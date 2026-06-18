const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const records = await prisma.salesRecord.findMany({
    where: { product_id: 23 },
    select: { id: true, marketplace_sku: true, quantity: true, labels_total: true, date: true }
  });
  console.log('SalesRecords for Shorts PC-3 (product 23):');
  console.log(JSON.stringify(records, null, 2));
  console.log(`\nTotal: ${records.length} records`);

  const accountPrices = await prisma.accountPrice.findMany({
    where: { product_id: 23 },
    include: { account: true }
  });
  console.log('\nAccountPrices for Shorts PC-3:');
  console.log(JSON.stringify(accountPrices, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
