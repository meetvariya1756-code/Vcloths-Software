const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET all mappings
router.get('/', async (req, res) => {
  try {
    const mappings = await prisma.skuMapping.findMany({
      include: { product: true },
      orderBy: { id: 'desc' }
    });
    res.json(mappings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch SKU mappings' });
  }
});

// POST new mapping
router.post('/', async (req, res) => {
  const { marketplace_sku, product_id, color_variant, size_variant, platform } = req.body;
  if (!marketplace_sku || !product_id || !platform) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const mapping = await prisma.skuMapping.create({
      data: {
        marketplace_sku: marketplace_sku.trim(),
        product_id: parseInt(product_id),
        color_variant: color_variant || null,
        size_variant: size_variant || null,
        platform: platform.toLowerCase()
      },
      include: { product: true }
    });
    res.status(201).json(mapping);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Marketplace SKU mapping already exists' });
    }
    res.status(500).json({ error: 'Failed to create mapping' });
  }
});

// PUT update mapping
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { marketplace_sku, product_id, color_variant, size_variant, platform } = req.body;

  try {
    const existing = await prisma.skuMapping.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'SKU mapping not found' });
    }

    const updated = await prisma.skuMapping.update({
      where: { id: parseInt(id) },
      data: {
        marketplace_sku: marketplace_sku !== undefined ? marketplace_sku.trim() : undefined,
        product_id: product_id !== undefined ? parseInt(product_id) : undefined,
        color_variant: color_variant !== undefined ? color_variant : undefined,
        size_variant: size_variant !== undefined ? size_variant : undefined,
        platform: platform !== undefined ? platform.toLowerCase() : undefined
      },
      include: { product: true }
    });

    // Synchronize the linked ImportedSku records if any exist
    await prisma.importedSku.updateMany({
      where: { marketplace_sku: existing.marketplace_sku },
      data: {
        product_id: product_id !== undefined ? parseInt(product_id) : undefined,
        color_variant: color_variant !== undefined ? color_variant : undefined,
        size_variant: size_variant !== undefined ? size_variant : undefined
      }
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Marketplace SKU mapping already exists' });
    }
    res.status(500).json({ error: 'Failed to update mapping' });
  }
});

// DELETE mapping
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.skuMapping.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Mapping deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

// POST bulk CSV import mappings
router.post('/bulk', async (req, res) => {
  const { csvText } = req.body;
  if (!csvText) {
    return res.status(400).json({ error: 'CSV data is required' });
  }

  try {
    // CSV format: marketplace_sku, product_name_or_id, color_variant, size_variant, platform
    const lines = csvText.split('\n');
    let importedCount = 0;
    let errorCount = 0;

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('marketplace_sku')) continue; // Skip header

      const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 3) {
        errorCount++;
        continue;
      }

      const [marketplace_sku, product_id_or_name, color, size, platform] = cols;

      // Find product by id or name
      let product = null;
      if (!isNaN(product_id_or_name)) {
        product = await prisma.product.findUnique({ where: { id: parseInt(product_id_or_name) } });
      } else {
        product = await prisma.product.findFirst({
          where: { name: { equals: product_id_or_name, mode: 'insensitive' } }
        });
      }

      if (!product) {
        errorCount++;
        continue;
      }

      try {
        await prisma.skuMapping.upsert({
          where: { marketplace_sku },
          update: {
            product_id: product.id,
            color_variant: color || null,
            size_variant: size || null,
            platform: (platform || 'meesho').toLowerCase()
          },
          create: {
            marketplace_sku,
            product_id: product.id,
            color_variant: color || null,
            size_variant: size || null,
            platform: (platform || 'meesho').toLowerCase()
          }
        });
        importedCount++;
      } catch (e) {
        console.error(e);
        errorCount++;
      }
    }

    res.json({ success: true, importedCount, errorCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process bulk import' });
  }
});

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const ExcelJS = require('exceljs');
const fs = require('fs');

// POST Upload Excel Master SKU Mapping
router.post('/upload-excel', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Excel file is required' });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    
    // Find the first worksheet
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'No worksheet found in Excel' });
    }

    const getCellValue = (cell, preserveCase = false) => {
      if (!cell) return '';
      const val = cell.value;
      if (val === null || val === undefined) return '';
      
      let str = '';
      if (typeof val === 'string' || typeof val === 'number') {
        str = val.toString().trim();
      } else if (val.richText && Array.isArray(val.richText)) {
        str = val.richText.map(t => t.text || '').join('').trim();
      } else if (val.result !== undefined && val.result !== null) {
        str = val.result.toString().trim();
      } else if (val.text !== undefined && val.text !== null) {
        str = val.text.toString().trim();
      } else {
        str = val.toString().trim();
      }

      return preserveCase ? str : str.toLowerCase();
    };

    const cleanStr = (str) => {
      if (typeof str !== 'string') return '';
      return str.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    let bestHeaderRowIndex = 1;
    let maxMatchCount = 0;
    let headers = [];

    // Scan first 10 rows for the best header row candidate
    for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
      const row = worksheet.getRow(r);
      const tempHeaders = [];
      let matchCount = 0;

      row.eachCell((cell, colNumber) => {
        const rawVal = getCellValue(cell, false);
        tempHeaders[colNumber] = rawVal;

        const cleanVal = cleanStr(rawVal);
        const skuSynonyms = ['skucode', 'sku', 'itemcode', 'productid', 'styleid', 'skuid', 'stylecode'];
        const nameSynonyms = ['productname', 'product', 'producttitle', 'title', 'itemname', 'description'];
        
        if (skuSynonyms.some(s => cleanVal.includes(s)) || nameSynonyms.some(s => cleanVal.includes(s))) {
          matchCount++;
        }
      });

      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        bestHeaderRowIndex = r;
        headers = tempHeaders;
      }
    }

    // Fallback if no matching row found
    if (maxMatchCount === 0) {
      bestHeaderRowIndex = 1;
      const row = worksheet.getRow(1);
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = getCellValue(cell, false);
      });
    }

    const getColIndex = (names) => {
      return headers.findIndex(h => {
        if (!h) return false;
        const cleanH = cleanStr(h);
        return names.some(name => cleanH.includes(name));
      });
    };

    const skuIdx = getColIndex(['skucode', 'sku', 'itemcode', 'productid', 'styleid', 'skuid', 'stylecode']);
    const productNameIdx = getColIndex(['productname', 'product', 'producttitle', 'title', 'itemname', 'description']);
    const qtyIdx = getColIndex(['quantity', 'qty', 'pieces', 'pcs']);
    const colorIdx = getColIndex(['color', 'colour']);
    const sizeIdx = getColIndex(['size']);
    const platformIdx = getColIndex(['platform', 'channel']);

    // Check mandatory columns presence in header
    const missingColumns = [];
    if (skuIdx === -1) missingColumns.push('SKU Code');
    if (productNameIdx === -1) missingColumns.push('Product Title');
    if (qtyIdx === -1) missingColumns.push('Quantity');
    if (colorIdx === -1) missingColumns.push('Color');
    if (sizeIdx === -1) missingColumns.push('Size');

    if (missingColumns.length > 0) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: `Missing required columns. Please ensure your Excel contains the following headers: ${missingColumns.join(', ')}.`
      });
    }

    let parsedCount = 0;
    let skippedCount = 0;
    const errors = [];
    const mappingsResult = [];

    // Loop through rows (starting from bestHeaderRowIndex + 1)
    for (let r = bestHeaderRowIndex + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const marketplace_sku = getCellValue(row.getCell(skuIdx), true).trim();
      const productName = getCellValue(row.getCell(productNameIdx), true).trim();
      const color = getCellValue(row.getCell(colorIdx), true).trim();
      const size = getCellValue(row.getCell(sizeIdx), true).trim();
      const qVal = getCellValue(row.getCell(qtyIdx), false);
      const rawPlatform = platformIdx !== -1 ? getCellValue(row.getCell(platformIdx), true).trim() || 'meesho' : 'meesho';
      const platform = rawPlatform.toLowerCase();

      // If the entire row is completely empty, we can skip it.
      if (!marketplace_sku && !productName && !color && !size && !qVal) {
        skippedCount++;
        continue;
      }

      // Validate mandatory fields
      const missingFields = [];
      if (!marketplace_sku) missingFields.push('SKU');
      if (!productName) missingFields.push('Product Title');
      if (!color) missingFields.push('Color');
      if (!size) missingFields.push('Size');

      let quantity = 0;
      if (!qVal) {
        missingFields.push('Quantity');
      } else {
        const parsedQty = parseInt(qVal);
        if (isNaN(parsedQty) || parsedQty <= 0) {
          missingFields.push('Valid Quantity (> 0)');
        } else {
          quantity = parsedQty;
        }
      }

      if (missingFields.length > 0) {
        errors.push({
          row: r,
          sku: marketplace_sku || 'N/A',
          error: `Missing mandatory values: ${missingFields.join(', ')}`
        });
        continue;
      }

      try {
        // Find or dynamically create product
        let product = await prisma.product.findFirst({
          where: { name: { equals: productName, mode: 'insensitive' } }
        });

        if (!product) {
          // Determine price/category/labels by matching some simple patterns
          let category = 'General';
          let base_price = 11000; // default ₹110
          let labels_per_unit = 1;

          const nameLower = productName.toLowerCase();
          if (nameLower.includes('short') || nameLower.includes('sh-') || nameLower.includes('sort')) {
            category = 'Shorts';
            base_price = 8000; // default ₹80
            labels_per_unit = 4;
            if (nameLower.includes('strip')) {
              base_price = 13000; // Stripe Shorts
            } else if (nameLower.includes('cord')) {
              base_price = 16000; // Cord Shorts
            }
          } else if (nameLower.includes('track') || nameLower.includes('pants')) {
            category = 'Track';
            base_price = 10500; // default ₹105
            labels_per_unit = 4;
            if (nameLower.includes('ziper') || nameLower.includes('zipper')) {
              base_price = 17500;
            } else if (nameLower.includes('3-patti') || nameLower.includes('patti')) {
              base_price = 13000;
            } else if (nameLower.includes('kids')) {
              base_price = 10500;
              labels_per_unit = 2;
            }
          } else if (nameLower.includes('barfi') || nameLower.includes('burfi')) {
            category = 'Barfi';
            base_price = 11000;
            labels_per_unit = nameLower.includes('kids') ? 2 : 4;
          } else if (nameLower.includes('ladies') || nameLower.includes('lds')) {
            category = 'Ladies';
            base_price = 16500;
            labels_per_unit = 4;
          } else if (nameLower.includes('men')) {
            category = 'Men';
            base_price = 16500;
            labels_per_unit = 60;
          } else if (nameLower.includes('kids')) {
            category = 'Kids';
            base_price = 16000;
            labels_per_unit = 2;
          }

          product = await prisma.product.create({
            data: {
              name: productName,
              category,
              base_price,
              labels_per_unit
            }
          });
        }

        // Upsert SKU Mapping
        const mapping = await prisma.skuMapping.upsert({
          where: { marketplace_sku },
          update: {
            product_id: product.id,
            color_variant: color,
            size_variant: size,
            platform,
            quantity
          },
          create: {
            marketplace_sku,
            product_id: product.id,
            color_variant: color,
            size_variant: size,
            platform,
            quantity
          },
          include: { product: true }
        });

        parsedCount++;
        mappingsResult.push({
          id: mapping.id,
          marketplace_sku: mapping.marketplace_sku,
          product_name: product.name,
          quantity: mapping.quantity,
          color_variant: mapping.color_variant,
          size_variant: mapping.size_variant,
          platform: mapping.platform
        });

      } catch (err) {
        console.error(err);
        errors.push({ row: r, sku: marketplace_sku, error: err.message });
      }
    }

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.json({
      success: true,
      parsedCount,
      skippedCount,
      errors,
      mappings: mappingsResult
    });

  } catch (err) {
    console.error(err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to process Excel upload: ' + err.message });
  }
});

module.exports = router;
