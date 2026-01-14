const express = require('express');
const { body, validationResult } = require('express-validator');
const TaxManagement = require('../models/TaxManagement');
const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');
const { auth, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/tax-documents';
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

// @route   GET /api/tax-management
// @desc    Get tax records with filtering
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      employeeId, 
      status, 
      financialYear,
      taxRegime 
    } = req.query;
    
    let query = {};
    
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
    if (financialYear) query['financialYear.startYear'] = parseInt(financialYear);
    if (taxRegime) query.taxRegime = taxRegime;

    const taxRecords = await TaxManagement.find(query)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('reviewedBy', 'username email')
      .populate('approvedBy', 'username email')
      .sort({ 'financialYear.startYear': -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await TaxManagement.countDocuments(query);

    res.json({
      taxRecords,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get tax records error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tax-management
// @desc    Create or update tax declaration
// @access  Private
router.post('/', [auth, [
  body('financialYear.startYear').isInt({ min: 2020, max: 2030 }).withMessage('Valid financial year is required'),
  body('taxRegime').isIn(['old', 'new']).withMessage('Valid tax regime is required'),
  body('annualSalary.grossAnnualSalary').isNumeric().withMessage('Valid gross annual salary is required')
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

    const { financialYear, taxRegime, annualSalary, declarations } = req.body;

    // Check if tax record already exists for this financial year
    let taxRecord = await TaxManagement.findOne({
      employeeId,
      'financialYear.startYear': financialYear.startYear
    });

    if (taxRecord) {
      // Update existing record
      taxRecord.taxRegime = taxRegime;
      taxRecord.annualSalary = annualSalary;
      if (declarations) taxRecord.declarations = declarations;
      taxRecord.updatedBy = req.user.id;
      
      // Add audit trail
      taxRecord.auditTrail.push({
        action: 'Tax declaration updated',
        performedBy: req.user.id,
        comments: 'Tax declaration updated by user'
      });
    } else {
      // Create new record
      const startDate = new Date(financialYear.startYear, 3, 1); // April 1st
      const endDate = new Date(financialYear.startYear + 1, 2, 31); // March 31st
      
      taxRecord = new TaxManagement({
        employeeId,
        financialYear: {
          startYear: financialYear.startYear,
          endYear: financialYear.startYear + 1,
          startDate,
          endDate
        },
        taxRegime,
        annualSalary,
        declarations: declarations || {},
        createdBy: req.user.id,
        updatedBy: req.user.id
      });
    }

    // Calculate total deductions for old regime
    if (taxRegime === 'old' && declarations) {
      let totalDeductions = 0;
      
      // Section 80C
      if (declarations.section80C) {
        const section80C = declarations.section80C;
        const total80C = (section80C.ppf || 0) + (section80C.elss || 0) + 
                        (section80C.lifePremium || 0) + (section80C.nsc || 0) + 
                        (section80C.fixedDeposit || 0) + (section80C.homeLoanPrincipal || 0) + 
                        (section80C.tuitionFees || 0) + (section80C.other || 0);
        
        taxRecord.declarations.section80C.total = Math.min(total80C, section80C.maxLimit || 150000);
        totalDeductions += taxRecord.declarations.section80C.total;
      }
      
      // Section 80D
      if (declarations.section80D) {
        const section80D = declarations.section80D;
        taxRecord.declarations.section80D.total = (section80D.selfAndFamily || 0) + 
                                                 (section80D.parents || 0) + 
                                                 (section80D.seniorCitizenParents || 0) + 
                                                 (section80D.preventiveHealthCheckup || 0);
        totalDeductions += taxRecord.declarations.section80D.total;
      }
      
      // Other deductions
      totalDeductions += (declarations.section80E || 0) + 
                        (declarations.section80G || 0) + 
                        (declarations.section24 || 0);
      
      taxRecord.declarations.totalDeductions = totalDeductions;
    }

    // Calculate HRA exemption if applicable
    if (declarations && declarations.hraExemption) {
      await taxRecord.calculateHRAExemption();
    }

    // Calculate tax
    await taxRecord.calculateTax();

    await taxRecord.save();

    const populatedRecord = await TaxManagement.findById(taxRecord._id)
      .populate('employeeId', 'employeeId personalInfo employment');

    res.json({
      message: 'Tax declaration saved successfully',
      taxRecord: populatedRecord
    });

  } catch (error) {
    console.error('Create/update tax declaration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tax-management/:id/upload-proof
// @desc    Upload investment proof
// @access  Private
router.post('/:id/upload-proof', [auth, upload.single('document')], async (req, res) => {
  try {
    const taxRecord = await TaxManagement.findById(req.params.id);
    
    if (!taxRecord) {
      return res.status(404).json({ message: 'Tax record not found' });
    }

    // Check access permissions
    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ userId: req.user.id });
      if (!employee || taxRecord.employeeId.toString() !== employee._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { section, category, amount } = req.body;

    if (!section || !category || !amount) {
      return res.status(400).json({ message: 'Section, category, and amount are required' });
    }

    // Add investment proof
    taxRecord.investmentProofs.push({
      section,
      category,
      amount: parseFloat(amount),
      fileName: req.file.filename,
      originalName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: req.file.path
    });

    // Add audit trail
    taxRecord.auditTrail.push({
      action: 'Investment proof uploaded',
      performedBy: req.user.id,
      comments: `Uploaded proof for ${section} - ${category}`
    });

    await taxRecord.save();

    res.json({
      message: 'Investment proof uploaded successfully',
      proof: taxRecord.investmentProofs[taxRecord.investmentProofs.length - 1]
    });

  } catch (error) {
    console.error('Upload investment proof error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tax-management/:id/verify-proof/:proofId
// @desc    Verify investment proof
// @access  Private (HR/Admin)
router.put('/:id/verify-proof/:proofId', [auth, authorize(['admin', 'hr']), [
  body('verified').isBoolean().withMessage('Verified status is required'),
  body('comments').optional().isLength({ max: 500 }).withMessage('Comments cannot exceed 500 characters')
]], async (req, res) => {
  try {
    const taxRecord = await TaxManagement.findById(req.params.id);
    
    if (!taxRecord) {
      return res.status(404).json({ message: 'Tax record not found' });
    }

    const proof = taxRecord.investmentProofs.id(req.params.proofId);
    if (!proof) {
      return res.status(404).json({ message: 'Investment proof not found' });
    }

    const { verified, comments } = req.body;

    proof.verified = verified;
    proof.verifiedBy = req.user.id;
    proof.verifiedDate = new Date();
    proof.comments = comments;

    // Add audit trail
    taxRecord.auditTrail.push({
      action: `Investment proof ${verified ? 'verified' : 'rejected'}`,
      performedBy: req.user.id,
      comments: comments || `Proof ${verified ? 'verified' : 'rejected'} by HR`
    });

    await taxRecord.save();

    res.json({
      message: `Investment proof ${verified ? 'verified' : 'rejected'} successfully`,
      proof
    });

  } catch (error) {
    console.error('Verify investment proof error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tax-management/:id/submit
// @desc    Submit tax declaration for review
// @access  Private
router.put('/:id/submit', auth, async (req, res) => {
  try {
    const taxRecord = await TaxManagement.findById(req.params.id);
    
    if (!taxRecord) {
      return res.status(404).json({ message: 'Tax record not found' });
    }

    // Check access permissions
    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ userId: req.user.id });
      if (!employee || taxRecord.employeeId.toString() !== employee._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    if (taxRecord.status !== 'draft') {
      return res.status(400).json({ message: 'Tax declaration can only be submitted from draft status' });
    }

    taxRecord.status = 'submitted';
    taxRecord.submittedDate = new Date();

    // Add audit trail
    taxRecord.auditTrail.push({
      action: 'Tax declaration submitted',
      performedBy: req.user.id,
      comments: 'Tax declaration submitted for review'
    });

    await taxRecord.save();

    res.json({
      message: 'Tax declaration submitted successfully',
      taxRecord
    });

  } catch (error) {
    console.error('Submit tax declaration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tax-management/:id/approve
// @desc    Approve tax declaration
// @access  Private (HR/Admin)
router.put('/:id/approve', [auth, authorize(['admin', 'hr']), [
  body('comments').optional().isLength({ max: 500 }).withMessage('Comments cannot exceed 500 characters')
]], async (req, res) => {
  try {
    const taxRecord = await TaxManagement.findById(req.params.id);
    
    if (!taxRecord) {
      return res.status(404).json({ message: 'Tax record not found' });
    }

    if (!['submitted', 'under-review'].includes(taxRecord.status)) {
      return res.status(400).json({ message: 'Tax declaration cannot be approved in current status' });
    }

    const { comments } = req.body;

    taxRecord.status = 'approved';
    taxRecord.approvedBy = req.user.id;
    taxRecord.approvedDate = new Date();
    taxRecord.hrComments = comments;

    // Recalculate tax with approved declarations
    await taxRecord.calculateTax();

    // Add audit trail
    taxRecord.auditTrail.push({
      action: 'Tax declaration approved',
      performedBy: req.user.id,
      comments: comments || 'Tax declaration approved by HR'
    });

    await taxRecord.save();

    res.json({
      message: 'Tax declaration approved successfully',
      taxRecord
    });

  } catch (error) {
    console.error('Approve tax declaration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tax-management/:id/add-monthly-tds
// @desc    Add monthly TDS record
// @access  Private (System/Payroll)
router.post('/:id/add-monthly-tds', [auth, authorize(['admin', 'hr', 'finance']), [
  body('month').isInt({ min: 1, max: 12 }).withMessage('Valid month is required'),
  body('year').isInt({ min: 2020, max: 2030 }).withMessage('Valid year is required'),
  body('grossSalary').isNumeric().withMessage('Valid gross salary is required'),
  body('tdsDeducted').isNumeric().withMessage('Valid TDS amount is required'),
  body('payrollId').isMongoId().withMessage('Valid payroll ID is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const taxRecord = await TaxManagement.findById(req.params.id);
    
    if (!taxRecord) {
      return res.status(404).json({ message: 'Tax record not found' });
    }

    const { month, year, grossSalary, tdsDeducted, payrollId } = req.body;

    await taxRecord.addMonthlyTDS(month, year, grossSalary, tdsDeducted, payrollId);

    res.json({
      message: 'Monthly TDS record added successfully',
      monthlyTDS: taxRecord.monthlyTDS
    });

  } catch (error) {
    console.error('Add monthly TDS error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tax-management/:id/form16
// @desc    Generate Form 16
// @access  Private
router.get('/:id/form16', auth, async (req, res) => {
  try {
    const taxRecord = await TaxManagement.findById(req.params.id)
      .populate('employeeId', 'employeeId personalInfo employment');
    
    if (!taxRecord) {
      return res.status(404).json({ message: 'Tax record not found' });
    }

    // Check access permissions
    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ userId: req.user.id });
      if (!employee || taxRecord.employeeId._id.toString() !== employee._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Generate Form 16 PDF
    const pdfBuffer = await generateForm16PDF(taxRecord);
    
    // Update form 16 status
    if (!taxRecord.form16.generated) {
      await taxRecord.generateForm16(req.user.id);
    } else {
      taxRecord.form16.downloadCount += 1;
      taxRecord.form16.lastDownloaded = new Date();
      await taxRecord.save();
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=form16-${taxRecord.taxId}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Generate Form 16 error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tax-management/reports/summary
// @desc    Get tax summary report
// @access  Private (HR/Admin)
router.get('/reports/summary', [auth, authorize(['admin', 'hr', 'finance'])], async (req, res) => {
  try {
    const { financialYear = new Date().getFullYear() } = req.query;
    
    const summary = await TaxManagement.getTaxSummary(parseInt(financialYear));
    
    res.json({
      financialYear: parseInt(financialYear),
      summary: summary[0] || {},
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Get tax summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to generate Form 16 PDF
async function generateForm16PDF(taxRecord) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      const employee = taxRecord.employeeId;
      const fy = `${taxRecord.financialYear.startYear}-${taxRecord.financialYear.endYear}`;

      // Header
      doc.fontSize(16).text('FORM NO. 16', { align: 'center' });
      doc.fontSize(12).text(`[See rule 31(1)(a)]`, { align: 'center' });
      doc.moveDown();
      
      doc.text('Certificate under section 203 of the Income-tax Act, 1961', { align: 'center' });
      doc.text('for tax deducted at source from salary', { align: 'center' });
      doc.moveDown();
      
      // Part A
      doc.fontSize(14).text('PART A', { underline: true });
      doc.fontSize(10);
      
      // Employer details
      doc.text('Name and address of the Employer: HR Pro Company');
      doc.text('123 Business Street, City - 560001');
      doc.text('TAN: ABCD12345E');
      doc.moveDown();
      
      // Employee details
      doc.text(`Name of the Employee: ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`);
      doc.text(`Employee ID: ${employee.employeeId}`);
      doc.text(`PAN: ${employee.personalInfo.panNumber || 'Not Available'}`);
      doc.text(`Designation: ${employee.employment.designation}`);
      doc.text(`Department: ${employee.employment.department}`);
      doc.moveDown();
      
      // Financial Year
      doc.text(`Financial Year: ${fy}`);
      doc.moveDown();
      
      // Part B - Summary
      doc.fontSize(14).text('PART B', { underline: true });
      doc.fontSize(10);
      
      doc.text('Details of salary paid and tax deducted:');
      doc.moveDown();
      
      // Monthly details table
      doc.text('Month-wise Details:');
      let yPosition = doc.y;
      
      // Table headers
      doc.text('Month', 50, yPosition);
      doc.text('Gross Salary', 150, yPosition);
      doc.text('TDS Deducted', 250, yPosition);
      doc.text('Cumulative TDS', 350, yPosition);
      
      yPosition += 20;
      
      // Monthly data
      taxRecord.monthlyTDS.forEach(record => {
        const monthName = new Date(record.year, record.month - 1).toLocaleString('default', { month: 'long' });
        doc.text(`${monthName} ${record.year}`, 50, yPosition);
        doc.text(`₹${record.grossSalary.toLocaleString('en-IN')}`, 150, yPosition);
        doc.text(`₹${record.tdsDeducted.toLocaleString('en-IN')}`, 250, yPosition);
        doc.text(`₹${record.cumulativeTDS.toLocaleString('en-IN')}`, 350, yPosition);
        yPosition += 15;
      });
      
      doc.y = yPosition + 20;
      
      // Summary
      doc.text('Annual Summary:');
      doc.text(`Total Gross Income: ₹${taxRecord.annualSummary.totalGrossIncome.toLocaleString('en-IN')}`);
      doc.text(`Total TDS Deducted: ₹${taxRecord.annualSummary.totalTDSDeducted.toLocaleString('en-IN')}`);
      doc.text(`Tax Regime: ${taxRecord.taxRegime.toUpperCase()}`);
      
      if (taxRecord.taxRegime === 'old') {
        doc.moveDown();
        doc.text('Deductions claimed:');
        doc.text(`Section 80C: ₹${taxRecord.declarations.section80C.total.toLocaleString('en-IN')}`);
        doc.text(`Section 80D: ₹${taxRecord.declarations.section80D.total.toLocaleString('en-IN')}`);
        doc.text(`HRA Exemption: ₹${taxRecord.declarations.hraExemption.exemptedAmount.toLocaleString('en-IN')}`);
        doc.text(`Total Deductions: ₹${taxRecord.declarations.totalDeductions.toLocaleString('en-IN')}`);
      }
      
      doc.moveDown();
      doc.text(`Taxable Income: ₹${taxRecord.taxCalculation.taxableIncome.toLocaleString('en-IN')}`);
      doc.text(`Tax Liability: ₹${taxRecord.taxCalculation.totalTaxLiability.toLocaleString('en-IN')}`);
      
      // Footer
      doc.moveDown(2);
      doc.text('This is a computer-generated Form 16 and does not require signature.', { align: 'center' });
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = router;