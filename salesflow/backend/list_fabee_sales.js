const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sales = await prisma.salesRecord.findMany({
    include: {
      product: true,
      account: true
    }
  });

  console.log(`Total Sales Records in DB: ${sales.length}`);
  sales.forEach(s => {
    console.log(`- Date: ${s.date.toISOString().split('T')[0]} | Account: ${s.account.name} | SKU: "${s.marketplace_sku}" | Product Name: "${s.product.name}" | Qty: ${s.quantity} | Labels: ${s.labels_total}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
