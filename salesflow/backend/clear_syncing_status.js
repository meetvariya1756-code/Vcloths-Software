const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const meeshoResult = await prisma.account.updateMany({
    where: { meesho_sync_status: 'syncing' },
    data: {
      meesho_sync_status: 'failed',
      meesho_sync_error: 'Sync timed out or aborted due to server restart. Please try triggering it again.'
    }
  });
  
  const flipkartResult = await prisma.account.updateMany({
    where: { flipkart_sync_status: 'syncing' },
    data: {
      flipkart_sync_status: 'failed',
      flipkart_sync_error: 'Sync timed out or aborted due to server restart. Please try triggering it again.'
    }
  });

  console.log(`Reset ${meeshoResult.count} stuck Meesho and ${flipkartResult.count} stuck Flipkart sync tasks.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
