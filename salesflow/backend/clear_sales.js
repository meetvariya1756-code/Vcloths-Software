const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing all sales records to remove orphaned daily report data...');
  const result = await prisma.salesRecord.deleteMany({});
  console.log(`Successfully deleted ${result.count} orphaned sales records!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
