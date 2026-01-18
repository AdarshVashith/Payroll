const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { auth, authorize } = require('../middleware/auth');
const moment = require('moment');
const { mapExpense } = require('../utils/mappers');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, employeeId, status, expenseType } = req.query;

    let query = supabase.from('expenses').select('*, employees(*)', { count: 'exact' });

    if (employeeId) query = query.eq('employee_id', employeeId);
    if (status) query = query.eq('status', status);
    if (expenseType) query = query.eq('expense_type', expenseType);

    const start = (page - 1) * limit;
    const end = start + parseInt(limit) - 1;

    const { data: expenses, count, error } = await query
      .range(start, end)
      .order('submitted_date', { ascending: false });

    if (error) throw error;

    res.json({
      expenses: (expenses || []).map(mapExpense),
      totalPages: Math.ceil((count || 0) / limit),
      currentPage: parseInt(page),
      total: count || 0
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', [auth, [
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('expenseType').notEmpty().withMessage('Expense type is required'),
  body('amount').isNumeric().withMessage('Valid amount is required'),
  body('expenseDate').isISO8601().withMessage('Valid expense date is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { employeeId, expenseType, amount, expenseDate, description } = req.body;

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert([{
        employee_id: employeeId,
        expense_type: expenseType,
        amount,
        expense_date: expenseDate,
        description,
        status: 'submitted',
        submitted_date: new Date().toISOString()
      }])
      .select('*, employees(*)').single();

    if (error) throw error;

    res.status(201).json({
      message: 'Expense claim submitted successfully',
      expense: mapExpense(expense)
    });
  } catch (error) {
    console.error('Submit expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/status', [auth, authorize(['admin', 'finance'])], async (req, res) => {
  try {
    const { status, remarks, paidAmount, paidDate } = req.body;

    let updateData = { status, remarks };
    if (status === 'paid') {
      updateData.paid_amount = paidAmount;
      updateData.paid_date = paidDate || new Date().toISOString();
    }

    const { data: expense, error } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*, employees(*)').single();

    if (error) throw error;
    res.json({ message: `Expense updated to ${status}`, expense: mapExpense(expense) });
  } catch (error) {
    console.error('Update expense status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;