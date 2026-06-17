/**
 * test-scraper.js
 * Quick standalone test for the Meesho scraper.
 * Run: node test-scraper.js
 * 
 * Fill in your real Meesho Supplier credentials below.
 */

const { scrapeMeeshoCatalog } = require('./meesho-scraper');

// ── Fill these in ──────────────────────────────────
const MEESHO_ID   = 'your_phone_number_or_id';   // e.g. 9876543210
const PASSWORD    = 'your_password';
const ACCOUNT_NAME = 'TestAccount';
// ──────────────────────────────────────────────────

(async () => {
  console.log('🚀 Starting Meesho scraper test...\n');

  try {
    const skus = await scrapeMeeshoCatalog({
      meeshoId: MEESHO_ID,
      password: PASSWORD,
      accountName: ACCOUNT_NAME,
      onStep: (step, msg) => {
        console.log(`  [Step ${step}] ${msg}`);
      }
    });

    console.log(`\n✅ Scraping complete! Found ${skus.length} SKU(s):\n`);
    skus.forEach((sku, i) => {
      console.log(`  ${i + 1}. SKU: ${sku.marketplace_sku} | Title: ${sku.title}`);
    });

  } catch (err) {
    console.error('\n❌ Scraper failed:', err.message);
  }
})();
