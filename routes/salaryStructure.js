const express = require('express');
const { body, validationResult } = require('express-validator');
const SalaryStructure = require('../models/SalaryStructure');
const Employee = require('../models/Employee');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/salary-structure
// @desc    Get all salary structures
// @access  Private (HR/Admin)
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, employeeId, status } = req.query;
    
    let query = {};
    
    if (employeeId) {
      query.employeeId = employeeId;
    }
    
    if (status) {
      query.status = status;
    }

    const salaryStructures = await SalaryStructure.find(query)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('createdBy', 'username')
      .populate('approvedBy', 'username')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ effectiveDate: -1 });

    const total = await SalaryStructure.countDocuments(query);

    res.json({
      salaryStructures,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get salary structures error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/salary-structure/:id
// @desc    Get salary structure by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const salaryStructure = await SalaryStructure.findById(req.params.id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('createdBy', 'username email')
      .populate('approvedBy', 'username email');

    if (!salaryStructure) {
      return res.status(404).json({ message: 'Salary structure not found' });
    }

    res.json(salaryStructure);
  } catch (error) {
    console.error('Get salary structure error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/salary-structure
// @desc    Create new salary structure
// @access  Private (HR/Admin)
router.post('/', [auth, authorize('admin', 'hr'), [
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

    // Check if employee exists
    const employee = await Employee.findById(req.body.employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check for overlapping salary structures
    const existingStructure = await SalaryStructure.findOne({
      employeeId: req.body.employeeId,
      effectiveDate: { $lte: new Date(req.body.effectiveDate) },
      $or: [
        { endDate: null },
        { endDate: { $gte: new Date(req.body.effectiveDate) } }
      ]
    });

    if (existingStructure) {
      return res.status(400).json({ 
        message: 'Overlapping salary structure exists. Please end the existing structure first.' 
      });
    }

    const salaryStructure = new SalaryStructure({
      ...req.body,
      createdBy: req.user.userId,
      updatedBy: req.user.userId
    });

    await salaryStructure.save();

    const populatedStructure = await SalaryStructure.findById(salaryStructure._id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('createdBy', 'username');

    res.status(201).json({
      message: 'Salary structure created successfully',
      salaryStructure: populatedStructure
    });
  } catch (error) {
    console.error('Create salary structure error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/salary-structure/:id
// @desc    Update salary structure
// @access  Private (HR/Admin)
router.put('/:id', [auth, authorize('admin', 'hr')], async (req, res) => {
  try {
    const salaryStructure = await SalaryStructure.findById(req.params.id);
    
    if (!salaryStructure) {
      return res.status(404).json({ message: 'Salary structure not found' });
    }

    if (salaryStructure.status === 'approved') {
      return res.status(400).json({ message: 'Cannot modify approved salary structure' });
    }

    const updatedStructure = await SalaryStructure.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user.userId },
      { new: true, runValidators: true }
    ).populate('employeeId', 'employeeId personalInfo employment');

    res.json({
      message: 'Salary structure updated successfully',
      salaryStructure: updatedStructure
    });
  } catch (error) {
    console.error('Update salary structure error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/salary-structure/:id/approve
// @desc    Approve salary structure
// @access  Private (Admin)
router.post('/:id/approve', [auth, authorize('admin')], async (req, res) => {
  try {
    const salaryStructure = await SalaryStructure.findById(req.params.id);
    
    if (!salaryStructure) {
      return res.status(404).json({ message: 'Salary structure not found' });
    }

    if (salaryStructure.status !== 'pending-approval') {
      return res.status(400).json({ message: 'Salary structure is not pending approval' });
    }

    salaryStructure.status = 'approved';
    salaryStructure.approvedBy = req.user.userId;
    salaryStructure.approvedAt = new Date();
    salaryStructure.updatedBy = req.user.userId;
    
    await salaryStructure.save();

    // Update employee's salary structure
    await Employee.findByIdAndUpdate(salaryStructure.employeeId, {
      salaryStructure: {
        ctc: salaryStructure.ctc,
        basicSalary: salaryStructure.basicSalary,
        hra: salaryStructure.earnings.hra.amount,
        specialAllowance: salaryStructure.earnings.specialAllowance,
        transportAllowance: salaryStructure.earnings.transportAllowance,
        medicalAllowance: salaryStructure.earnings.medicalAllowance,
        providentFund: salaryStructure.deductions.providentFund.employeeContribution,
        esi: salaryStructure.deductions.esi.employeeContribution,
        professionalTax: salaryStructure.deductions.professionalTax,
        effectiveDate: salaryStructure.effectiveDate
      }
    });

    res.json({
      message: 'Salary structure approved successfully',
      salaryStructure
    });
  } catch (error) {
    console.error('Approve salary structure error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/salary-structure/:id/reject
// @desc    Reject salary structure
// @access  Private (Admin)
router.post('/:id/reject', [auth, authorize('admin')], async (req, res) => {
  try {
    const salaryStructure = await SalaryStructure.findById(req.params.id);
    
    if (!salaryStructure) {
      return res.status(404).json({ message: 'Salary structure not found' });
    }

    if (salaryStructure.status !== 'pending-approval') {
      return res.status(400).json({ message: 'Salary structure is not pending approval' });
    }

    salaryStructure.status = 'rejected';
    salaryStructure.remarks = req.body.remarks || 'Rejected by admin';
    salaryStructure.updatedBy = req.user.userId;
    
    await salaryStructure.save();

    res.json({
      message: 'Salary structure rejected successfully',
      salaryStructure
    });
  } catch (error) {
    console.error('Reject salary structure error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/salary-structure/employee/:employeeId
// @desc    Get salary structures for specific employee
// @access  Private
router.get('/employee/:employeeId', auth, async (req, res) => {
  try {
    const salaryStructures = await SalaryStructure.find({ employeeId: req.params.employeeId })
      .populate('createdBy', 'username')
      .populate('approvedBy', 'username')
      .sort({ effectiveDate: -1 });

    res.json(salaryStructures);
  } catch (error) {
    console.error('Get employee salary structures error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/salary-structure/employee/:employeeId/current
// @desc    Get current salary structure for employee
// @access  Private
router.get('/employee/:employeeId/current', auth, async (req, res) => {
  try {
    const currentStructure = await SalaryStructure.findOne({
      employeeId: req.params.employeeId,
      status: 'approved',
      effectiveDate: { $lte: new Date() },
      $or: [
        { endDate: null },
        { endDate: { $gte: new Date() } }
      ]
    }).populate('employeeId', 'employeeId personalInfo employment');

    if (!currentStructure) {
      return res.status(404).json({ message: 'No current salary structure found' });
    }

    res.json(currentStructure);
  } catch (error) {
    console.error('Get current salary structure error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/salary-structure/:id/calculate
// @desc    Calculate salary components
// @access  Private (HR/Admin)
router.post('/:id/calculate', auth, async (req, res) => {
  try {
    const salaryStructure = await SalaryStructure.findById(req.params.id);
    
    if (!salaryStructure) {
      return res.status(404).json({ message: 'Salary structure not found' });
    }

    const calculations = {
      grossSalary: salaryStructure.calculateGrossSalary(),
      totalDeductions: salaryStructure.calculateTotalDeductions(),
      netSalary: salaryStructure.calculateNetSalary(),
      monthlyGross: Math.round(salaryStructure.calculateGrossSalary() / 12),
      monthlyNet: Math.round(salaryStructure.calculateNetSalary() / 12)
    };

    res.json({
      message: 'Salary calculations completed',
      calculations,
      salaryStructure
    });
  } catch (error) {
    console.error('Calculate salary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;