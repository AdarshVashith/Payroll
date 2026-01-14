const mongoose = require('mongoose');

const payslipSchema = new mongoose.Schema({
  payslipId: {
    type: String,
    required: true
  },
  
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  payrollCycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayrollCycle',
    required: true
  },
  
  // Pay Period
  payPeriod: {
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    payDate: { type: Date, required: true }
  },
  
  // Employee Details (snapshot at time of payroll)
  employeeDetails: {
    employeeId: String,
    fullName: String,
    designation: String,
    department: String,
    dateOfJoining: Date,
    panNumber: String,
    pfNumber: String,
    esiNumber: String,
    uanNumber: String,
    bankAccount: {
      accountNumber: String,
      ifscCode: String,
      bankName: String
    }
  },
  
  // Attendance Details
  attendanceDetails: {
    totalWorkingDays: { type: Number, required: true },
    actualWorkingDays: { type: Number, required: true },
    presentDays: { type: Number, required: true },
    absentDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    weeklyOffs: { type: Number, default: 0 },
    holidays: { type: Number, default: 0 },
    paidLeaves: { type: Number, default: 0 },
    unpaidLeaves: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    lateComingDays: { type: Number, default: 0 }
  },
  
  // Salary Structure
  salaryStructure: {
    ctc: { type: Number, required: true },
    basicSalary: { type: Number, required: true },
    
    // Earnings
    earnings: {
      basic: { type: Number, required: true },
      hra: { type: Number, default: 0 },
      specialAllowance: { type: Number, default: 0 },
      transportAllowance: { type: Number, default: 0 },
      medicalAllowance: { type: Number, default: 0 },
      lunchAllowance: { type: Number, default: 0 },
      phoneAllowance: { type: Number, default: 0 },
      internetAllowance: { type: Number, default: 0 },
      performanceBonus: { type: Number, default: 0 },
      incentives: { type: Number, default: 0 },
      overtimePay: { type: Number, default: 0 },
      arrears: { type: Number, default: 0 },
      
      // Custom earnings
      customEarnings: [{
        name: String,
        amount: Number,
        isTaxable: Boolean
      }],
      
      totalEarnings: { type: Number, required: true }
    },
    
    // Deductions
    deductions: {
      providentFund: { type: Number, default: 0 },
      esi: { type: Number, default: 0 },
      professionalTax: { type: Number, default: 0 },
      incomeTax: { type: Number, default: 0 },
      loanDeduction: { type: Number, default: 0 },
      advanceDeduction: { type: Number, default: 0 },
      lateComingFine: { type: Number, default: 0 },
      lopDeduction: { type: Number, default: 0 },
      
      // Custom deductions
      customDeductions: [{
        name: String,
        amount: Number
      }],
      
      totalDeductions: { type: Number, required: true }
    },
    
    // Net Salary
    netSalary: { type: Number, required: true }
  },
  
  // Employer Contributions (for reference)
  employerContributions: {
    providentFund: { type: Number, default: 0 },
    esi: { type: Number, default: 0 },
    gratuity: { type: Number, default: 0 },
    totalContribution: { type: Number, default: 0 }
  },
  
  // Year-to-Date Summary
  ytdSummary: {
    grossEarnings: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },
    taxDeducted: { type: Number, default: 0 },
    pfContribution: { type: Number, default: 0 }
  },
  
  // Tax Information
  taxDetails: {
    taxableIncome: { type: Number, default: 0 },
    taxExemptIncome: { type: Number, default: 0 },
    tdsDeducted: { type: Number, default: 0 },
    taxRegime: { type: String, enum: ['old', 'new'], default: 'new' }
  },
  
  // Reimbursements
  reimbursements: [{
    type: String,
    description: String,
    amount: Number,
    isTaxable: Boolean,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date
  }],
  
  // Status and Processing
  status: {
    type: String,
    enum: ['draft', 'calculated', 'approved', 'processed', 'paid', 'cancelled'],
    default: 'draft'
  },
  
  // Payment Details
  paymentDetails: {
    paymentMethod: { 
      type: String, 
      enum: ['bank-transfer', 'cheque', 'cash'], 
      default: 'bank-transfer' 
    },
    transactionId: String,
    utrNumber: String,
    paymentDate: Date,
    paymentStatus: { 
      type: String, 
      enum: ['pending', 'success', 'failed', 'cancelled'], 
      default: 'pending' 
    },
    failureReason: String,
    retryCount: { type: Number, default: 0 }
  },
  
  // Document Generation
  documents: {
    payslipPdf: {
      url: String,
      generatedAt: Date,
      downloadCount: { type: Number, default: 0 },
      lastDownloadedAt: Date
    },
    emailSent: {
      sentAt: Date,
      sentTo: String,
      status: { type: String, enum: ['sent', 'failed'], default: 'sent' }
    }
  },
  
  // Approval Workflow
  approvals: [{
    approverRole: String,
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedAt: Date,
    remarks: String
  }],
  
  // Revision History
  revisions: [{
    revisionNumber: Number,
    revisedAt: Date,
    revisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changes: mongoose.Schema.Types.Mixed,
    reason: String
  }],
  
  // Compliance
  compliance: {
    pfCompliant: { type: Boolean, default: true },
    esiCompliant: { type: Boolean, default: true },
    ptCompliant: { type: Boolean, default: true },
    tdsCompliant: { type: Boolean, default: true },
    complianceCheckedAt: Date,
    complianceCheckedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Indexes
payslipSchema.index({ employeeId: 1, 'payPeriod.year': 1, 'payPeriod.month': 1 });
payslipSchema.index({ payrollCycleId: 1 });
payslipSchema.index({ status: 1 });
payslipSchema.index({ 'payPeriod.payDate': -1 });

// Pre-save middleware
payslipSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate payslipId if not exists
  if (!this.payslipId) {
    const monthYear = `${this.payPeriod.year}${String(this.payPeriod.month).padStart(2, '0')}`;
    this.payslipId = `PS-${monthYear}-${this.employeeDetails.employeeId}`;
  }
  
  // Calculate totals
  this.salaryStructure.earnings.totalEarnings = this.calculateTotalEarnings();
  this.salaryStructure.deductions.totalDeductions = this.calculateTotalDeductions();
  this.salaryStructure.netSalary = this.salaryStructure.earnings.totalEarnings - this.salaryStructure.deductions.totalDeductions;
  
  next();
});

// Method to calculate total earnings
payslipSchema.methods.calculateTotalEarnings = function() {
  const earnings = this.salaryStructure.earnings;
  let total = earnings.basic + 
              earnings.hra + 
              earnings.specialAllowance + 
              earnings.transportAllowance + 
              earnings.medicalAllowance + 
              earnings.lunchAllowance + 
              earnings.phoneAllowance + 
              earnings.internetAllowance + 
              earnings.performanceBonus + 
              earnings.incentives + 
              earnings.overtimePay + 
              earnings.arrears;
  
  // Add custom earnings
  earnings.customEarnings.forEach(earning => {
    total += earning.amount;
  });
  
  // Add reimbursements
  this.reimbursements.forEach(reimbursement => {
    total += reimbursement.amount;
  });
  
  return Math.round(total);
};

// Method to calculate total deductions
payslipSchema.methods.calculateTotalDeductions = function() {
  const deductions = this.salaryStructure.deductions;
  let total = deductions.providentFund + 
              deductions.esi + 
              deductions.professionalTax + 
              deductions.incomeTax + 
              deductions.loanDeduction + 
              deductions.advanceDeduction + 
              deductions.lateComingFine + 
              deductions.lopDeduction;
  
  // Add custom deductions
  deductions.customDeductions.forEach(deduction => {
    total += deduction.amount;
  });
  
  return Math.round(total);
};

// Method to calculate pro-rata salary
payslipSchema.methods.calculateProRataSalary = function() {
  const totalDays = this.attendanceDetails.totalWorkingDays;
  const workedDays = this.attendanceDetails.actualWorkingDays;
  const proRataRatio = workedDays / totalDays;
  
  // Apply pro-rata to basic components
  this.salaryStructure.earnings.basic = Math.round(this.salaryStructure.earnings.basic * proRataRatio);
  this.salaryStructure.earnings.hra = Math.round(this.salaryStructure.earnings.hra * proRataRatio);
  this.salaryStructure.earnings.specialAllowance = Math.round(this.salaryStructure.earnings.specialAllowance * proRataRatio);
  
  // Recalculate dependent deductions
  this.salaryStructure.deductions.providentFund = Math.round(this.salaryStructure.earnings.basic * 0.12);
};

// Method to generate payslip PDF
payslipSchema.methods.generatePDF = async function() {
  // This would integrate with a PDF generation service
  // For now, we'll just mark it as generated
  this.documents.payslipPdf.generatedAt = new Date();
  this.documents.payslipPdf.url = `/payslips/${this.payslipId}.pdf`;
  await this.save();
  
  return this.documents.payslipPdf.url;
};

// Method to send email
payslipSchema.methods.sendEmail = async function(recipientEmail) {
  // This would integrate with an email service
  // For now, we'll just mark it as sent
  this.documents.emailSent.sentAt = new Date();
  this.documents.emailSent.sentTo = recipientEmail;
  this.documents.emailSent.status = 'sent';
  await this.save();
  
  return true;
};

// Static method to get payslips for employee
payslipSchema.statics.getEmployeePayslips = function(employeeId, year = null) {
  const query = { employeeId };
  if (year) {
    query['payPeriod.year'] = year;
  }
  
  return this.find(query).sort({ 'payPeriod.year': -1, 'payPeriod.month': -1 });
};

// Static method to get payslips for payroll cycle
payslipSchema.statics.getCyclePayslips = function(payrollCycleId) {
  return this.find({ payrollCycleId }).populate('employeeId', 'personalInfo employment');
};

module.exports = mongoose.model('Payslip', payslipSchema);