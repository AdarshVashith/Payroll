const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  
  // Check-in/Check-out Details
  checkIn: {
    time: Date,
    method: { 
      type: String, 
      enum: ['web', 'mobile', 'biometric', 'manual'], 
      default: 'web' 
    },
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    ipAddress: String,
    deviceInfo: String,
    photo: String // For selfie attendance
  },
  
  checkOut: {
    time: Date,
    method: { 
      type: String, 
      enum: ['web', 'mobile', 'biometric', 'manual'], 
      default: 'web' 
    },
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    ipAddress: String,
    deviceInfo: String,
    photo: String
  },
  
  // Attendance Status
  status: {
    type: String,
    enum: [
      'present',
      'absent', 
      'half-day',
      'work-from-home',
      'on-leave',
      'holiday',
      'weekly-off',
      'late',
      'early-departure'
    ],
    required: true,
    default: 'present'
  },
  
  // Working Hours Calculation
  workingHours: {
    totalHours: { type: Number, default: 0 },
    regularHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    breakHours: { type: Number, default: 0 },
    productiveHours: { type: Number, default: 0 }
  },
  
  // Break Details
  breaks: [{
    startTime: Date,
    endTime: Date,
    duration: Number, // in minutes
    type: { type: String, enum: ['lunch', 'tea', 'personal', 'meeting'], default: 'lunch' },
    location: String
  }],
  
  // Late Coming / Early Going
  lateArrival: {
    isLate: { type: Boolean, default: false },
    lateByMinutes: { type: Number, default: 0 },
    reason: String,
    isApproved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  earlyDeparture: {
    isEarly: { type: Boolean, default: false },
    earlyByMinutes: { type: Number, default: 0 },
    reason: String,
    isApproved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // Work From Home
  workFromHome: {
    isWFH: { type: Boolean, default: false },
    reason: String,
    isApproved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    tasks: [String], // Tasks planned for WFH
    productivity: {
      tasksCompleted: Number,
      hoursWorked: Number,
      rating: { type: Number, min: 1, max: 5 }
    }
  },
  
  // Overtime Details
  overtime: {
    isOvertime: { type: Boolean, default: false },
    overtimeHours: { type: Number, default: 0 },
    reason: String,
    isApproved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    overtimeRate: { type: Number, default: 1.5 }, // 1.5x regular rate
    overtimePay: { type: Number, default: 0 }
  },
  
  // Manual Adjustments
  manualAdjustment: {
    isAdjusted: { type: Boolean, default: false },
    adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adjustedAt: Date,
    originalStatus: String,
    adjustmentReason: String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // Shift Details
  shift: {
    shiftType: { 
      type: String, 
      enum: ['general', 'morning', 'evening', 'night', 'rotational'], 
      default: 'general' 
    },
    startTime: String, // "09:00"
    endTime: String,   // "18:00"
    breakDuration: { type: Number, default: 60 }, // minutes
    isFlexible: { type: Boolean, default: false }
  },
  
  // Compliance and Validation
  compliance: {
    isCompliant: { type: Boolean, default: true },
    violations: [{
      type: { type: String, enum: ['late', 'early', 'missing-checkout', 'long-break'] },
      description: String,
      severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
    }],
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    validatedAt: Date
  },
  
  // Comments and Notes
  comments: [{
    comment: String,
    commentedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    commentedAt: { type: Date, default: Date.now },
    type: { type: String, enum: ['employee', 'manager', 'hr', 'system'], default: 'employee' }
  }],
  
  // Integration Data
  integrationData: {
    biometricId: String,
    cardId: String,
    externalSystemId: String,
    syncedAt: Date,
    syncStatus: { type: String, enum: ['pending', 'synced', 'failed'], default: 'synced' }
  },
  
  // Legacy fields for backward compatibility
  totalHours: { type: Number, default: 0 },
  regularHours: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  notes: String,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Indexes for better performance
attendanceSchema.index({ employeeId: 1, date: -1 });
attendanceSchema.index({ date: -1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ 'checkIn.time': 1 });
attendanceSchema.index({ 'workFromHome.isWFH': 1 });

// Pre-save middleware
attendanceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate working hours if both check-in and check-out exist
  if (this.checkIn.time && this.checkOut.time) {
    const checkInTime = new Date(this.checkIn.time);
    const checkOutTime = new Date(this.checkOut.time);
    
    // Calculate total hours
    const totalMilliseconds = checkOutTime - checkInTime;
    const totalHours = totalMilliseconds / (1000 * 60 * 60);
    
    // Calculate break hours
    let breakHours = 0;
    this.breaks.forEach(breakItem => {
      if (breakItem.startTime && breakItem.endTime) {
        const breakDuration = (new Date(breakItem.endTime) - new Date(breakItem.startTime)) / (1000 * 60 * 60);
        breakHours += breakDuration;
      }
    });
    
    this.workingHours.totalHours = Math.round(totalHours * 100) / 100;
    this.workingHours.breakHours = Math.round(breakHours * 100) / 100;
    this.workingHours.productiveHours = Math.round((totalHours - breakHours) * 100) / 100;
    
    // Update legacy fields for backward compatibility
    this.totalHours = this.workingHours.totalHours;
    
    // Determine regular vs overtime hours (assuming 8 hours is regular)
    const regularHoursLimit = 8;
    if (this.workingHours.productiveHours > regularHoursLimit) {
      this.workingHours.regularHours = regularHoursLimit;
      this.workingHours.overtimeHours = this.workingHours.productiveHours - regularHoursLimit;
      this.overtime.isOvertime = true;
      this.overtime.overtimeHours = this.workingHours.overtimeHours;
    } else {
      this.workingHours.regularHours = this.workingHours.productiveHours;
      this.workingHours.overtimeHours = 0;
    }
    
    // Update legacy fields
    this.regularHours = this.workingHours.regularHours;
    this.overtimeHours = this.workingHours.overtimeHours;
  }
  
  // Check for late arrival
  if (this.checkIn.time && this.shift.startTime) {
    const checkInTime = new Date(this.checkIn.time);
    const shiftStartTime = new Date(this.checkIn.time);
    const [hours, minutes] = this.shift.startTime.split(':');
    shiftStartTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    if (checkInTime > shiftStartTime) {
      const lateByMilliseconds = checkInTime - shiftStartTime;
      const lateByMinutes = Math.floor(lateByMilliseconds / (1000 * 60));
      
      if (lateByMinutes > 0) {
        this.lateArrival.isLate = true;
        this.lateArrival.lateByMinutes = lateByMinutes;
        
        // Add compliance violation
        this.compliance.violations.push({
          type: 'late',
          description: `Late by ${lateByMinutes} minutes`,
          severity: lateByMinutes > 30 ? 'high' : lateByMinutes > 15 ? 'medium' : 'low'
        });
        this.compliance.isCompliant = false;
      }
    }
  }
  
  next();
});

// Method to mark attendance
attendanceSchema.methods.markCheckIn = function(location, method = 'web', deviceInfo = null) {
  this.checkIn = {
    time: new Date(),
    method,
    location,
    deviceInfo
  };
  
  // Determine status based on existing leave or holiday
  if (!this.status || this.status === 'absent') {
    this.status = 'present';
  }
  
  return this.save();
};

// Method to mark check-out
attendanceSchema.methods.markCheckOut = function(location, method = 'web', deviceInfo = null) {
  this.checkOut = {
    time: new Date(),
    method,
    location,
    deviceInfo
  };
  
  return this.save();
};

// Static method to get monthly attendance
attendanceSchema.statics.getMonthlyAttendance = function(employeeId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  return this.find({
    employeeId,
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: 1 });
};

// Static method to get attendance summary
attendanceSchema.statics.getAttendanceSummary = function(employeeId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        employeeId: mongoose.Types.ObjectId(employeeId),
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalDays: { $sum: 1 },
        presentDays: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        absentDays: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        halfDays: { $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] } },
        wfhDays: { $sum: { $cond: [{ $eq: ['$status', 'work-from-home'] }, 1, 0] } },
        totalWorkingHours: { $sum: '$workingHours.productiveHours' },
        totalOvertimeHours: { $sum: '$workingHours.overtimeHours' },
        lateDays: { $sum: { $cond: ['$lateArrival.isLate', 1, 0] } },
        averageWorkingHours: { $avg: '$workingHours.productiveHours' }
      }
    }
  ]);
};

// Compound index for employee and date
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);