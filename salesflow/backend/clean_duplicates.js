const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting duplicate account cleanup...');

  // Get all accounts with count of their related records
  const accounts = await prisma.account.findMany({
    include: {
      _count: {
        select: {
          sales_records: true,
          pdf_imports: true,
          account_prices: true
        }
      }
    }
  });

  // Group accounts by name and platform (case-insensitive)
  const groups = {};
  accounts.forEach(acc => {
    const key = `${acc.name.toLowerCase().trim()}_${acc.platform.toLowerCase().trim()}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(acc);
  });

  let deletedCount = 0;
  let mergedRecordsCount = 0;

  for (const key in groups) {
    const list = groups[key];
    if (list.length <= 1) continue;

    // Sort accounts so that the one with relations is first, otherwise the oldest ID is first
    list.sort((a, b) => {
      const aScore = a._count.sales_records + a._count.pdf_imports + a._count.account_prices;
      const bScore = b._count.sales_records + b._count.pdf_imports + b._count.account_prices;
      if (aScore !== bScore) {
        return bScore - aScore; // higher score first
      }
      return a.id - b.id; // smaller ID first
    });

    const master = list[0];
    const duplicates = list.slice(1);

    console.log(`\nGrouping for "${master.name}" [${master.platform}]:`);
    console.log(`  Master Account ID: ${master.id} (Sales: ${master._count.sales_records}, Imports: ${master._count.pdf_imports})`);

    for (const dup of duplicates) {
      console.log(`  Duplicate Account ID: ${dup.id} (Sales: ${dup._count.sales_records}, Imports: ${dup._count.pdf_imports}) - Merging & Deleting`);

      // 1. Move sales records if any exist
      if (dup._count.sales_records > 0) {
        const updateSales = await prisma.salesRecord.updateMany({
          where: { account_id: dup.id },
          data: { account_id: master.id }
        });
        mergedRecordsCount += updateSales.count;
        console.log(`    Moved ${updateSales.count} sales records.`);
      }

      // 2. Move PDF imports if any exist
      if (dup._count.pdf_imports > 0) {
        const imports = await prisma.pdfImport.findMany({ where: { account_id: dup.id } });
        for (const imp of imports) {
          try {
            await prisma.pdfImport.update({
              where: { id: imp.id },
              data: { account_id: master.id }
            });
            console.log(`    Moved PDF import "${imp.filename}".`);
          } catch (e) {
            // If it already exists for the master, we can delete the duplicate PDF import record since it's already there
            await prisma.pdfImport.delete({ where: { id: imp.id } });
            console.log(`    Deleted conflicting PDF import "${imp.filename}".`);
          }
        }
      }

      // 3. Move price overrides if any exist
      if (dup._count.account_prices > 0) {
        const prices = await prisma.accountPrice.findMany({ where: { account_id: dup.id } });
        for (const price of prices) {
          try {
            await prisma.accountPrice.update({
              where: { id: price.id },
              data: { account_id: master.id }
            });
            console.log(`    Moved price override for product ID ${price.product_id}.`);
          } catch (e) {
            // Already exists, delete duplicate
            await prisma.accountPrice.delete({ where: { id: price.id } });
            console.log(`    Deleted conflicting price override for product ID ${price.product_id}.`);
          }
        }
      }

      // 4. Delete the duplicate account
      await prisma.account.delete({
        where: { id: dup.id }
      });
      deletedCount++;
    }
  }

  console.log(`\nCleanup complete! Deleted ${deletedCount} duplicate accounts.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
