const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to format Date to IST YYYY-MM-DD
function toISTDateString(date) {
  return new Date(date.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().split('T')[0];
}

// Helper to group SKUs under parent categories dynamically
function getGroupedSku(sku) {
  if (!sku) return "Unknown";
  const upper = sku.toUpperCase().trim();
  
  // Extract PC pieces number multiplier
  let pcNum = null;
  const pcMatch = upper.match(/PC[-_]?(\d+)/i);
  if (pcMatch) {
    pcNum = parseInt(pcMatch[1]);
  } else {
    const trailingMatch = upper.match(/[-_](\d+)$/);
    if (trailingMatch) {
      pcNum = parseInt(trailingMatch[1]);
    }
  }
  
  // Define groups based on the patterns from the image
  const groups = [
    // 1. Shorts Category
    { key: 'STRIP-SH-WB', name: 'Stripe Shorts' },
    { key: 'CORD-SH', name: 'Cord Shorts' },
    { key: 'SHPC', name: 'Shorts' },
    { key: 'SORT', name: 'Shorts' },
    { key: 'SHORTS', name: 'Shorts' },

    // 2. Track Category
    { key: 'ZIPER-TRACK', name: 'Zipper Track' },
    { key: '3-PATTI-TRACK', name: '3 Patti Track' },
    { key: 'KIDS-TRACK', name: 'Kids Track' },
    { key: 'TRACK-PC', name: 'Track Pants' },

    // 3. Barfi Category
    { key: 'KIDS-BARFI', name: 'Kids Barfi' },
    { key: 'KIDS-BURFI', name: 'Kids Barfi' },
    { key: 'BARFI', name: 'Barfi' },
    { key: 'BURFI', name: 'Barfi' },

    // 4. Ladies Category
    { key: 'LDS-WB', name: 'Ladies WB' },
    { key: 'LDS-GB', name: 'Ladies GB' },

    // 5. Men's Category
    { key: 'MEN-WB', name: 'Men WB' },
    { key: 'MEN-GB', name: 'Men GB' },

    // 6. Kids Category
    { key: 'KIDS-WB', name: 'Kids WB' },
    { key: 'KIDS-GB', name: 'Kids GB' }
  ];

  for (const g of groups) {
    if (upper.includes(g.key)) {
      if (pcNum !== null) {
        return `PC-${pcNum} (${g.name})`;
      }
      return g.name;
    }
  }

  // Fallback default parser
  if (pcNum !== null) {
    return `PC-${pcNum} (${sku})`;
  }
  return sku;
}

// GET Daily Report
router.get('/daily', async (req, res) => {
  const { date, accountId, platform, category } = req.query;

  try {
    let targetDate = new Date();
    if (date) {
      targetDate = new Date(date);
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

    // Aggregates for Metric Cards
    let totalPieces = 0;
    let totalLabels = 0;
    let totalRevenue = 0n;

    // Group records dynamically by their parent Grouped SKU
    const grouped = {};
    for (const s of sales) {
      const groupedSkuName = getGroupedSku(s.marketplace_sku);
      
      totalPieces += s.quantity;
      totalLabels += s.labels_total;
      totalRevenue += s.revenue;

      if (!grouped[groupedSkuName]) {
        grouped[groupedSkuName] = {
          product_name: groupedSkuName,
          category: s.product.category,
          quantity: 0,
          labels_per_unit: s.product.labels_per_unit,
          total_labels: 0,
          revenue: 0n,
          account_name: s.account.name,
          platform: s.account.platform
        };
      }
      
      grouped[groupedSkuName].quantity += s.quantity;
      grouped[groupedSkuName].total_labels += s.labels_total;
      grouped[groupedSkuName].revenue += s.revenue;
    }

    const tableData = Object.values(grouped).map(g => {
      const pricePerLabel = Number(g.revenue) / (g.total_labels || 1);
      return {
        product_name: g.product_name,
        category: g.category,
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

    res.json({
      metrics: {
        totalPieces,
        totalLabels,
        totalRevenue: Number(totalRevenue),
        activeAccounts: activeAccountsCount
      },
      table: tableData
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
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();

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
    if (date) targetDate = new Date(date);

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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Daily Report');

    worksheet.columns = [
      { header: 'Product Name', key: 'product_name', width: 25 },
      { header: 'Category', key: 'category', width: 15 },
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
      const groupedSkuName = getGroupedSku(s.marketplace_sku);
      if (!grouped[groupedSkuName]) {
        grouped[groupedSkuName] = {
          product_name: groupedSkuName,
          category: s.product.category,
          quantity: 0,
          labels_per_unit: s.product.labels_per_unit,
          total_labels: 0,
          revenue: 0n,
          account_name: s.account.name,
          platform: s.account.platform
        };
      }
      grouped[groupedSkuName].quantity += s.quantity;
      grouped[groupedSkuName].total_labels += s.labels_total;
      grouped[groupedSkuName].revenue += s.revenue;
    });

    Object.values(grouped).forEach(g => {
      const pricePerLabel = (Number(g.revenue) / (g.total_labels || 1)) / 100; // in rupees
      const revenueRs = Number(g.revenue) / 100;

      worksheet.addRow({
        product_name: g.product_name,
        category: g.category,
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
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();

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
