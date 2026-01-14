const express = require('express');
const { body, validationResult } = require('express-validator');
const Expense = require('../models/Expense');
const Employee = require('../models/Employee');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/expenses
// @desc    Get expense claims
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, employeeId, status, expenseType } = req.query;
    
    let query = {};
    
    if (employeeId) {
      query.employeeId = employeeId;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (expenseType) {
      query.expenseType = expenseType;
    }

    const expenses = await Expense.find(query)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('approvalWorkflow.approver', 'username')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ submittedDate: -1 });

    const total = await Expense.countDocuments(query);

    res.json({
      expenses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/expenses
// @desc    Submit expense claim
// @access  Private
router.post('/', [auth, [
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('expenseType').isIn(['travel', 'meals', 'accommodation', 'transportation', 'office-supplies', 'training', 'other']).withMessage('Invalid expense type'),
  body('description').notEmpty().withMessage('Description is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('expenseDate').isISO8601().withMessage('Valid expense date is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('businessPurpose').notEmpty().withMessage('Business purpose is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const expense = new Expense({
      ...req.body,
      status: 'submitted',
      submittedDate: new Date()
    });

    await expense.save();

    const populatedExpense = await Expense.findById(expense._id)
      .populate('employeeId', 'employeeId personalInfo employment');

    res.status(201).json({
      message: 'Expense claim submitted successfully',
      expense: populatedExpense
    });
  } catch (error) {
    console.error('Submit expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/expenses/:id/approve
// @desc    Approve expense claim
// @access  Private (HR/Manager)
router.put('/:id/approve', [auth, [
  body('comments').optional().isString()
]], async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ message: 'Expense claim not found' });
    }

    if (expense.status === 'approved') {
      return res.status(400).json({ message: 'Expense already approved' });
    }

    // Add approval to workflow
    expense.approvalWorkflow.push({
      approver: req.user.userId,
      level: expense.approvalWorkflow.length + 1,
      status: 'approved',
      comments: req.body.comments,
      actionDate: new Date()
    });

    expense.status = 'approved';
    await expense.save();

    const populatedExpense = await Expense.findById(expense._id)
      .populate('employeeId', 'employeeId personalInfo')
      .populate('approvalWorkflow.approver', 'username');

    res.json({
      message: 'Expense claim approved successfully',
      expense: populatedExpense
    });
  } catch (error) {
    console.error('Approve expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/expenses/:id/reject
// @desc    Reject expense claim
// @access  Private (HR/Manager)
router.put('/:id/reject', [auth, [
  body('comments').notEmpty().withMessage('Rejection reason is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const expense = await Expense.findById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ message: 'Expense claim not found' });
    }

    if (expense.status === 'rejected') {
      return res.status(400).json({ message: 'Expense already rejected' });
    }

    // Add rejection to workflow
    expense.approvalWorkflow.push({
      approver: req.user.userId,
      level: expense.approvalWorkflow.length + 1,
      status: 'rejected',
      comments: req.body.comments,
      actionDate: new Date()
    });

    expense.status = 'rejected';
    await expense.save();

    const populatedExpense = await Expense.findById(expense._id)
      .populate('employeeId', 'employeeId personalInfo')
      .populate('approvalWorkflow.approver', 'username');

    res.json({
      message: 'Expense claim rejected',
      expense: populatedExpense
    });
  } catch (error) {
    console.error('Reject expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/expenses/:id/pay
// @desc    Mark expense as paid
// @access  Private (HR/Admin)
router.put('/:id/pay', [auth, [
  body('paidAmount').isNumeric().withMessage('Paid amount must be a number')
]], async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    
    if (!expense) {
      return res.status(404).json({ message: 'Expense claim not found' });
    }

    if (expense.status !== 'approved') {
      return res.status(400).json({ message: 'Expense must be approved before payment' });
    }

    expense.status = 'paid';
    expense.paidDate = new Date();
    expense.paidAmount = req.body.paidAmount || expense.amount;
    
    await expense.save();

    res.json({
      message: 'Expense marked as paid successfully',
      expense
    });
  } catch (error) {
    console.error('Pay expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/expenses/:id
// @desc    Get expense by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('approvalWorkflow.approver', 'username email');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/expenses/reports/summary
// @desc    Get expense summary report
// @access  Private (HR/Admin)
router.get('/reports/summary', auth, async (req, res) => {
  try {
    const { startDate, endDate, department, status } = req.query;
    
    let matchQuery = {};
    
    if (startDate && endDate) {
      matchQuery.expenseDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (status) {
      matchQuery.status = status;
    }

    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' }
    ];

    if (department) {
      pipeline.push({
        $match: { 'employee.employment.department': department }
      });
    }

    pipeline.push({
      $group: {
        _id: {
          status: '$status',
          expenseType: '$expenseType'
        },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        averageAmount: { $avg: '$amount' }
      }
    });

    const summary = await Expense.aggregate(pipeline);

    res.json(summary);
  } catch (error) {
    console.error('Get expense summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;