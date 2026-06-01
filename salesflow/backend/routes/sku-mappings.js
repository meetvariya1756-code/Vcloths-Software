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

module.exports = router;
