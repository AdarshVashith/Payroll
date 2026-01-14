const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  payrollId: {
    type: String,
    unique: true
  },
  
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  payPeriod: {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    workingDays: { type: Number, required: true },
    actualWorkingDays: { type: Number, required: true }
  },
  
  // Salary Structure Reference
  salaryStructure: {
    ctc: { type: Number, required: true },
    basicSalary: { type: Number, required: true },
    hra: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    transportAllowance: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 }
  },
  
  // Earnings Breakdown
  earnings: {
    basicSalary: { type: Number, required: true },
    hra: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    transportAllowance: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },
    overtime: { 
      hours: { type: Number, default: 0 },
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    },
    bonus: { type: Number, default: 0 },
    incentives: { type: Number, default: 0 },
    arrears: { type: Number, default: 0 },
    reimbursements: { type: Number, default: 0 },
    totalEarnings: { type: Number, required: true }
  },
  
  // Indian Statutory Deductions
  statutoryDeductions: {
    // Provident Fund
    pf: {
      employeeContribution: { type: Number, default: 0 },
      employerContribution: { type: Number, default: 0 },
      pensionFund: { type: Number, default: 0 },
      adminCharges: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    
    // Employee State Insurance
    esi: {
      employeeContribution: { type: Number, default: 0 },
      employerContribution: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    
    // Professional Tax (State-based)
    professionalTax: {
      amount: { type: Number, default: 0 },
      state: { type: String, default: 'Karnataka' }
    },
    
    // Income Tax (TDS)
    incomeTax: {
      taxableIncome: { type: Number, default: 0 },
      taxDeducted: { type: Number, default: 0 },
      regime: { type: String, enum: ['old', 'new'], default: 'new' },
      exemptions: { type: Number, default: 0 },
      deductions: { type: Number, default: 0 }
    },
    
    totalStatutoryDeductions: { type: Number, default: 0 }
  },
  
  // Other Deductions
  otherDeductions: {
    loanDeduction: { type: Number, default: 0 },
    advanceDeduction: { type: Number, default: 0 },
    lossOfPay: { 
      days: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    },
    disciplinaryDeduction: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    totalOtherDeductions: { type: Number, default: 0 }
  },
  
  // Net Pay Calculation
  grossPay: { type: Number, required: true },
  totalDeductions: { type: Number, required: true },
  netPay: { type: Number, required: true },
  
  // Attendance Integration
  attendanceData: {
    totalDays: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    paidLeaveDays: { type: Number, default: 0 },
    unpaidLeaveDays: { type: Number, default: 0 },
    holidayDays: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 }
  },
  
  // Compliance & Reporting
  compliance: {
    pfChallanGenerated: { type: Boolean, default: false },
    esiChallanGenerated: { type: Boolean, default: false },
    ptChallanGenerated: { type: Boolean, default: false },
    tdsDeducted: { type: Boolean, default: false },
    form16Generated: { type: Boolean, default: false }
  },
  
  // Payment Details
  paymentDetails: {
    method: { 
      type: String, 
      enum: ['bank-transfer', 'cash', 'cheque', 'upi'], 
      default: 'bank-transfer' 
    },
    bankAccount: {
      accountNumber: String,
      ifscCode: String,
      bankName: String
    },
    transactionId: String,
    utrNumber: String,
    paymentDate: Date,
    paymentStatus: {
      type: String,
      enum: ['pending', 'processing', 'success', 'failed', 'cancelled'],
      default: 'pending'
    },
    failureReason: String,
    retryCount: { type: Number, default: 0 }
  },
  
  // Payslip Details
  payslip: {
    generated: { type: Boolean, default: false },
    generatedDate: Date,
    downloadCount: { type: Number, default: 0 },
    emailSent: { type: Boolean, default: false },
    emailSentDate: Date,
    pdfPath: String
  },
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['draft', 'calculated', 'approved', 'processed', 'paid', 'cancelled'],
    default: 'draft'
  },
  
  // Approval Workflow
  approvalWorkflow: [{
    level: { type: Number, required: true },
    approverRole: { 
      type: String, 
      enum: ['manager', 'hr', 'finance', 'admin'], 
      required: true 
    },
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'], 
      default: 'pending' 
    },
    actionDate: Date,
    comments: String
  }],
  
  // Processing Details
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedDate: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedDate: Date,
  
  // Audit Trail
  auditTrail: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    oldValues: mongoose.Schema.Types.Mixed,
    newValues: mongoose.Schema.Types.Mixed,
    comments: String
  }],
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Indexes for performance
payrollSchema.index({ employeeId: 1, 'payPeriod.month': 1, 'payPeriod.year': 1 });
payrollSchema.index({ status: 1 });
payrollSchema.index({ 'payPeriod.year': 1, 'payPeriod.month': 1 });
payrollSchema.index({ processedDate: -1 });

// Pre-save middleware
payrollSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate payrollId if not exists
  if (!this.payrollId) {
    const year = this.payPeriod.year;
    const month = String(this.payPeriod.month).padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.payrollId = `PAY-${year}${month}-${randomNum}`;
  }
  
  // Calculate totals
  this.calculateTotals();
  
  next();
});

// Method to calculate all totals
payrollSchema.methods.calculateTotals = function() {
  // Calculate total earnings
  this.earnings.totalEarnings = 
    this.earnings.basicSalary + 
    this.earnings.hra + 
    this.earnings.specialAllowance + 
    this.earnings.transportAllowance + 
    this.earnings.medicalAllowance + 
    this.earnings.otherAllowances + 
    this.earnings.overtime.amount + 
    this.earnings.bonus + 
    this.earnings.incentives + 
    this.earnings.arrears + 
    this.earnings.reimbursements;

  // Calculate statutory deductions totals
  this.statutoryDeductions.pf.total = 
    this.statutoryDeductions.pf.employeeContribution + 
    this.statutoryDeductions.pf.adminCharges;
    
  this.statutoryDeductions.esi.total = 
    this.statutoryDeductions.esi.employeeContribution;
    
  this.statutoryDeductions.totalStatutoryDeductions = 
    this.statutoryDeductions.pf.total + 
    this.statutoryDeductions.esi.total + 
    this.statutoryDeductions.professionalTax.amount + 
    this.statutoryDeductions.incomeTax.taxDeducted;

  // Calculate other deductions total
  this.otherDeductions.totalOtherDeductions = 
    this.otherDeductions.loanDeduction + 
    this.otherDeductions.advanceDeduction + 
    this.otherDeductions.lossOfPay.amount + 
    this.otherDeductions.disciplinaryDeduction + 
    this.otherDeductions.otherDeductions;

  // Calculate gross pay, total deductions, and net pay
  this.grossPay = this.earnings.totalEarnings;
  this.totalDeductions = this.statutoryDeductions.totalStatutoryDeductions + this.otherDeductions.totalOtherDeductions;
  this.netPay = this.grossPay - this.totalDeductions;
};

// Method to calculate Indian statutory deductions
payrollSchema.methods.calculateStatutoryDeductions = function() {
  const basicSalary = this.earnings.basicSalary;
  const grossPay = this.grossPay;
  
  // PF Calculation (12% of basic salary, max ceiling ₹15,000)
  const pfBasic = Math.min(basicSalary, 15000);
  this.statutoryDeductions.pf.employeeContribution = Math.round(pfBasic * 0.12);
  this.statutoryDeductions.pf.employerContribution = Math.round(pfBasic * 0.12);
  this.statutoryDeductions.pf.pensionFund = Math.round(pfBasic * 0.0833);
  this.statutoryDeductions.pf.adminCharges = Math.round(pfBasic * 0.0067);
  
  // ESI Calculation (0.75% of gross salary, max ceiling ₹21,000)
  if (grossPay <= 21000) {
    this.statutoryDeductions.esi.employeeContribution = Math.round(grossPay * 0.0075);
    this.statutoryDeductions.esi.employerContribution = Math.round(grossPay * 0.0325);
  }
  
  // Professional Tax (Karnataka - example)
  if (grossPay > 15000) {
    this.statutoryDeductions.professionalTax.amount = 200;
  } else if (grossPay > 10000) {
    this.statutoryDeductions.professionalTax.amount = 150;
  } else {
    this.statutoryDeductions.professionalTax.amount = 0;
  }
  
  // Recalculate totals after statutory deductions
  this.calculateTotals();
};

// Method to calculate income tax (TDS)
payrollSchema.methods.calculateIncomeTax = function(annualSalary, regime = 'new', exemptions = 0, deductions = 0) {
  this.statutoryDeductions.incomeTax.regime = regime;
  this.statutoryDeductions.incomeTax.exemptions = exemptions;
  this.statutoryDeductions.incomeTax.deductions = deductions;
  
  let taxableIncome = annualSalary;
  
  if (regime === 'old') {
    // Old regime with deductions
    taxableIncome = annualSalary - exemptions - deductions;
  } else {
    // New regime without deductions but lower tax rates
    taxableIncome = annualSalary - 50000; // Standard deduction
  }
  
  this.statutoryDeductions.incomeTax.taxableIncome = taxableIncome;
  
  let annualTax = 0;
  
  if (regime === 'new') {
    // New tax regime rates (FY 2023-24)
    if (taxableIncome > 1500000) {
      annualTax += (taxableIncome - 1500000) * 0.30;
      taxableIncome = 1500000;
    }
    if (taxableIncome > 1200000) {
      annualTax += (taxableIncome - 1200000) * 0.20;
      taxableIncome = 1200000;
    }
    if (taxableIncome > 900000) {
      annualTax += (taxableIncome - 900000) * 0.15;
      taxableIncome = 900000;
    }
    if (taxableIncome > 600000) {
      annualTax += (taxableIncome - 600000) * 0.10;
      taxableIncome = 600000;
    }
    if (taxableIncome > 300000) {
      annualTax += (taxableIncome - 300000) * 0.05;
    }
  } else {
    // Old tax regime rates
    if (taxableIncome > 1000000) {
      annualTax += (taxableIncome - 1000000) * 0.30;
      taxableIncome = 1000000;
    }
    if (taxableIncome > 500000) {
      annualTax += (taxableIncome - 500000) * 0.20;
      taxableIncome = 500000;
    }
    if (taxableIncome > 250000) {
      annualTax += (taxableIncome - 250000) * 0.05;
    }
  }
  
  // Add cess (4% of tax)
  annualTax += annualTax * 0.04;
  
  // Monthly TDS
  this.statutoryDeductions.incomeTax.taxDeducted = Math.round(annualTax / 12);
  
  // Recalculate totals
  this.calculateTotals();
};

// Method to process attendance-based calculations
payrollSchema.methods.processAttendanceData = function(attendanceData) {
  this.attendanceData = attendanceData;
  
  // Calculate LOP (Loss of Pay)
  const lopDays = attendanceData.absentDays + attendanceData.unpaidLeaveDays;
  if (lopDays > 0) {
    const dailyRate = this.salaryStructure.basicSalary / this.payPeriod.workingDays;
    this.otherDeductions.lossOfPay.days = lopDays;
    this.otherDeductions.lossOfPay.amount = Math.round(dailyRate * lopDays);
  }
  
  // Calculate overtime
  if (attendanceData.overtimeHours > 0) {
    const hourlyRate = this.salaryStructure.basicSalary / (this.payPeriod.workingDays * 8);
    this.earnings.overtime.hours = attendanceData.overtimeHours;
    this.earnings.overtime.rate = hourlyRate * 1.5; // 1.5x rate for overtime
    this.earnings.overtime.amount = Math.round(this.earnings.overtime.rate * attendanceData.overtimeHours);
  }
  
  // Recalculate totals
  this.calculateTotals();
};

// Method to approve payroll
payrollSchema.methods.approvePayroll = function(approverId, level, comments) {
  const workflow = this.approvalWorkflow.find(w => w.level === level);
  if (workflow) {
    workflow.approverId = approverId;
    workflow.status = 'approved';
    workflow.actionDate = new Date();
    workflow.comments = comments;
  }
  
  // Check if all approvals are complete
  const allApproved = this.approvalWorkflow.every(w => w.status === 'approved');
  if (allApproved) {
    this.status = 'approved';
    this.approvedBy = approverId;
    this.approvedDate = new Date();
  }
  
  // Add audit trail
  this.auditTrail.push({
    action: `Payroll approved at level ${level}`,
    performedBy: approverId,
    comments: comments
  });
  
  return this.save();
};

// Method to process payment
payrollSchema.methods.processPayment = function(paymentDetails) {
  this.paymentDetails = {
    ...this.paymentDetails,
    ...paymentDetails,
    paymentDate: new Date()
  };
  
  if (paymentDetails.paymentStatus === 'success') {
    this.status = 'paid';
  }
  
  // Add audit trail
  this.auditTrail.push({
    action: 'Payment processed',
    performedBy: paymentDetails.processedBy,
    comments: `Payment ${paymentDetails.paymentStatus} - ${paymentDetails.transactionId || paymentDetails.utrNumber}`
  });
  
  return this.save();
};

// Static method to get payroll summary
payrollSchema.statics.getPayrollSummary = function(year, month) {
  const matchQuery = {};
  if (year) matchQuery['payPeriod.year'] = year;
  if (month) matchQuery['payPeriod.month'] = month;
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalEmployees: { $sum: 1 },
        totalGrossPay: { $sum: '$grossPay' },
        totalNetPay: { $sum: '$netPay' },
        totalDeductions: { $sum: '$totalDeductions' },
        totalPF: { $sum: '$statutoryDeductions.pf.total' },
        totalESI: { $sum: '$statutoryDeductions.esi.total' },
        totalTDS: { $sum: '$statutoryDeductions.incomeTax.taxDeducted' },
        paidCount: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
        },
        pendingCount: {
          $sum: { $cond: [{ $ne: ['$status', 'paid'] }, 1, 0] }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Payroll', payrollSchema);