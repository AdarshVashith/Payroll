const mongoose = require('mongoose');

const salaryStructureSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  effectiveDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  
  // Basic Structure
  ctc: { type: Number, required: true }, // Annual CTC
  basicSalary: { type: Number, required: true },
  
  // Earnings Components
  earnings: {
    hra: { 
      amount: { type: Number, default: 0 },
      isPercentage: { type: Boolean, default: true },
      percentage: { type: Number, default: 40 } // 40% of basic
    },
    specialAllowance: { type: Number, default: 0 },
    transportAllowance: { type: Number, default: 1600 },
    medicalAllowance: { type: Number, default: 1250 },
    lunchAllowance: { type: Number, default: 0 },
    phoneAllowance: { type: Number, default: 0 },
    internetAllowance: { type: Number, default: 0 },
    
    // Variable Components
    performanceBonus: { type: Number, default: 0 },
    incentives: { type: Number, default: 0 },
    overtimePay: { type: Number, default: 0 },
    arrears: { type: Number, default: 0 },
    
    // Custom Earnings
    customEarnings: [{
      name: { type: String, required: true },
      amount: { type: Number, default: 0 },
      isPercentage: { type: Boolean, default: false },
      percentageOf: { type: String, enum: ['basic', 'gross', 'ctc'], default: 'basic' },
      percentage: { type: Number, default: 0 },
      isTaxable: { type: Boolean, default: true },
      isStatutory: { type: Boolean, default: false }
    }]
  },
  
  // Deduction Components
  deductions: {
    // Statutory Deductions
    providentFund: {
      employeeContribution: { type: Number, default: 0 },
      employerContribution: { type: Number, default: 0 },
      isPercentage: { type: Boolean, default: true },
      percentage: { type: Number, default: 12 }
    },
    esi: {
      employeeContribution: { type: Number, default: 0 },
      employerContribution: { type: Number, default: 0 },
      isPercentage: { type: Boolean, default: true },
      employeePercentage: { type: Number, default: 0.75 },
      employerPercentage: { type: Number, default: 3.25 }
    },
    professionalTax: { type: Number, default: 200 },
    incomeTax: { type: Number, default: 0 },
    
    // Other Deductions
    loanDeduction: { type: Number, default: 0 },
    advanceDeduction: { type: Number, default: 0 },
    lateComingFine: { type: Number, default: 0 },
    
    // Custom Deductions
    customDeductions: [{
      name: { type: String, required: true },
      amount: { type: Number, default: 0 },
      isPercentage: { type: Boolean, default: false },
      percentageOf: { type: String, enum: ['basic', 'gross'], default: 'basic' },
      percentage: { type: Number, default: 0 },
      isRecurring: { type: Boolean, default: true }
    }]
  },
  
  // Calculation Rules
  calculationRules: {
    pfCeiling: { type: Number, default: 15000 }, // PF ceiling amount
    esiCeiling: { type: Number, default: 21000 }, // ESI ceiling amount
    ptSlab: { type: String, default: 'maharashtra' }, // State for PT calculation
    gratuityEligible: { type: Boolean, default: true },
    bonusEligible: { type: Boolean, default: true }
  },
  
  // Approval Status
  status: {
    type: String,
    enum: ['draft', 'pending-approval', 'approved', 'rejected'],
    default: 'draft'
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  
  remarks: String,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Indexes
salaryStructureSchema.index({ employeeId: 1, effectiveDate: -1 });
salaryStructureSchema.index({ status: 1 });

// Pre-save middleware
salaryStructureSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate HRA if percentage-based
  if (this.earnings.hra.isPercentage) {
    this.earnings.hra.amount = Math.round(
      (this.basicSalary * this.earnings.hra.percentage) / 100
    );
  }
  
  // Calculate PF if percentage-based
  if (this.deductions.providentFund.isPercentage) {
    const pfBase = Math.min(this.basicSalary, this.calculationRules.pfCeiling);
    this.deductions.providentFund.employeeContribution = Math.round(
      (pfBase * this.deductions.providentFund.percentage) / 100
    );
    this.deductions.providentFund.employerContribution = this.deductions.providentFund.employeeContribution;
  }
  
  // Calculate ESI if percentage-based
  const grossForESI = this.basicSalary + this.earnings.hra.amount + this.earnings.specialAllowance;
  if (grossForESI <= this.calculationRules.esiCeiling && this.deductions.esi.isPercentage) {
    this.deductions.esi.employeeContribution = Math.round(
      (grossForESI * this.deductions.esi.employeePercentage) / 100
    );
    this.deductions.esi.employerContribution = Math.round(
      (grossForESI * this.deductions.esi.employerPercentage) / 100
    );
  }
  
  next();
});

// Method to calculate gross salary
salaryStructureSchema.methods.calculateGrossSalary = function() {
  const earnings = this.earnings;
  let gross = this.basicSalary + 
              earnings.hra.amount + 
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
    if (earning.isPercentage) {
      const base = earning.percentageOf === 'basic' ? this.basicSalary : 
                   earning.percentageOf === 'ctc' ? this.ctc : gross;
      gross += Math.round((base * earning.percentage) / 100);
    } else {
      gross += earning.amount;
    }
  });
  
  return Math.round(gross);
};

// Method to calculate total deductions
salaryStructureSchema.methods.calculateTotalDeductions = function() {
  const deductions = this.deductions;
  let totalDeductions = deductions.providentFund.employeeContribution + 
                       deductions.esi.employeeContribution + 
                       deductions.professionalTax + 
                       deductions.incomeTax + 
                       deductions.loanDeduction + 
                       deductions.advanceDeduction + 
                       deductions.lateComingFine;
  
  // Add custom deductions
  deductions.customDeductions.forEach(deduction => {
    if (deduction.isPercentage) {
      const base = deduction.percentageOf === 'basic' ? this.basicSalary : this.calculateGrossSalary();
      totalDeductions += Math.round((base * deduction.percentage) / 100);
    } else {
      totalDeductions += deduction.amount;
    }
  });
  
  return Math.round(totalDeductions);
};

// Method to calculate net salary
salaryStructureSchema.methods.calculateNetSalary = function() {
  return this.calculateGrossSalary() - this.calculateTotalDeductions();
};

module.exports = mongoose.model('SalaryStructure', salaryStructureSchema);