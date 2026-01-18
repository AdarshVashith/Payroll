const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { auth, authorize } = require('../middleware/auth');
const moment = require('moment');

const router = express.Router();

// @route   GET /api/reimbursements
// @desc    Get reimbursements
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, employeeId, status } = req.query;

    let query = supabase.from('reimbursements').select('*, employees(*)', { count: 'exact' });

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const start = (page - 1) * limit;
    const end = start + parseInt(limit) - 1;

    const { data: reimbursements, count, error } = await query
      .range(start, end)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      reimbursements,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    console.error('Get reimbursements error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/reimbursements
// @desc    Create new reimbursement
// @access  Private
router.post('/', [auth, [
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('type').notEmpty().withMessage('Type is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('description').notEmpty().withMessage('Description is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employeeId, type, amount, description } = req.body;

    const { data: reimbursement, error } = await supabase
      .from('reimbursements')
      .insert([{
        employee_id: employeeId,
        reimbursement_id: `REIM-${moment().format('YYYYMMDD')}-${Math.floor(Math.random() * 1000)}`,
        type,
        amount,
        description,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Reimbursement claim created successfully',
      reimbursement
    });
  } catch (error) {
    console.error('Create reimbursement error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;