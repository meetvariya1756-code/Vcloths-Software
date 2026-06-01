const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET all accounts
router.get('/', async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// POST new account
router.post('/', async (req, res) => {
  const { name, platform, is_active, notes } = req.body;
  if (!name || !platform) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const account = await prisma.account.create({
      data: {
        name,
        platform: platform.toLowerCase(),
        is_active: is_active !== undefined ? is_active : true,
        notes: notes || null
      }
    });
    res.status(201).json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// PUT update account
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, platform, is_active, notes } = req.body;

  try {
    const account = await prisma.account.update({
      where: { id: parseInt(id) },
      data: {
        name,
        platform: platform ? platform.toLowerCase() : undefined,
        is_active,
        notes
      }
    });
    res.json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// DELETE account
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.account.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// POST/PUT price override for account
router.put('/:id/prices', async (req, res) => {
  const { id } = req.params;
  const { product_id, price } = req.body; // price in paisa
  if (!product_id || price === undefined) {
    return res.status(400).json({ error: 'Product ID and price are required' });
  }

  try {
    const override = await prisma.accountPrice.upsert({
      where: {
        account_id_product_id: {
          account_id: parseInt(id),
          product_id: parseInt(product_id)
        }
      },
      update: { price: parseInt(price) },
      create: {
        account_id: parseInt(id),
        product_id: parseInt(product_id),
        price: parseInt(price)
      }
    });
    res.json(override);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save price override' });
  }
});

// GET single account summary and product list with pricing
router.get('/:id/summary', async (req, res) => {
  const { id } = req.params;
  try {
    const account = await prisma.account.findUnique({
      where: { id: parseInt(id) }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get today's sales and this month's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayStats = await prisma.salesRecord.aggregate({
      where: {
        account_id: parseInt(id),
        date: { gte: today }
      },
      _sum: { quantity: true, revenue: true }
    });

    const monthStats = await prisma.salesRecord.aggregate({
      where: {
        account_id: parseInt(id),
        date: { gte: firstDayOfMonth }
      },
      _sum: { quantity: true, revenue: true }
    });

    // Get all products and merge their main base price with account custom price
    const products = await prisma.product.findMany({
      include: {
        account_prices: {
          where: { account_id: parseInt(id) }
        }
      }
    });

    const productsWithPrices = products.map(p => {
      const customPriceObj = p.account_prices[0];
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        base_price: p.base_price, // in paisa
        custom_price: customPriceObj ? customPriceObj.price : null // in paisa or null
      };
    });

    // Product-wise sales breakdown for this account
    const salesRecords = await prisma.salesRecord.groupBy({
      by: ['product_id'],
      where: { account_id: parseInt(id) },
      _sum: { quantity: true, revenue: true }
    });

    const productSalesSummary = [];
    for (const record of salesRecords) {
      const prod = products.find(p => p.id === record.product_id);
      if (prod) {
        productSalesSummary.push({
          product_name: prod.name,
          quantity: record._sum.quantity || 0,
          revenue: Number(record._sum.revenue || 0)
        });
      }
    }

    res.json({
      account,
      stats: {
        today: {
          pieces: todayStats._sum.quantity || 0,
          revenue: Number(todayStats._sum.revenue || 0)
        },
        month: {
          pieces: monthStats._sum.quantity || 0,
          revenue: Number(monthStats._sum.revenue || 0)
        }
      },
      products: productsWithPrices,
      sales_breakdown: productSalesSummary
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch account summary' });
  }
});

module.exports = router;
