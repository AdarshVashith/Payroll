const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { auth, authorize } = require('../middleware/auth');
const moment = require('moment');

const router = express.Router();

// @route   GET /api/payroll
// @desc    Get payroll records
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, employeeId, status, month, year } = req.query;

    let query = supabase.from('payroll').select('*, employees(*)', { count: 'exact' });

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (month) {
      query = query.eq('month', month);
    }

    if (year) {
      query = query.eq('year', year);
    }

    const start = (page - 1) * limit;
    const end = start + parseInt(limit) - 1;

    const { data: payrolls, count, error } = await query
      .range(start, end)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw error;

    res.json({
      payrolls,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    console.error('Get payrolls error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payroll
// @desc    Create/Calculate payroll
// @access  Private (Admin/HR)
router.post('/', [auth, authorize(['admin', 'hr'])], async (req, res) => {
  try {
    const { employeeId, month, year, grossPay, totalDeductions, netPay } = req.body;

    const { data: payroll, error } = await supabase
      .from('payroll')
      .insert([{
        employee_id: employeeId,
        month,
        year,
        gross_pay: grossPay,
        total_deductions: totalDeductions,
        net_pay: netPay,
        status: 'draft',
        payroll_id: `PAY-${year}${month}-${Math.floor(Math.random() * 1000)}`,
        start_date: new Date(year, month - 1, 1).toISOString(),
        end_date: new Date(year, month, 0).toISOString(),
        working_days: 22, // Simplified
        actual_working_days: 22 // Simplified
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Payroll calculated successfully',
      payroll
    });
  } catch (error) {
    console.error('Calculate payroll error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;