const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const { PrismaClient } = require('@prisma/client');
const { findBestSkuMapping } = require('../utils/skuMatcher');

const prisma = new PrismaClient();
const upload = multer({ dest: 'uploads/' });

const PDF_PARSER_URL = process.env.PDF_PARSER_URL || 'http://localhost:5001';

// Helper to extract the PC pieces quantity multiplier from SKU
function getPcNumber(sku) {
  if (!sku) return 1;
  const upper = sku.toUpperCase().trim();
  
  // 1. Match PC-X, PC_X, PCX
  const pcMatch = upper.match(/PC[-_]?(\d+)/i);
  if (pcMatch) {
    return parseInt(pcMatch[1]);
  }
  
  // 2. Match trailing dash/underscore number (e.g., MEN-WB-2 -> 2, KIDS-WB-BGY-1 -> 1)
  const trailingMatch = upper.match(/[-_](\d+)$/);
  if (trailingMatch) {
    return parseInt(trailingMatch[1]);
  }
  
  return 1;
}

// GET all import history
router.get('/', async (req, res) => {
  try {
    const imports = await prisma.pdfImport.findMany({
      include: { account: true },
      orderBy: { created_at: 'desc' }
    });
    res.json(imports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch imports history' });
  }
});

// POST Upload PDF
router.post('/upload', upload.single('file'), async (req, res) => {
  const { account_id, override_date } = req.body;
  if (!req.file || !account_id) {
    return res.status(400).json({ error: 'File and Account ID are required' });
  }

  const accountId = parseInt(account_id);
  const filename = req.file.originalname;

  try {
    // 1. Check if already imported
    const existing = await prisma.pdfImport.findUnique({
      where: {
        filename_account_id: {
          filename,
          account_id: accountId
        }
      }
    });

    if (existing && existing.status === 'done') {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'This file has already been imported for this account.' });
    }

    // 2. Create/Upsert PDF import with 'processing' status
    const pdfImport = await prisma.pdfImport.upsert({
      where: {
        filename_account_id: {
          filename,
          account_id: accountId
        }
      },
      update: { status: 'processing', records_extracted: 0 },
      create: {
        filename,
        account_id: accountId,
        status: 'processing'
      }
    });

    // 3. Send file to Python parser microservice
    const form = new FormData();
    form.append('file', fs.createReadStream(req.file.path), filename);

    const parserResponse = await axios.post(`${PDF_PARSER_URL}/parse`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const parsedRecords = parserResponse.data.records || [];

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Check for duplicate PDF upload by looking up unique order IDs in database
    const orderIds = parsedRecords.map(r => r.order_id).filter(id => id && !id.startsWith('MOCK-'));
    if (orderIds.length > 0) {
      const duplicateRecord = await prisma.salesRecord.findFirst({
        where: {
          order_id: { in: orderIds }
        }
      });
      if (duplicateRecord) {
        // Update the import record to error/done or delete it, but return 400 immediately
        await prisma.pdfImport.delete({
          where: { id: pdfImport.id }
        });
        return res.status(400).json({ error: 'This PDF has already been added.' });
      }
    }

    // 4. Resolve SKU Mappings
    const resolvedRecords = [];
    const unmappedSkus = new Set();
    const finalDate = override_date ? new Date(override_date).toISOString() : null;

    for (const r of parsedRecords) {
      const recordDate = finalDate || r.date;
      const mapping = await findBestSkuMapping(prisma, r.raw_sku);
      if (mapping) {
        // Fetch custom account price if exists, otherwise base product price
        const accountPrice = await prisma.accountPrice.findUnique({
          where: {
            account_id_product_id: {
              account_id: accountId,
              product_id: mapping.product_id
            }
          }
        });

        const price = accountPrice ? accountPrice.price : mapping.product.base_price;
        
        const orderQtyFromPdf = r.quantity ? parseInt(r.quantity) : 1;
        const parsedPcNumber = getPcNumber(r.raw_sku);
        const pcMultiplier = mapping.quantity > 1 ? mapping.quantity : parsedPcNumber;
        
        const totalPieces = orderQtyFromPdf * pcMultiplier;
        const revenue = totalPieces * price;

        resolvedRecords.push({
          raw_sku: r.raw_sku,
          size: r.size || mapping.size_variant || '',
          color: r.color || mapping.color_variant || '',
          mapped_product_id: mapping.product_id,
          mapped_product_name: mapping.product.name,
          quantity: totalPieces,
          labels_per_unit: 1,
          labels_total: orderQtyFromPdf,
          price,
          revenue,
          date: recordDate,
          order_id: r.order_id,
          mapped: true
        });
      } else {
        unmappedSkus.add(r.raw_sku);
        
        const orderQtyFromPdf = r.quantity ? parseInt(r.quantity) : 1;
        const parsedPcNumber = getPcNumber(r.raw_sku);
        const totalPieces = orderQtyFromPdf * parsedPcNumber;

        resolvedRecords.push({
          raw_sku: r.raw_sku,
          size: r.size || '',
          color: r.color || '',
          mapped_product_id: null,
          mapped_product_name: 'UNMAPPED',
          quantity: totalPieces,
          labels_per_unit: 1,
          labels_total: orderQtyFromPdf,
          price: 0,
          revenue: 0,
          date: recordDate,
          order_id: r.order_id,
          mapped: false
        });
      }
    }

    // If all SKUs matched successfully, automatically confirm and save the import!
    if (unmappedSkus.size === 0) {
      const salesData = resolvedRecords.map(r => ({
        date: new Date(r.date),
        account_id: accountId,
        product_id: parseInt(r.mapped_product_id),
        marketplace_sku: r.raw_sku,
        quantity: parseInt(r.quantity),
        labels_total: parseInt(r.labels_total),
        revenue: BigInt(r.revenue),
        source_pdf_name: filename,
        order_id: r.order_id
      }));

      await prisma.$transaction(async (tx) => {
        // Delete any existing sales records for this file and account first (to prevent duplicates!)
        await tx.salesRecord.deleteMany({
          where: {
            source_pdf_name: filename,
            account_id: accountId
          }
        });

        // Create sales records
        await tx.salesRecord.createMany({
          data: salesData
        });

        // Update import status to 'done'
        await tx.pdfImport.update({
          where: { id: pdfImport.id },
          data: {
            status: 'done',
            records_extracted: salesData.length
          }
        });
      });

      res.json({
        importId: pdfImport.id,
        filename,
        hasUnmapped: false,
        unmappedSkus: [],
        records: resolvedRecords,
        autoConfirmed: true
      });
    } else {
      // If there are unmapped SKUs, update import state to 'queued'
      await prisma.pdfImport.update({
        where: { id: pdfImport.id },
        data: {
          records_extracted: resolvedRecords.length,
          status: 'queued'
        }
      });

      res.json({
        importId: pdfImport.id,
        filename,
        hasUnmapped: true,
        unmappedSkus: Array.from(unmappedSkus),
        records: resolvedRecords,
        autoConfirmed: false
      });
    }

  } catch (err) {
    console.error(err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to process PDF import: ' + err.message });
  }
});

// POST Confirm PDF Import (Save resolved records to sales_records)
router.post('/:id/confirm', async (req, res) => {
  const { id } = req.params;
  const { records } = req.body; // Array of resolved records from frontend

  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Records are required for confirmation' });
  }

  try {
    const pdfImport = await prisma.pdfImport.findUnique({
      where: { id: parseInt(id) }
    });

    if (!pdfImport) {
      return res.status(404).json({ error: 'Import session not found' });
    }

    if (pdfImport.status === 'done') {
      return res.json({ success: true, message: 'This import has already been confirmed and saved.', count: records.length });
    }

    // Double check that everything is mapped
    const unmapped = records.find(r => !r.mapped_product_id);
    if (unmapped) {
      return res.status(400).json({ error: 'Cannot confirm import with unmapped SKUs. Please map them first.' });
    }

    // Save sales records
    const salesData = records.map(r => ({
      date: new Date(r.date),
      account_id: pdfImport.account_id,
      product_id: parseInt(r.mapped_product_id),
      marketplace_sku: r.raw_sku,
      quantity: parseInt(r.quantity),
      labels_total: parseInt(r.labels_total),
      revenue: BigInt(r.revenue),
      source_pdf_name: pdfImport.filename,
      order_id: r.order_id
    }));

    await prisma.$transaction(async (tx) => {
      // Delete any existing sales records for this file and account first (failsafe!)
      await tx.salesRecord.deleteMany({
        where: {
          source_pdf_name: pdfImport.filename,
          account_id: pdfImport.account_id
        }
      });

      // Create sales records
      await tx.salesRecord.createMany({
        data: salesData
      });

      // Update import status to 'done'
      await tx.pdfImport.update({
        where: { id: pdfImport.id },
        data: {
          status: 'done',
          records_extracted: salesData.length
        }
      });
    });

    res.json({ success: true, count: salesData.length });

  } catch (err) {
    console.error(err);
    await prisma.pdfImport.update({
      where: { id: parseInt(id) },
      data: { status: 'error' }
    });
    res.status(500).json({ error: 'Failed to confirm and save records: ' + err.message });
  }
});

// DELETE an import record and its associated sales records
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pdfImport = await prisma.pdfImport.findUnique({
      where: { id: parseInt(id) }
    });

    if (pdfImport) {
      await prisma.$transaction([
        // Delete all sales records associated with this import file and account
        prisma.salesRecord.deleteMany({
          where: {
            source_pdf_name: pdfImport.filename,
            account_id: pdfImport.account_id
          }
        }),
        // Delete the import session record itself
        prisma.pdfImport.delete({
          where: { id: parseInt(id) }
        })
      ]);
    }

    res.json({ success: true, message: 'Import and all associated sales records deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete import: ' + err.message });
  }
});

module.exports = router;
