const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { auth, authorize } = require('../middleware/auth');
const moment = require('moment');

const router = express.Router();

// @route   GET /api/salary-structure
// @desc    Get all salary structures
// @access  Private (HR/Admin)
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, employeeId, status } = req.query;

    let query = supabase.from('salary_structures').select('*, employees(*)', { count: 'exact' });

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const start = (page - 1) * limit;
    const end = start + parseInt(limit) - 1;

    const { data: salaryStructures, count, error } = await query
      .range(start, end)
      .order('effective_date', { ascending: false });

    if (error) throw error;

    res.json({
      salaryStructures,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    console.error('Get salary structures error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/salary-structure
// @desc    Create new salary structure
// @access  Private (HR/Admin)
router.post('/', [auth, authorize(['admin', 'hr']), [
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('ctc').isNumeric().withMessage('CTC must be a number'),
  body('basicSalary').isNumeric().withMessage('Basic salary must be a number'),
  body('effectiveDate').isISO8601().withMessage('Valid effective date is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employeeId, ctc, basicSalary, effectiveDate, earnings, deductions, calculationRules } = req.body;

    const { data: salaryStructure, error } = await supabase
      .from('salary_structures')
      .insert([{
        employee_id: employeeId,
        ctc,
        basic_salary: basicSalary,
        effective_date: effectiveDate,
        earnings: earnings || {},
        deductions: deductions || {},
        calculation_rules: calculationRules || {},
        status: 'draft'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Salary structure created successfully',
      salaryStructure
    });
  } catch (error) {
    console.error('Create salary structure error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/salary-structure/:id/status
// @desc    Approve/Reject salary structure
// @access  Private (Admin)
router.put('/:id/status', [auth, authorize(['admin'])], async (req, res) => {
  try {
    const { status, remarks } = req.body;

    let updateData = { status, remarks };
    if (status === 'approved') {
      updateData.approved_by = req.user.id;
      updateData.approved_at = new Date().toISOString();
    }

    const { data: salaryStructure, error } = await supabase
      .from('salary_structures')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: `Salary structure ${status}`,
      salaryStructure
    });
  } catch (error) {
    console.error('Update salary structure status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;