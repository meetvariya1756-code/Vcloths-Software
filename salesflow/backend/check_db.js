const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const importsCount = await prisma.pdfImport.count();
  const salesCount = await prisma.salesRecord.count();
  const imports = await prisma.pdfImport.findMany({
    include: { account: true }
  });

  console.log(`PDF Imports Count: ${importsCount}`);
  console.log(`Sales Records Count: ${salesCount}`);
  console.log('\n--- PDF Imports List ---');
  imports.forEach(imp => {
    console.log(`ID: ${imp.id} | File: ${imp.filename} | Account: ${imp.account.name} | Status: ${imp.status} | Records: ${imp.records_extracted}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
