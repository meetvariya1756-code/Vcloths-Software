const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET all products with count of sku mappings
router.get('/', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        _count: {
          select: { sku_mappings: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET single product details including stats and mappings
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        sku_mappings: true,
        account_prices: {
          include: { account: true }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get today's stats and this month's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const salesToday = await prisma.salesRecord.aggregate({
      where: {
        product_id: parseInt(id),
        date: { gte: today }
      },
      _sum: { quantity: true, revenue: true }
    });

    const salesMonth = await prisma.salesRecord.aggregate({
      where: {
        product_id: parseInt(id),
        date: { gte: firstDayOfMonth }
      },
      _sum: { quantity: true, revenue: true }
    });

    // Sales breakdown for stats aggregation
    const salesBreakdown = await prisma.salesRecord.findMany({
      where: { product_id: parseInt(id) }
    });

    const accountStats = {};

    for (const record of salesBreakdown) {
      // Account stats
      const accId = record.account_id;
      if (!accountStats[accId]) {
        const acc = await prisma.account.findUnique({ where: { id: accId } });
        accountStats[accId] = { name: acc?.name || 'Unknown', quantity: 0, revenue: 0 };
      }
      accountStats[accId].quantity += record.quantity;
      accountStats[accId].revenue += Number(record.revenue);
    }

    res.json({
      product,
      stats: {
        today: {
          quantity: salesToday._sum.quantity || 0,
          revenue: Number(salesToday._sum.revenue || 0)
        },
        month: {
          quantity: salesMonth._sum.quantity || 0,
          revenue: Number(salesMonth._sum.revenue || 0)
        },
        colors: [],
        accounts: Object.values(accountStats)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});

// POST create product
router.post('/', async (req, res) => {
  const { name, category, labels_per_unit, base_price } = req.body;
  if (!name || !category || labels_per_unit === undefined || base_price === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const product = await prisma.product.create({
      data: {
        name,
        category,
        labels_per_unit: parseInt(labels_per_unit),
        base_price: parseInt(base_price) // in paisa
      }
    });
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT update product
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, labels_per_unit, base_price } = req.body;

  try {
    const product = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        name,
        category,
        labels_per_unit: labels_per_unit !== undefined ? parseInt(labels_per_unit) : undefined,
        base_price: base_price !== undefined ? parseInt(base_price) : undefined
      }
    });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE product
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.product.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
