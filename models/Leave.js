const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  leaveId: {
    type: String
  },
  
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  // Leave Type and Category
  leaveType: {
    type: String,
    enum: [
      'casual-leave',
      'sick-leave', 
      'earned-leave',
      'paid-leave',
      'unpaid-leave',
      'maternity-leave',
      'paternity-leave',
      'bereavement-leave',
      'marriage-leave',
      'study-leave',
      'sabbatical',
      'compensatory-off',
      'emergency-leave',
      'vacation',
      'sick',
      'personal',
      'maternity',
      'paternity',
      'bereavement',
      'emergency',
      'other'
    ],
    required: true
  },
  
  leaveCategory: {
    type: String,
    enum: ['paid', 'unpaid', 'half-paid'],
    required: true
  },
  
  // Leave Duration
  startDate: {
    type: Date,
    required: true
  },
  
  endDate: {
    type: Date,
    required: true
  },
  
  totalDays: {
    type: Number,
    required: true,
    min: 0.5
  },
  
  // Half Day Details
  isHalfDay: {
    type: Boolean,
    default: false
  },
  
  halfDayPeriod: {
    type: String,
    enum: ['morning', 'afternoon', 'first-half', 'second-half']
  },
  
  // Leave Reason and Details
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  description: {
    type: String,
    maxlength: 1000
  },
  
  // Emergency Leave Details
  isEmergency: {
    type: Boolean,
    default: false
  },
  
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  
  // Medical Leave Details
  medicalDetails: {
    isMedical: { type: Boolean, default: false },
    doctorName: String,
    hospitalName: String,
    medicalCertificateNumber: String,
    diagnosis: String,
    treatmentPeriod: {
      from: Date,
      to: Date
    }
  },
  
  // Maternity/Paternity Leave Details
  maternityPaternityDetails: {
    expectedDeliveryDate: Date,
    actualDeliveryDate: Date,
    childName: String,
    isAdoption: { type: Boolean, default: false },
    adoptionDate: Date,
    certificateNumber: String
  },
  
  // Application Details
  appliedDate: {
    type: Date,
    default: Date.now
  },
  
  appliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Approval Workflow
  approvalWorkflow: [{
    level: { type: Number, required: true },
    approverRole: { 
      type: String, 
      enum: ['manager', 'hr', 'admin'], 
      required: true 
    },
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected', 'delegated'], 
      default: 'pending' 
    },
    actionDate: Date,
    comments: String,
    delegatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Current Status
  status: {
    type: String,
    enum: [
      'draft',
      'pending',
      'submitted',
      'under-review',
      'approved',
      'rejected',
      'cancelled',
      'expired',
      'taken',
      'partially-taken'
    ],
    default: 'pending'
  },
  
  // Legacy approval fields for backward compatibility
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  approvedDate: {
    type: Date
  },
  
  rejectionReason: {
    type: String
  },
  
  // Leave Balance Impact
  balanceImpact: {
    leaveTypeBalance: {
      before: Number,
      after: Number,
      deducted: Number
    },
    carryForwardImpact: {
      affected: { type: Boolean, default: false },
      carryForwardDays: Number
    }
  },
  
  // Handover Details
  handoverDetails: {
    isRequired: { type: Boolean, default: false },
    handoverTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    handoverNotes: String,
    handoverCompleted: { type: Boolean, default: false },
    handoverDate: Date,
    emergencyContact: {
      name: String,
      phone: String,
      email: String
    }
  },
  
  // Supporting Documents
  documents: [{
    name: String,
    fileName: String,
    originalName: String,
    fileType: String,
    fileSize: Number,
    url: String,
    uploadDate: { type: Date, default: Date.now },
    uploadedAt: { type: Date, default: Date.now },
    documentType: {
      type: String,
      enum: ['medical-certificate', 'marriage-certificate', 'death-certificate', 'travel-documents', 'other'],
      default: 'other'
    }
  }],
  
  // Cancellation Details
  cancellation: {
    isCancelled: { type: Boolean, default: false },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    cancellationReason: String,
    refundDays: { type: Number, default: 0 }
  },
  
  // Extension Details
  extension: {
    isExtended: { type: Boolean, default: false },
    originalEndDate: Date,
    extensionDays: { type: Number, default: 0 },
    extensionReason: String,
    extendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    extendedAt: Date,
    extensionApproved: { type: Boolean, default: false }
  },
  
  // Return Details
  returnDetails: {
    expectedReturnDate: Date,
    actualReturnDate: Date,
    isReturned: { type: Boolean, default: false },
    returnNotes: String,
    medicalFitnessRequired: { type: Boolean, default: false },
    medicalFitnessCertificate: String
  },
  
  // Salary Impact
  salaryImpact: {
    isPaidLeave: { type: Boolean, default: true },
    salaryDeduction: { type: Number, default: 0 },
    lopDays: { type: Number, default: 0 },
    proRataCalculation: { type: Boolean, default: false }
  },
  
  // Policy Compliance
  policyCompliance: {
    isCompliant: { type: Boolean, default: true },
    violations: [{
      violationType: String,
      description: String,
      severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
    }],
    minimumNoticeGiven: { type: Boolean, default: true },
    maximumDaysExceeded: { type: Boolean, default: false },
    blackoutPeriodViolation: { type: Boolean, default: false }
  },
  
  // Integration with Attendance
  attendanceIntegration: {
    attendanceMarked: { type: Boolean, default: false },
    attendanceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' }],
    autoMarkAttendance: { type: Boolean, default: true }
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
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Indexes
leaveSchema.index({ employeeId: 1, startDate: -1 });
leaveSchema.index({ status: 1 });
leaveSchema.index({ leaveType: 1 });
leaveSchema.index({ appliedDate: -1 });
leaveSchema.index({ startDate: 1, endDate: 1 });

// Pre-save middleware
leaveSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate leaveId if not exists
  if (!this.leaveId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.leaveId = `LV-${year}${month}-${randomNum}`;
  }
  
  // Calculate total days if not provided
  if (this.startDate && this.endDate) {
    const timeDiff = this.endDate.getTime() - this.startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    
    if (this.isHalfDay) {
      this.totalDays = 0.5;
    } else {
      this.totalDays = daysDiff;
    }
  }
  
  // Set expected return date
  if (!this.returnDetails.expectedReturnDate && this.endDate) {
    const returnDate = new Date(this.endDate);
    returnDate.setDate(returnDate.getDate() + 1);
    this.returnDetails.expectedReturnDate = returnDate;
  }
  
  // Determine leave category based on type
  if (!this.leaveCategory) {
    const paidLeaveTypes = ['casual-leave', 'sick-leave', 'earned-leave', 'maternity-leave', 'paternity-leave', 'vacation', 'sick', 'maternity', 'paternity'];
    this.leaveCategory = paidLeaveTypes.includes(this.leaveType) ? 'paid' : 'unpaid';
  }
  
  // Set salary impact
  this.salaryImpact.isPaidLeave = this.leaveCategory === 'paid';
  if (!this.salaryImpact.isPaidLeave) {
    this.salaryImpact.lopDays = this.totalDays;
  }
  
  next();
});

// Method to submit leave application
leaveSchema.methods.submitApplication = function(userId) {
  this.status = 'submitted';
  this.appliedBy = userId;
  this.appliedDate = new Date();
  
  // Add audit trail
  this.auditTrail.push({
    action: 'Leave application submitted',
    performedBy: userId,
    comments: 'Leave application submitted for approval'
  });
  
  return this.save();
};

// Method to approve/reject leave
leaveSchema.methods.processApproval = function(level, approverId, status, comments) {
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
      this.approvedBy = approverId; // For backward compatibility
      this.approvedDate = new Date();
    } else {
      this.status = 'under-review';
    }
  } else if (status === 'rejected') {
    this.status = 'rejected';
    this.rejectionReason = comments; // For backward compatibility
  }
  
  // Add audit trail
  this.auditTrail.push({
    action: `Leave ${status} by level ${level}`,
    performedBy: approverId,
    comments: comments
  });
  
  return this.save();
};

// Method to cancel leave
leaveSchema.methods.cancelLeave = function(userId, reason) {
  this.status = 'cancelled';
  this.cancellation.isCancelled = true;
  this.cancellation.cancelledBy = userId;
  this.cancellation.cancelledAt = new Date();
  this.cancellation.cancellationReason = reason;
  
  // Add audit trail
  this.auditTrail.push({
    action: 'Leave cancelled',
    performedBy: userId,
    comments: reason
  });
  
  return this.save();
};

// Static method to get employee leaves
leaveSchema.statics.getEmployeeLeaves = function(employeeId, year = null, status = null) {
  const query = { employeeId };
  if (year) {
    query.startDate = {
      $gte: new Date(year, 0, 1),
      $lte: new Date(year, 11, 31)
    };
  }
  if (status) query.status = status;
  
  return this.find(query).sort({ startDate: -1 });
};

// Static method to get pending approvals
leaveSchema.statics.getPendingApprovals = function(approverId, role) {
  return this.find({
    status: { $in: ['submitted', 'under-review', 'pending'] },
    'approvalWorkflow': {
      $elemMatch: {
        approverRole: role,
        status: 'pending'
      }
    }
  }).populate('employeeId', 'personalInfo employment');
};

module.exports = mongoose.model('Leave', leaveSchema);