/**
 * meesho-scraper.js
 * Upgraded Meesho Supplier Panel scraper using Puppeteer and session-intercepted programmatic API fetches.
 * Logs in, extracts cookies and session headers, and fetches all catalog variants (Active, Paused, Blocked)
 * directly from the panel APIs to support very large supplier inventories efficiently.
 */

const puppeteer = require('puppeteer');

const MEESHO_LOGIN_URL = 'https://supplier.meesho.com/panel/v3/new/root/login';

/**
 * Launch Puppeteer with stable defaults.
 */
async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,800'
    ],
    defaultViewport: { width: 1280, height: 800 }
  });
  return browser;
}

/**
 * Log in to Meesho Supplier Panel.
 */
async function loginToMeesho(browser, meeshoId, password, onStep) {
  const page = await browser.newPage();

  // Set real-looking user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  onStep(1, 'Opening Meesho Supplier login page...');
  await page.goto(MEESHO_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  await delay(800);

  onStep(2, 'Entering Meesho credentials...');

  const phoneSelectors = [
    'input[placeholder*="Email" i]',
    'input[placeholder*="mobile" i]',
    'input[placeholder*="Mobile" i]',
    'input[placeholder*="phone" i]',
    'input[type="tel"]',
    'input[type="text"]',
    'input[name="phone"]',
    'input'
  ];

  let phoneInput = null;
  for (const sel of phoneSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      phoneInput = await page.$(sel);
      if (phoneInput) break;
    } catch (_) {}
  }

  if (!phoneInput) {
    throw new Error('Could not find email/phone input on Meesho login page.');
  }

  await phoneInput.click({ clickCount: 3 });
  await phoneInput.type(meeshoId.trim(), { delay: 80 });

  // Handle optional Next/Continue buttons
  let continueBtn = null;
  try {
    const btnHandle = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => {
        const text = (btn.textContent || '').trim().toLowerCase();
        return text.includes('continue') || text.includes('next');
      });
    });
    if (btnHandle) {
      continueBtn = btnHandle.asElement();
    }
  } catch (_) {}

  if (!continueBtn) {
    try {
      continueBtn = await page.$('button[type="submit"]');
    } catch (_) {}
  }

  if (continueBtn) {
    const btnText = await page.evaluate(el => el.textContent || '', continueBtn);
    if (btnText.toLowerCase().includes('continue') || btnText.toLowerCase().includes('next')) {
      await continueBtn.click();
      await delay(2000);
    }
  }

  // Password input
  const passwordSelectors = [
    'input[type="password"]',
    'input[placeholder*="Password" i]',
    'input[name="password"]'
  ];

  let passwordInput = null;
  for (const sel of passwordSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 8000 });
      passwordInput = await page.$(sel);
      if (passwordInput) break;
    } catch (_) {}
  }

  if (!passwordInput) {
    throw new Error('Could not find password input on Meesho login page.');
  }

  await passwordInput.click({ clickCount: 3 });
  await passwordInput.type(password.trim(), { delay: 70 });
  await delay(400);

  onStep(2, 'Submitting login...');

  let loginBtn = null;
  try {
    const btnHandle = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => {
        const text = (btn.textContent || '').trim().toLowerCase();
        return text.includes('log in') || text.includes('login') || text.includes('sign in');
      });
    });
    if (btnHandle) {
      loginBtn = btnHandle.asElement();
    }
  } catch (_) {}

  if (loginBtn) {
    await loginBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }

  onStep(2, 'Verifying login redirect...');
  try {
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
  } catch (_) {}

  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    const errorText = await page.evaluate(() => {
      const errorEl = document.querySelector('[class*="error"], [class*="Error"], .MuiFormHelperText-root');
      return errorEl ? errorEl.textContent : null;
    });
    throw new Error(
      errorText
        ? `Meesho login failed: ${errorText}`
        : 'Meesho login failed. Please verify credentials.'
    );
  }

  return page;
}

/**
 * Main scraper entry point.
 */
async function scrapeMeeshoCatalog({ meeshoId, password, accountName, onStep = () => {} }) {
  let browser = null;
  let page = null;

  try {
    onStep(0, 'Launching browser session...');
    browser = await launchBrowser();

    page = await loginToMeesho(browser, meeshoId, password, onStep);

    // 1. Dynamic Supplier ID Hash Retrieval
    let supplierHash = null;
    const startTime = Date.now();
    onStep(2, 'Resolving Supplier Hash...');
    while (Date.now() - startTime < 15000) {
      const url = page.url();
      if (url.includes('/growth/')) {
        supplierHash = url.split('/growth/')[1].split('/')[0];
        break;
      }
      if (url.includes('/services/')) {
        supplierHash = url.split('/services/')[1].split('/')[0];
        break;
      }
      await delay(500);
    }

    if (!supplierHash) {
      throw new Error(`Could not retrieve Supplier Panel ID hash. Current URL: ${page.url()}`);
    }

    // 2. Set up request interception listener to capture custom headers and POST parameters
    let interceptedHeaders = null;
    let interceptedBody = null;

    const requestListener = req => {
      const url = req.url();
      if (url.includes('fetchAllStockV2Catalogs') && !interceptedHeaders) {
        interceptedHeaders = req.headers();
        try {
          interceptedBody = JSON.parse(req.postData() || '{}');
        } catch (_) {}
      }
    };

    page.on('request', requestListener);

    // 3. Navigate to the Inventory Services page to trigger initial list requests
    const inventoryUrl = `https://supplier.meesho.com/panel/v3/new/services/${supplierHash}/inventory`;
    onStep(3, 'Navigating to Inventory panel...');
    await page.goto(inventoryUrl, { waitUntil: 'networkidle2', timeout: 35000 });

    await delay(7000);

    // Dismiss onboarding popup if present
    try {
      const gotItHandle = await page.evaluateHandle(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        return elements.find(el => {
          const text = (el.innerText || el.textContent || '').trim().toLowerCase();
          return text === 'got it';
        }) || null;
      });
      const gotItEl = gotItHandle.asElement();
      if (gotItEl) {
        await gotItEl.click();
        await delay(1500);
      }
    } catch (_) {}

    if (!interceptedHeaders) {
      console.log('Waiting another 5 seconds for background API headers...');
      await delay(5000);
    }

    if (!interceptedHeaders) {
      throw new Error('Failed to intercept catalog list headers. The Meesho panel API might have changed.');
    }

    // Clean up request listener
    page.off('request', requestListener);

    // 4. Retrieve Tab Counts programmatically
    onStep(4, 'Querying catalog inventory status counts...');
    const tabCountsResponse = await page.evaluate(async (headers, supplierId) => {
      const r = await fetch('/api/services/catalogManagement/fetchTabCountV2', {
        method: 'POST',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          'client-type': headers['client-type'] || 'd-web',
          'client-version': headers['client-version'] || 'v1',
          'browser-id': headers['browser-id'],
          'identifier': headers['identifier']
        },
        body: JSON.stringify({ supplier_id: supplierId })
      });
      return r.json();
    }, interceptedHeaders, interceptedBody.supplier_id);

    if (!tabCountsResponse || !tabCountsResponse.counts) {
      throw new Error('Failed to retrieve inventory tab counts.');
    }

    const activeCountObj = tabCountsResponse.counts.find(c => c.key === 'active');
    const pausedCountObj = tabCountsResponse.counts.find(c => c.key === 'paused');
    const blockedCountObj = tabCountsResponse.counts.find(c => c.key === 'blocked');

    const activeCount = activeCountObj ? activeCountObj.value : 0;
    const pausedCount = pausedCountObj ? pausedCountObj.value : 0;
    const blockedCount = blockedCountObj ? blockedCountObj.value : 0;

    console.log(`Scraper: Counts - Active: ${activeCount}, Paused: ${pausedCount}, Blocked: ${blockedCount}`);

    // Define tasks to fetch
    const fetchTasks = [];
    if (activeCount > 0) {
      fetchTasks.push({
        tab: 'active',
        endpoint: '/api/services/catalogManagement/fetchAllStockV2Catalogs',
        count: activeCount,
        bodyTemplate: {
          ...interceptedBody,
          old_category_id: [],
          sort_by: "ORDERS_PER_DAY",
          fetch_price_reco: false,
          is_hasp_seller: true,
          gst_type: "GSTIN"
        }
      });
    }
    if (pausedCount > 0) {
      fetchTasks.push({
        tab: 'paused',
        endpoint: '/api/services/catalogManagement/fetchArchivedV2Catalogs',
        count: pausedCount,
        bodyTemplate: {
          ...interceptedBody,
          old_category_id: [],
          is_hasp_seller: true,
          gst_type: "GSTIN"
        }
      });
    }
    if (blockedCount > 0) {
      fetchTasks.push({
        tab: 'blocked',
        endpoint: '/api/services/catalogManagement/fetchAllDeactivatedV2Catalogs',
        count: blockedCount,
        bodyTemplate: {
          ...interceptedBody,
          old_category_id: [],
          is_hasp_seller: true,
          gst_type: "GSTIN"
        }
      });
    }

    const allImportedSkus = [];

    // 5. Fetch all catalogs programmatically tab by tab
    for (const task of fetchTasks) {
      onStep(4, `Downloading ${task.tab} catalogs (Total: ${task.count})...`);

      // Run parallel batch requests directly in browser context (concurrency = 5)
      const catalogsData = await page.evaluate(async (headers, endpoint, count, bodyTemplate) => {
        const results = [];
        const concurrency = 5;

        for (let i = 0; i < count; i += concurrency) {
          const batchPromises = [];
          for (let j = 0; j < concurrency && (i + j) < count; j++) {
            const offset = i + j;
            const requestBody = {
              ...bodyTemplate,
              limit: 1,
              offset: offset
            };

            const promise = fetch(endpoint, {
              method: 'POST',
              headers: {
                'content-type': 'application/json;charset=UTF-8',
                'client-type': headers['client-type'] || 'd-web',
                'client-version': headers['client-version'] || 'v1',
                'browser-id': headers['browser-id'],
                'identifier': headers['identifier']
              },
              body: JSON.stringify(requestBody)
            })
            .then(res => res.json())
            .then(data => {
              if (data && data.catalogs && data.catalogs[0]) {
                return data.catalogs[0];
              }
              return null;
            })
            .catch(err => ({ error: err.message }));

            batchPromises.push(promise);
          }

          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults.filter(Boolean));

          // 50ms safety delay between batches
          await new Promise(r => setTimeout(r, 50));
        }

        return results;
      }, interceptedHeaders, task.endpoint, task.count, task.bodyTemplate);

      console.log(`Scraper: Fetched ${catalogsData.length} catalogs in "${task.tab}" tab.`);

      // 6. Map variants into ImportedSku-ready records
      for (const catalog of catalogsData) {
        if (catalog.error) {
          console.error(`Error fetching catalog: ${catalog.error}`);
          continue;
        }

        const catalogId = catalog.id ? catalog.id.toString() : null;
        const catalogName = catalog.name || 'Check out this trending catalog';

        if (catalog.products && catalog.products.length > 0) {
          for (const prod of catalog.products) {
            if (!prod.sku_id) continue;

            allImportedSkus.push({
              marketplace_sku: prod.sku_id,
              title: prod.name || catalogName,
              color_variant: null,
              size_variant: prod.variation || null,
              
              // New details fields
              catalog_id: catalogId,
              catalog_name: catalogName,
              style_id: prod.style_id || null,
              image_url: prod.image_url || null,
              price: prod.meesho_price ? Math.round(Number(prod.meesho_price) * 100) : null,
              inventory: prod.inventory !== undefined ? Number(prod.inventory) : null,
              status: task.tab
            });
          }
        }
      }
    }

    onStep(5, `Successfully scraped ${allImportedSkus.length} SKU variants across connected tabs.`);
    return allImportedSkus;

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { scrapeMeeshoCatalog };
