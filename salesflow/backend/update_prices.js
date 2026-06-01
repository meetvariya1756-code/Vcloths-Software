const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Updating product base prices to match business rules...');

  // Update Men GB PC-2 base price to 16500 (₹165)
  await prisma.product.updateMany({
    where: { name: { contains: 'GB' } },
    data: { base_price: 16500 }
  });

  // Update Men WB Boxer PC-3 base price to 16500 (₹165)
  await prisma.product.updateMany({
    where: { name: { contains: 'Boxer' } },
    data: { base_price: 16500 }
  });

  console.log('Successfully updated product prices!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
