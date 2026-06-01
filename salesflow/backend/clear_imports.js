const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing old imports and sales records for a clean test...');
  await prisma.salesRecord.deleteMany({});
  await prisma.pdfImport.deleteMany({});
  console.log('Clear complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
