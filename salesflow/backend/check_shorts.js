const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const prods = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: 'short', mode: 'insensitive' } },
        { category: { contains: 'short', mode: 'insensitive' } }
      ]
    },
    include: { sku_mappings: true }
  });
  console.log('=== SHORTS PRODUCTS ===');
  console.log(JSON.stringify(prods, null, 2));

  const allMappings = await prisma.skuMapping.findMany({
    where: {
      marketplace_sku: { startsWith: 'SH', mode: 'insensitive' }
    },
    include: { product: true }
  });
  console.log('\n=== SHPC SKU MAPPINGS ===');
  console.log(JSON.stringify(allMappings, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
