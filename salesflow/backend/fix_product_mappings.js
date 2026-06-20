const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('=== FIXING SKU PRODUCT DATA ===\n');

  // FIX 1: Fix Kids GB PC-2 product (ID:39) - wrong category and lpu
  const fix1 = await prisma.product.update({
    where: { id: 39 },
    data: {
      category: 'Kids',
      labels_per_unit: 2
    }
  });
  console.log('FIX 1: Kids GB PC-2 (ID:39) category set to Kids, lpu set to 2 ✓');

  // FIX 2: Fix Kids WB PC-2 product (ID:38) - wrong lpu
  const fix2 = await prisma.product.update({
    where: { id: 38 },
    data: {
      labels_per_unit: 2
    }
  });
  console.log('FIX 2: Kids WB PC-2 (ID:38) lpu set to 2 ✓');

  // FIX 3: Fix 7 WB SKUs wrongly mapped to Kids GB PC-1 (ID:21)
  // These should be mapped to Kids WB PC-2 (ID:38) since they are PC-2 products with (WB)
  const wrongIds = [1995, 1996, 1997, 1998, 1999, 2000, 2001];
  const fix3 = await prisma.skuMapping.updateMany({
    where: { id: { in: wrongIds } },
    data: { product_id: 38 } // Kids WB PC-2
  });
  console.log('FIX 3: Remapped ' + fix3.count + ' WB SKUs from Kids GB PC-1 to Kids WB PC-2 ✓');

  // Also update ImportedSku records for these
  const affectedSkuMappings = await prisma.skuMapping.findMany({ where: { id: { in: wrongIds } } });
  for (const mapping of affectedSkuMappings) {
    await prisma.importedSku.updateMany({
      where: { marketplace_sku: mapping.marketplace_sku },
      data: { product_id: 38 }
    });
    console.log('  ImportedSku updated for: ' + mapping.marketplace_sku);
  }

  // FIX 4: Fix Men WB PC-1 (ID:42) and Men WB PC-2 (ID:43) - fix lpu to match Men products
  // Men WB should have lpu:60 like Men GB
  const fix4a = await prisma.product.update({
    where: { id: 42 },
    data: { labels_per_unit: 60 }
  });
  console.log('\nFIX 4a: Men WB PC-1 (ID:42) lpu set to 60 ✓');

  const fix4b = await prisma.product.update({
    where: { id: 43 },
    data: { labels_per_unit: 60 }
  });
  console.log('FIX 4b: Men WB PC-2 (ID:43) lpu set to 60 ✓');

  // FIX 5: Fix Ladies GB PC-2 and Ladies WB PC-2 - wrong categories
  const ladiesGbPc2 = await prisma.product.update({
    where: { id: 37 },
    data: { category: 'Ladies', labels_per_unit: 4 }
  });
  console.log('\nFIX 5a: Ladies GB PC-2 (ID:37) category set to Ladies, lpu=4 ✓');

  const ladiesWbPc2 = await prisma.product.update({
    where: { id: 36 },
    data: { category: 'Ladies', labels_per_unit: 4 }
  });
  console.log('FIX 5b: Ladies WB PC-2 (ID:36) category set to Ladies, lpu=4 ✓');

  // Show final state
  console.log('\n=== FINAL PRODUCT STATE ===');
  const products = await prisma.product.findMany({
    where: {
      name: {
        in: ['Kids WB PC-1', 'Kids WB PC-2', 'Kids GB PC-1', 'Kids GB PC-2',
             'Men WB PC-1', 'Men WB PC-2', 'Ladies WB PC-2', 'Ladies GB PC-2']
      }
    },
    orderBy: { name: 'asc' }
  });
  products.forEach(pr => {
    console.log('  ID:' + pr.id + ' | ' + pr.name + ' | lpu:' + pr.labels_per_unit + ' | cat:' + pr.category);
  });

  await prisma.$disconnect();
  console.log('\nAll fixes applied successfully!');
})();
