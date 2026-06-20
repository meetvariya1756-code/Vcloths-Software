const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany();
  console.log("All products in database:");
  products.forEach(p => {
    console.log(`- ID: ${p.id} | Name: "${p.name}" | Category: "${p.category}" | Labels/Unit: ${p.labels_per_unit}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
