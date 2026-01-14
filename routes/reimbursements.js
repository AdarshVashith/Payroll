const express = require('express');
const { body, validationResult } = require('express-validator');
const Reimbursement = require('../models/Reimbursement');
const Employee = require('../models/Employee');
const { auth, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/reimbursement-documents';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and documents are allowed'));
    }
  }
});

// @route   GET /api/reimbursements
// @desc    Get reimbursements/bonuses with filtering
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      employeeId, 
      status, 
      claimType = 'reimbursement',
      expenseType,
      bonusType,
      startDate,
      endDate 
    } = req.query;
    
    let query = { claimType };
    
    // Employee filter - employees can only see their own records
    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ userId: req.user.id });
      if (!employee) {
        return res.status(404).json({ message: 'Employee profile not found' });
      }
      query.employeeId = employee._id;
    } else if (employeeId) {
      query.employeeId = employeeId;
    }
    
    // Other filters
    if (status) query.status = status;
    if (expenseType) query.expenseType = expenseType;
    if (bonusType) query['bonusDetails.bonusType'] = bonusType;
    
    // Date range filter
    if (startDate && endDate) {
      query.expenseDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const reimbursements = await Reimbursement.find(query)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('submittedBy', 'username email')
      .populate('processedBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Reimbursement.countDocuments(query);

    res.json({
      reimbursements,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get reimbursements error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/reimbursements
// @desc    Create new reimbursement or bonus claim
// @access  Private
router.post('/', [auth, upload.array('documents', 5), [
  body('claimType').isIn(['reimbursement', 'bonus', 'incentive', 'allowance', 'advance']).withMessage('Valid claim type is required'),
  body('amount').isNumeric().withMessage('Valid amount is required'),
  body('description').isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('expenseDate').isISO8601().withMessage('Valid expense date is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let employeeId;
    
    // Get employee ID
    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ userId: req.user.id });
      if (!employee) {
        return res.status(404).json({ message: 'Employee profile not found' });
      }
      employeeId = employee._id;
    } else {
      employeeId = req.body.employeeId;
      if (!employeeId) {
        return res.status(400).json({ message: 'Employee ID is required' });
      }
    }

    const { 
      claimType, 
      expenseType, 
      category, 
      description, 
      amount, 
      expenseDate,
      businessPurpose,
      projectCode,
      clientName,
      bonusDetails,
      taxDetails
    } = req.body;

    // Create reimbursement data
    const reimbursementData = {
      employeeId,
      claimType,
      description,
      amount: parseFloat(amount),
      expenseDate: new Date(expenseDate),
      createdBy: req.user.id,
      updatedBy: req.user.id
    };

    // Add type-specific data
    if (claimType === 'reimbursement') {
      if (!expenseType || !businessPurpose) {
        return res.status(400).json({ message: 'Expense type and business purpose are required for reimbursements' });
      }
      reimbursementData.expenseType = expenseType;
      reimbursementData.category = category;
      reimbursementData.businessPurpose = businessPurpose;
      reimbursementData.projectCode = projectCode;
      reimbursementData.clientName = clientName;
    } else if (claimType === 'bonus') {
      if (!bonusDetails || !bonusDetails.bonusType) {
        return res.status(400).json({ message: 'Bonus type is required for bonus claims' });
      }
      reimbursementData.bonusDetails = bonusDetails;
    }

    // Add tax details if provided
    if (taxDetails) {
      reimbursementData.taxDetails = taxDetails;
    }

    // Set up approval workflow
    reimbursementData.approvalWorkflow = [
      {
        level: 1,
        approverRole: 'manager',
        status: 'pending'
      }
    ];

    // For high-value claims or bonuses, add additional approval levels
    if (amount > 50000 || claimType === 'bonus') {
      reimbursementData.approvalWorkflow.push({
        level: 2,
        approverRole: 'hr',
        status: 'pending'
      });
    }

    if (amount > 100000) {
      reimbursementData.approvalWorkflow.push({
        level: 3,
        approverRole: 'finance',
        status: 'pending'
      });
    }

    const reimbursement = new Reimbursement(reimbursementData);

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        reimbursement.documents.push({
          fileName: file.filename,
          originalName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          url: `/uploads/reimbursement-documents/${file.filename}`,
          documentType: 'receipt'
        });
      });
    }

    await reimbursement.save();

    const populatedReimbursement = await Reimbursement.findById(reimbursement._id)
      .populate('employeeId', 'employeeId personalInfo employment');

    res.status(201).json({
      message: `${claimType.charAt(0).toUpperCase() + claimType.slice(1)} claim created successfully`,
      reimbursement: populatedReimbursement
    });

  } catch (error) {
    console.error('Create reimbursement error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/reimbursements/:id/submit
// @desc    Submit reimbursement for approval
// @access  Private
router.put('/:id/submit', auth, async (req, res) => {
  try {
    const reimbursement = await Reimbursement.findById(req.params.id);
    
    if (!reimbursement) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }

    // Check access permissions
    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ userId: req.user.id });
      if (!employee || reimbursement.employeeId.toString() !== employee._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    if (reimbursement.status !== 'draft') {
      return res.status(400).json({ message: 'Reimbursement can only be submitted from draft status' });
    }

    // Validate required documents for reimbursements
    if (reimbursement.claimType === 'reimbursement' && reimbursement.amount > 50 && reimbursement.documents.length === 0) {
      return res.status(400).json({ message: 'Supporting documents are required for reimbursements above ₹50' });
    }

    await reimbursement.submitForApproval(req.user.id);

    res.json({
      message: 'Reimbursement submitted for approval successfully',
      reimbursement
    });

  } catch (error) {
    console.error('Submit reimbursement error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/reimbursements/:id/approve
// @desc    Approve reimbursement
// @access  Private (Manager/HR/Finance/Admin)
router.put('/:id/approve', [auth, authorize(['admin', 'hr', 'manager', 'finance']), [
  body('comments').optional().isLength({ max: 500 }).withMessage('Comments cannot exceed 500 characters')
]], async (req, res) => {
  try {
    const reimbursement = await Reimbursement.findById(req.params.id);
    
    if (!reimbursement) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }

    if (!['submitted', 'under-review'].includes(reimbursement.status)) {
      return res.status(400).json({ message: 'Reimbursement cannot be approved in current status' });
    }

    const { comments = '' } = req.body;
    const userRole = req.user.role;

    // Find the appropriate workflow level for this user
    const workflowLevel = reimbursement.approvalWorkflow.find(w => 
      w.approverRole === userRole && w.status === 'pending'
    );

    if (!workflowLevel) {
      return res.status(403).json({ message: 'You are not authorized to approve this reimbursement at this stage' });
    }

    // Process the approval
    await reimbursement.processApproval(workflowLevel.level, req.user.id, 'approved', comments);

    const populatedReimbursement = await Reimbursement.findById(reimbursement._id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('approvalWorkflow.approverId', 'username email');

    res.json({
      message: reimbursement.status === 'approved' ? 'Reimbursement fully approved' : 'Reimbursement approved at your level',
      reimbursement: populatedReimbursement
    });
  } catch (error) {
    console.error('Approve reimbursement error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/reimbursements/:id/reject
// @desc    Reject reimbursement
// @access  Private (Manager/HR/Finance/Admin)
router.put('/:id/reject', [auth, authorize(['admin', 'hr', 'manager', 'finance']), [
  body('comments').notEmpty().withMessage('Rejection reason is required')
]], async (req, res) => {
  try {
    const reimbursement = await Reimbursement.findById(req.params.id);
    
    if (!reimbursement) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }

    if (!['submitted', 'under-review'].includes(reimbursement.status)) {
      return res.status(400).json({ message: 'Reimbursement cannot be rejected in current status' });
    }

    const { comments } = req.body;
    const userRole = req.user.role;

    // Find the appropriate workflow level for this user
    const workflowLevel = reimbursement.approvalWorkflow.find(w => 
      w.approverRole === userRole && w.status === 'pending'
    );

    if (!workflowLevel) {
      return res.status(403).json({ message: 'You are not authorized to reject this reimbursement' });
    }

    // Process the rejection
    await reimbursement.processApproval(workflowLevel.level, req.user.id, 'rejected', comments);

    const populatedReimbursement = await Reimbursement.findById(reimbursement._id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('approvalWorkflow.approverId', 'username email');

    res.json({
      message: 'Reimbursement rejected',
      reimbursement: populatedReimbursement
    });
  } catch (error) {
    console.error('Reject reimbursement error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/reimbursements/:id/process-payment
// @desc    Process payment for approved reimbursement
// @access  Private (Finance/Admin)
router.put('/:id/process-payment', [auth, authorize(['admin', 'finance']), [
  body('paymentMethod').isIn(['bank-transfer', 'cheque', 'petty-cash', 'salary-adjustment']).withMessage('Valid payment method is required'),
  body('paidAmount').isNumeric().withMessage('Valid paid amount is required')
]], async (req, res) => {
  try {
    const reimbursement = await Reimbursement.findById(req.params.id);
    
    if (!reimbursement) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }

    if (reimbursement.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved reimbursements can be processed for payment' });
    }

    const { paymentMethod, paidAmount, transactionId, utrNumber, chequeNumber, paymentRemarks } = req.body;

    const paymentDetails = {
      paymentMethod,
      paymentDate: new Date(),
      paidAmount: parseFloat(paidAmount),
      paymentStatus: 'success',
      paymentRemarks
    };

    if (transactionId) paymentDetails.transactionId = transactionId;
    if (utrNumber) paymentDetails.utrNumber = utrNumber;
    if (chequeNumber) paymentDetails.chequeNumber = chequeNumber;

    await reimbursement.processPayment(paymentDetails, req.user.id);

    // Update status to paid
    reimbursement.status = 'paid';
    await reimbursement.save();

    res.json({
      message: 'Payment processed successfully',
      reimbursement
    });

  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reimbursements/pending-approvals
// @desc    Get pending approvals for current user
// @access  Private (Manager/HR/Finance/Admin)
router.get('/pending-approvals', [auth, authorize(['admin', 'hr', 'manager', 'finance'])], async (req, res) => {
  try {
    const userRole = req.user.role;
    
    const pendingReimbursements = await Reimbursement.getPendingApprovals(req.user.id, userRole);

    res.json({
      pendingApprovals: pendingReimbursements,
      count: pendingReimbursements.length
    });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reimbursements/employee/:employeeId
// @desc    Get employee reimbursements
// @access  Private
router.get('/employee/:employeeId', auth, async (req, res) => {
  try {
    const { status, year } = req.query;
    
    // Check access permissions
    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ userId: req.user.id });
      if (!employee || req.params.employeeId !== employee._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const reimbursements = await Reimbursement.getEmployeeReimbursements(
      req.params.employeeId, 
      status, 
      year ? parseInt(year) : null
    );

    res.json({
      reimbursements,
      count: reimbursements.length
    });
  } catch (error) {
    console.error('Get employee reimbursements error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reimbursements/reports/summary
// @desc    Get reimbursement summary report
// @access  Private (HR/Admin/Finance)
router.get('/reports/summary', [auth, authorize(['admin', 'hr', 'finance'])], async (req, res) => {
  try {
    const { startDate, endDate, employeeId, expenseType, category, claimType = 'reimbursement' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    const filters = { claimType };
    if (employeeId) filters.employeeId = employeeId;
    if (expenseType) filters.expenseType = expenseType;
    if (category) filters.category = category;

    const summary = await Reimbursement.getReimbursementSummary(
      new Date(startDate),
      new Date(endDate),
      filters
    );

    res.json({
      period: { startDate, endDate },
      filters,
      summary,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Get reimbursement summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/reimbursements/bulk-bonus
// @desc    Create bulk bonus payments
// @access  Private (HR/Admin)
router.post('/bulk-bonus', [auth, authorize(['admin', 'hr']), [
  body('bonusType').isIn(['performance', 'annual', 'festival', 'retention', 'referral', 'project-completion', 'sales-incentive', 'spot-award', 'joining-bonus']).withMessage('Valid bonus type is required'),
  body('employees').isArray().withMessage('Employees array is required'),
  body('description').isLength({ min: 10 }).withMessage('Description must be at least 10 characters')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { bonusType, employees, description, calculationMethod = 'fixed', baseAmount } = req.body;
    
    const createdBonuses = [];
    const processingErrors = [];

    for (const empData of employees) {
      try {
        const employee = await Employee.findById(empData.employeeId);
        if (!employee) {
          processingErrors.push(`Employee not found: ${empData.employeeId}`);
          continue;
        }

        let bonusAmount = empData.amount;
        
        // Calculate bonus amount based on method
        if (calculationMethod === 'percentage-of-salary' && baseAmount) {
          bonusAmount = (employee.salaryStructure.ctc / 12) * (baseAmount / 100);
        }

        const bonusData = {
          employeeId: empData.employeeId,
          claimType: 'bonus',
          description,
          amount: bonusAmount,
          expenseDate: new Date(),
          bonusDetails: {
            bonusType,
            calculationMethod,
            baseAmount: calculationMethod === 'percentage-of-salary' ? baseAmount : bonusAmount,
            performanceMetrics: empData.performanceMetrics,
            salesMetrics: empData.salesMetrics
          },
          approvalWorkflow: [
            {
              level: 1,
              approverRole: 'hr',
              status: 'pending'
            }
          ],
          createdBy: req.user.id,
          updatedBy: req.user.id
        };

        // For high-value bonuses, add finance approval
        if (bonusAmount > 50000) {
          bonusData.approvalWorkflow.push({
            level: 2,
            approverRole: 'finance',
            status: 'pending'
          });
        }

        const bonus = new Reimbursement(bonusData);
        await bonus.save();
        
        createdBonuses.push(bonus);

      } catch (error) {
        console.error(`Error creating bonus for employee ${empData.employeeId}:`, error);
        processingErrors.push(`Error processing bonus for employee ${empData.employeeId}: ${error.message}`);
      }
    }

    res.json({
      message: `Created ${createdBonuses.length} bonus payments successfully`,
      processedCount: createdBonuses.length,
      errorCount: processingErrors.length,
      errors: processingErrors,
      bonuses: createdBonuses
    });

  } catch (error) {
    console.error('Bulk bonus creation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;