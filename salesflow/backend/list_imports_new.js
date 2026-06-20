const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const imports = await prisma.pdfImport.findMany({
    include: { account: true }
  });
  console.log("PDF Imports in DB:");
  imports.forEach(i => {
    console.log(`- ID: ${i.id} | File: "${i.filename}" | Account: ${i.account.name} | Status: ${i.status} | Records: ${i.records_extracted}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
