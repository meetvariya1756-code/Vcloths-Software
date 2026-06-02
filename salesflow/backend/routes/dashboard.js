const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/summary', async (req, res) => {
  try {
    // 2. Fetch all sales records
    const salesRecords = await prisma.salesRecord.findMany({
      include: {
        product: true,
        account: true
      }
    });

    // 3. Calculate metrics
    let totalPieces = 0;
    let totalLabels = 0;
    let totalRevenue = 0n; // Use BigInt for calculation

    const productSalesMap = {};
    const accountSalesMap = {};
    const labelsSummary = [];

    // Active accounts count
    const activeAccountsCount = await prisma.account.count({
      where: { is_active: true }
    });

    for (const record of salesRecords) {
      totalPieces += record.quantity;
      totalLabels += record.labels_total;
      totalRevenue += record.revenue;

      // Product sales for bar chart
      const prodName = record.product.name;
      productSalesMap[prodName] = (productSalesMap[prodName] || 0) + record.quantity;

      // Account-wise revenue
      const accId = record.account.id;
      if (!accountSalesMap[accId]) {
        accountSalesMap[accId] = {
          name: record.account.name,
          platform: record.account.platform,
          pieces: 0,
          revenue: 0n
        };
      }
      accountSalesMap[accId].pieces += record.quantity;
      accountSalesMap[accId].revenue += record.revenue;

      // Label calculation table summary
      const customPrice = record.revenue / BigInt(record.labels_total || 1); // approximate price per label
      labelsSummary.push({
        id: record.id,
        sku: record.marketplace_sku,
        productName: record.product.name,
        qtySold: record.quantity,
        labelsPerUnit: record.product.labels_per_unit,
        totalLabels: record.labels_total,
        price: Number(record.revenue) / (record.labels_total || 1), // price in paisa per label
        revenue: Number(record.revenue) // revenue in paisa
      });
    }

    // Top 6 products
    const topProducts = Object.entries(productSalesMap)
      .map(([name, pieces]) => ({ name, pieces }))
      .sort((a, b) => b.pieces - a.pieces)
      .slice(0, 6);

    // Account summary format
    const accountSummary = Object.values(accountSalesMap).map(a => ({
      name: a.name,
      platform: a.platform,
      pieces: a.pieces,
      revenue: Number(a.revenue) // Convert to JS number for JSON
    }));

    res.json({
      metrics: {
        totalPieces,
        totalLabels,
        totalRevenue: Number(totalRevenue), // Convert to JS number for JSON
        activeAccounts: activeAccountsCount
      },
      topProducts,
      accountSummary,
      labelsSummary
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary: ' + err.message });
  }
});

module.exports = router;
