const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');

// In Netlify Functions, env vars are already available via process.env
// dotenv is only needed for local development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();

// Check for required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:', missingEnvVars);
}

// CORS configuration
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging for debugging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check route
app.get('/api/health', async (req, res) => {
    try {
        const envStatus = {
            SUPABASE_URL: !!process.env.SUPABASE_URL,
            SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
            JWT_SECRET: !!process.env.JWT_SECRET,
            JWT_EXPIRE: !!process.env.JWT_EXPIRE
        };

        const supabase = require('../../config/supabase');
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
        if (error) throw error;

        res.json({
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString(),
            env: process.env.NODE_ENV || 'production',
            envVarsConfigured: envStatus
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed',
            error: err.message,
            envVarsConfigured: {
                SUPABASE_URL: !!process.env.SUPABASE_URL,
                SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
                JWT_SECRET: !!process.env.JWT_SECRET
            }
        });
    }
});

// Routes
app.use('/api/auth', require('../../routes/auth'));
app.use('/api/employees', require('../../routes/employees'));
app.use('/api/salary-structure', require('../../routes/salaryStructure'));
app.use('/api/payroll-cycle', require('../../routes/payrollCycle'));
app.use('/api/payroll', require('../../routes/payroll'));
app.use('/api/attendance', require('../../routes/attendance'));
app.use('/api/leaves', require('../../routes/leaves'));
app.use('/api/expenses', require('../../routes/expenses'));
app.use('/api/performance', require('../../routes/performance'));
app.use('/api/dashboard', require('../../routes/dashboard'));
app.use('/api/tax-management', require('../../routes/taxManagement'));
app.use('/api/salary-disbursement', require('../../routes/salaryDisbursement'));
app.use('/api/reimbursements', require('../../routes/reimbursements'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('API ERROR:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    res.status(500).json({
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'production' ? {} : err.message
    });
});

// 404 handler for unmatched API routes
app.use((req, res) => {
    res.status(404).json({
        message: 'API endpoint not found',
        path: req.path
    });
});

module.exports.handler = serverless(app);
