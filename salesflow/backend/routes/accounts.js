const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { scrapeMeeshoCatalog } = require('../meesho-scraper');

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

// GET all imported SKUs for an account
router.get('/:id/imported-skus', async (req, res) => {
  const { id } = req.params;
  try {
    const skus = await prisma.importedSku.findMany({
      where: { account_id: parseInt(id) },
      include: { product: true },
      orderBy: { marketplace_sku: 'asc' }
    });
    res.json(skus);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch imported SKUs' });
  }
});

// POST sync Meesho account catalog — real Puppeteer-based scraper
router.post('/:id/meesho-sync', async (req, res) => {
  const { id } = req.params;
  const { meesho_id, password } = req.body;

  try {
    let account = await prisma.account.findUnique({
      where: { id: parseInt(id) }
    });
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // ── Credentials Lock and Validate ────────────────────────────────────────
    const hasLocked = !!(account.meesho_username && account.meesho_password);
    let activeId = meesho_id?.trim();
    let activePassword = password?.trim();

    if (!activeId || !activePassword) {
      if (hasLocked) {
        activeId = account.meesho_username;
        activePassword = account.meesho_password;
      } else {
        return res.status(400).json({ error: 'Meesho ID and password are required' });
      }
    } else {
      if (hasLocked) {
        if (account.meesho_username !== activeId || account.meesho_password !== activePassword) {
          return res.status(400).json({
            error: 'Invalid Meesho Supplier credentials. The entered ID or Password does not match the credentials locked to this account.'
          });
        }
      }
    }

    // ── Real Puppeteer Scraper ────────────────────────────────────────────────
    // Track progress steps to send in final response
    const progressLog = [];
    const onStep = (step, msg) => {
      console.log(`[Meesho Scraper] Step ${step}: ${msg}`);
      progressLog.push({ step, msg });
    };

    let rawSkus;
    try {
      rawSkus = await scrapeMeeshoCatalog({
        meeshoId: activeId,
        password: activePassword,
        accountName: account.name,
        onStep
      });
    } catch (scraperErr) {
      console.error('[Meesho Scraper] Error:', scraperErr.message);
      // Return a structured error the frontend can display nicely
      return res.status(422).json({
        error: scraperErr.message,
        hint: 'Make sure your Meesho Supplier Panel credentials are correct and that supplier.meesho.com is accessible.',
        progress: progressLog
      });
    }

    if (!rawSkus || rawSkus.length === 0) {
      return res.status(422).json({
        error: 'No catalogs found in your Meesho Supplier Panel. Make sure you have active listings.',
        progress: progressLog
      });
    }

    // On successful sync, lock/save the credentials in the database if not already done
    if (!hasLocked) {
      account = await prisma.account.update({
        where: { id: parseInt(id) },
        data: {
          meesho_username: activeId,
          meesho_password: activePassword
        }
      });
    }

    // ── Upsert into database ─────────────────────────────────────────────────
    const imported = [];
    for (const sku of rawSkus) {
      const item = await prisma.importedSku.upsert({
        where: { marketplace_sku: sku.marketplace_sku },
        update: {
          account_id: parseInt(id),
          title: sku.title || null,
          color_variant: sku.color_variant || null,
          size_variant: sku.size_variant || null
        },
        create: {
          account_id: parseInt(id),
          marketplace_sku: sku.marketplace_sku,
          title: sku.title || null,
          color_variant: sku.color_variant || null,
          size_variant: sku.size_variant || null
        }
      });
      imported.push(item);
    }

    res.json({
      success: true,
      count: imported.length,
      skus: imported,
      progress: progressLog
    });

  } catch (err) {
    console.error('[Meesho Sync Route] Error:', err);
    res.status(500).json({ error: 'Failed to sync Meesho catalog: ' + err.message });
  }
});

// PUT map imported SKU to a Master Product model
router.put('/:id/imported-skus/:skuId/map', async (req, res) => {
  const { skuId } = req.params;
  const { product_id, color_variant, size_variant } = req.body;
  if (!product_id) {
    return res.status(400).json({ error: 'Product ID is required to map SKU' });
  }

  try {
    // 1. Update ImportedSku in db
    const imported = await prisma.importedSku.update({
      where: { id: parseInt(skuId) },
      data: {
        product_id: parseInt(product_id),
        color_variant: color_variant || null,
        size_variant: size_variant || null
      },
      include: { product: true }
    });

    // 2. Synchronize main SkuMapping for PDF parsing engine
    await prisma.skuMapping.upsert({
      where: { marketplace_sku: imported.marketplace_sku },
      update: {
        product_id: parseInt(product_id),
        color_variant: color_variant || null,
        size_variant: size_variant || null,
        platform: 'meesho'
      },
      create: {
        marketplace_sku: imported.marketplace_sku,
        product_id: parseInt(product_id),
        color_variant: color_variant || null,
        size_variant: size_variant || null,
        platform: 'meesho'
      }
    });

    res.json(imported);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to map SKU: ' + err.message });
  }
});

// POST reset credentials for a Meesho account
router.post('/:id/meesho-reset', async (req, res) => {
  const { id } = req.params;
  try {
    const account = await prisma.account.update({
      where: { id: parseInt(id) },
      data: {
        meesho_username: null,
        meesho_password: null
      }
    });
    res.json({ success: true, message: 'Meesho credentials reset successfully for this account.', account });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset credentials: ' + err.message });
  }
});

module.exports = router;
