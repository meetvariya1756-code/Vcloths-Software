/**
 * fix_shorts_legacy_mappings.js
 *
 * The old generic "Shorts" product (ID 7) still has BALAPARI-SHPC-2, BALAPARI-SHPC-3,
 * FABREECA-SHPC-2, VIMS-SHPC-2 style mappings pointing to it.
 * These should be re-pointed to the correct Shorts PC-X products.
 *
 * Run: node fix_shorts_legacy_mappings.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function detectPackCount(sku) {
  const upper = sku.toUpperCase().trim();
  const shpcMatch = upper.match(/SHPC[-_]?([1-4])/);
  if (shpcMatch) return parseInt(shpcMatch[1]);
  const shpMatch = upper.match(/SH-P([1-4])/);
  if (shpMatch) return parseInt(shpMatch[1]);
  // Count '+' separated parts (colour groups)
  if (upper.includes('+')) {
    const count = upper.split('+').length;
    if (count >= 1 && count <= 4) return count;
  }
  return null;
}

async function main() {
  console.log('Fixing leftover SHPC mappings on old "Shorts" product (ID 7)...\n');

  // Get all new pack-size products
  const packProducts = {};
  for (const pc of [1, 2, 3, 4]) {
    const pname = `Shorts PC-${pc} (Pack of ${pc} Piece${pc > 1 ? 's' : ''})`;
    const prod = await prisma.product.findFirst({ where: { name: pname } });
    if (prod) {
      packProducts[pc] = prod;
      console.log(`  Found: "${prod.name}" (ID: ${prod.id})`);
    }
  }

  // Get all mappings under old generic "Shorts" (ID 7) that have SHPC in the SKU
  const oldMappings = await prisma.skuMapping.findMany({
    where: {
      product_id: 7,
      marketplace_sku: { contains: 'SHPC', mode: 'insensitive' }
    }
  });

  console.log(`\nFound ${oldMappings.length} SHPC mapping(s) still pointing to old "Shorts" product:`);
  for (const m of oldMappings) {
    const packCount = detectPackCount(m.marketplace_sku);
    if (!packCount || !packProducts[packCount]) {
      console.warn(`  ⚠️  Cannot detect pack count for "${m.marketplace_sku}" — skipping.`);
      continue;
    }
    await prisma.skuMapping.update({
      where: { id: m.id },
      data: { product_id: packProducts[packCount].id }
    });
    console.log(`  ✅  ${m.marketplace_sku} → "${packProducts[packCount].name}" (ID: ${packProducts[packCount].id})`);
  }

  // Also fix SH-P2 style SKUs if any
  const shpMappings = await prisma.skuMapping.findMany({
    where: {
      product_id: 7,
      marketplace_sku: { contains: 'SH-P', mode: 'insensitive' }
    }
  });
  for (const m of shpMappings) {
    const packCount = detectPackCount(m.marketplace_sku);
    if (!packCount || !packProducts[packCount]) {
      console.warn(`  ⚠️  Cannot detect pack count for "${m.marketplace_sku}" — skipping.`);
      continue;
    }
    await prisma.skuMapping.update({
      where: { id: m.id },
      data: { product_id: packProducts[packCount].id }
    });
    console.log(`  ✅  ${m.marketplace_sku} → "${packProducts[packCount].name}" (ID: ${packProducts[packCount].id})`);
  }

  console.log('\n✅ Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
