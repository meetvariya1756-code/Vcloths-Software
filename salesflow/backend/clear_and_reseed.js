const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting thorough database cleanup and reseeding...');

  // 1. Delete all existing sales records, mappings, imports, and products
  console.log('Deleting existing transactions and products...');
  await prisma.salesRecord.deleteMany({});
  await prisma.pdfImport.deleteMany({});
  await prisma.skuMapping.deleteMany({});
  await prisma.accountPrice.deleteMany({});
  await prisma.product.deleteMany({});

  console.log('Existing data deleted successfully.');

  // 2. Define the new correct products based on the requested categories and pricing structure
  const productsToSeed = [
    // 1. Shorts Category
    { name: 'Shorts', category: 'Shorts', base_price: 8000, labels_per_unit: 4 },
    { name: 'Stripe Shorts', category: 'Shorts', base_price: 13000, labels_per_unit: 4 },
    { name: 'Cord Shorts', category: 'Shorts', base_price: 16000, labels_per_unit: 4 },

    // 2. Track Category
    { name: 'Track Pants', category: 'Track', base_price: 10500, labels_per_unit: 4 },
    { name: 'Zipper Track', category: 'Track', base_price: 17500, labels_per_unit: 4 },
    { name: '3 Patti Track', category: 'Track', base_price: 13000, labels_per_unit: 4 },
    { name: 'Kids Track', category: 'Track', base_price: 10500, labels_per_unit: 2 },

    // 3. Barfi Category
    { name: 'Barfi', category: 'Barfi', base_price: 11000, labels_per_unit: 4 },
    { name: 'Kids Barfi', category: 'Barfi', base_price: 11000, labels_per_unit: 2 },

    // 4. Ladies Category
    { name: 'Ladies WB', category: 'Ladies', base_price: 16500, labels_per_unit: 4 },
    { name: 'Ladies GB', category: 'Ladies', base_price: 16500, labels_per_unit: 4 },

    // 5. Men\'s Category
    { name: 'Men WB', category: 'Men', base_price: 16500, labels_per_unit: 60 },
    { name: 'Men GB', category: 'Men', base_price: 16500, labels_per_unit: 60 },

    // 6. Kids Category
    { name: 'Kids WB', category: 'Kids', base_price: 16000, labels_per_unit: 2 },
    { name: 'Kids GB', category: 'Kids', base_price: 16000, labels_per_unit: 2 }
  ];

  console.log('Seeding new correct products...');
  for (const p of productsToSeed) {
    const created = await prisma.product.create({ data: p });
    console.log(`Created Product: ${created.name} in category ${created.category} (₹${created.base_price / 100})`);
  }

  console.log('Database cleanup and reseeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
