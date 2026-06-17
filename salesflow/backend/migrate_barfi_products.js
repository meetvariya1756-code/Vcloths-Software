const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function resolveBarfiPackSize(sku, defaultPackSize = 1) {
  const upper = sku.toUpperCase().trim();
  
  // 1. Explicit PC-X, PC_X, PCX
  const pcMatch = upper.match(/PC[-_]?([1-3])/i);
  if (pcMatch) return parseInt(pcMatch[1]);
  
  // 2. B#A-X
  const bhashMatch = upper.match(/B#A([1-3])/i);
  if (bhashMatch) return parseInt(bhashMatch[1]);
  
  // 3. Count colors separated by '+'
  if (upper.includes('+')) {
    const parts = upper.split('+');
    const count = parts.length;
    if (count >= 1 && count <= 3) {
      return count;
    }
  }
  
  // 4. Ends with -1, _1, etc.
  const endMatch = upper.match(/[-_]([1-3])$/);
  if (endMatch) return parseInt(endMatch[1]);
  
  return defaultPackSize;
}

async function main() {
  console.log('Starting BARFI products migration...');

  // 1. Create/upsert the three valid master products
  const productsToCreate = [
    { name: 'BARFI-PC-1 (Pack of 1 Piece)', category: 'Barfi', base_price: 11000, labels_per_unit: 1 },
    { name: 'BARFI-PC-2 (Pack of 2 Pieces)', category: 'Barfi', base_price: 11000, labels_per_unit: 2 },
    { name: 'BARFI-PC-3 (Pack of 3 Pieces)', category: 'Barfi', base_price: 11000, labels_per_unit: 3 }
  ];

  const barfiProducts = {};
  for (const p of productsToCreate) {
    let dbProd = await prisma.product.findFirst({
      where: { name: p.name }
    });
    if (!dbProd) {
      dbProd = await prisma.product.create({ data: p });
      console.log(`Created new product: ${dbProd.name} (ID: ${dbProd.id})`);
    } else {
      console.log(`Product already exists: ${dbProd.name} (ID: ${dbProd.id})`);
    }
    barfiProducts[p.labels_per_unit] = dbProd.id;
  }

  // 2. Identify legacy products
  const allProds = await prisma.product.findMany();
  const legacyProds = allProds.filter(p => {
    const nameLower = p.name.toLowerCase();
    const isBarfi = nameLower.includes('barfi') || nameLower.includes('burfi');
    const isNew = p.name.startsWith('BARFI-PC-');
    return isBarfi && !isNew;
  });

  const legacyIds = legacyProds.map(p => p.id);
  console.log(`Found legacy products: ${legacyProds.map(p => `${p.name} (ID: ${p.id})`).join(', ')}`);

  if (legacyIds.length === 0) {
    console.log('No legacy products found. Migration might have already run.');
    return;
  }

  // 3. Migrate SkuMappings
  console.log('\nMigrating SkuMappings...');
  const mappings = await prisma.skuMapping.findMany({
    where: { product_id: { in: legacyIds } }
  });
  console.log(`Found ${mappings.length} SkuMappings to migrate.`);
  for (const m of mappings) {
    const packSize = resolveBarfiPackSize(m.marketplace_sku, 1);
    const targetProdId = barfiProducts[packSize];
    console.log(`  Mapping: ${m.marketplace_sku} -> resolve pack size: ${packSize} -> Target Product ID: ${targetProdId}`);
    
    // Check if a mapping for marketplace_sku already exists with the target product to avoid duplicate unique key error
    // Although marketplace_sku is @unique in SkuMapping, updating the product_id of the existing mapping is safe.
    await prisma.skuMapping.update({
      where: { id: m.id },
      data: {
        product_id: targetProdId,
        quantity: 1
      }
    });
  }

  // 4. Migrate SalesRecords
  console.log('\nMigrating SalesRecords...');
  const sales = await prisma.salesRecord.findMany({
    where: { product_id: { in: legacyIds } }
  });
  console.log(`Found ${sales.length} SalesRecords to migrate.`);
  for (const s of sales) {
    const ratio = Number(s.quantity) / (s.labels_total || 1);
    let packSize = ratio;
    if (packSize !== 1 && packSize !== 2 && packSize !== 3) {
      packSize = resolveBarfiPackSize(s.marketplace_sku, 1);
    }
    const targetProdId = barfiProducts[packSize];
    await prisma.salesRecord.update({
      where: { id: s.id },
      data: { product_id: targetProdId }
    });
  }

  // 5. Migrate AccountPrices
  console.log('\nMigrating AccountPrices...');
  const accountPrices = await prisma.accountPrice.findMany({
    where: { product_id: { in: legacyIds } }
  });
  console.log(`Found ${accountPrices.length} AccountPrices to migrate.`);
  for (const ap of accountPrices) {
    // Replicate custom account price for all 3 new products
    for (const size of [1, 2, 3]) {
      const targetProdId = barfiProducts[size];
      await prisma.accountPrice.upsert({
        where: {
          account_id_product_id: {
            account_id: ap.account_id,
            product_id: targetProdId
          }
        },
        update: { price: ap.price },
        create: {
          account_id: ap.account_id,
          product_id: targetProdId,
          price: ap.price
        }
      });
    }
  }

  // 6. Migrate ImportedSkus
  console.log('\nMigrating ImportedSkus...');
  const importedSkus = await prisma.importedSku.findMany({
    where: { product_id: { in: legacyIds } }
  });
  console.log(`Found ${importedSkus.length} ImportedSkus to migrate.`);
  for (const i of importedSkus) {
    const packSize = resolveBarfiPackSize(i.marketplace_sku, 1);
    const targetProdId = barfiProducts[packSize];
    await prisma.importedSku.update({
      where: { id: i.id },
      data: { product_id: targetProdId }
    });
  }

  // 7. Delete legacy products
  console.log('\nDeleting legacy products...');
  const deleteResult = await prisma.product.deleteMany({
    where: { id: { in: legacyIds } }
  });
  console.log(`Deleted ${deleteResult.count} legacy products.`);

  console.log('\nBARFI products migration completed successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
