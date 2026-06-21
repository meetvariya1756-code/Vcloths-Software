const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { scrapeMeeshoCatalog } = require('../meesho-scraper');
const { scrapeFlipkartCatalog } = require('../flipkart-scraper');

// Detect if running in a cloud environment (Render, Railway, etc.)
// Scraping is blocked on cloud — must be done from local machine
const isCloudEnv = () => process.env.RENDER === 'true' || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_STATIC_URL;

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
    let attempts = 0;
    const maxAttempts = 3;
    let success = false;
    let lastError = null;

    while (attempts < maxAttempts && !success) {
      attempts++;
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

        console.log(`[Background Sync] Starting scraper for account "${account.name}" (ID: ${account.id}) - Attempt ${attempts}`);

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
        success = true;

      } catch (err) {
        lastError = err;
        console.error(`[Background Sync Attempt ${attempts} Failed] for account ID ${accountId}:`, err.stack || err.message);
        if (attempts < maxAttempts) {
          console.log(`[Background Sync] Retrying in ${attempts * 2} seconds...`);
          await new Promise(r => setTimeout(r, attempts * 2000));
        }
      }
    }

    if (!success) {
      console.error(`[Background Sync Final Failure] for account ID ${accountId}:`, lastError ? (lastError.stack || lastError.message) : 'Unknown error');
      // Set status to failed and store the user-friendly message
      await prisma.account.update({
        where: { id: accountId },
        data: {
          meesho_sync_status: 'failed',
          meesho_sync_error: 'Sync temporarily unavailable. Please try again in a few minutes.'
        }
      });
    }
  }, 0);
}

// ── Flipkart Background Auto-Sync Helper ──────────────────────────────────────────
async function triggerFlipkartBackgroundSync(accountId) {
  setTimeout(async () => {
    let attempts = 0;
    const maxAttempts = 3;
    let success = false;
    let lastError = null;

    while (attempts < maxAttempts && !success) {
      attempts++;
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

        console.log(`[Background Sync] Starting Flipkart scraper for account "${account.name}" (ID: ${account.id}) - Attempt ${attempts}`);

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
        success = true;

      } catch (err) {
        lastError = err;
        console.error(`[Background Sync Flipkart Attempt ${attempts} Failed] for account ID ${accountId}:`, err.stack || err.message);
        if (attempts < maxAttempts) {
          console.log(`[Background Sync Flipkart] Retrying in ${attempts * 2} seconds...`);
          await new Promise(r => setTimeout(r, attempts * 2000));
        }
      }
    }

    if (!success) {
      console.error(`[Background Sync Flipkart Final Failure] for account ID ${accountId}:`, lastError ? (lastError.stack || lastError.message) : 'Unknown error');
      // Set status to failed and store the user-friendly message
      await prisma.account.update({
        where: { id: accountId },
        data: {
          flipkart_sync_status: 'failed',
          flipkart_sync_error: 'Sync temporarily unavailable. Please try again in a few minutes.'
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

// Reset stuck syncing statuses on startup
const resetStuckSyncing = async () => {
  try {
    const cloudMsg = 'Sync temporarily unavailable. Please try again in a few minutes.';

    const meeshoResult = await prisma.account.updateMany({
      where: { meesho_sync_status: 'syncing' },
      data: {
        meesho_sync_status: 'failed',
        meesho_sync_error: cloudMsg
      }
    });
    const flipkartResult = await prisma.account.updateMany({
      where: { flipkart_sync_status: 'syncing' },
      data: {
        flipkart_sync_status: 'failed',
        flipkart_sync_error: cloudMsg
      }
    });
    if (meeshoResult.count > 0 || flipkartResult.count > 0) {
      console.log(`[Startup Cleanup] Reset ${meeshoResult.count} stuck Meesho and ${flipkartResult.count} stuck Flipkart sync tasks.`);
    }
  } catch (err) {
    console.error('[Startup Cleanup] Error resetting stuck syncing statuses:', err);
  }
};
resetStuckSyncing();

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
    const isMeesho = String(platform).toLowerCase() === 'meesho';
    const isFlipkart = String(platform).toLowerCase() === 'flipkart';

    let parsedIsActive = true;
    if (is_active !== undefined) {
      if (typeof is_active === 'boolean') {
        parsedIsActive = is_active;
      } else if (typeof is_active === 'string') {
        parsedIsActive = is_active.toLowerCase() === 'true' || is_active === '1';
      } else if (typeof is_active === 'number') {
        parsedIsActive = is_active === 1;
      }
    }

    const parsedNotes = notes !== undefined && notes !== null ? String(notes) : null;
    const parsedMeeshoSupplierId = meesho_supplier_id !== undefined && meesho_supplier_id !== null ? String(meesho_supplier_id).trim() || null : null;
    const parsedMeeshoUsername = meesho_username !== undefined && meesho_username !== null ? String(meesho_username).trim() || null : null;
    const parsedMeeshoPassword = meesho_password !== undefined && meesho_password !== null ? String(meesho_password) || null : null;

    const parsedFlipkartSupplierId = flipkart_supplier_id !== undefined && flipkart_supplier_id !== null ? String(flipkart_supplier_id).trim() || null : null;
    const parsedFlipkartUsername = flipkart_username !== undefined && flipkart_username !== null ? String(flipkart_username).trim() || null : null;
    const parsedFlipkartPassword = flipkart_password !== undefined && flipkart_password !== null ? String(flipkart_password) || null : null;

    const account = await prisma.account.create({
      data: {
        name: String(name).trim(),
        platform: String(platform).trim().toLowerCase(),
        is_active: parsedIsActive,
        notes: parsedNotes,
        meesho_supplier_id: isMeesho ? parsedMeeshoSupplierId : null,
        meesho_username: isMeesho ? parsedMeeshoUsername : null,
        meesho_password: isMeesho ? parsedMeeshoPassword : null,
        meesho_sync_status: isMeesho && parsedMeeshoUsername && parsedMeeshoPassword ? 'pending' : null,
        flipkart_supplier_id: isFlipkart ? parsedFlipkartSupplierId : null,
        flipkart_username: isFlipkart ? parsedFlipkartUsername : null,
        flipkart_password: isFlipkart ? parsedFlipkartPassword : null,
        flipkart_sync_status: isFlipkart && parsedFlipkartUsername && parsedFlipkartPassword ? 'pending' : null
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
    const isMeesho = String(targetPlatform).toLowerCase() === 'meesho';
    const isFlipkart = String(targetPlatform).toLowerCase() === 'flipkart';

    const parsedName = name !== undefined ? (name !== null ? String(name).trim() : null) : undefined;
    const parsedPlatform = platform !== undefined ? (platform !== null ? String(platform).trim().toLowerCase() : null) : undefined;
    
    let parsedIsActive = undefined;
    if (is_active !== undefined) {
      if (typeof is_active === 'boolean') {
        parsedIsActive = is_active;
      } else if (typeof is_active === 'string') {
        parsedIsActive = is_active.toLowerCase() === 'true' || is_active === '1';
      } else if (typeof is_active === 'number') {
        parsedIsActive = is_active === 1;
      }
    }

    const parsedNotes = notes !== undefined ? (notes !== null ? String(notes) : null) : undefined;
    const parsedMeeshoSupplierId = meesho_supplier_id !== undefined ? (meesho_supplier_id !== null ? String(meesho_supplier_id).trim() || null : null) : undefined;
    const parsedMeeshoUsername = meesho_username !== undefined ? (meesho_username !== null ? String(meesho_username).trim() || null : null) : undefined;
    const parsedMeeshoPassword = meesho_password !== undefined ? (meesho_password !== null ? String(meesho_password) || null : null) : undefined;

    const parsedFlipkartSupplierId = flipkart_supplier_id !== undefined ? (flipkart_supplier_id !== null ? String(flipkart_supplier_id).trim() || null : null) : undefined;
    const parsedFlipkartUsername = flipkart_username !== undefined ? (flipkart_username !== null ? String(flipkart_username).trim() || null : null) : undefined;
    const parsedFlipkartPassword = flipkart_password !== undefined ? (flipkart_password !== null ? String(flipkart_password) || null : null) : undefined;

    const account = await prisma.account.update({
      where: { id: parseInt(id) },
      data: {
        name: parsedName,
        platform: parsedPlatform,
        is_active: parsedIsActive,
        notes: parsedNotes,
        meesho_supplier_id: isMeesho ? (parsedMeeshoSupplierId !== undefined ? parsedMeeshoSupplierId : original.meesho_supplier_id) : null,
        meesho_username: isMeesho ? (parsedMeeshoUsername !== undefined ? parsedMeeshoUsername : original.meesho_username) : null,
        meesho_password: isMeesho ? (parsedMeeshoPassword !== undefined ? parsedMeeshoPassword : original.meesho_password) : null,
        flipkart_supplier_id: isFlipkart ? (parsedFlipkartSupplierId !== undefined ? parsedFlipkartSupplierId : original.flipkart_supplier_id) : null,
        flipkart_username: isFlipkart ? (parsedFlipkartUsername !== undefined ? parsedFlipkartUsername : original.flipkart_username) : null,
        flipkart_password: isFlipkart ? (parsedFlipkartPassword !== undefined ? parsedFlipkartPassword : original.flipkart_password) : null
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

// GET all imported SKUs across all accounts (with optional server-side filtering + pagination)
router.get('/all/imported-skus', async (req, res) => {
  try {
    const { account_id, search, mapped, page = '1', limit = '100' } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 100));
    const skip = (pageNum - 1) * limitNum;

    // Build Prisma where clause
    const where = {};

    if (account_id) {
      where.account_id = parseInt(account_id);
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { marketplace_sku: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { catalog_name: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (mapped === 'true') {
      where.product_id = { not: null };
    } else if (mapped === 'false') {
      where.product_id = null;
    }

    const [skus, total] = await prisma.$transaction([
      prisma.importedSku.findMany({
        where,
        include: {
          product: true,
          account: true
        },
        orderBy: { marketplace_sku: 'asc' },
        skip,
        take: limitNum
      }),
      prisma.importedSku.count({ where })
    ]);

    res.json({ skus, total, page: pageNum, limit: limitNum });
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

