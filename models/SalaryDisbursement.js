const mongoose = require('mongoose');

const salaryDisbursementSchema = new mongoose.Schema({
  disbursementId: {
    type: String,
    unique: true
  },
  
  // Batch Information
  batchId: {
    type: String,
    required: true
  },
  
  payPeriod: {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }
  },
  
  // Employee and Payroll Reference
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  payrollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll',
    required: true
  },
  
  // Payment Details
  paymentDetails: {
    grossAmount: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    deductions: { type: Number, required: true },
    
    // Bank Account Details
    bankAccount: {
      accountNumber: { type: String, required: true },
      ifscCode: { type: String, required: true },
      bankName: { type: String, required: true },
      branchName: String,
      accountHolderName: { type: String, required: true },
      accountType: { type: String, enum: ['savings', 'current'], default: 'savings' }
    },
    
    // Payment Method
    paymentMethod: {
      type: String,
      enum: ['neft', 'rtgs', 'imps', 'upi', 'cheque', 'cash'],
      default: 'neft'
    },
    
    // Payment Gateway Integration
    paymentGateway: {
      provider: { type: String, enum: ['razorpay', 'payu', 'cashfree', 'manual'], default: 'manual' },
      payoutId: String,
      contactId: String,
      fundAccountId: String
    }
  },
  
  // Transaction Details
  transaction: {
    transactionId: String,
    utrNumber: String,
    referenceNumber: String,
    transactionDate: Date,
    
    // Payment Status
    status: {
      type: String,
      enum: ['pending', 'processing', 'queued', 'success', 'failed', 'cancelled', 'reversed'],
      default: 'pending'
    },
    
    // Status History
    statusHistory: [{
      status: String,
      timestamp: { type: Date, default: Date.now },
      reason: String,
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    
    // Failure Details
    failureReason: String,
    failureCode: String,
    gatewayResponse: mongoose.Schema.Types.Mixed,
    
    // Retry Information
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    nextRetryAt: Date,
    lastRetryAt: Date
  },
  
  // Processing Information
  processing: {
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    initiatedAt: Date,
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    processedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    
    // Batch Processing
    batchProcessed: { type: Boolean, default: false },
    batchProcessedAt: Date,
    
    // Validation
    validated: { type: Boolean, default: false },
    validationErrors: [String],
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    validatedAt: Date
  },
  
  // Compliance and Reporting
  compliance: {
    tdsDeducted: { type: Number, default: 0 },
    pfDeducted: { type: Number, default: 0 },
    esiDeducted: { type: Number, default: 0 },
    ptDeducted: { type: Number, default: 0 },
    
    // Reporting Flags
    reportedToBank: { type: Boolean, default: false },
    reportedToPF: { type: Boolean, default: false },
    reportedToESI: { type: Boolean, default: false },
    reportedToIT: { type: Boolean, default: false }
  },
  
  // Notifications
  notifications: {
    employeeNotified: { type: Boolean, default: false },
    employeeNotifiedAt: Date,
    smsNotification: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      messageId: String
    },
    emailNotification: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      messageId: String
    },
    pushNotification: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      messageId: String
    }
  },
  
  // Reconciliation
  reconciliation: {
    reconciled: { type: Boolean, default: false },
    reconciledAt: Date,
    reconciledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bankStatementEntry: {
      date: Date,
      amount: Number,
      reference: String,
      matched: { type: Boolean, default: false }
    },
    discrepancy: {
      found: { type: Boolean, default: false },
      amount: Number,
      reason: String,
      resolved: { type: Boolean, default: false },
      resolvedAt: Date,
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  },
  
  // Audit Trail
  auditTrail: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    oldValues: mongoose.Schema.Types.Mixed,
    newValues: mongoose.Schema.Types.Mixed,
    comments: String,
    ipAddress: String
  }],
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Indexes
salaryDisbursementSchema.index({ batchId: 1 });
salaryDisbursementSchema.index({ employeeId: 1, 'payPeriod.month': 1, 'payPeriod.year': 1 });
salaryDisbursementSchema.index({ 'transaction.status': 1 });
salaryDisbursementSchema.index({ 'transaction.transactionDate': -1 });
salaryDisbursementSchema.index({ 'payPeriod.year': 1, 'payPeriod.month': 1 });

// Pre-save middleware
salaryDisbursementSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate disbursementId if not exists
  if (!this.disbursementId) {
    const year = this.payPeriod.year;
    const month = String(this.payPeriod.month).padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.disbursementId = `DIS-${year}${month}-${randomNum}`;
  }
  
  next();
});

// Method to initiate payment
salaryDisbursementSchema.methods.initiatePayment = function(initiatedBy) {
  this.processing.initiatedBy = initiatedBy;
  this.processing.initiatedAt = new Date();
  this.transaction.status = 'processing';
  
  // Add status history
  this.transaction.statusHistory.push({
    status: 'processing',
    updatedBy: initiatedBy,
    reason: 'Payment initiated'
  });
  
  // Add audit trail
  this.auditTrail.push({
    action: 'Payment initiated',
    performedBy: initiatedBy,
    comments: 'Salary disbursement payment initiated'
  });
  
  return this.save();
};

// Method to update payment status
salaryDisbursementSchema.methods.updatePaymentStatus = function(status, details = {}) {
  const oldStatus = this.transaction.status;
  this.transaction.status = status;
  
  // Update transaction details
  if (details.transactionId) this.transaction.transactionId = details.transactionId;
  if (details.utrNumber) this.transaction.utrNumber = details.utrNumber;
  if (details.referenceNumber) this.transaction.referenceNumber = details.referenceNumber;
  if (details.transactionDate) this.transaction.transactionDate = details.transactionDate;
  if (details.gatewayResponse) this.transaction.gatewayResponse = details.gatewayResponse;
  
  // Handle failure
  if (status === 'failed') {
    this.transaction.failureReason = details.failureReason;
    this.transaction.failureCode = details.failureCode;
    
    // Schedule retry if within retry limit
    if (this.transaction.retryCount < this.transaction.maxRetries) {
      this.transaction.nextRetryAt = new Date(Date.now() + (30 * 60 * 1000)); // 30 minutes
    }
  }
  
  // Handle success
  if (status === 'success') {
    this.processing.processedAt = new Date();
    this.transaction.transactionDate = details.transactionDate || new Date();
  }
  
  // Add status history
  this.transaction.statusHistory.push({
    status: status,
    updatedBy: details.updatedBy,
    reason: details.reason || `Status updated to ${status}`
  });
  
  // Add audit trail
  this.auditTrail.push({
    action: `Payment status updated from ${oldStatus} to ${status}`,
    performedBy: details.updatedBy,
    comments: details.reason || 'Payment status updated',
    oldValues: { status: oldStatus },
    newValues: { status: status }
  });
  
  return this.save();
};

// Method to retry failed payment
salaryDisbursementSchema.methods.retryPayment = function(retryBy) {
  if (this.transaction.status !== 'failed') {
    throw new Error('Can only retry failed payments');
  }
  
  if (this.transaction.retryCount >= this.transaction.maxRetries) {
    throw new Error('Maximum retry attempts exceeded');
  }
  
  this.transaction.retryCount += 1;
  this.transaction.lastRetryAt = new Date();
  this.transaction.status = 'processing';
  this.transaction.nextRetryAt = null;
  
  // Add status history
  this.transaction.statusHistory.push({
    status: 'processing',
    updatedBy: retryBy,
    reason: `Retry attempt ${this.transaction.retryCount}`
  });
  
  // Add audit trail
  this.auditTrail.push({
    action: `Payment retry initiated (attempt ${this.transaction.retryCount})`,
    performedBy: retryBy,
    comments: 'Failed payment retry initiated'
  });
  
  return this.save();
};

// Method to validate disbursement
salaryDisbursementSchema.methods.validateDisbursement = function(validatedBy) {
  const errors = [];
  
  // Validate bank account details
  if (!this.paymentDetails.bankAccount.accountNumber) {
    errors.push('Bank account number is required');
  }
  
  if (!this.paymentDetails.bankAccount.ifscCode) {
    errors.push('IFSC code is required');
  }
  
  // Validate IFSC code format
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (this.paymentDetails.bankAccount.ifscCode && !ifscRegex.test(this.paymentDetails.bankAccount.ifscCode)) {
    errors.push('Invalid IFSC code format');
  }
  
  // Validate amounts
  if (this.paymentDetails.netAmount <= 0) {
    errors.push('Net amount must be greater than zero');
  }
  
  if (this.paymentDetails.grossAmount < this.paymentDetails.netAmount) {
    errors.push('Gross amount cannot be less than net amount');
  }
  
  this.processing.validationErrors = errors;
  this.processing.validated = errors.length === 0;
  this.processing.validatedBy = validatedBy;
  this.processing.validatedAt = new Date();
  
  // Add audit trail
  this.auditTrail.push({
    action: 'Disbursement validated',
    performedBy: validatedBy,
    comments: errors.length === 0 ? 'Validation successful' : `Validation failed: ${errors.join(', ')}`
  });
  
  return this.save();
};

// Method to send notifications
salaryDisbursementSchema.methods.sendNotifications = function(notificationType = 'all') {
  const notifications = [];
  
  if (notificationType === 'all' || notificationType === 'sms') {
    // SMS notification logic would go here
    this.notifications.smsNotification.sent = true;
    this.notifications.smsNotification.sentAt = new Date();
    notifications.push('SMS');
  }
  
  if (notificationType === 'all' || notificationType === 'email') {
    // Email notification logic would go here
    this.notifications.emailNotification.sent = true;
    this.notifications.emailNotification.sentAt = new Date();
    notifications.push('Email');
  }
  
  if (notificationType === 'all' || notificationType === 'push') {
    // Push notification logic would go here
    this.notifications.pushNotification.sent = true;
    this.notifications.pushNotification.sentAt = new Date();
    notifications.push('Push');
  }
  
  this.notifications.employeeNotified = true;
  this.notifications.employeeNotifiedAt = new Date();
  
  // Add audit trail
  this.auditTrail.push({
    action: 'Notifications sent',
    comments: `${notifications.join(', ')} notifications sent to employee`
  });
  
  return this.save();
};

// Method to reconcile payment
salaryDisbursementSchema.methods.reconcilePayment = function(bankStatementEntry, reconciledBy) {
  this.reconciliation.bankStatementEntry = bankStatementEntry;
  this.reconciliation.reconciledBy = reconciledBy;
  this.reconciliation.reconciledAt = new Date();
  
  // Check for discrepancies
  const amountMatch = Math.abs(this.paymentDetails.netAmount - bankStatementEntry.amount) < 0.01;
  
  if (amountMatch) {
    this.reconciliation.reconciled = true;
    this.reconciliation.bankStatementEntry.matched = true;
  } else {
    this.reconciliation.discrepancy.found = true;
    this.reconciliation.discrepancy.amount = this.paymentDetails.netAmount - bankStatementEntry.amount;
    this.reconciliation.discrepancy.reason = 'Amount mismatch with bank statement';
  }
  
  // Add audit trail
  this.auditTrail.push({
    action: 'Payment reconciled',
    performedBy: reconciledBy,
    comments: amountMatch ? 'Reconciliation successful' : 'Discrepancy found during reconciliation'
  });
  
  return this.save();
};

// Static method to get disbursement summary
salaryDisbursementSchema.statics.getDisbursementSummary = function(year, month, batchId) {
  const matchQuery = {};
  if (year) matchQuery['payPeriod.year'] = year;
  if (month) matchQuery['payPeriod.month'] = month;
  if (batchId) matchQuery.batchId = batchId;
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalDisbursements: { $sum: 1 },
        totalAmount: { $sum: '$paymentDetails.netAmount' },
        totalGrossAmount: { $sum: '$paymentDetails.grossAmount' },
        totalDeductions: { $sum: '$paymentDetails.deductions' },
        successCount: {
          $sum: { $cond: [{ $eq: ['$transaction.status', 'success'] }, 1, 0] }
        },
        failedCount: {
          $sum: { $cond: [{ $eq: ['$transaction.status', 'failed'] }, 1, 0] }
        },
        pendingCount: {
          $sum: { $cond: [{ $in: ['$transaction.status', ['pending', 'processing', 'queued']] }, 1, 0] }
        },
        reconciledCount: {
          $sum: { $cond: ['$reconciliation.reconciled', 1, 0] }
        }
      }
    }
  ]);
};

// Static method to get failed payments for retry
salaryDisbursementSchema.statics.getFailedPaymentsForRetry = function() {
  return this.find({
    'transaction.status': 'failed',
    'transaction.retryCount': { $lt: '$transaction.maxRetries' },
    'transaction.nextRetryAt': { $lte: new Date() }
  }).populate('employeeId', 'employeeId personalInfo');
};

module.exports = mongoose.model('SalaryDisbursement', salaryDisbursementSchema);