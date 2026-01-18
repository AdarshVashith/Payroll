const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://cdn.jsdelivr.net/npm/chart.js"],
      imgSrc: ["'self'", "data:", "https:", "https://images.unsplash.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://uqmacqzsodbzzwrpcczw.supabase.co", "https://*.supabase.co"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration - more explicit for cross-origin requests
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500 // Increased limit for development/testing
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (only when running locally, not in Netlify Functions)
if (require.main === module) {
  app.use(express.static('public'));
}

// Health check route
app.get('/api/health', async (req, res) => {
  try {
    const { data, error } = await require('./config/supabase').from('users').select('count', { count: 'exact', head: true });
    if (error) throw error;
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: err.message
    });
  }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/salary-structure', require('./routes/salaryStructure'));
app.use('/api/payroll-cycle', require('./routes/payrollCycle'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/performance', require('./routes/performance'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/tax-management', require('./routes/taxManagement'));
app.use('/api/salary-disbursement', require('./routes/salaryDisbursement'));
app.use('/api/reimbursements', require('./routes/reimbursements'));

// Serve frontend (only when running locally, not in Netlify Functions)
if (require.main === module) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query
  });

  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? {} : err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});

// Start server if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend available at http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });
}

module.exports = app;