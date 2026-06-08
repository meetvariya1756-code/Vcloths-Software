const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    include: {
      _count: {
        select: {
          sales_records: true,
          pdf_imports: true,
          account_prices: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log('Total accounts found:', accounts.length);
  accounts.forEach(acc => {
    console.log(`ID: ${acc.id} | Name: ${acc.name} | Platform: ${acc.platform} | Sales Records: ${acc._count.sales_records} | PDF Imports: ${acc._count.pdf_imports} | Price Overrides: ${acc._count.account_prices}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
