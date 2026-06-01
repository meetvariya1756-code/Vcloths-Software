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
  const match = sku.match(/PC[-_]?(\d+)/i);
  if (match) {
    return parseInt(match[1]);
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
        const labels_total = 1; // 1 page/label per record
        const quantity = getPcNumber(r.raw_sku); // e.g. 2 pieces for PC-2
        const revenue = quantity * price; // pieces sold multiplied by price per piece

        resolvedRecords.push({
          raw_sku: r.raw_sku,
          size: r.size || '',
          color: r.color || '',
          mapped_product_id: mapping.product_id,
          mapped_product_name: mapping.product.name,
          quantity: quantity, // e.g. 2
          labels_per_unit: 1,
          labels_total: 1,
          price, // in paisa
          revenue, // in paisa
          date: recordDate,
          order_id: r.order_id,
          mapped: true
        });
      } else {
        unmappedSkus.add(r.raw_sku);
        resolvedRecords.push({
          raw_sku: r.raw_sku,
          size: r.size || '',
          color: r.color || '',
          mapped_product_id: null,
          mapped_product_name: 'UNMAPPED',
          quantity: getPcNumber(r.raw_sku),
          labels_per_unit: 1,
          labels_total: 1,
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
        source_pdf_name: filename
      }));

      await prisma.$transaction(async (tx) => {
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
      source_pdf_name: pdfImport.filename
    }));

    await prisma.$transaction(async (tx) => {
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
    await prisma.pdfImport.delete({
      where: { id: parseInt(id) }
    });
    res.json({ success: true, message: 'Import deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete import: ' + err.message });
  }
});

module.exports = router;
