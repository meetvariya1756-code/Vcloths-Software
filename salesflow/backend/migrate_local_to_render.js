const { PrismaClient } = require('@prisma/client');

async function main() {
  const localUrl = "postgresql://postgres:meet1756@localhost:5432/salesflow?schema=public";
  const renderUrl = "postgresql://venner_sales_flow_user:U9IqA9DpudVD9zEONvcLQ5QS0MVCGQuv@dpg-d8qkg7v7f7vs73ebm2cg-a.ohio-postgres.render.com/venner_sales_flow?schema=public";

  console.log('Initializing connection to Local Database...');
  const localPrisma = new PrismaClient({ datasources: { db: { url: localUrl } } });

  console.log('Initializing connection to Render Database...');
  const renderPrisma = new PrismaClient({ datasources: { db: { url: renderUrl } } });

  try {
    // 1. Fetch all data from Local Database
    console.log('\n--- Reading Local Data ---');
    
    console.log('Reading Users...');
    const users = await localPrisma.user.findMany();
    
    console.log('Reading Products...');
    const products = await localPrisma.product.findMany();
    
    console.log('Reading Accounts...');
    const accounts = await localPrisma.account.findMany();
    
    console.log('Reading Account Prices...');
    const accountPrices = await localPrisma.accountPrice.findMany();
    
    console.log('Reading SKU Mappings...');
    const skuMappings = await localPrisma.skuMapping.findMany();
    
    console.log('Reading Imported SKUs...');
    const importedSkus = await localPrisma.importedSku.findMany();
    
    console.log('Reading PDF Imports...');
    const pdfImports = await localPrisma.pdfImport.findMany();
    
    console.log('Reading Sales Records...');
    const salesRecords = await localPrisma.salesRecord.findMany();

    console.log(`\nSuccessfully loaded from Local Database:`);
    console.log(`- Users: ${users.length}`);
    console.log(`- Products: ${products.length}`);
    console.log(`- Accounts: ${accounts.length}`);
    console.log(`- Account Prices: ${accountPrices.length}`);
    console.log(`- SKU Mappings: ${skuMappings.length}`);
    console.log(`- Imported SKUs: ${importedSkus.length}`);
    console.log(`- PDF Imports: ${pdfImports.length}`);
    console.log(`- Sales Records: ${salesRecords.length}`);

    // 2. Clear all tables in Render Database (in reverse dependency order)
    console.log('\n--- Clearing Render Database (Starting fresh) ---');
    
    console.log('Deleting Sales Records on Render...');
    await renderPrisma.salesRecord.deleteMany({});
    
    console.log('Deleting PDF Imports on Render...');
    await renderPrisma.pdfImport.deleteMany({});
    
    console.log('Deleting Imported SKUs on Render...');
    await renderPrisma.importedSku.deleteMany({});
    
    console.log('Deleting SKU Mappings on Render...');
    await renderPrisma.skuMapping.deleteMany({});
    
    console.log('Deleting Account Prices on Render...');
    await renderPrisma.accountPrice.deleteMany({});
    
    console.log('Deleting Accounts on Render...');
    await renderPrisma.account.deleteMany({});
    
    console.log('Deleting Products on Render...');
    await renderPrisma.product.deleteMany({});
    
    console.log('Deleting Users on Render...');
    await renderPrisma.user.deleteMany({});

    console.log('Render database cleared successfully.');

    // 3. Insert all data into Render Database (in dependency order)
    console.log('\n--- Writing Data to Render Cloud Database ---');

    console.log('Writing Users...');
    if (users.length > 0) {
      await renderPrisma.user.createMany({ data: users });
    }

    console.log('Writing Products...');
    if (products.length > 0) {
      await renderPrisma.product.createMany({ data: products });
    }

    console.log('Writing Accounts...');
    if (accounts.length > 0) {
      await renderPrisma.account.createMany({ data: accounts });
    }

    console.log('Writing Account Prices...');
    if (accountPrices.length > 0) {
      await renderPrisma.accountPrice.createMany({ data: accountPrices });
    }

    console.log('Writing SKU Mappings...');
    if (skuMappings.length > 0) {
      // Create in batches to avoid payload size limit
      const batchSize = 250;
      for (let i = 0; i < skuMappings.length; i += batchSize) {
        const batch = skuMappings.slice(i, i + batchSize);
        await renderPrisma.skuMapping.createMany({ data: batch });
        console.log(`  Processed SKU Mappings batch ${i + 1} to ${Math.min(i + batchSize, skuMappings.length)}`);
      }
    }

    console.log('Writing Imported SKUs...');
    if (importedSkus.length > 0) {
      const batchSize = 250;
      for (let i = 0; i < importedSkus.length; i += batchSize) {
        const batch = importedSkus.slice(i, i + batchSize);
        await renderPrisma.importedSku.createMany({ data: batch });
        console.log(`  Processed Imported SKUs batch ${i + 1} to ${Math.min(i + batchSize, importedSkus.length)}`);
      }
    }

    console.log('Writing PDF Imports...');
    if (pdfImports.length > 0) {
      await renderPrisma.pdfImport.createMany({ data: pdfImports });
    }

    console.log('Writing Sales Records...');
    if (salesRecords.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < salesRecords.length; i += batchSize) {
        const batch = salesRecords.slice(i, i + batchSize);
        await renderPrisma.salesRecord.createMany({ data: batch });
        console.log(`  Processed Sales Records batch ${i + 1} to ${Math.min(i + batchSize, salesRecords.length)}`);
      }
    }

    console.log('\n=========================================');
    console.log('🎉 SUCCESS: Data Migration Complete!');
    console.log('All local mappings, credentials, products, and logs have been synced to the Render database.');
    console.log('=========================================');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await localPrisma.$disconnect();
    await renderPrisma.$disconnect();
  }
}

main();
