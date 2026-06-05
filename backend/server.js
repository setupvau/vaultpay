require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const { rateLimiter } = require('./src/middleware/rateLimiter');
const errorHandler    = require('./src/middleware/errorHandler');

const app = express();

// Allow requests from the frontend and admin panel
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  process.env.ADMIN_URL    || 'http://localhost:5174',
];

app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Rate limiting on all /api routes
app.use('/api/', rateLimiter);

// Health check — use this to verify the server is running
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Database check — tells you which tables exist
app.get('/health/db', async (req, res) => {
  try {
    const { query } = require('./src/config/database');
    const result = await query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name`
    );
    const tables = result.rows.map(r => r.table_name);
    const required = ['users','wallets','wallet_ledger','deposit_orders','withdrawal_requests','settings','notifications'];
    const missing  = required.filter(t => !tables.includes(t));
    res.json({
      status: missing.length === 0 ? 'ok' : 'missing_tables',
      tables_found: tables,
      missing_tables: missing,
      hint: missing.length > 0 ? 'Run docs/FULL_SETUP.sql in Supabase SQL Editor' : 'All good!',
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Routes
app.use('/api/auth',        require('./src/routes/auth'));
app.use('/api/wallet',      require('./src/routes/wallet'));
app.use('/api/deposit',     require('./src/routes/deposit'));
app.use('/api/withdrawal',  require('./src/routes/withdrawal'));
app.use('/api/investment',  require('./src/routes/investment'));
app.use('/api/broadcast',   require('./src/routes/broadcast'));
app.use('/api/admin',       require('./src/routes/admin'));

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\nVaultPay API running → http://localhost:${PORT}`);
  console.log(`Health check        → http://localhost:${PORT}/health\n`);
});

module.exports = app;
