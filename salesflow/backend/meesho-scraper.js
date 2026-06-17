/**
 * meesho-scraper.js
 * Real Meesho Supplier Panel scraper using Puppeteer browser automation.
 * Logs into supplier.meesho.com and extracts catalog listings + SKU variants.
 */

const puppeteer = require('puppeteer');

const MEESHO_SUPPLIER_URL = 'https://supplier.meesho.com';
const MEESHO_LOGIN_URL = 'https://supplier.meesho.com/panel/v3/new/root/login';
const MEESHO_CATALOG_URL = 'https://supplier.meesho.com/catalog/';

/**
 * Launch Puppeteer with sensible defaults.
 * headless: 'new' is the stable modern headless mode.
 */
async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--window-size=1280,800'
    ],
    defaultViewport: { width: 1280, height: 800 }
  });
  return browser;
}

/**
 * Log in to Meesho Supplier Panel.
 * @param {import('puppeteer').Browser} browser
 * @param {string} meeshoId  - Phone number or supplier ID
 * @param {string} password  - Account password
 * @param {Function} onStep  - Progress callback(stepNumber, message)
 * @returns {import('puppeteer').Page} Logged-in page instance
 */
async function loginToMeesho(browser, meeshoId, password, onStep) {
  const page = await browser.newPage();

  // Set a real-looking user agent to avoid basic bot detection
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  onStep(1, 'Opening Meesho Supplier login page...');
  await page.goto(MEESHO_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  // Small human-like delay
  await delay(800);

  onStep(2, 'Entering Meesho credentials...');

  // ── Phone / User ID field ──
  const phoneSelectors = [
    'input[placeholder*="Email" i]',
    'input[placeholder*="mobile" i]',
    'input[placeholder*="Mobile" i]',
    'input[placeholder*="phone" i]',
    'input[type="tel"]',
    'input[type="text"]',
    'input[name="phone"]',
    'input[id*="phone"]',
    'input[id*="mobile"]',
    'input'
  ];

  let phoneInput = null;
  for (const sel of phoneSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      phoneInput = await page.$(sel);
      if (phoneInput) break;
    } catch (_) { /* try next selector */ }
  }

  if (!phoneInput) {
    throw new Error('Could not find phone/ID input on Meesho login page. The login page layout may have changed.');
  }

  await phoneInput.click({ clickCount: 3 });
  await phoneInput.type(meeshoId.trim(), { delay: 80 });

  // Some Meesho versions show a "Continue" button before password
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
      const element = btnHandle.asElement();
      if (element) {
        continueBtn = element;
      }
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

  // ── Password field ──
  const passwordSelectors = [
    'input[type="password"]',
    'input[placeholder*="Password" i]',
    'input[placeholder*="password" i]',
    'input[name="password"]'
  ];

  let passwordInput = null;
  for (const sel of passwordSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 8000 });
      passwordInput = await page.$(sel);
      if (passwordInput) break;
    } catch (_) { /* try next */ }
  }

  if (!passwordInput) {
    throw new Error('Could not find password input on Meesho login page.');
  }

  await passwordInput.click({ clickCount: 3 });
  await passwordInput.type(password.trim(), { delay: 70 });
  await delay(400);

  onStep(2, 'Submitting login form...');

  // ── Submit login ──
  let loginBtn = null;
  
  // Try to find by text content "Log in", "Login", "Sign In" using page.evaluateHandle
  try {
    const btnHandle = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => {
        const text = (btn.textContent || '').trim().toLowerCase();
        return text.includes('log in') || text.includes('login') || text.includes('sign in');
      });
    });
    if (btnHandle) {
      const element = btnHandle.asElement();
      if (element) {
        loginBtn = element;
      }
    }
  } catch (err) {
    console.error('Error finding button via evaluateHandle:', err);
  }

  // Fallback to selectors if evaluateHandle failed to find
  if (!loginBtn) {
    const loginBtnSelectors = [
      'button[type="submit"]',
      'button'
    ];
    for (const sel of loginBtnSelectors) {
      try {
        loginBtn = await page.$(sel);
        if (loginBtn) break;
      } catch (_) {}
    }
  }

  if (loginBtn) {
    await loginBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }

  // Wait for navigation away from login page (indicates success)
  onStep(2, 'Verifying login...');
  try {
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
  } catch (e) {
    // Sometimes Meesho uses client-side routing — check URL instead
  }

  // Check if we are still on the login page (login failed)
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    // Look for error messages
    const errorText = await page.evaluate(() => {
      const errorEl = document.querySelector('[class*="error"], [class*="Error"], .MuiFormHelperText-root');
      return errorEl ? errorEl.textContent : null;
    });
    throw new Error(
      errorText
        ? `Meesho login failed: ${errorText}`
        : 'Meesho login failed. Please check your credentials and try again.'
    );
  }

  return page;
}

/**
 * Fetch all catalogs from the Meesho Supplier Panel.
 * @param {import('puppeteer').Page} page - Already logged-in page
 * @param {Function} onStep              - Progress callback(stepNumber, message)
 * @returns {Array} Array of catalog objects with SKUs
 */
async function fetchCatalogs(page, onStep) {
  onStep(3, 'Navigating to My Catalogs...');

  await page.goto(MEESHO_CATALOG_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(2000);

  onStep(4, 'Reading catalog listings...');

  // Scroll to load lazy-loaded catalog cards
  await autoScroll(page);
  await delay(1000);

  // Extract catalogs from the page
  // Meesho renders catalog cards with product names, SKU codes, images
  const catalogs = await page.evaluate(() => {
    const results = [];

    // Primary: catalog cards container
    // Meesho uses Material-UI cards — selectors may include:
    // - divs with class containing "catalog", "CatalogCard", "product-card"
    // - table rows with product data
    const cardSelectors = [
      '[class*="CatalogCard"]',
      '[class*="catalog-card"]',
      '[class*="ProductCard"]',
      '[class*="product-card"]',
      'tr[class*="catalog"]',
      '[data-testid*="catalog"]'
    ];

    let cards = [];
    for (const sel of cardSelectors) {
      const found = document.querySelectorAll(sel);
      if (found.length > 0) {
        cards = Array.from(found);
        break;
      }
    }

    // Fallback: look for tables (Meesho sometimes uses data tables)
    if (cards.length === 0) {
      const rows = document.querySelectorAll('table tbody tr');
      if (rows.length > 0) {
        cards = Array.from(rows);
      }
    }

    for (const card of cards) {
      const text = card.innerText || card.textContent || '';

      // Extract SKU-like codes (alphanumeric with hyphens, 4+ chars)
      const skuMatches = text.match(/[A-Z0-9][A-Z0-9\-_]{3,30}/g) || [];
      const uniqueSkus = [...new Set(skuMatches)].filter(s =>
        s.length >= 4 && !['MEESHO', 'CATALOG', 'ACTIVE', 'STATUS', 'PRICE'].includes(s)
      );

      // Extract title (first meaningful text block)
      const titleEl = card.querySelector('h6, h5, h4, [class*="title"], [class*="name"], [class*="Title"], strong');
      const title = titleEl ? titleEl.innerText.trim() : text.split('\n')[0].trim();

      if (title && title.length > 2) {
        results.push({
          title: title.substring(0, 120),
          skus: uniqueSkus.slice(0, 5) // max 5 SKUs per catalog
        });
      }
    }

    // If still nothing — try to read raw page data from window/React state
    if (results.length === 0) {
      // Meesho sometimes exposes data in window.__INITIAL_STATE__ or similar
      try {
        const stateKeys = Object.keys(window).filter(k =>
          k.includes('state') || k.includes('data') || k.includes('catalog')
        );
        for (const key of stateKeys.slice(0, 5)) {
          const val = JSON.stringify(window[key] || {});
          if (val.includes('sku') || val.includes('catalog')) {
            results.push({ __raw: key, data: val.substring(0, 500) });
          }
        }
      } catch (_) { }
    }

    return results;
  });

  return catalogs;
}

/**
 * Convert raw catalog scrape results into clean ImportedSku records.
 * Falls back to generating structured SKUs from catalog titles if
 * the scraper couldn't extract explicit SKU codes.
 * @param {Array} catalogs  - Raw catalog data from fetchCatalogs()
 * @param {string} accountName - Account name for prefix generation
 * @returns {Array} Array of { marketplace_sku, title, color_variant, size_variant }
 */
function buildImportedSkus(catalogs, accountName) {
  const skus = [];
  const seen = new Set();
  const prefix = accountName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

  for (let i = 0; i < catalogs.length; i++) {
    const catalog = catalogs[i];
    const title = catalog.title || `Catalog ${i + 1}`;

    if (catalog.skus && catalog.skus.length > 0) {
      // Use real scraped SKU codes
      for (const sku of catalog.skus) {
        if (!seen.has(sku)) {
          seen.add(sku);
          skus.push({
            marketplace_sku: sku,
            title: title,
            color_variant: null,
            size_variant: null
          });
        }
      }
    } else {
      // Generate a structured SKU from catalog title words
      const titleWords = title.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
      const skuSuffix = titleWords.slice(0, 3).join('-').substring(0, 20) || `CAT${i + 1}`;
      const sku = `${prefix}-${skuSuffix}`;
      if (!seen.has(sku)) {
        seen.add(sku);
        skus.push({
          marketplace_sku: sku,
          title: title,
          color_variant: null,
          size_variant: null
        });
      }
    }
  }

  return skus;
}

/**
 * Main entry point — scrape Meesho catalog for an account.
 * @param {Object} opts
 * @param {string} opts.meeshoId
 * @param {string} opts.password
 * @param {string} opts.accountName
 * @param {Function} opts.onStep  - Progress callback(stepNumber, message)
 * @returns {Array} Array of ImportedSku-ready objects
 */
async function scrapeMeeshoCatalog({ meeshoId, password, accountName, onStep = () => { } }) {
  let browser = null;

  try {
    onStep(0, 'Launching secure browser session...');
    browser = await launchBrowser();

    const page = await loginToMeesho(browser, meeshoId, password, onStep);

    const catalogs = await fetchCatalogs(page, onStep);

    onStep(5, `Extracted ${catalogs.length} catalog(s). Processing SKUs...`);
    const skus = buildImportedSkus(catalogs, accountName);

    return skus;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

module.exports = { scrapeMeeshoCatalog };
