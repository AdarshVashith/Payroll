const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { auth, authorize } = require('../middleware/auth');
const moment = require('moment');

const router = express.Router();

// @route   GET /api/payroll-cycle
// @desc    Get all payroll cycles
// @access  Private (HR/Admin)
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    let query = supabase.from('payroll_cycles').select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    const start = (page - 1) * limit;
    const end = start + parseInt(limit) - 1;

    const { data: cycles, count, error } = await query
      .range(start, end)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw error;

    res.json({
      cycles,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    console.error('Get payroll cycles error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payroll-cycle
// @desc    Create new payroll cycle
// @access  Private (HR/Admin)
router.post('/', [auth, authorize(['admin', 'hr']), [
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  body('year').isInt({ min: 2020 }).withMessage('Year must be valid'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { month, year, startDate, endDate, name } = req.body;

    const { data: cycle, error } = await supabase
      .from('payroll_cycles')
      .insert([{
        name: name || `${moment().month(month - 1).format('MMMM')} ${year} Payroll`,
        month,
        year,
        start_date: startDate,
        end_date: endDate,
        status: 'upcoming'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Payroll cycle created successfully',
      cycle
    });
  } catch (error) {
    console.error('Create payroll cycle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;