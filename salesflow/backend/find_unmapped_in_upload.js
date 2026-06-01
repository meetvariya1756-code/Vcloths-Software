const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { findBestSkuMapping } = require('./utils/skuMatcher');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

async function main() {
  // Find PDF in downloads
  const downloadsPath = 'C:\\Users\\Venner\\Downloads';
  const files = fs.readdirSync(downloadsPath);
  const pdfFile = files.find(f => f.includes('27.6.2026') && f.includes('DONE'));

  if (!pdfFile) {
    console.log('No PDF file found!');
    return;
  }

  const filePath = path.join(downloadsPath, pdfFile);
  console.log(`Testing parsing for: ${filePath}`);

  // Send to python parser
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), pdfFile);

  const response = await axios.post('http://localhost:5001/parse', form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  const records = response.data.records || [];
  console.log(`Parsed ${records.length} records.`);

  const unmapped = [];
  for (const r of records) {
    const mapping = await findBestSkuMapping(prisma, r.raw_sku);
    if (!mapping) {
      unmapped.push(r.raw_sku);
    }
  }

  console.log('--- Unmapped SKUs ---');
  console.log(Array.from(new Set(unmapped)));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
