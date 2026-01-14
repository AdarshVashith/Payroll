const mongoose = require('mongoose');

const reimbursementSchema = new mongoose.Schema({
  reimbursementId: {
    type: String,
    unique: true
  },
  
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  // Reimbursement Details
  claimType: {
    type: String,
    enum: ['reimbursement', 'bonus', 'incentive', 'allowance', 'advance'],
    default: 'reimbursement'
  },
  
  expenseType: {
    type: String,
    enum: [
      'travel',
      'accommodation',
      'meals',
      'fuel',
      'medical',
      'internet',
      'phone',
      'office-supplies',
      'training',
      'conference',
      'client-entertainment',
      'other'
    ],
    required: function() { return this.claimType === 'reimbursement'; }
  },
  
  category: {
    type: String,
    enum: ['business-travel', 'office-expenses', 'medical', 'communication', 'training', 'entertainment', 'other'],
    required: true
  },
  
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  currency: {
    type: String,
    default: 'INR'
  },
  
  expenseDate: {
    type: Date,
    required: true
  },
  
  // Business Purpose
  businessPurpose: {
    type: String,
    required: function() { return this.claimType === 'reimbursement'; },
    maxlength: 300
  },
  
  projectCode: String,
  clientName: String,
  
  // Bonus Details (for bonus claims)
  bonusDetails: {
    bonusType: {
      type: String,
      enum: [
        'performance', 'annual', 'festival', 'retention', 'referral', 
        'project-completion', 'sales-incentive', 'spot-award', 'joining-bonus'
      ],
      required: function() { return this.claimType === 'bonus'; }
    },
    
    // Performance Bonus
    performanceMetrics: {
      rating: { type: Number, min: 1, max: 5 },
      kpiAchievement: { type: Number, min: 0, max: 100 }, // Percentage
      targetAchievement: { type: Number, min: 0 }, // Percentage
      reviewPeriod: {
        startDate: Date,
        endDate: Date
      }
    },
    
    // Sales Incentive
    salesMetrics: {
      targetAmount: { type: Number, default: 0 },
      achievedAmount: { type: Number, default: 0 },
      achievementPercentage: { type: Number, default: 0 },
      incentiveRate: { type: Number, default: 0 } // Percentage or fixed amount
    },
    
    // Recurring Bonus
    isRecurring: { type: Boolean, default: false },
    recurringFrequency: {
      type: String,
      enum: ['monthly', 'quarterly', 'half-yearly', 'annual']
    },
    nextPaymentDate: Date,
    
    calculationMethod: {
      type: String,
      enum: ['fixed', 'percentage-of-salary', 'performance-based', 'target-based'],
      default: 'fixed'
    },
    baseAmount: Number, // For percentage calculations
    
    // Approval Requirements
    requiresHigherApproval: { type: Boolean, default: false },
    approvalThreshold: { type: Number, default: 50000 }
  },
  
  // Tax Information
  taxDetails: {
    isTaxable: { type: Boolean, default: true },
    taxCategory: { 
      type: String, 
      enum: ['fully-taxable', 'partially-exempt', 'fully-exempt'], 
      default: 'fully-taxable' 
    },
    exemptAmount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    gstApplicable: { type: Boolean, default: false },
    gstAmount: { type: Number, default: 0 },
    gstNumber: String
  },
  
  // Supporting Documents
  documents: [{
    fileName: String,
    originalName: String,
    fileType: String,
    fileSize: Number,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
    documentType: {
      type: String,
      enum: ['receipt', 'invoice', 'bill', 'voucher', 'ticket', 'other'],
      default: 'receipt'
    }
  }],
  
  // Approval Workflow
  approvalWorkflow: [{
    level: { type: Number, required: true },
    approverRole: { 
      type: String, 
      enum: ['manager', 'finance', 'hr', 'admin'], 
      required: true 
    },
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected', 'returned'], 
      default: 'pending' 
    },
    actionDate: Date,
    comments: String,
    returnReason: String
  }],
  
  // Current Status
  status: {
    type: String,
    enum: [
      'draft',
      'submitted',
      'under-review',
      'approved',
      'rejected',
      'returned',
      'processed',
      'paid',
      'cancelled'
    ],
    default: 'draft'
  },
  
  // Submission Details
  submittedAt: Date,
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Processing Details
  processedAt: Date,
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Payment Details
  paymentDetails: {
    paymentMethod: { 
      type: String, 
      enum: ['bank-transfer', 'cheque', 'petty-cash', 'salary-adjustment'], 
      default: 'bank-transfer' 
    },
    paymentDate: Date,
    transactionId: String,
    utrNumber: String,
    chequeNumber: String,
    paymentStatus: { 
      type: String, 
      enum: ['pending', 'success', 'failed'], 
      default: 'pending' 
    },
    paidAmount: Number,
    paymentRemarks: String
  },
  
  // Policy Compliance
  policyCompliance: {
    isCompliant: { type: Boolean, default: true },
    policyViolations: [{
      violationType: String,
      description: String,
      severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
    }],
    exceededLimits: [{
      limitType: String,
      allowedAmount: Number,
      claimedAmount: Number,
      excessAmount: Number
    }]
  },
  
  // Advance Adjustment
  advanceAdjustment: {
    hasAdvance: { type: Boolean, default: false },
    advanceAmount: { type: Number, default: 0 },
    adjustmentAmount: { type: Number, default: 0 },
    balanceAmount: { type: Number, default: 0 },
    advanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Advance' }
  },
  
  // Recurring Expense
  recurringDetails: {
    isRecurring: { type: Boolean, default: false },
    frequency: { 
      type: String, 
      enum: ['monthly', 'quarterly', 'yearly'], 
      default: 'monthly' 
    },
    nextDueDate: Date,
    endDate: Date,
    parentReimbursementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reimbursement' }
  },
  
  // Audit Trail
  auditTrail: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    oldValues: mongoose.Schema.Types.Mixed,
    newValues: mongoose.Schema.Types.Mixed,
    comments: String
  }],
  
  // Integration Data
  integrationData: {
    erpId: String,
    accountingEntryId: String,
    syncedAt: Date,
    syncStatus: { type: String, enum: ['pending', 'synced', 'failed'], default: 'pending' }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Indexes
reimbursementSchema.index({ employeeId: 1, expenseDate: -1 });
reimbursementSchema.index({ status: 1 });
reimbursementSchema.index({ expenseType: 1 });
reimbursementSchema.index({ submittedAt: -1 });

// Pre-save middleware
reimbursementSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate reimbursementId if not exists
  if (!this.reimbursementId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-6); // Use timestamp for uniqueness
    this.reimbursementId = `RMB-${year}${month}-${timestamp}`;
  }
  
  // Calculate taxable amount
  if (this.taxDetails.isTaxable) {
    this.taxDetails.taxableAmount = this.amount - this.taxDetails.exemptAmount;
  } else {
    this.taxDetails.taxableAmount = 0;
    this.taxDetails.exemptAmount = this.amount;
  }
  
  next();
});

// Method to submit for approval
reimbursementSchema.methods.submitForApproval = function(userId) {
  this.status = 'submitted';
  this.submittedAt = new Date();
  this.submittedBy = userId;
  
  // Add audit trail
  this.auditTrail.push({
    action: 'Submitted for approval',
    performedBy: userId,
    comments: 'Reimbursement submitted for approval'
  });
  
  return this.save();
};

// Method to approve/reject
reimbursementSchema.methods.processApproval = function(level, approverId, status, comments) {
  const workflow = this.approvalWorkflow.find(w => w.level === level);
  if (workflow) {
    workflow.approverId = approverId;
    workflow.status = status;
    workflow.actionDate = new Date();
    workflow.comments = comments;
  }
  
  // Update overall status
  if (status === 'approved') {
    const nextLevel = this.approvalWorkflow.find(w => w.level > level && w.status === 'pending');
    if (!nextLevel) {
      this.status = 'approved';
    } else {
      this.status = 'under-review';
    }
  } else if (status === 'rejected') {
    this.status = 'rejected';
  } else if (status === 'returned') {
    this.status = 'returned';
  }
  
  // Add audit trail
  this.auditTrail.push({
    action: `${status.charAt(0).toUpperCase() + status.slice(1)} by level ${level}`,
    performedBy: approverId,
    comments: comments
  });
  
  return this.save();
};

// Method to process payment
reimbursementSchema.methods.processPayment = function(paymentDetails, userId) {
  this.paymentDetails = { ...this.paymentDetails, ...paymentDetails };
  this.status = 'processed';
  this.processedAt = new Date();
  this.processedBy = userId;
  
  // Add audit trail
  this.auditTrail.push({
    action: 'Payment processed',
    performedBy: userId,
    comments: `Payment processed via ${paymentDetails.paymentMethod}`
  });
  
  return this.save();
};

// Static method to get employee reimbursements
reimbursementSchema.statics.getEmployeeReimbursements = function(employeeId, status = null, year = null) {
  const query = { employeeId };
  if (status) query.status = status;
  if (year) {
    query.expenseDate = {
      $gte: new Date(year, 0, 1),
      $lte: new Date(year, 11, 31)
    };
  }
  
  return this.find(query).sort({ expenseDate: -1 });
};

// Static method to get pending approvals
reimbursementSchema.statics.getPendingApprovals = function(approverId, role) {
  return this.find({
    status: { $in: ['submitted', 'under-review'] },
    'approvalWorkflow': {
      $elemMatch: {
        approverRole: role,
        status: 'pending'
      }
    }
  }).populate('employeeId', 'personalInfo employment');
};

// Static method to get reimbursement summary
reimbursementSchema.statics.getReimbursementSummary = function(startDate, endDate, filters = {}) {
  const matchQuery = {
    expenseDate: { $gte: startDate, $lte: endDate },
    status: { $in: ['approved', 'processed', 'paid'] }
  };
  
  if (filters.employeeId) matchQuery.employeeId = filters.employeeId;
  if (filters.expenseType) matchQuery.expenseType = filters.expenseType;
  if (filters.category) matchQuery.category = filters.category;
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          expenseType: '$expenseType',
          month: { $month: '$expenseDate' },
          year: { $year: '$expenseDate' }
        },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } }
  ]);
};

module.exports = mongoose.model('Reimbursement', reimbursementSchema);