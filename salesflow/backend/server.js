require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const productsRouter = require('./routes/products');
const skuMappingsRouter = require('./routes/sku-mappings');
const accountsRouter = require('./routes/accounts');
const importsRouter = require('./routes/imports');
const reportsRouter = require('./routes/reports');

const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS — allow Vercel frontend URL in production, all origins in development
const corsOptions = {
  origin: process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000']
    : true,
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Public routes
app.use('/api/auth', authRouter);

// Protected routes (require JWT verification)
app.use('/api/dashboard', authMiddleware, dashboardRouter);
app.use('/api/products', authMiddleware, productsRouter);
app.use('/api/sku-mappings', authMiddleware, skuMappingsRouter);
app.use('/api/accounts', authMiddleware, accountsRouter);
app.use('/api/imports', authMiddleware, importsRouter);
app.use('/api/reports', authMiddleware, reportsRouter);

// Standard status check
app.get('/status', (req, res) => {
  res.json({ status: 'OK', service: 'SalesFlow Backend' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server!' });
});

app.listen(PORT, () => {
  console.log(`SalesFlow Backend is running on port ${PORT}`);
});
