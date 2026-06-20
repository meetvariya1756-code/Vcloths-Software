const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = [
    'users',
    'products',
    'accounts',
    'account_prices',
    'sku_mappings',
    'imported_skus',
    'pdf_imports',
    'sales_records'
  ];

  console.log('Fixing auto-increment sequences for all tables...');
  for (const table of tables) {
    try {
      // Resolve the sequence name and reset it to COALESCE(MAX(id), 1)
      // If the max ID is set, the next autoincrement ID will be max ID + 1.
      const query = `
        SELECT setval(
          pg_get_serial_sequence('"${table}"', 'id'),
          COALESCE((SELECT MAX(id) FROM "${table}"), 1),
          true
        );
      `;
      await prisma.$executeRawUnsafe(query);
      console.log(`✅ Successfully reset sequence counter for table: "${table}"`);
    } catch (err) {
      console.error(`❌ Failed to reset sequence for table "${table}":`, err.message);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
