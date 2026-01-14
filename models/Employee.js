const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  personalInfo: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    maritalStatus: { type: String, enum: ['single', 'married', 'divorced', 'widowed'] },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'India' }
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String
    },
    // India-specific documents
    panNumber: { type: String, uppercase: true },
    aadhaarNumber: { type: String },
    passportNumber: String
  },
  employment: {
    department: { type: String, required: true },
    designation: { type: String, required: true },
    role: { type: String, required: true }, // Job role/position
    employmentType: { 
      type: String, 
      enum: ['full-time', 'part-time', 'contract', 'intern', 'consultant'],
      default: 'full-time'
    },
    dateOfJoining: { type: Date, required: true },
    dateOfExit: { type: Date },
    probationPeriod: { type: Number, default: 6 }, // months
    noticePeriod: { type: Number, default: 30 }, // days
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    workLocation: { type: String },
    status: {
      type: String,
      enum: ['active', 'on-notice', 'inactive', 'exited'],
      default: 'active'
    },
    workingDays: { type: Number, default: 5 }, // per week
    workingHours: { type: Number, default: 8 } // per day
  },
  salaryStructure: {
    ctc: { type: Number, required: true }, // Cost to Company (Annual)
    basicSalary: { type: Number, required: true },
    hra: { type: Number, default: 0 }, // House Rent Allowance
    specialAllowance: { type: Number, default: 0 },
    transportAllowance: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },
    
    // Variable components
    performanceBonus: { type: Number, default: 0 },
    incentives: { type: Number, default: 0 },
    
    // Deductions
    providentFund: { type: Number, default: 0 },
    esi: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 200 },
    incomeTax: { type: Number, default: 0 },
    
    currency: { type: String, default: 'INR' },
    payFrequency: { 
      type: String, 
      enum: ['weekly', 'bi-weekly', 'monthly', 'annually'],
      default: 'monthly'
    },
    effectiveDate: { type: Date, default: Date.now },
    
    // Custom components
    customEarnings: [{
      name: String,
      amount: Number,
      isPercentage: { type: Boolean, default: false },
      percentageOf: { type: String, enum: ['basic', 'ctc'], default: 'basic' }
    }],
    customDeductions: [{
      name: String,
      amount: Number,
      isPercentage: { type: Boolean, default: false },
      percentageOf: { type: String, enum: ['basic', 'gross'], default: 'basic' }
    }]
  },
  bankDetails: {
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true, uppercase: true },
    bankName: { type: String, required: true },
    branchName: String,
    accountType: { 
      type: String, 
      enum: ['savings', 'current'], 
      default: 'savings' 
    },
    accountHolderName: { type: String, required: true }
  },
  taxInfo: {
    taxRegime: { 
      type: String, 
      enum: ['old', 'new'], 
      default: 'new' 
    },
    pfNumber: String,
    esiNumber: String,
    uanNumber: String, // Universal Account Number for PF
    previousEmployerDetails: [{
      employerName: String,
      period: {
        from: Date,
        to: Date
      },
      grossSalary: Number,
      taxDeducted: Number
    }]
  },
  benefits: {
    healthInsurance: { type: Boolean, default: false },
    dentalInsurance: { type: Boolean, default: false },
    visionInsurance: { type: Boolean, default: false },
    lifeInsurance: { type: Boolean, default: false },
    accidentInsurance: { type: Boolean, default: false },
    gratuity: { type: Boolean, default: true },
    paidTimeOff: { type: Number, default: 21 }, // annual leave days
    sickLeave: { type: Number, default: 12 },
    casualLeave: { type: Number, default: 12 },
    maternityLeave: { type: Number, default: 180 },
    paternityLeave: { type: Number, default: 15 }
  },
  documents: [{
    name: String,
    type: { 
      type: String, 
      enum: ['resume', 'offer-letter', 'joining-letter', 'id-proof', 'address-proof', 'education', 'experience', 'other'] 
    },
    url: String,
    uploadDate: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: false }
  }],
  leaveBalance: {
    casualLeave: { type: Number, default: 12 },
    sickLeave: { type: Number, default: 12 },
    earnedLeave: { type: Number, default: 21 },
    maternityLeave: { type: Number, default: 180 },
    paternityLeave: { type: Number, default: 15 },
    unpaidLeave: { type: Number, default: 0 }
  },
  performanceMetrics: {
    currentRating: { type: Number, min: 1, max: 5 },
    lastReviewDate: Date,
    nextReviewDate: Date,
    goals: [{
      title: String,
      description: String,
      targetDate: Date,
      status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
      rating: { type: Number, min: 1, max: 5 }
    }]
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Indexes for better performance
employeeSchema.index({ 'personalInfo.email': 1 });
employeeSchema.index({ 'employment.department': 1 });
employeeSchema.index({ 'employment.status': 1 });
employeeSchema.index({ 'personalInfo.panNumber': 1 });

// Update the updatedAt field before saving
employeeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for full name
employeeSchema.virtual('fullName').get(function() {
  return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`;
});

// Virtual for monthly salary
employeeSchema.virtual('monthlySalary').get(function() {
  return Math.round(this.salaryStructure.ctc / 12);
});

// Virtual for gross salary (before deductions)
employeeSchema.virtual('grossSalary').get(function() {
  const basic = this.salaryStructure.basicSalary;
  const hra = this.salaryStructure.hra;
  const special = this.salaryStructure.specialAllowance;
  const transport = this.salaryStructure.transportAllowance;
  const medical = this.salaryStructure.medicalAllowance;
  const other = this.salaryStructure.otherAllowances;
  
  return basic + hra + special + transport + medical + other;
});

// Method to calculate net salary
employeeSchema.methods.calculateNetSalary = function() {
  const gross = this.grossSalary;
  const pf = this.salaryStructure.providentFund;
  const esi = this.salaryStructure.esi;
  const pt = this.salaryStructure.professionalTax;
  const tax = this.salaryStructure.incomeTax;
  
  return gross - (pf + esi + pt + tax);
};

// Method to check if employee is eligible for gratuity
employeeSchema.methods.isEligibleForGratuity = function() {
  const joiningDate = new Date(this.employment.dateOfJoining);
  const currentDate = new Date();
  const yearsOfService = (currentDate - joiningDate) / (1000 * 60 * 60 * 24 * 365);
  
  return yearsOfService >= 5;
};

module.exports = mongoose.model('Employee', employeeSchema);