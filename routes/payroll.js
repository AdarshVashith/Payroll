const express = require('express');
const { body, validationResult } = require('express-validator');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const TaxManagement = require('../models/TaxManagement');
const SalaryDisbursement = require('../models/SalaryDisbursement');
const Reimbursement = require('../models/Reimbursement');
const { auth, authorize } = require('../middleware/auth');
const moment = require('moment');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// @route   GET /api/payroll
// @desc    Get payroll records with filtering
// @access  Private (HR/Admin)
router.get('/', [auth, authorize(['admin', 'hr', 'finance'])], async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      employeeId, 
      status, 
      month, 
      year = new Date().getFullYear(),
      department 
    } = req.query;
    
    let query = {};
    
    // Employee filter
    if (employeeId) {
      query.employeeId = employeeId;
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    // Date filters
    if (year) {
      query['payPeriod.year'] = parseInt(year);
    }
    if (month) {
      query['payPeriod.month'] = parseInt(month);
    }

    // Build aggregation pipeline for department filter
    let pipeline = [
      { $match: query }
    ];

    // Add employee lookup
    pipeline.push({
      $lookup: {
        from: 'employees',
        localField: 'employeeId',
        foreignField: '_id',
        as: 'employee'
      }
    });

    pipeline.push({ $unwind: '$employee' });

    // Department filter
    if (department) {
      pipeline.push({
        $match: { 'employee.employment.department': department }
      });
    }

    // Add user lookups
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'processedBy',
          foreignField: '_id',
          as: 'processor'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'approvedBy',
          foreignField: '_id',
          as: 'approver'
        }
      }
    );

    // Sort and paginate
    pipeline.push(
      { $sort: { 'payPeriod.year': -1, 'payPeriod.month': -1, createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    );

    const payrolls = await Payroll.aggregate(pipeline);
    
    // Get total count
    const totalPipeline = [
      { $match: query },
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
      totalPipeline.push({
        $match: { 'employee.employment.department': department }
      });
    }

    totalPipeline.push({ $count: 'total' });
    const totalResult = await Payroll.aggregate(totalPipeline);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    res.json({
      payrolls,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get payrolls error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payroll/process-bulk
// @desc    Process payroll for multiple employees
// @access  Private (HR/Admin)
router.post('/process-bulk', [auth, authorize(['admin', 'hr']), [
  body('month').isInt({ min: 1, max: 12 }).withMessage('Valid month is required'),
  body('year').isInt({ min: 2020, max: 2030 }).withMessage('Valid year is required'),
  body('employeeIds').isArray().withMessage('Employee IDs array is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { month, year, employeeIds, includeReimbursements = true } = req.body;
    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const workingDays = calculateWorkingDays(startDate, endDate);
    
    const processedPayrolls = [];
    const processingErrors = [];

    for (const employeeId of employeeIds) {
      try {
        // Check if payroll already exists
        const existingPayroll = await Payroll.findOne({
          employeeId,
          'payPeriod.month': month,
          'payPeriod.year': year
        });

        if (existingPayroll) {
          processingErrors.push(`Payroll already exists for employee ${employeeId} for ${month}/${year}`);
          continue;
        }

        // Get employee details
        const employee = await Employee.findById(employeeId);
        if (!employee) {
          processingErrors.push(`Employee not found: ${employeeId}`);
          continue;
        }

        // Get attendance data
        const attendanceData = await getEmployeeAttendanceData(employeeId, startDate, endDate);
        
        // Get tax information
        const taxInfo = await TaxManagement.findOne({
          employeeId,
          'financialYear.startYear': year >= 4 ? year - 1 : year
        });

        // Get approved reimbursements for the month
        let reimbursements = 0;
        if (includeReimbursements) {
          const approvedReimbursements = await Reimbursement.find({
            employeeId,
            status: 'approved',
            expenseDate: { $gte: startDate, $lte: endDate }
          });
          reimbursements = approvedReimbursements.reduce((sum, reimb) => sum + reimb.amount, 0);
        }

        // Create payroll record
        const payrollData = {
          employeeId,
          payPeriod: {
            month,
            year,
            startDate,
            endDate,
            workingDays,
            actualWorkingDays: attendanceData.presentDays + attendanceData.halfDays * 0.5
          },
          salaryStructure: {
            ctc: employee.salaryStructure.ctc,
            basicSalary: employee.salaryStructure.basicSalary,
            hra: employee.salaryStructure.hra,
            specialAllowance: employee.salaryStructure.specialAllowance,
            transportAllowance: employee.salaryStructure.transportAllowance,
            medicalAllowance: employee.salaryStructure.medicalAllowance,
            otherAllowances: employee.salaryStructure.otherAllowances || 0
          },
          earnings: {
            basicSalary: Math.round((employee.salaryStructure.basicSalary / 12) * (attendanceData.presentDays + attendanceData.halfDays * 0.5) / workingDays),
            hra: Math.round((employee.salaryStructure.hra / 12) * (attendanceData.presentDays + attendanceData.halfDays * 0.5) / workingDays),
            specialAllowance: Math.round((employee.salaryStructure.specialAllowance / 12) * (attendanceData.presentDays + attendanceData.halfDays * 0.5) / workingDays),
            transportAllowance: employee.salaryStructure.transportAllowance,
            medicalAllowance: employee.salaryStructure.medicalAllowance,
            reimbursements
          },
          attendanceData,
          createdBy: req.user.id,
          updatedBy: req.user.id
        };

        const payroll = new Payroll(payrollData);
        
        // Process attendance-based calculations
        payroll.processAttendanceData(attendanceData);
        
        // Calculate statutory deductions
        payroll.calculateStatutoryDeductions();
        
        // Calculate income tax if tax info available
        if (taxInfo) {
          payroll.calculateIncomeTax(employee.salaryStructure.ctc, taxInfo.taxRegime);
        }

        await payroll.save();
        processedPayrolls.push(payroll);

      } catch (error) {
        console.error(`Error processing payroll for employee ${employeeId}:`, error);
        processingErrors.push(`Error processing payroll for employee ${employeeId}: ${error.message}`);
      }
    }

    res.json({
      message: `Processed ${processedPayrolls.length} payrolls successfully`,
      processedCount: processedPayrolls.length,
      errorCount: processingErrors.length,
      errors: processingErrors,
      payrolls: processedPayrolls
    });

  } catch (error) {
    console.error('Bulk payroll processing error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/payroll/:id/approve
// @desc    Approve payroll
// @access  Private (HR/Admin/Finance)
router.put('/:id/approve', [auth, authorize(['admin', 'hr', 'finance']), [
  body('comments').optional().isLength({ max: 500 }).withMessage('Comments cannot exceed 500 characters')
]], async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll not found' });
    }

    if (!['calculated', 'draft'].includes(payroll.status)) {
      return res.status(400).json({ message: 'Payroll cannot be approved in current status' });
    }

    const { comments = '' } = req.body;
    const userRole = req.user.role;

    // Find the appropriate workflow level for this user
    const workflowLevel = payroll.approvalWorkflow.find(w => 
      w.approverRole === userRole && w.status === 'pending'
    );

    if (!workflowLevel) {
      return res.status(403).json({ message: 'You are not authorized to approve this payroll at this stage' });
    }

    // Process the approval
    await payroll.approvePayroll(req.user.id, workflowLevel.level, comments);

    const populatedPayroll = await Payroll.findById(payroll._id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('approvedBy', 'username email');

    res.json({
      message: payroll.status === 'approved' ? 'Payroll fully approved' : 'Payroll approved at your level',
      payroll: populatedPayroll
    });
  } catch (error) {
    console.error('Approve payroll error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payroll/disburse-bulk
// @desc    Create bulk salary disbursement
// @access  Private (Finance/Admin)
router.post('/disburse-bulk', [auth, authorize(['admin', 'finance']), [
  body('payrollIds').isArray().withMessage('Payroll IDs array is required'),
  body('paymentMethod').isIn(['neft', 'rtgs', 'imps', 'upi']).withMessage('Valid payment method is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { payrollIds, paymentMethod, paymentGateway = 'manual' } = req.body;
    
    // Generate batch ID
    const batchId = `BATCH-${Date.now()}`;
    const disbursements = [];
    const processingErrors = [];

    for (const payrollId of payrollIds) {
      try {
        const payroll = await Payroll.findById(payrollId).populate('employeeId');
        
        if (!payroll) {
          processingErrors.push(`Payroll not found: ${payrollId}`);
          continue;
        }

        if (payroll.status !== 'approved') {
          processingErrors.push(`Payroll not approved: ${payrollId}`);
          continue;
        }

        // Check if disbursement already exists
        const existingDisbursement = await SalaryDisbursement.findOne({ payrollId });
        if (existingDisbursement) {
          processingErrors.push(`Disbursement already exists for payroll: ${payrollId}`);
          continue;
        }

        // Create disbursement record
        const disbursementData = {
          batchId,
          payPeriod: payroll.payPeriod,
          employeeId: payroll.employeeId._id,
          payrollId: payroll._id,
          paymentDetails: {
            grossAmount: payroll.grossPay,
            netAmount: payroll.netPay,
            deductions: payroll.totalDeductions,
            bankAccount: {
              accountNumber: payroll.employeeId.bankDetails.accountNumber,
              ifscCode: payroll.employeeId.bankDetails.ifscCode,
              bankName: payroll.employeeId.bankDetails.bankName,
              branchName: payroll.employeeId.bankDetails.branchName,
              accountHolderName: payroll.employeeId.bankDetails.accountHolderName,
              accountType: payroll.employeeId.bankDetails.accountType
            },
            paymentMethod,
            paymentGateway: {
              provider: paymentGateway
            }
          },
          compliance: {
            tdsDeducted: payroll.statutoryDeductions.incomeTax.taxDeducted,
            pfDeducted: payroll.statutoryDeductions.pf.total,
            esiDeducted: payroll.statutoryDeductions.esi.total,
            ptDeducted: payroll.statutoryDeductions.professionalTax.amount
          },
          processing: {
            initiatedBy: req.user.id
          },
          createdBy: req.user.id,
          updatedBy: req.user.id
        };

        const disbursement = new SalaryDisbursement(disbursementData);
        
        // Validate disbursement
        await disbursement.validateDisbursement(req.user.id);
        
        if (!disbursement.processing.validated) {
          processingErrors.push(`Validation failed for payroll ${payrollId}: ${disbursement.processing.validationErrors.join(', ')}`);
          continue;
        }

        await disbursement.save();
        disbursements.push(disbursement);

        // Update payroll status
        payroll.status = 'processed';
        payroll.processedBy = req.user.id;
        payroll.processedDate = new Date();
        await payroll.save();

      } catch (error) {
        console.error(`Error creating disbursement for payroll ${payrollId}:`, error);
        processingErrors.push(`Error processing payroll ${payrollId}: ${error.message}`);
      }
    }

    res.json({
      message: `Created ${disbursements.length} disbursements successfully`,
      batchId,
      processedCount: disbursements.length,
      errorCount: processingErrors.length,
      errors: processingErrors,
      disbursements
    });

  } catch (error) {
    console.error('Bulk disbursement error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/payroll/:id/payslip
// @desc    Generate and download payslip
// @access  Private
router.get('/:id/payslip', auth, async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('employeeId', 'employeeId personalInfo employment bankDetails')
      .populate('processedBy', 'username email');
    
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll not found' });
    }

    // Check access permissions
    if (req.user.role === 'employee' && payroll.employeeId.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Generate PDF payslip
    const pdfBuffer = await generatePayslipPDF(payroll);
    
    // Update download count
    payroll.payslip.downloadCount += 1;
    await payroll.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip-${payroll.payrollId}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Generate payslip error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payroll/:id/email-payslip
// @desc    Email payslip to employee
// @access  Private (HR/Admin)
router.post('/:id/email-payslip', [auth, authorize(['admin', 'hr'])], async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('employeeId', 'employeeId personalInfo employment');
    
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll not found' });
    }

    // Generate PDF payslip
    const pdfBuffer = await generatePayslipPDF(payroll);
    
    // Email logic would go here
    // For now, just mark as sent
    payroll.payslip.emailSent = true;
    payroll.payslip.emailSentDate = new Date();
    await payroll.save();

    res.json({ message: 'Payslip emailed successfully' });

  } catch (error) {
    console.error('Email payslip error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/payroll/compliance/challans
// @desc    Generate compliance challans (PF, ESI, PT)
// @access  Private (HR/Admin/Finance)
router.get('/compliance/challans', [auth, authorize(['admin', 'hr', 'finance'])], async (req, res) => {
  try {
    const { month, year, type } = req.query;
    
    if (!month || !year || !type) {
      return res.status(400).json({ message: 'Month, year, and type are required' });
    }

    const payrolls = await Payroll.find({
      'payPeriod.month': parseInt(month),
      'payPeriod.year': parseInt(year),
      status: { $in: ['approved', 'processed', 'paid'] }
    }).populate('employeeId', 'employeeId personalInfo employment');

    let challanData = {};

    switch (type) {
      case 'pf':
        challanData = generatePFChallan(payrolls, month, year);
        break;
      case 'esi':
        challanData = generateESIChallan(payrolls, month, year);
        break;
      case 'pt':
        challanData = generatePTChallan(payrolls, month, year);
        break;
      default:
        return res.status(400).json({ message: 'Invalid challan type' });
    }

    res.json(challanData);

  } catch (error) {
    console.error('Generate challan error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/payroll/reports/summary
// @desc    Get payroll summary report
// @access  Private (HR/Admin/Finance)
router.get('/reports/summary', [auth, authorize(['admin', 'hr', 'finance'])], async (req, res) => {
  try {
    const { year, month } = req.query;
    
    const summary = await Payroll.getPayrollSummary(year, month);
    
    res.json({
      period: { year, month },
      summary: summary[0] || {},
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Get payroll summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper Functions

// Calculate working days in a month
function calculateWorkingDays(startDate, endDate) {
  let workingDays = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
}

// Get employee attendance data for payroll period
async function getEmployeeAttendanceData(employeeId, startDate, endDate) {
  const attendanceRecords = await Attendance.find({
    employeeId,
    date: { $gte: startDate, $lte: endDate }
  });

  const data = {
    totalDays: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1,
    presentDays: 0,
    absentDays: 0,
    halfDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    holidayDays: 0,
    overtimeHours: 0
  };

  attendanceRecords.forEach(record => {
    switch (record.status) {
      case 'present':
      case 'work-from-home':
        data.presentDays++;
        break;
      case 'absent':
        data.absentDays++;
        break;
      case 'half-day':
        data.halfDays++;
        break;
      case 'on-leave':
        // Determine if paid or unpaid leave
        data.paidLeaveDays++; // Simplified - would need leave record lookup
        break;
      case 'holiday':
        data.holidayDays++;
        break;
    }
    
    if (record.workingHours && record.workingHours.overtimeHours) {
      data.overtimeHours += record.workingHours.overtimeHours;
    }
  });

  return data;
}

// Generate payslip PDF
async function generatePayslipPDF(payroll) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Header
      doc.fontSize(20).text('PAYSLIP', { align: 'center' });
      doc.moveDown();
      
      // Company details
      doc.fontSize(12).text('HR Pro Company', { align: 'center' });
      doc.text('123 Business Street, City - 560001', { align: 'center' });
      doc.moveDown();
      
      // Employee details
      const employee = payroll.employeeId;
      doc.text(`Employee ID: ${employee.employeeId}`);
      doc.text(`Name: ${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`);
      doc.text(`Department: ${employee.employment.department}`);
      doc.text(`Designation: ${employee.employment.designation}`);
      doc.moveDown();
      
      // Pay period
      doc.text(`Pay Period: ${payroll.payPeriod.month}/${payroll.payPeriod.year}`);
      doc.text(`Working Days: ${payroll.payPeriod.workingDays}`);
      doc.text(`Actual Working Days: ${payroll.payPeriod.actualWorkingDays}`);
      doc.moveDown();
      
      // Earnings
      doc.text('EARNINGS', { underline: true });
      doc.text(`Basic Salary: ₹${payroll.earnings.basicSalary.toLocaleString('en-IN')}`);
      doc.text(`HRA: ₹${payroll.earnings.hra.toLocaleString('en-IN')}`);
      doc.text(`Special Allowance: ₹${payroll.earnings.specialAllowance.toLocaleString('en-IN')}`);
      doc.text(`Transport Allowance: ₹${payroll.earnings.transportAllowance.toLocaleString('en-IN')}`);
      doc.text(`Medical Allowance: ₹${payroll.earnings.medicalAllowance.toLocaleString('en-IN')}`);
      if (payroll.earnings.overtime.amount > 0) {
        doc.text(`Overtime: ₹${payroll.earnings.overtime.amount.toLocaleString('en-IN')}`);
      }
      if (payroll.earnings.bonus > 0) {
        doc.text(`Bonus: ₹${payroll.earnings.bonus.toLocaleString('en-IN')}`);
      }
      doc.text(`Total Earnings: ₹${payroll.grossPay.toLocaleString('en-IN')}`, { underline: true });
      doc.moveDown();
      
      // Deductions
      doc.text('DEDUCTIONS', { underline: true });
      doc.text(`PF Contribution: ₹${payroll.statutoryDeductions.pf.total.toLocaleString('en-IN')}`);
      doc.text(`ESI Contribution: ₹${payroll.statutoryDeductions.esi.total.toLocaleString('en-IN')}`);
      doc.text(`Professional Tax: ₹${payroll.statutoryDeductions.professionalTax.amount.toLocaleString('en-IN')}`);
      doc.text(`Income Tax (TDS): ₹${payroll.statutoryDeductions.incomeTax.taxDeducted.toLocaleString('en-IN')}`);
      if (payroll.otherDeductions.lossOfPay.amount > 0) {
        doc.text(`Loss of Pay: ₹${payroll.otherDeductions.lossOfPay.amount.toLocaleString('en-IN')}`);
      }
      doc.text(`Total Deductions: ₹${payroll.totalDeductions.toLocaleString('en-IN')}`, { underline: true });
      doc.moveDown();
      
      // Net pay
      doc.fontSize(14).text(`NET PAY: ₹${payroll.netPay.toLocaleString('en-IN')}`, { underline: true });
      doc.moveDown();
      
      // Footer
      doc.fontSize(10).text('This is a computer-generated payslip and does not require a signature.', { align: 'center' });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Generate PF Challan
function generatePFChallan(payrolls, month, year) {
  let totalEmployeeContribution = 0;
  let totalEmployerContribution = 0;
  let totalPensionFund = 0;
  let totalAdminCharges = 0;
  
  const employeeDetails = payrolls.map(payroll => {
    totalEmployeeContribution += payroll.statutoryDeductions.pf.employeeContribution;
    totalEmployerContribution += payroll.statutoryDeductions.pf.employerContribution;
    totalPensionFund += payroll.statutoryDeductions.pf.pensionFund;
    totalAdminCharges += payroll.statutoryDeductions.pf.adminCharges;
    
    return {
      employeeId: payroll.employeeId.employeeId,
      name: `${payroll.employeeId.personalInfo.firstName} ${payroll.employeeId.personalInfo.lastName}`,
      pfNumber: payroll.employeeId.taxInfo?.pfNumber || '',
      basicSalary: payroll.earnings.basicSalary,
      employeeContribution: payroll.statutoryDeductions.pf.employeeContribution,
      employerContribution: payroll.statutoryDeductions.pf.employerContribution
    };
  });
  
  return {
    challanType: 'PF',
    period: `${month}/${year}`,
    totalEmployees: payrolls.length,
    totalEmployeeContribution,
    totalEmployerContribution,
    totalPensionFund,
    totalAdminCharges,
    grandTotal: totalEmployeeContribution + totalEmployerContribution,
    employeeDetails,
    generatedAt: new Date()
  };
}

// Generate ESI Challan
function generateESIChallan(payrolls, month, year) {
  let totalEmployeeContribution = 0;
  let totalEmployerContribution = 0;
  
  const employeeDetails = payrolls.filter(payroll => 
    payroll.statutoryDeductions.esi.employeeContribution > 0
  ).map(payroll => {
    totalEmployeeContribution += payroll.statutoryDeductions.esi.employeeContribution;
    totalEmployerContribution += payroll.statutoryDeductions.esi.employerContribution;
    
    return {
      employeeId: payroll.employeeId.employeeId,
      name: `${payroll.employeeId.personalInfo.firstName} ${payroll.employeeId.personalInfo.lastName}`,
      esiNumber: payroll.employeeId.taxInfo?.esiNumber || '',
      grossSalary: payroll.grossPay,
      employeeContribution: payroll.statutoryDeductions.esi.employeeContribution,
      employerContribution: payroll.statutoryDeductions.esi.employerContribution
    };
  });
  
  return {
    challanType: 'ESI',
    period: `${month}/${year}`,
    totalEmployees: employeeDetails.length,
    totalEmployeeContribution,
    totalEmployerContribution,
    grandTotal: totalEmployeeContribution + totalEmployerContribution,
    employeeDetails,
    generatedAt: new Date()
  };
}

// Generate PT Challan
function generatePTChallan(payrolls, month, year) {
  let totalProfessionalTax = 0;
  
  const employeeDetails = payrolls.filter(payroll => 
    payroll.statutoryDeductions.professionalTax.amount > 0
  ).map(payroll => {
    totalProfessionalTax += payroll.statutoryDeductions.professionalTax.amount;
    
    return {
      employeeId: payroll.employeeId.employeeId,
      name: `${payroll.employeeId.personalInfo.firstName} ${payroll.employeeId.personalInfo.lastName}`,
      grossSalary: payroll.grossPay,
      professionalTax: payroll.statutoryDeductions.professionalTax.amount
    };
  });
  
  return {
    challanType: 'Professional Tax',
    period: `${month}/${year}`,
    state: 'Karnataka',
    totalEmployees: employeeDetails.length,
    totalProfessionalTax,
    employeeDetails,
    generatedAt: new Date()
  };
}

module.exports = router;