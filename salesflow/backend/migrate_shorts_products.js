/**
 * migrate_shorts_products.js
 *
 * Splits the single "Shorts PC-3" product into 4 separate pack-size products:
 *   Shorts PC-1 (Pack of 1 Piece)   — labels_per_unit: 1
 *   Shorts PC-2 (Pack of 2 Pieces)  — labels_per_unit: 2
 *   Shorts PC-3 (Pack of 3 Pieces)  — labels_per_unit: 3
 *   Shorts PC-4 (Pack of 4 Pieces)  — labels_per_unit: 4
 *
 * Each product gets exactly the SHPC-X SKU mapping that corresponds to its pack size.
 * Other SHPC-X variants across accounts (e.g. BALAPARI-SHPC-2, VIMS-SHPC-2) are
 * re-mapped to the matching pack-size product.
 *
 * The legacy "Shorts PC-3" product (id 23) is deleted after migration.
 *
 * Run: node migrate_shorts_products.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detect pack count from a marketplace SKU string.
 * Returns 1, 2, 3, or 4. Defaults to null if not determinable.
 */
function detectPackCount(sku) {
  const upper = sku.toUpperCase().trim();

  // Explicit SHPC-X or SHPC_X
  const shpcMatch = upper.match(/SHPC[-_]?([1-4])/);
  if (shpcMatch) return parseInt(shpcMatch[1]);

  // SH-P2, SH-P3, etc.
  const shpMatch = upper.match(/SH[-_]P([1-4])/);
  if (shpMatch) return parseInt(shpMatch[1]);

  // P-2, P-3 etc at the start
  const pMatch = upper.match(/^P[-_]([1-4])/);
  if (pMatch) return parseInt(pMatch[1]);

  // Count '+' separated colors (pack of N colors)
  if (upper.includes('+')) {
    const count = upper.split('+').length;
    if (count >= 1 && count <= 4) return count;
  }

  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀  Starting Shorts pack-size product migration...\n');

  // 1. Fetch the legacy product
  const legacy = await prisma.product.findUnique({ where: { id: 23 } });
  if (!legacy) {
    console.log('Legacy "Shorts PC-3" (id 23) not found. Might have already been migrated.');
    return;
  }
  console.log(`Found legacy product: "${legacy.name}" (ID: ${legacy.id})`);
  console.log(`  category: ${legacy.category}, base_price: ${legacy.base_price}, labels_per_unit: ${legacy.labels_per_unit}\n`);

  // 2. Define the 4 new products (inherit base_price from legacy)
  const packDefinitions = [
    { packCount: 1, name: 'Shorts PC-1 (Pack of 1 Piece)',  category: 'Shorts', labels_per_unit: 1, base_price: legacy.base_price },
    { packCount: 2, name: 'Shorts PC-2 (Pack of 2 Pieces)', category: 'Shorts', labels_per_unit: 2, base_price: legacy.base_price },
    { packCount: 3, name: 'Shorts PC-3 (Pack of 3 Pieces)', category: 'Shorts', labels_per_unit: 3, base_price: legacy.base_price },
    { packCount: 4, name: 'Shorts PC-4 (Pack of 4 Pieces)', category: 'Shorts', labels_per_unit: 4, base_price: legacy.base_price },
  ];

  // 3. Upsert new products
  console.log('📦  Creating / verifying pack-size products...');
  const newProducts = {}; // packCount -> product record
  for (const def of packDefinitions) {
    let prod = await prisma.product.findFirst({ where: { name: def.name } });
    if (!prod) {
      prod = await prisma.product.create({
        data: {
          name: def.name,
          category: def.category,
          labels_per_unit: def.labels_per_unit,
          base_price: def.base_price,
        }
      });
      console.log(`  ✅ Created: "${prod.name}" (ID: ${prod.id})`);
    } else {
      console.log(`  ℹ️  Already exists: "${prod.name}" (ID: ${prod.id})`);
    }
    newProducts[def.packCount] = prod;
  }

  // 4. Re-map all SKU mappings that were pointing to the legacy product
  console.log('\n🔗  Migrating SKU mappings...');
  const legacyMappings = await prisma.skuMapping.findMany({
    where: { product_id: legacy.id }
  });
  console.log(`  Found ${legacyMappings.length} SKU mapping(s) under legacy product.`);

  for (const mapping of legacyMappings) {
    const packCount = detectPackCount(mapping.marketplace_sku);
    if (!packCount || !newProducts[packCount]) {
      console.warn(`  ⚠️  Cannot determine pack count for SKU "${mapping.marketplace_sku}" — skipping.`);
      continue;
    }
    const targetProduct = newProducts[packCount];
    await prisma.skuMapping.update({
      where: { id: mapping.id },
      data: { product_id: targetProduct.id }
    });
    console.log(`  ✅  ${mapping.marketplace_sku} → "${targetProduct.name}" (ID: ${targetProduct.id})`);
  }

  // 5. Migrate any sales records (currently 0, but future-proof)
  console.log('\n📊  Checking sales records...');
  const salesRecords = await prisma.salesRecord.findMany({
    where: { product_id: legacy.id }
  });
  console.log(`  Found ${salesRecords.length} sales record(s) under legacy product.`);

  for (const sale of salesRecords) {
    const packCount = detectPackCount(sale.marketplace_sku);
    if (!packCount || !newProducts[packCount]) {
      console.warn(`  ⚠️  Cannot determine pack count for sale SKU "${sale.marketplace_sku}" — defaulting to PC-3.`);
      await prisma.salesRecord.update({ where: { id: sale.id }, data: { product_id: newProducts[3].id } });
      continue;
    }
    await prisma.salesRecord.update({ where: { id: sale.id }, data: { product_id: newProducts[packCount].id } });
    console.log(`  ✅  Sale #${sale.id} (${sale.marketplace_sku}) → "${newProducts[packCount].name}"`);
  }

  // 6. Migrate account prices (currently 0, but future-proof)
  console.log('\n💰  Checking account price overrides...');
  const accountPrices = await prisma.accountPrice.findMany({
    where: { product_id: legacy.id }
  });
  console.log(`  Found ${accountPrices.length} account price override(s) under legacy product.`);

  for (const ap of accountPrices) {
    // Replicate the price for all 4 new pack products
    for (const packCount of [1, 2, 3, 4]) {
      const targetProduct = newProducts[packCount];
      await prisma.accountPrice.upsert({
        where: {
          account_id_product_id: { account_id: ap.account_id, product_id: targetProduct.id }
        },
        update: { price: ap.price },
        create: { account_id: ap.account_id, product_id: targetProduct.id, price: ap.price }
      });
    }
    console.log(`  ✅  Replicated account price for account ${ap.account_id} across all 4 new products.`);
  }

  // 7. Migrate imported SKUs
  console.log('\n📥  Checking imported SKUs...');
  const importedSkus = await prisma.importedSku.findMany({
    where: { product_id: legacy.id }
  });
  console.log(`  Found ${importedSkus.length} imported SKU(s) under legacy product.`);

  for (const iSku of importedSkus) {
    const packCount = detectPackCount(iSku.marketplace_sku);
    if (!packCount || !newProducts[packCount]) {
      console.warn(`  ⚠️  Cannot determine pack count for imported SKU "${iSku.marketplace_sku}" — skipping.`);
      continue;
    }
    await prisma.importedSku.update({
      where: { id: iSku.id },
      data: { product_id: newProducts[packCount].id }
    });
    console.log(`  ✅  ImportedSku "${iSku.marketplace_sku}" → "${newProducts[packCount].name}"`);
  }

  // 8. Delete the legacy product
  console.log('\n🗑️   Deleting legacy "Shorts PC-3" product...');
  await prisma.product.delete({ where: { id: legacy.id } });
  console.log('  ✅  Legacy product deleted successfully.');

  console.log('\n🎉  Migration complete! Summary of new products:');
  for (const [pc, prod] of Object.entries(newProducts)) {
    console.log(`  PC-${pc}: "${prod.name}" (ID: ${prod.id}) — ${prod.labels_per_unit} label(s)/unit, ₹${prod.base_price / 100}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
