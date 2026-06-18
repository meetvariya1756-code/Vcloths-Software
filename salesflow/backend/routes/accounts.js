const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { scrapeMeeshoCatalog } = require('../meesho-scraper');
const { scrapeFlipkartCatalog } = require('../flipkart-scraper');

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

// ── Background Auto-Sync Helper ──────────────────────────────────────────────
async function triggerBackgroundSync(accountId) {
  setTimeout(async () => {
    try {
      const account = await prisma.account.findUnique({
        where: { id: accountId }
      });

      if (!account || account.platform !== 'meesho') return;
      if (!account.meesho_username || !account.meesho_password) return;

      // Set status to syncing and clear any old error
      await prisma.account.update({
        where: { id: accountId },
        data: {
          meesho_sync_status: 'syncing',
          meesho_sync_error: null
        }
      });

      console.log(`[Background Sync] Starting scraper for account "${account.name}" (ID: ${account.id})`);

      const progressLog = [];
      const onStep = (step, msg) => {
        console.log(`[Background Sync][${account.name}] Step ${step}: ${msg}`);
        progressLog.push({ step, msg });
      };

      const rawSkus = await scrapeMeeshoCatalog({
        meeshoId: account.meesho_username,
        password: account.meesho_password,
        accountName: account.name,
        onStep
      });

      if (!rawSkus || rawSkus.length === 0) {
        throw new Error('No catalogs found in Meesho Supplier Panel. Verify active listings exist.');
      }

      // Upsert into database using account-scoped composite unique index
      for (const sku of rawSkus) {
        await prisma.importedSku.upsert({
          where: {
            account_id_marketplace_sku: {
              account_id: account.id,
              marketplace_sku: sku.marketplace_sku
            }
          },
          update: {
            title: sku.title || null,
            color_variant: sku.color_variant || null,
            size_variant: sku.size_variant || null,
            catalog_id: sku.catalog_id || null,
            catalog_name: sku.catalog_name || null,
            style_id: sku.style_id || null,
            image_url: sku.image_url || null,
            price: sku.price || null,
            inventory: sku.inventory !== null && sku.inventory !== undefined ? Number(sku.inventory) : null,
            status: sku.status || null
          },
          create: {
            account_id: account.id,
            marketplace_sku: sku.marketplace_sku,
            title: sku.title || null,
            color_variant: sku.color_variant || null,
            size_variant: sku.size_variant || null,
            catalog_id: sku.catalog_id || null,
            catalog_name: sku.catalog_name || null,
            style_id: sku.style_id || null,
            image_url: sku.image_url || null,
            price: sku.price || null,
            inventory: sku.inventory !== null && sku.inventory !== undefined ? Number(sku.inventory) : null,
            status: sku.status || null
          }
        });
      }

      // Set status to success
      await prisma.account.update({
        where: { id: accountId },
        data: {
          meesho_sync_status: 'success',
          meesho_last_sync: new Date(),
          meesho_sync_error: null
        }
      });
      console.log(`[Background Sync] Completed successfully for "${account.name}"`);

    } catch (err) {
      console.error(`[Background Sync] Error for account ID ${accountId}:`, err);
      await prisma.account.update({
        where: { id: accountId },
        data: {
          meesho_sync_status: 'failed',
          meesho_sync_error: err.message
        }
      });
    }
  }, 0);
}

// ── Flipkart Background Auto-Sync Helper ──────────────────────────────────────────
async function triggerFlipkartBackgroundSync(accountId) {
  setTimeout(async () => {
    try {
      const account = await prisma.account.findUnique({
        where: { id: accountId }
      });

      if (!account || account.platform !== 'flipkart') return;
      if (!account.flipkart_username || !account.flipkart_password) return;

      // Set status to syncing and clear any old error
      await prisma.account.update({
        where: { id: accountId },
        data: {
          flipkart_sync_status: 'syncing',
          flipkart_sync_error: null
        }
      });

      console.log(`[Background Sync] Starting Flipkart scraper for account "${account.name}" (ID: ${account.id})`);

      const progressLog = [];
      const onStep = (step, msg) => {
        console.log(`[Background Sync][${account.name}] Step ${step}: ${msg}`);
        progressLog.push({ step, msg });
      };

      const rawSkus = await scrapeFlipkartCatalog({
        flipkartId: account.flipkart_username,
        password: account.flipkart_password,
        accountName: account.name,
        onStep
      });

      if (!rawSkus || rawSkus.length === 0) {
        throw new Error('No catalogs found in Flipkart Seller Panel. Verify active listings exist.');
      }

      // Upsert into database using account-scoped composite unique index
      for (const sku of rawSkus) {
        await prisma.importedSku.upsert({
          where: {
            account_id_marketplace_sku: {
              account_id: account.id,
              marketplace_sku: sku.marketplace_sku
            }
          },
          update: {
            title: sku.title || null,
            color_variant: sku.color_variant || null,
            size_variant: sku.size_variant || null,
            catalog_id: sku.catalog_id || null,
            catalog_name: sku.catalog_name || null,
            style_id: sku.style_id || null,
            image_url: sku.image_url || null,
            price: sku.price || null,
            inventory: sku.inventory !== null && sku.inventory !== undefined ? Number(sku.inventory) : null,
            status: sku.status || null
          },
          create: {
            account_id: account.id,
            marketplace_sku: sku.marketplace_sku,
            title: sku.title || null,
            color_variant: sku.color_variant || null,
            size_variant: sku.size_variant || null,
            catalog_id: sku.catalog_id || null,
            catalog_name: sku.catalog_name || null,
            style_id: sku.style_id || null,
            image_url: sku.image_url || null,
            price: sku.price || null,
            inventory: sku.inventory !== null && sku.inventory !== undefined ? Number(sku.inventory) : null,
            status: sku.status || null
          }
        });
      }

      // Set status to success
      await prisma.account.update({
        where: { id: accountId },
        data: {
          flipkart_sync_status: 'success',
          flipkart_last_sync: new Date(),
          flipkart_sync_error: null
        }
      });
      console.log(`[Background Sync] Flipkart completed successfully for "${account.name}"`);

    } catch (err) {
      console.error(`[Background Sync] Flipkart Error for account ID ${accountId}:`, err);
      await prisma.account.update({
        where: { id: accountId },
        data: {
          flipkart_sync_status: 'failed',
          flipkart_sync_error: err.message
        }
      });
    }
  }, 0);
}


// ── Scheduled Auto-Sync Cron ──────────────────────────────────────────────────
const syncAllAccounts = async () => {
  try {
    const meeshoAccounts = await prisma.account.findMany({
      where: {
        platform: 'meesho',
        is_active: true,
        meesho_username: { not: null },
        meesho_password: { not: null }
      }
    });

    console.log(`[Auto-Sync Cron] Found ${meeshoAccounts.length} active Meesho accounts to synchronize.`);
    for (const acc of meeshoAccounts) {
      triggerBackgroundSync(acc.id);
    }

    const flipkartAccounts = await prisma.account.findMany({
      where: {
        platform: 'flipkart',
        is_active: true,
        flipkart_username: { not: null },
        flipkart_password: { not: null }
      }
    });

    console.log(`[Auto-Sync Cron] Found ${flipkartAccounts.length} active Flipkart accounts to synchronize.`);
    for (const acc of flipkartAccounts) {
      triggerFlipkartBackgroundSync(acc.id);
    }
  } catch (err) {
    console.error('[Auto-Sync Cron] Error finding accounts:', err);
  }
};

// Auto-sync accounts 2 minutes after startup, then every 6 hours
setTimeout(() => {
  console.log('[Auto-Sync Cron] Running initial startup synchronization...');
  syncAllAccounts();
}, 2 * 60 * 1000);

setInterval(() => {
  console.log('[Auto-Sync Cron] Running scheduled synchronization...');
  syncAllAccounts();
}, 6 * 60 * 60 * 1000);

// POST new account
router.post('/', async (req, res) => {
  const { name, platform, is_active, notes, meesho_supplier_id, meesho_username, meesho_password, flipkart_supplier_id, flipkart_username, flipkart_password } = req.body;
  if (!name || !platform) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const isMeesho = platform.toLowerCase() === 'meesho';
    const isFlipkart = platform.toLowerCase() === 'flipkart';
    const account = await prisma.account.create({
      data: {
        name,
        platform: platform.toLowerCase(),
        is_active: is_active !== undefined ? is_active : true,
        notes: notes || null,
        meesho_supplier_id: isMeesho ? meesho_supplier_id || null : null,
        meesho_username: isMeesho ? meesho_username || null : null,
        meesho_password: isMeesho ? meesho_password || null : null,
        meesho_sync_status: isMeesho && meesho_username && meesho_password ? 'pending' : null,
        flipkart_supplier_id: isFlipkart ? flipkart_supplier_id || null : null,
        flipkart_username: isFlipkart ? flipkart_username || null : null,
        flipkart_password: isFlipkart ? flipkart_password || null : null,
        flipkart_sync_status: isFlipkart && flipkart_username && flipkart_password ? 'pending' : null
      }
    });

    if (isMeesho && account.meesho_username && account.meesho_password) {
      triggerBackgroundSync(account.id);
    }
    if (isFlipkart && account.flipkart_username && account.flipkart_password) {
      triggerFlipkartBackgroundSync(account.id);
    }

    res.status(201).json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// PUT update account
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, platform, is_active, notes, meesho_supplier_id, meesho_username, meesho_password, flipkart_supplier_id, flipkart_username, flipkart_password } = req.body;

  try {
    const original = await prisma.account.findUnique({
      where: { id: parseInt(id) }
    });

    if (!original) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const targetPlatform = platform || original.platform;
    const isMeesho = targetPlatform.toLowerCase() === 'meesho';
    const isFlipkart = targetPlatform.toLowerCase() === 'flipkart';

    const account = await prisma.account.update({
      where: { id: parseInt(id) },
      data: {
        name,
        platform: platform ? platform.toLowerCase() : undefined,
        is_active,
        notes,
        meesho_supplier_id: isMeesho ? meesho_supplier_id || null : null,
        meesho_username: isMeesho ? meesho_username || null : null,
        meesho_password: isMeesho ? meesho_password || null : null,
        flipkart_supplier_id: isFlipkart ? flipkart_supplier_id || null : null,
        flipkart_username: isFlipkart ? flipkart_username || null : null,
        flipkart_password: isFlipkart ? flipkart_password || null : null
      }
    });

    if (account.platform === 'meesho') {
      const credsChanged = 
        account.meesho_supplier_id !== original.meesho_supplier_id ||
        account.meesho_username !== original.meesho_username ||
        account.meesho_password !== original.meesho_password;

      if (credsChanged && account.meesho_username && account.meesho_password) {
        triggerBackgroundSync(account.id);
      }
    } else if (account.platform === 'flipkart') {
      const credsChanged = 
        account.flipkart_supplier_id !== original.flipkart_supplier_id ||
        account.flipkart_username !== original.flipkart_username ||
        account.flipkart_password !== original.flipkart_password;

      if (credsChanged && account.flipkart_username && account.flipkart_password) {
        triggerFlipkartBackgroundSync(account.id);
      }
    }

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

// GET all imported SKUs across all accounts
router.get('/all/imported-skus', async (req, res) => {
  try {
    const skus = await prisma.importedSku.findMany({
      include: {
        product: true,
        account: true
      },
      orderBy: { marketplace_sku: 'asc' }
    });
    res.json(skus);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch all imported SKUs' });
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
// POST manually trigger background sync for an account
router.post('/:id/sync', async (req, res) => {
  const { id } = req.params;

  try {
    const account = await prisma.account.findUnique({
      where: { id: parseInt(id) }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const plat = account.platform.toLowerCase();
    if (plat === 'meesho') {
      if (!account.meesho_username || !account.meesho_password) {
        return res.status(400).json({ error: 'Meesho login credentials must be set before syncing.' });
      }
      triggerBackgroundSync(account.id);
      res.json({ success: true, message: 'Meesho catalog sync started in the background.' });
    } else if (plat === 'flipkart') {
      if (!account.flipkart_username || !account.flipkart_password) {
        return res.status(400).json({ error: 'Flipkart login credentials must be set before syncing.' });
      }
      triggerFlipkartBackgroundSync(account.id);
      res.json({ success: true, message: 'Flipkart catalog sync started in the background.' });
    } else {
      return res.status(400).json({ error: 'Sync only supported for Meesho or Flipkart platforms.' });
    }
  } catch (err) {
    console.error('[Manual Sync trigger] Error:', err);
    res.status(500).json({ error: 'Failed to trigger sync: ' + err.message });
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
      include: { product: true, account: true }
    });

    const plat = imported.account ? imported.account.platform.toLowerCase() : 'meesho';

    // 2. Synchronize main SkuMapping for PDF parsing engine
    await prisma.skuMapping.upsert({
      where: { marketplace_sku: imported.marketplace_sku },
      update: {
        product_id: parseInt(product_id),
        color_variant: color_variant || null,
        size_variant: size_variant || null,
        platform: plat
      },
      create: {
        marketplace_sku: imported.marketplace_sku,
        product_id: parseInt(product_id),
        color_variant: color_variant || null,
        size_variant: size_variant || null,
        platform: plat
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
        meesho_supplier_id: null,
        meesho_username: null,
        meesho_password: null,
        meesho_sync_status: null,
        meesho_sync_error: null
      }
    });
    res.json({ success: true, message: 'Meesho credentials reset successfully for this account.', account });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset credentials: ' + err.message });
  }
});

// POST reset credentials for a Flipkart account
router.post('/:id/flipkart-reset', async (req, res) => {
  const { id } = req.params;
  try {
    const account = await prisma.account.update({
      where: { id: parseInt(id) },
      data: {
        flipkart_supplier_id: null,
        flipkart_username: null,
        flipkart_password: null,
        flipkart_sync_status: null,
        flipkart_sync_error: null
      }
    });
    res.json({ success: true, message: 'Flipkart credentials reset successfully for this account.', account });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset credentials: ' + err.message });
  }
});

// POST /accounts/bulk-map-skus
// Body: { product_id: number, color_variant?: string, size_variant?: string, sku_ids: number[] }
// Maps multiple ImportedSku records and their SkuMappings to a single master product in one request.
router.post('/bulk-map-skus', async (req, res) => {
  const { product_id, color_variant, size_variant, sku_ids } = req.body;

  if (!product_id || !Array.isArray(sku_ids) || sku_ids.length === 0) {
    return res.status(400).json({ error: 'product_id and sku_ids[] are required' });
  }

  const productIdInt = parseInt(product_id);
  const results = { success: [], failed: [] };

  try {
    // Fetch all targeted ImportedSkus at once
    const importedSkus = await prisma.importedSku.findMany({
      where: { id: { in: sku_ids.map(id => parseInt(id)) } },
      include: { account: true }
    });

    // Run all updates in a single transaction
    await prisma.$transaction(async (tx) => {
      for (const imported of importedSkus) {
        // Update ImportedSku
        await tx.importedSku.update({
          where: { id: imported.id },
          data: {
            product_id: productIdInt,
            color_variant: color_variant || imported.color_variant || null,
            size_variant: size_variant || imported.size_variant || null
          }
        });

        const plat = imported.account ? imported.account.platform.toLowerCase() : 'meesho';

        // Upsert main SkuMapping for PDF/sales routing engine
        await tx.skuMapping.upsert({
          where: { marketplace_sku: imported.marketplace_sku },
          update: {
            product_id: productIdInt,
            color_variant: color_variant || imported.color_variant || null,
            size_variant: size_variant || imported.size_variant || null,
            platform: plat
          },
          create: {
            marketplace_sku: imported.marketplace_sku,
            product_id: productIdInt,
            color_variant: color_variant || imported.color_variant || null,
            size_variant: size_variant || imported.size_variant || null,
            platform: plat
          }
        });

        results.success.push(imported.id);
      }
    });

    res.json({
      message: `Successfully mapped ${results.success.length} SKU(s) to product ${productIdInt}`,
      mapped_count: results.success.length,
      sku_ids: results.success
    });
  } catch (err) {
    console.error('Bulk map error:', err);
    res.status(500).json({ error: 'Bulk mapping failed: ' + err.message });
  }
});

module.exports = router;

