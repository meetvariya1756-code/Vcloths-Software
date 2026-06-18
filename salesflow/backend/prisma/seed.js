const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('VenneR@2Thou-26', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'Venner-Sales' },
    update: {},
    create: {
      username: 'Venner-Sales',
      password: hashedPassword
    }
  });
  console.log('Created user:', admin.username);

  // Products
  const productsData = [
    { name: 'Men WB Boxer PC-3', category: 'Innerwear', labels_per_unit: 180, base_price: 16500 }, // ₹165
    { name: 'Shorts PC-3', category: 'Apparel', labels_per_unit: 4, base_price: 8000 },          // ₹80
    { name: 'Kids Barfi PC-3', category: 'Kids', labels_per_unit: 2, base_price: 11000 },       // ₹110
    { name: 'Men GB PC-2', category: 'Innerwear', labels_per_unit: 60, base_price: 13000 }       // ₹130
  ];

  const products = [];
  for (const p of productsData) {
    let prod = await prisma.product.findFirst({
      where: { name: p.name }
    });
    if (!prod) {
      prod = await prisma.product.create({
        data: p
      });
      console.log(`Created product: ${prod.name}`);
    } else {
      console.log(`Product already exists: ${prod.name}`);
    }
    products.push(prod);
  }

  // Find products by name for mapping
  const boxer = products.find(p => p.name === 'Men WB Boxer PC-3');
  const shorts = products.find(p => p.name === 'Shorts PC-3');
  const kidsBarfi = products.find(p => p.name === 'Kids Barfi PC-3');

  // Accounts
  const accountsData = [
    { name: 'VIMS', platform: 'meesho' },
    { name: 'VENNER NEW', platform: 'meesho' },
    { name: 'VENNER FASHION', platform: 'meesho' },
    { name: 'CLASSY', platform: 'meesho' },
    { name: 'PANDAV ( MONTUBHAI )', platform: 'meesho' },
    { name: 'MANYA EMPIRE', platform: 'meesho' },
    { name: 'TENDANZA', platform: 'meesho' },
    { name: 'FASHION INSTA', platform: 'meesho' },
    { name: 'BE YOURS', platform: 'meesho' },
    { name: 'DAPPERDOM', platform: 'meesho' },
    { name: 'LATTER LAGOON', platform: 'meesho' },
    { name: 'BALAPARI', platform: 'meesho' },
    { name: 'ATHARVA', platform: 'meesho' },
    { name: 'AHANA', platform: 'meesho' },
    { name: 'MANYA CAPITAL', platform: 'meesho' },
    { name: 'HK', platform: 'meesho' },
    { name: 'INFINITY', platform: 'meesho' },
    { name: 'SHIV', platform: 'meesho' },
    { name: 'THREAD TROVE', platform: 'meesho' },
    { name: 'AV IMPEX', platform: 'meesho' },
    { name: 'RV IMPEX', platform: 'meesho' },
    { name: 'MK MART', platform: 'meesho' },
    { name: 'FABREE CART', platform: 'meesho' },
    { name: 'FASHION MANIA', platform: 'meesho' },
    { name: 'PURE THREAD', platform: 'meesho' },
    { name: 'BALAPARI FASHION', platform: 'meesho' },
    { name: 'STATIC STITCH', platform: 'meesho' }
  ];

  const accounts = [];
  for (const acc of accountsData) {
    let account = await prisma.account.findFirst({
      where: {
        name: acc.name,
        platform: acc.platform
      }
    });
    if (!account) {
      account = await prisma.account.create({
        data: {
          name: acc.name,
          platform: acc.platform,
          is_active: true
        }
      });
      console.log(`Created account: ${account.name} [${acc.platform}]`);
    } else {
      console.log(`Account already exists: ${account.name} [${acc.platform}]`);
    }
    accounts.push(account);
  }

  // SKU Mappings
  const mappings = [
    { marketplace_sku: 'MEN-WB-BGY-PC-3', product_id: boxer.id, color_variant: 'BGY', size_variant: 'M', platform: 'meesho' },
    { marketplace_sku: 'PC-3(WB)-(BGY)', product_id: boxer.id, color_variant: 'BGY', size_variant: 'M', platform: 'meesho' },
    { marketplace_sku: 'PC-3(WB)-(BLK+GRY+WHT)', product_id: boxer.id, color_variant: 'BLK+GRY+WHT', size_variant: 'L', platform: 'meesho' },
    { marketplace_sku: 'PC-3(WB)-(RED+BLK+NAVY)', product_id: boxer.id, color_variant: 'RED+BLK+NAVY', size_variant: 'XL', platform: 'meesho' },
    { marketplace_sku: 'SHPC-1', product_id: shorts.id, color_variant: 'Assorted', size_variant: 'L', platform: 'meesho' },
    { marketplace_sku: 'SHPC-2', product_id: shorts.id, color_variant: 'Assorted', size_variant: 'XL', platform: 'meesho' },
    { marketplace_sku: 'SHPC-3', product_id: shorts.id, color_variant: 'Assorted', size_variant: 'XXL', platform: 'meesho' },
    { marketplace_sku: 'SHPC-4', product_id: shorts.id, color_variant: 'Assorted', size_variant: 'M', platform: 'meesho' },
    { marketplace_sku: 'KIDS-BARFI-PC-3', product_id: kidsBarfi.id, color_variant: 'Assorted', size_variant: '24', platform: 'meesho' },
    { marketplace_sku: 'KIDS-BARFI-1', product_id: kidsBarfi.id, color_variant: 'Assorted', size_variant: '26', platform: 'meesho' }
  ];

  for (const m of mappings) {
    const existing = await prisma.skuMapping.findUnique({
      where: { marketplace_sku: m.marketplace_sku }
    });
    if (!existing) {
      await prisma.skuMapping.create({
        data: m
      });
      console.log(`Created mapping: ${m.marketplace_sku} -> Product ID ${m.product_id}`);
    } else {
      console.log(`Mapping already exists: ${m.marketplace_sku}`);
    }
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
