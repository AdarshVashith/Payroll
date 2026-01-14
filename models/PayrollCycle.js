const mongoose = require('mongoose');

const payrollCycleSchema = new mongoose.Schema({
  cycleId: {
    type: String,
    required: true
  },
  
  // Payroll Period
  payPeriod: {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }
  },
  
  // Cycle Status
  status: {
    type: String,
    enum: [
      'draft',           // Initial state
      'attendance-locked', // Attendance finalized
      'calculated',      // Salaries calculated
      'reviewed',        // HR review completed
      'approved',        // Management approved
      'processed',       // Payroll processed
      'disbursed',       // Salaries paid
      'completed'        // Cycle completed
    ],
    default: 'draft'
  },
  
  // Processing Dates
  attendanceLockDate: Date,
  calculationDate: Date,
  reviewDate: Date,
  approvalDate: Date,
  processingDate: Date,
  disbursementDate: Date,
  completionDate: Date,
  
  // Payroll Summary
  summary: {
    totalEmployees: { type: Number, default: 0 },
    activeEmployees: { type: Number, default: 0 },
    processedEmployees: { type: Number, default: 0 },
    
    totalGrossSalary: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    totalNetSalary: { type: Number, default: 0 },
    
    // Statutory Summary
    totalPF: { type: Number, default: 0 },
    totalESI: { type: Number, default: 0 },
    totalPT: { type: Number, default: 0 },
    totalTDS: { type: Number, default: 0 },
    
    // Department-wise breakdown
    departmentSummary: [{
      department: String,
      employeeCount: Number,
      grossSalary: Number,
      netSalary: Number
    }]
  },
  
  // Processing Rules
  processingRules: {
    includeNewJoiners: { type: Boolean, default: true },
    includeExitedEmployees: { type: Boolean, default: true },
    proRataCalculation: { type: Boolean, default: true },
    attendanceBasedSalary: { type: Boolean, default: true },
    
    // Cut-off dates
    newJoinerCutoff: Date, // Employees joined after this date get pro-rata
    exitCutoff: Date,      // Employees exited before this date get pro-rata
    
    // Attendance rules
    minimumWorkingDays: { type: Number, default: 0 },
    lopDeduction: { type: Boolean, default: true }
  },
  
  // Approval Workflow
  approvalWorkflow: [{
    step: { type: Number, required: true },
    approverRole: { type: String, required: true },
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'], 
      default: 'pending' 
    },
    approvedAt: Date,
    remarks: String
  }],
  
  // Error Handling
  processingErrors: [{
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    errorType: String,
    errorMessage: String,
    isResolved: { type: Boolean, default: false },
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Notifications
  notifications: [{
    type: { 
      type: String, 
      enum: ['email', 'sms', 'in-app'], 
      required: true 
    },
    recipient: String,
    subject: String,
    message: String,
    sentAt: Date,
    status: { 
      type: String, 
      enum: ['pending', 'sent', 'failed'], 
      default: 'pending' 
    }
  }],
  
  // Audit Trail
  auditTrail: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    details: mongoose.Schema.Types.Mixed,
    ipAddress: String
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Indexes
payrollCycleSchema.index({ 'payPeriod.year': 1, 'payPeriod.month': 1 });
payrollCycleSchema.index({ status: 1 });
payrollCycleSchema.index({ createdAt: -1 });

// Pre-save middleware
payrollCycleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate cycleId if not exists
  if (!this.cycleId) {
    this.cycleId = `PAY-${this.payPeriod.year}-${String(this.payPeriod.month).padStart(2, '0')}`;
  }
  
  next();
});

// Method to add audit trail entry
payrollCycleSchema.methods.addAuditEntry = function(action, userId, details, ipAddress) {
  this.auditTrail.push({
    action,
    performedBy: userId,
    details,
    ipAddress,
    performedAt: new Date()
  });
};

// Method to update status with audit trail
payrollCycleSchema.methods.updateStatus = function(newStatus, userId, remarks, ipAddress) {
  const oldStatus = this.status;
  this.status = newStatus;
  
  // Update relevant date fields
  const now = new Date();
  switch (newStatus) {
    case 'attendance-locked':
      this.attendanceLockDate = now;
      break;
    case 'calculated':
      this.calculationDate = now;
      break;
    case 'reviewed':
      this.reviewDate = now;
      break;
    case 'approved':
      this.approvalDate = now;
      break;
    case 'processed':
      this.processingDate = now;
      break;
    case 'disbursed':
      this.disbursementDate = now;
      break;
    case 'completed':
      this.completionDate = now;
      break;
  }
  
  // Add audit trail
  this.addAuditEntry(
    `Status changed from ${oldStatus} to ${newStatus}`,
    userId,
    { oldStatus, newStatus, remarks },
    ipAddress
  );
};

// Method to check if cycle can be processed
payrollCycleSchema.methods.canProcess = function() {
  return ['approved'].includes(this.status) && this.errors.filter(e => !e.isResolved).length === 0;
};

// Method to get current processing step
payrollCycleSchema.methods.getCurrentStep = function() {
  const statusOrder = [
    'draft', 'attendance-locked', 'calculated', 'reviewed', 
    'approved', 'processed', 'disbursed', 'completed'
  ];
  
  return statusOrder.indexOf(this.status) + 1;
};

// Method to get total processing steps
payrollCycleSchema.methods.getTotalSteps = function() {
  return 8; // Total number of status steps
};

// Static method to get current active cycle
payrollCycleSchema.statics.getCurrentCycle = function() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  return this.findOne({
    'payPeriod.month': currentMonth,
    'payPeriod.year': currentYear
  });
};

// Static method to create new cycle
payrollCycleSchema.statics.createNewCycle = function(month, year, userId) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  return this.create({
    payPeriod: {
      month,
      year,
      startDate,
      endDate
    },
    createdBy: userId,
    updatedBy: userId
  });
};

module.exports = mongoose.model('PayrollCycle', payrollCycleSchema);