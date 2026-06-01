const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Mapping the remaining kids SKU...');

  const products = await prisma.product.findMany();
  const barfi = products.find(p => p.name.includes('Barfi')) || products[2];

  const mappings = [
    { marketplace_sku: 'PC_3_(KIDS 14-15', product_id: barfi.id, color_variant: 'Assorted', size_variant: 'M', platform: 'meesho' }
  ];

  for (const m of mappings) {
    await prisma.skuMapping.upsert({
      where: { marketplace_sku: m.marketplace_sku },
      update: {},
      create: m
    });
    console.log(`Ensured mapping: ${m.marketplace_sku} -> Product ID ${m.product_id}`);
  }

  console.log('Successfully completed mapping!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
