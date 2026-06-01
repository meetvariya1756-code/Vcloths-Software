const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { findBestSkuMapping } = require('./utils/skuMatcher');

const parsedSkus = [
  'PC-2-(GB)-BLK+GRY-OT2',
  'PC-2-(GB)-BLK+GRY-OT2',
  'PC-2-(WB)-BLK+WHT_LF2',
  'PC-1-(GB)-BLACK-GL2',
  'PC-2-(WB)-BLK+WHT_hll15',
  'PC-2-(GB)-BLK+GRY-OT2',
  'PC_2(GB) BLACK+GREY_22',
  'PC_2(GB) BLACK+GREY_22',
  'PC-2-(WB)-BLK+WHT_LF2',
  'PC-2-(WB)-BLK+WHT_hll15',
  'PC_3_(KIDS 14-15'
];

async function main() {
  console.log('Testing SKU resolution for parsed SKUs...');
  for (const raw of parsedSkus) {
    // Apply suffix cleaning regex first
    const cleaned = raw.replace(/(_[a-zA-Z0-9]+|-OT[0-9]+|-GL[0-9]+)$/, '');
    const mapping = await findBestSkuMapping(prisma, cleaned);
    console.log(`Raw: "${raw}" | Cleaned: "${cleaned}" | Mapped: ${mapping ? mapping.product.name : '❌ UNMAPPED'}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
