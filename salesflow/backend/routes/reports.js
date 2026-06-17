const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to format Date to IST YYYY-MM-DD
function toISTDateString(date) {
  return new Date(date.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().split('T')[0];
}

// Helper to standardize SKUs based on product name and extract the pieces multiplier
function getStandardizedSku(sku, productName) {
  if (!sku) return "Unknown";
  const upperSku = sku.toUpperCase().trim();
  const pName = (productName || '').toLowerCase();

  // 1. Determine base prefix from product name
  let basePrefix = 'OTHER';
  if (pName.includes('stripe shorts')) {
    basePrefix = 'STRIP-SH-WB-PC';
  } else if (pName.includes('cord shorts')) {
    basePrefix = 'CORD-SH-PC';
  } else if (pName.includes('zipper track')) {
    basePrefix = '(ZIPER)-TRACK-PC';
  } else if (pName.includes('3 patti track')) {
    basePrefix = '3-PATTI-TRACK-PC';
  } else if (pName.includes('kids track')) {
    basePrefix = 'KIDS-TRACK-PC';
  } else if (pName.includes('track pants')) {
    basePrefix = 'TRACKPC';
  } else if (pName.includes('kids barfi')) {
    basePrefix = 'KIDS-BARFI-PC';
  } else if (pName.includes('barfi')) {
    basePrefix = 'BARFI-PC';
  } else if (pName.includes('ladies wb')) {
    basePrefix = 'LDS-WB-BGY';
  } else if (pName.includes('ladies gb')) {
    basePrefix = 'LDS-GB-BGY';
  } else if (pName.includes('men wb')) {
    basePrefix = 'MEN-WB';
  } else if (pName.includes('men gb')) {
    basePrefix = 'MEN-GB';
  } else if (pName.includes('kids wb')) {
    basePrefix = 'KIDS-WB-BGY';
  } else if (pName.includes('kids gb')) {
    basePrefix = 'KIDS-GB-BGY';
  } else if (pName.includes('shorts')) {
    basePrefix = 'SHPC';
  } else if (pName.includes('cargo')) {
    basePrefix = 'CARGO-PC';
  } else {
    // Fallback parser if product name doesn't match
    let clean = upperSku.replace(/PC[-_]?\d+/i, '').replace(/[-_]?\d+$/, '').trim();
    clean = clean.replace(/[-_+]+$/, '').trim();
    basePrefix = clean || 'OTHER';
  }

  // 2. Extract pcNum from raw SKU
  let pcNum = null;
  const pcMatch = upperSku.match(/PC[-_]?(\d+)/i);
  if (pcMatch) {
    pcNum = parseInt(pcMatch[1]);
  }

  if (pcNum === null) {
    const endMatch = upperSku.match(/[-_](\d+)$/);
    if (endMatch) {
      pcNum = parseInt(endMatch[1]);
    }
  }

  if (pcNum === null) {
    const firstNumMatch = upperSku.match(/\d+/);
    if (firstNumMatch) {
      pcNum = parseInt(firstNumMatch[0]);
    }
  }

  if (pcNum === null) {
    pcNum = 1;
  }

  return `${basePrefix}-${pcNum}`;
}

// GET Daily Report
router.get('/daily', async (req, res) => {
  const { date, accountId, platform, category } = req.query;

  try {
    let targetDate = new Date();
    let isValidDate = true;
    if (date) {
      targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        isValidDate = false;
      } else {
        const yearVal = targetDate.getFullYear();
        if (yearVal < 1000 || yearVal > 9999) {
          isValidDate = false;
        }
      }
    }

    if (!isValidDate) {
      const activeAccountsCount = await prisma.account.count({ where: { is_active: true } }).catch(() => 0);
      return res.json({
        metrics: {
          totalPieces: 0,
          totalLabels: 0,
          totalRevenue: 0,
          activeAccounts: activeAccountsCount
        },
        platformSummary: [],
        table: [],
        whatsappMessage: ""
      });
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Build filters
    const where = {
      date: { gte: startOfDay, lte: endOfDay }
    };

    if (accountId) {
      where.account_id = parseInt(accountId);
    }
    if (platform) {
      where.account = { platform: platform.toLowerCase() };
    }
    if (category) {
      where.product = { category: category };
    }

    const sales = await prisma.salesRecord.findMany({
      where,
      include: {
        product: true,
        account: true
      }
    });

    // Fetch SKU mappings for color & size extraction
    const mappings = await prisma.skuMapping.findMany();
    const mappingsMap = new Map(mappings.map(m => [m.marketplace_sku.toLowerCase().trim(), m]));

    // Aggregates for Metric Cards
    let totalPieces = 0;
    let totalLabels = 0;
    let totalRevenue = 0n;

    // Platform-wise Summary initialization
    const platformSummary = {
      meesho: { pieces: 0, labels: 0, revenue: 0n },
      flipkart: { pieces: 0, labels: 0, revenue: 0n },
      amazon: { pieces: 0, labels: 0, revenue: 0n }
    };

    // Group records dynamically by their marketplace SKU
    const grouped = {};
    for (const s of sales) {
      const skuKey = s.marketplace_sku.trim();
      const accountId = s.account_id;
      const groupKey = `${skuKey}_${accountId}`;

      const mapping = mappingsMap.get(skuKey.toLowerCase());
      const color = mapping ? mapping.color_variant || 'Assorted' : 'Assorted';
      const size = mapping ? mapping.size_variant || 'Free' : 'Free';

      totalPieces += s.quantity;
      totalLabels += s.labels_total;
      totalRevenue += s.revenue;

      // Platform summaries accumulation
      const plat = s.account.platform.toLowerCase();
      if (platformSummary[plat]) {
        platformSummary[plat].pieces += s.quantity;
        platformSummary[plat].labels += s.labels_total;
        platformSummary[plat].revenue += s.revenue;
      }

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          product_name: s.product.name,
          sku: skuKey,
          category: s.product.category,
          color,
          size,
          quantity: 0,
          labels_per_unit: s.product.labels_per_unit,
          total_labels: 0,
          revenue: 0n,
          account_name: s.account.name,
          platform: s.account.platform
        };
      }

      grouped[groupKey].quantity += s.quantity;
      grouped[groupKey].total_labels += s.labels_total;
      grouped[groupKey].revenue += s.revenue;
    }

    const tableData = Object.values(grouped).map(g => {
      const pricePerLabel = Number(g.revenue) / (g.total_labels || 1);
      return {
        product_name: g.product_name,
        sku: g.sku,
        category: g.category,
        color: g.color,
        size: g.size,
        quantity: g.quantity,
        labels_per_unit: g.labels_per_unit,
        total_labels: g.total_labels,
        price: pricePerLabel, // in paisa
        revenue: Number(g.revenue), // in paisa
        account_name: g.account_name,
        platform: g.platform
      };
    });

    const activeAccountsCount = await prisma.account.count({ where: { is_active: true } });

    // Format platform summary for frontend
    const platformList = Object.entries(platformSummary).map(([plat, metrics]) => ({
      platform: plat.charAt(0).toUpperCase() + plat.slice(1),
      pieces: metrics.pieces,
      labels: metrics.labels,
      revenue: Number(metrics.revenue)
    }));

    // Generate WhatsApp Summary Message (respects selected filters)
    const allDailySales = await prisma.salesRecord.findMany({
      where,
      include: {
        product: true
      }
    });

    const prodGroups = {};
    for (const s of allDailySales) {
      const pName = s.product.name;
      if (!prodGroups[pName]) {
        prodGroups[pName] = {};
      }
      const stdSku = getStandardizedSku(s.marketplace_sku, pName);
      prodGroups[pName][stdSku] = (prodGroups[pName][stdSku] || 0) + s.quantity;
    }

    let displayDateStr = "";
    if (date) {
      const parts = date.split('-');
      if (parts.length === 3) {
        displayDateStr = `${parseInt(parts[2])}-${parseInt(parts[1])}-${parts[0]}`;
      }
    }
    if (!displayDateStr) {
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(new Date().getTime() + istOffset);
      const day = istDate.getUTCDate();
      const month = istDate.getUTCMonth() + 1;
      const year = istDate.getUTCFullYear();
      displayDateStr = `${day}-${month}-${year}`;
    }

    let whatsappMessage = `${displayDateStr}\n\n`;
    const sortedProds = Object.keys(prodGroups).sort();
    sortedProds.forEach((pName, idx) => {
      const skus = prodGroups[pName];
      const sortedSkus = Object.keys(skus).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      sortedSkus.forEach(sku => {
        whatsappMessage += `${sku} - ${skus[sku]}\n`;
      });
      if (idx < sortedProds.length - 1) {
        whatsappMessage += '\n';
      }
    });
    whatsappMessage = whatsappMessage.trim();

    res.json({
      metrics: {
        totalPieces,
        totalLabels,
        totalRevenue: Number(totalRevenue),
        activeAccounts: activeAccountsCount
      },
      platformSummary: platformList,
      table: tableData,
      whatsappMessage
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch daily report: ' + err.message });
  }
});

// GET Monthly Report
router.get('/monthly', async (req, res) => {
  const { month, year } = req.query; // 1-indexed month (1-12)

  try {
    const now = new Date();
    let targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    let targetYear = year ? parseInt(year) : now.getFullYear();

    if (isNaN(targetMonth) || targetMonth < 0 || targetMonth > 11) {
      targetMonth = now.getMonth();
    }
    if (isNaN(targetYear) || targetYear < 1000 || targetYear > 9999) {
      targetYear = now.getFullYear();
    }

    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    const sales = await prisma.salesRecord.findMany({
      where: {
        date: { gte: startOfMonth, lte: endOfMonth }
      },
      include: {
        product: true,
        account: true
      }
    });

    let totalPieces = 0;
    let totalLabels = 0;
    let totalRevenue = 0n;

    const productSummary = {};
    const accountSummary = {};
    const dayWiseSales = {};

    // Initialize day-wise sales
    const daysInMonth = endOfMonth.getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      dayWiseSales[d] = 0;
    }

    for (const s of sales) {
      totalPieces += s.quantity;
      totalLabels += s.labels_total;
      totalRevenue += s.revenue;

      // Product sales
      const pId = s.product_id;
      if (!productSummary[pId]) {
        productSummary[pId] = {
          name: s.product.name,
          quantity: 0,
          labels_total: 0,
          revenue: 0n
        };
      }
      productSummary[pId].quantity += s.quantity;
      productSummary[pId].labels_total += s.labels_total;
      productSummary[pId].revenue += s.revenue;

      // Account sales
      const aId = s.account_id;
      if (!accountSummary[aId]) {
        accountSummary[aId] = {
          name: s.account.name,
          revenue: 0n
        };
      }
      accountSummary[aId].revenue += s.revenue;

      // Day-wise pieces
      const day = new Date(s.date).getDate();
      dayWiseSales[day] = (dayWiseSales[day] || 0) + s.quantity;
    }

    // Top products by quantity
    const topProducts = Object.values(productSummary)
      .map(p => ({ name: p.name, quantity: p.quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 6);

    // Account revenue
    const accountRevenue = Object.values(accountSummary)
      .map(a => ({ name: a.name, revenue: Number(a.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);

    // Product-wise summary table
    const productTable = Object.values(productSummary).map(p => ({
      name: p.name,
      quantity: p.quantity,
      total_labels: p.labels_total,
      revenue: Number(p.revenue)
    }));

    // Day-wise line chart format
    const dayWiseList = Object.entries(dayWiseSales).map(([day, pieces]) => ({
      day: parseInt(day),
      pieces
    }));

    res.json({
      metrics: {
        totalPieces,
        totalLabels,
        totalRevenue: Number(totalRevenue)
      },
      topProducts,
      accountRevenue,
      dayWise: dayWiseList,
      productTable
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch monthly report: ' + err.message });
  }
});

// GET Export Daily Report to Excel
router.get('/daily/export', async (req, res) => {
  const { date, accountId, platform, category } = req.query;

  try {
    let targetDate = new Date();
    if (date) {
      targetDate = new Date(date);
      if (isNaN(targetDate.getTime()) || targetDate.getFullYear() < 1000 || targetDate.getFullYear() > 9999) {
        targetDate = new Date();
      }
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const where = { date: { gte: startOfDay, lte: endOfDay } };
    if (accountId) where.account_id = parseInt(accountId);
    if (platform) where.account = { platform: platform.toLowerCase() };
    if (category) where.product = { category };

    const sales = await prisma.salesRecord.findMany({
      where,
      include: { product: true, account: true }
    });

    const mappings = await prisma.skuMapping.findMany();
    const mappingsMap = new Map(mappings.map(m => [m.marketplace_sku.toLowerCase().trim(), m]));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Daily Report');

    worksheet.columns = [
      { header: 'Product Name', key: 'product_name', width: 25 },
      { header: 'SKU Code', key: 'sku', width: 20 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Size', key: 'size', width: 10 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Labels / Unit', key: 'labels_per_unit', width: 15 },
      { header: 'Total Labels', key: 'total_labels', width: 15 },
      { header: 'Price (₹)', key: 'price', width: 12 },
      { header: 'Revenue (₹)', key: 'revenue', width: 15 },
      { header: 'Account Name', key: 'account_name', width: 20 },
      { header: 'Platform', key: 'platform', width: 12 }
    ];

    // Group sales records dynamically by parent SKU for the excel export
    const grouped = {};
    sales.forEach(s => {
      const skuKey = s.marketplace_sku.trim();
      const accountId = s.account_id;
      const groupKey = `${skuKey}_${accountId}`;

      const mapping = mappingsMap.get(skuKey.toLowerCase());
      const size = mapping ? mapping.size_variant || 'Free' : 'Free';

      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          product_name: s.product.name,
          sku: skuKey,
          category: s.product.category,
          size,
          quantity: 0,
          labels_per_unit: s.product.labels_per_unit,
          total_labels: 0,
          revenue: 0n,
          account_name: s.account.name,
          platform: s.account.platform
        };
      }
      grouped[groupKey].quantity += s.quantity;
      grouped[groupKey].total_labels += s.labels_total;
      grouped[groupKey].revenue += s.revenue;
    });

    Object.values(grouped).forEach(g => {
      const pricePerLabel = (Number(g.revenue) / (g.total_labels || 1)) / 100; // in rupees
      const revenueRs = Number(g.revenue) / 100;

      worksheet.addRow({
        product_name: g.product_name,
        sku: g.sku,
        category: g.category,
        size: g.size,
        quantity: g.quantity,
        labels_per_unit: g.labels_per_unit,
        total_labels: g.total_labels,
        price: pricePerLabel,
        revenue: revenueRs,
        account_name: g.account_name,
        platform: g.platform.toUpperCase()
      });
    });

    // Styling headers
    worksheet.getRow(1).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Daily_Report_${toISTDateString(targetDate)}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Excel export failed: ' + err.message });
  }
});

// GET Export Monthly Report to Excel
router.get('/monthly/export', async (req, res) => {
  const { month, year } = req.query;

  try {
    const now = new Date();
    let targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    let targetYear = year ? parseInt(year) : now.getFullYear();

    if (isNaN(targetMonth) || targetMonth < 0 || targetMonth > 11) {
      targetMonth = now.getMonth();
    }
    if (isNaN(targetYear) || targetYear < 1000 || targetYear > 9999) {
      targetYear = now.getFullYear();
    }

    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    const sales = await prisma.salesRecord.findMany({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      include: { product: true }
    });

    // Group by product
    const productSummary = {};
    sales.forEach(s => {
      const pId = s.product_id;
      if (!productSummary[pId]) {
        productSummary[pId] = {
          name: s.product.name,
          category: s.product.category,
          quantity: 0,
          labels_total: 0,
          revenue: 0n
        };
      }
      productSummary[pId].quantity += s.quantity;
      productSummary[pId].labels_total += s.labels_total;
      productSummary[pId].revenue += s.revenue;
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Monthly Report');

    worksheet.columns = [
      { header: 'Product Name', key: 'name', width: 30 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Total Qty Sold', key: 'quantity', width: 15 },
      { header: 'Total Labels Required', key: 'total_labels', width: 20 },
      { header: 'Total Revenue (₹)', key: 'revenue', width: 18 }
    ];

    Object.values(productSummary).forEach(p => {
      worksheet.addRow({
        name: p.name,
        category: p.category,
        quantity: p.quantity,
        total_labels: p.labels_total,
        revenue: Number(p.revenue) / 100 // Convert to Rupee decimal
      });
    });

    worksheet.getRow(1).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Monthly_Report_${targetYear}_${targetMonth + 1}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Excel export failed: ' + err.message });
  }
});

module.exports = router;
