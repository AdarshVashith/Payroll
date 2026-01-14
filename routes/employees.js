const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/employees
// @desc    Get all employees
// @access  Private (HR/Admin)
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, department, status, search } = req.query;
    
    let query = {};
    
    // Filter by department
    if (department) {
      query['employment.department'] = department;
    }
    
    // Filter by status
    if (status) {
      query['employment.status'] = status;
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { 'personalInfo.firstName': { $regex: search, $options: 'i' } },
        { 'personalInfo.lastName': { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { 'employment.position': { $regex: search, $options: 'i' } }
      ];
    }

    const employees = await Employee.find(query)
      .populate('userId', 'username email')
      .populate('employment.managerId', 'personalInfo.firstName personalInfo.lastName')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Employee.countDocuments(query);

    res.json({
      employees,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/employees/:id
// @desc    Get employee by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('userId', 'username email role')
      .populate('employment.managerId', 'personalInfo.firstName personalInfo.lastName employeeId');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/employees
// @desc    Create new employee
// @access  Private (HR/Admin)
router.post('/', [auth, authorize('admin'), [
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('personalInfo.firstName').notEmpty().withMessage('First name is required'),
  body('personalInfo.lastName').notEmpty().withMessage('Last name is required'),
  body('personalInfo.email').isEmail().withMessage('Valid email is required'),
  body('personalInfo.phone').notEmpty().withMessage('Phone number is required'),
  body('employment.department').notEmpty().withMessage('Department is required'),
  body('employment.designation').notEmpty().withMessage('Designation is required'),
  body('employment.role').notEmpty().withMessage('Role is required'),
  body('employment.employmentType').isIn(['full-time', 'part-time', 'contract', 'intern', 'consultant']).withMessage('Invalid employment type'),
  body('employment.dateOfJoining').isISO8601().withMessage('Valid joining date is required'),
  body('employment.status').optional().isIn(['active', 'on-notice', 'inactive', 'exited']).withMessage('Invalid employee status'),
  body('salaryStructure.ctc').isNumeric().withMessage('CTC must be a number'),
  body('salaryStructure.basicSalary').isNumeric().withMessage('Basic salary must be a number'),
  body('bankDetails.accountNumber').notEmpty().withMessage('Account number is required'),
  body('bankDetails.ifscCode').notEmpty().withMessage('IFSC code is required'),
  body('bankDetails.bankName').notEmpty().withMessage('Bank name is required'),
  body('bankDetails.accountHolderName').notEmpty().withMessage('Account holder name is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if employee ID already exists
    const existingEmployee = await Employee.findOne({ employeeId: req.body.employeeId });
    if (existingEmployee) {
      return res.status(400).json({ message: 'Employee ID already exists' });
    }

    // Check if email already exists
    const existingEmail = await Employee.findOne({ 'personalInfo.email': req.body.personalInfo.email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Create user account
    let userId = req.body.userId;
    if (!userId) {
      const user = new User({
        username: req.body.employeeId,
        email: req.body.personalInfo.email,
        password: 'employee123',
        role: req.body.userRole || 'employee'
      });
      await user.save();
      userId = user._id;
      console.log('Created user account:', userId);
    }

    // Calculate salary components if not provided
    const employeeData = { ...req.body };
    if (!employeeData.salaryStructure.hra) {
      employeeData.salaryStructure.hra = Math.round(employeeData.salaryStructure.basicSalary * 0.4); // 40% of basic
    }
    if (!employeeData.salaryStructure.specialAllowance) {
      employeeData.salaryStructure.specialAllowance = employeeData.salaryStructure.ctc - employeeData.salaryStructure.basicSalary - employeeData.salaryStructure.hra - 1600 - 1250; // Remaining after basic, HRA, transport, medical
    }

    // Calculate statutory deductions
    if (!employeeData.salaryStructure.providentFund) {
      employeeData.salaryStructure.providentFund = Math.round(Math.min(employeeData.salaryStructure.basicSalary, 15000) * 0.12); // 12% of basic, max 15000
    }
    if (!employeeData.salaryStructure.esi && employeeData.salaryStructure.ctc <= 252000) { // ESI applicable if CTC <= 25.2L
      const grossForESI = employeeData.salaryStructure.basicSalary + employeeData.salaryStructure.hra + employeeData.salaryStructure.specialAllowance;
      if (grossForESI <= 21000) { // ESI ceiling
        employeeData.salaryStructure.esi = Math.round(grossForESI * 0.0075); // 0.75% employee contribution
      }
    }

    employeeData.userId = userId;
    employeeData.createdBy = req.user.userId;
    employeeData.updatedBy = req.user.userId;

    const employee = new Employee(employeeData);
    await employee.save();

    const populatedEmployee = await Employee.findById(employee._id)
      .populate('userId', 'username email role')
      .populate('employment.managerId', 'personalInfo.firstName personalInfo.lastName employeeId');

    res.status(201).json({
      message: 'Employee created successfully',
      employee: populatedEmployee
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/employees/:id
// @desc    Update employee
// @access  Private (HR/Admin)
router.put('/:id', [auth, authorize('admin'), [
  body('personalInfo.firstName').optional().notEmpty().withMessage('First name cannot be empty'),
  body('personalInfo.lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('personalInfo.email').optional().isEmail().withMessage('Valid email is required'),
  body('personalInfo.phone').optional().notEmpty().withMessage('Phone number cannot be empty'),
  body('employment.employmentType').optional().isIn(['full-time', 'part-time', 'contract', 'intern', 'consultant']).withMessage('Invalid employment type'),
  body('employment.status').optional().isIn(['active', 'on-notice', 'inactive', 'exited']).withMessage('Invalid employee status'),
  body('salaryStructure.ctc').optional().isNumeric().withMessage('CTC must be a number'),
  body('salaryStructure.basicSalary').optional().isNumeric().withMessage('Basic salary must be a number')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if email already exists (if being updated)
    if (req.body.personalInfo?.email) {
      const existingEmail = await Employee.findOne({ 
        'personalInfo.email': req.body.personalInfo.email,
        _id: { $ne: req.params.id }
      });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    const updateData = { 
      ...req.body, 
      updatedAt: Date.now(),
      updatedBy: req.user.userId
    };

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'username email role')
     .populate('employment.managerId', 'personalInfo.firstName personalInfo.lastName employeeId');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({
      message: 'Employee updated successfully',
      employee
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/employees/:id
// @desc    Delete employee (soft delete)
// @access  Private (Admin only)
router.delete('/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Soft delete - change status to exited
    employee.employment.status = 'exited';
    employee.employment.dateOfExit = new Date();
    employee.updatedBy = req.user.userId;
    await employee.save();

    res.json({ message: 'Employee terminated successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/employees/:id/salary
// @desc    Get employee salary information
// @access  Private (HR/Admin)
router.get('/:id/salary', auth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .select('employeeId personalInfo.firstName personalInfo.lastName employment.department employment.designation salaryStructure')
      .populate('userId', 'username email');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json(employee);
  } catch (error) {
    console.error('Get employee salary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/employees/:id/salary
// @desc    Update employee salary structure
// @access  Private (HR/Admin)
router.put('/:id/salary', [auth, authorize('admin', 'hr'), [
  body('salaryStructure.ctc').isNumeric().withMessage('CTC must be a number'),
  body('salaryStructure.basicSalary').isNumeric().withMessage('Basic salary must be a number')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Update salary structure
    employee.salaryStructure = { ...employee.salaryStructure, ...req.body.salaryStructure };
    employee.salaryStructure.effectiveDate = req.body.effectiveDate || new Date();
    employee.updatedBy = req.user.userId;
    
    await employee.save();

    res.json({
      message: 'Salary structure updated successfully',
      employee: employee
    });
  } catch (error) {
    console.error('Update salary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/employees/:id/documents
// @desc    Get employee documents
// @access  Private
router.get('/:id/documents', auth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .select('employeeId personalInfo.firstName personalInfo.lastName documents');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json(employee.documents);
  } catch (error) {
    console.error('Get employee documents error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/employees/:id/documents
// @desc    Add employee document
// @access  Private (HR/Admin)
router.post('/:id/documents', [auth, authorize('admin', 'hr')], async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const document = {
      name: req.body.name,
      type: req.body.type,
      url: req.body.url,
      uploadDate: new Date(),
      isVerified: false
    };

    employee.documents.push(document);
    employee.updatedBy = req.user.userId;
    await employee.save();

    res.status(201).json({
      message: 'Document added successfully',
      document: employee.documents[employee.documents.length - 1]
    });
  } catch (error) {
    console.error('Add document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/employees/:id/documents/:docId/verify
// @desc    Verify employee document
// @access  Private (HR/Admin)
router.put('/:id/documents/:docId/verify', [auth, authorize('admin', 'hr')], async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const document = employee.documents.id(req.params.docId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    document.isVerified = true;
    employee.updatedBy = req.user.userId;
    await employee.save();

    res.json({
      message: 'Document verified successfully',
      document
    });
  } catch (error) {
    console.error('Verify document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/employees/:id/leave-balance
// @desc    Get employee leave balance
// @access  Private
router.get('/:id/leave-balance', auth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .select('employeeId personalInfo.firstName personalInfo.lastName leaveBalance benefits');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({
      employeeId: employee.employeeId,
      name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
      leaveBalance: employee.leaveBalance,
      benefits: {
        paidTimeOff: employee.benefits.paidTimeOff,
        sickLeave: employee.benefits.sickLeave,
        casualLeave: employee.benefits.casualLeave,
        maternityLeave: employee.benefits.maternityLeave,
        paternityLeave: employee.benefits.paternityLeave
      }
    });
  } catch (error) {
    console.error('Get leave balance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/employees/:id/leave-balance
// @desc    Update employee leave balance
// @access  Private (HR/Admin)
router.put('/:id/leave-balance', [auth, authorize('admin', 'hr')], async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.leaveBalance = { ...employee.leaveBalance, ...req.body };
    employee.updatedBy = req.user.userId;
    await employee.save();

    res.json({
      message: 'Leave balance updated successfully',
      leaveBalance: employee.leaveBalance
    });
  } catch (error) {
    console.error('Update leave balance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/employees/departments/list
// @desc    Get list of departments
// @access  Private
router.get('/departments/list', auth, async (req, res) => {
  try {
    const departments = await Employee.distinct('employment.department');
    res.json(departments);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/employees/positions/list
// @desc    Get list of positions
// @access  Private
router.get('/positions/list', auth, async (req, res) => {
  try {
    const positions = await Employee.distinct('employment.position');
    res.json(positions);
  } catch (error) {
    console.error('Get positions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;