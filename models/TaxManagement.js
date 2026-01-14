const mongoose = require('mongoose');

const taxManagementSchema = new mongoose.Schema({
  taxId: {
    type: String,
    unique: true
  },
  
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  financialYear: {
    startYear: { type: Number, required: true }, // e.g., 2023 for FY 2023-24
    endYear: { type: Number, required: true },   // e.g., 2024 for FY 2023-24
    startDate: { type: Date, required: true },   // April 1st
    endDate: { type: Date, required: true }      // March 31st
  },
  
  // Tax Regime Selection
  taxRegime: {
    type: String,
    enum: ['old', 'new'],
    default: 'new'
  },
  
  // Annual Salary Breakdown
  annualSalary: {
    basicSalary: { type: Number, required: true },
    hra: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    transportAllowance: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    grossAnnualSalary: { type: Number, required: true }
  },
  
  // Tax Declarations (Old Regime)
  declarations: {
    // Section 80C - Investment Deductions
    section80C: {
      ppf: { type: Number, default: 0 },
      elss: { type: Number, default: 0 },
      lifePremium: { type: Number, default: 0 },
      nsc: { type: Number, default: 0 },
      fixedDeposit: { type: Number, default: 0 },
      homeLoanPrincipal: { type: Number, default: 0 },
      tuitionFees: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      maxLimit: { type: Number, default: 150000 }
    },
    
    // Section 80D - Medical Insurance
    section80D: {
      selfAndFamily: { type: Number, default: 0 },
      parents: { type: Number, default: 0 },
      seniorCitizenParents: { type: Number, default: 0 },
      preventiveHealthCheckup: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    
    // Other Deductions
    section80E: { type: Number, default: 0 }, // Education Loan Interest
    section80G: { type: Number, default: 0 }, // Donations
    section24: { type: Number, default: 0 },  // Home Loan Interest
    
    // HRA Exemption
    hraExemption: {
      rentPaid: { type: Number, default: 0 },
      hraReceived: { type: Number, default: 0 },
      exemptedAmount: { type: Number, default: 0 }
    },
    
    totalDeductions: { type: Number, default: 0 }
  },
  
  // Investment Proofs Upload
  investmentProofs: [{
    section: { type: String, required: true }, // 80C, 80D, etc.
    category: { type: String, required: true }, // PPF, ELSS, etc.
    amount: { type: Number, required: true },
    fileName: String,
    originalName: String,
    fileType: String,
    fileSize: Number,
    filePath: String,
    uploadDate: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedDate: Date,
    comments: String
  }],
  
  // Tax Calculation
  taxCalculation: {
    taxableIncome: { type: Number, default: 0 },
    
    // Tax Slabs (New Regime)
    newRegimeTax: {
      slab1: { range: { type: String, default: '0-3,00,000' }, rate: { type: Number, default: 0 }, tax: { type: Number, default: 0 } },
      slab2: { range: { type: String, default: '3,00,001-6,00,000' }, rate: { type: Number, default: 5 }, tax: { type: Number, default: 0 } },
      slab3: { range: { type: String, default: '6,00,001-9,00,000' }, rate: { type: Number, default: 10 }, tax: { type: Number, default: 0 } },
      slab4: { range: { type: String, default: '9,00,001-12,00,000' }, rate: { type: Number, default: 15 }, tax: { type: Number, default: 0 } },
      slab5: { range: { type: String, default: '12,00,001-15,00,000' }, rate: { type: Number, default: 20 }, tax: { type: Number, default: 0 } },
      slab6: { range: { type: String, default: '15,00,000+' }, rate: { type: Number, default: 30 }, tax: { type: Number, default: 0 } },
      totalTax: { type: Number, default: 0 }
    },
    
    // Tax Slabs (Old Regime)
    oldRegimeTax: {
      slab1: { range: { type: String, default: '0-2,50,000' }, rate: { type: Number, default: 0 }, tax: { type: Number, default: 0 } },
      slab2: { range: { type: String, default: '2,50,001-5,00,000' }, rate: { type: Number, default: 5 }, tax: { type: Number, default: 0 } },
      slab3: { range: { type: String, default: '5,00,001-10,00,000' }, rate: { type: Number, default: 20 }, tax: { type: Number, default: 0 } },
      slab4: { range: { type: String, default: '10,00,000+' }, rate: { type: Number, default: 30 }, tax: { type: Number, default: 0 } },
      totalTax: { type: Number, default: 0 }
    },
    
    // Final Tax Calculation
    applicableTax: { type: Number, default: 0 },
    healthAndEducationCess: { type: Number, default: 0 }, // 4% of tax
    totalTaxLiability: { type: Number, default: 0 },
    
    // Monthly TDS
    monthlyTDS: { type: Number, default: 0 },
    
    // Quarterly Projections
    quarterlyProjections: [{
      quarter: { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4'] },
      projectedIncome: { type: Number, default: 0 },
      projectedTax: { type: Number, default: 0 },
      actualIncome: { type: Number, default: 0 },
      actualTax: { type: Number, default: 0 }
    }]
  },
  
  // Monthly TDS Records
  monthlyTDS: [{
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    grossSalary: { type: Number, required: true },
    tdsDeducted: { type: Number, required: true },
    cumulativeIncome: { type: Number, required: true },
    cumulativeTDS: { type: Number, required: true },
    payrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' }
  }],
  
  // Form 16 Generation
  form16: {
    generated: { type: Boolean, default: false },
    generatedDate: Date,
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    filePath: String,
    downloadCount: { type: Number, default: 0 },
    lastDownloaded: Date
  },
  
  // Annual Tax Summary
  annualSummary: {
    totalGrossIncome: { type: Number, default: 0 },
    totalTDSDeducted: { type: Number, default: 0 },
    totalTaxLiability: { type: Number, default: 0 },
    refundDue: { type: Number, default: 0 },
    additionalTaxDue: { type: Number, default: 0 },
    effectiveTaxRate: { type: Number, default: 0 }
  },
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under-review', 'approved', 'completed'],
    default: 'draft'
  },
  
  submittedDate: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedDate: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedDate: Date,
  
  // Comments and Notes
  employeeComments: String,
  hrComments: String,
  financeComments: String,
  
  // Audit Trail
  auditTrail: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    oldValues: mongoose.Schema.Types.Mixed,
    newValues: mongoose.Schema.Types.Mixed,
    comments: String
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Indexes
taxManagementSchema.index({ employeeId: 1, 'financialYear.startYear': 1 });
taxManagementSchema.index({ status: 1 });
taxManagementSchema.index({ 'financialYear.startYear': 1 });

// Pre-save middleware
taxManagementSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate taxId if not exists
  if (!this.taxId) {
    const year = this.financialYear.startYear;
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.taxId = `TAX-${year}-${randomNum}`;
  }
  
  next();
});

// Method to calculate tax based on regime
taxManagementSchema.methods.calculateTax = function() {
  const grossIncome = this.annualSalary.grossAnnualSalary;
  let taxableIncome = grossIncome;
  
  if (this.taxRegime === 'old') {
    // Old regime - apply deductions
    taxableIncome = grossIncome - this.declarations.totalDeductions - this.declarations.hraExemption.exemptedAmount;
    this.calculateOldRegimeTax(taxableIncome);
  } else {
    // New regime - standard deduction only
    taxableIncome = grossIncome - 50000; // Standard deduction
    this.calculateNewRegimeTax(taxableIncome);
  }
  
  this.taxCalculation.taxableIncome = Math.max(0, taxableIncome);
  
  // Calculate cess and final liability
  const baseTax = this.taxRegime === 'old' ? 
    this.taxCalculation.oldRegimeTax.totalTax : 
    this.taxCalculation.newRegimeTax.totalTax;
    
  this.taxCalculation.applicableTax = baseTax;
  this.taxCalculation.healthAndEducationCess = Math.round(baseTax * 0.04);
  this.taxCalculation.totalTaxLiability = baseTax + this.taxCalculation.healthAndEducationCess;
  this.taxCalculation.monthlyTDS = Math.round(this.taxCalculation.totalTaxLiability / 12);
  
  return this.save();
};

// Calculate new regime tax
taxManagementSchema.methods.calculateNewRegimeTax = function(taxableIncome) {
  let remainingIncome = taxableIncome;
  let totalTax = 0;
  
  // Slab 6: Above 15,00,000 @ 30%
  if (remainingIncome > 1500000) {
    const taxableAtThisRate = remainingIncome - 1500000;
    this.taxCalculation.newRegimeTax.slab6.tax = Math.round(taxableAtThisRate * 0.30);
    totalTax += this.taxCalculation.newRegimeTax.slab6.tax;
    remainingIncome = 1500000;
  }
  
  // Slab 5: 12,00,001 to 15,00,000 @ 20%
  if (remainingIncome > 1200000) {
    const taxableAtThisRate = remainingIncome - 1200000;
    this.taxCalculation.newRegimeTax.slab5.tax = Math.round(taxableAtThisRate * 0.20);
    totalTax += this.taxCalculation.newRegimeTax.slab5.tax;
    remainingIncome = 1200000;
  }
  
  // Slab 4: 9,00,001 to 12,00,000 @ 15%
  if (remainingIncome > 900000) {
    const taxableAtThisRate = remainingIncome - 900000;
    this.taxCalculation.newRegimeTax.slab4.tax = Math.round(taxableAtThisRate * 0.15);
    totalTax += this.taxCalculation.newRegimeTax.slab4.tax;
    remainingIncome = 900000;
  }
  
  // Slab 3: 6,00,001 to 9,00,000 @ 10%
  if (remainingIncome > 600000) {
    const taxableAtThisRate = remainingIncome - 600000;
    this.taxCalculation.newRegimeTax.slab3.tax = Math.round(taxableAtThisRate * 0.10);
    totalTax += this.taxCalculation.newRegimeTax.slab3.tax;
    remainingIncome = 600000;
  }
  
  // Slab 2: 3,00,001 to 6,00,000 @ 5%
  if (remainingIncome > 300000) {
    const taxableAtThisRate = remainingIncome - 300000;
    this.taxCalculation.newRegimeTax.slab2.tax = Math.round(taxableAtThisRate * 0.05);
    totalTax += this.taxCalculation.newRegimeTax.slab2.tax;
  }
  
  this.taxCalculation.newRegimeTax.totalTax = totalTax;
};

// Calculate old regime tax
taxManagementSchema.methods.calculateOldRegimeTax = function(taxableIncome) {
  let remainingIncome = taxableIncome;
  let totalTax = 0;
  
  // Slab 4: Above 10,00,000 @ 30%
  if (remainingIncome > 1000000) {
    const taxableAtThisRate = remainingIncome - 1000000;
    this.taxCalculation.oldRegimeTax.slab4.tax = Math.round(taxableAtThisRate * 0.30);
    totalTax += this.taxCalculation.oldRegimeTax.slab4.tax;
    remainingIncome = 1000000;
  }
  
  // Slab 3: 5,00,001 to 10,00,000 @ 20%
  if (remainingIncome > 500000) {
    const taxableAtThisRate = remainingIncome - 500000;
    this.taxCalculation.oldRegimeTax.slab3.tax = Math.round(taxableAtThisRate * 0.20);
    totalTax += this.taxCalculation.oldRegimeTax.slab3.tax;
    remainingIncome = 500000;
  }
  
  // Slab 2: 2,50,001 to 5,00,000 @ 5%
  if (remainingIncome > 250000) {
    const taxableAtThisRate = remainingIncome - 250000;
    this.taxCalculation.oldRegimeTax.slab2.tax = Math.round(taxableAtThisRate * 0.05);
    totalTax += this.taxCalculation.oldRegimeTax.slab2.tax;
  }
  
  this.taxCalculation.oldRegimeTax.totalTax = totalTax;
};

// Method to calculate HRA exemption
taxManagementSchema.methods.calculateHRAExemption = function() {
  const hraReceived = this.declarations.hraExemption.hraReceived;
  const rentPaid = this.declarations.hraExemption.rentPaid;
  const basicSalary = this.annualSalary.basicSalary;
  
  if (hraReceived > 0 && rentPaid > 0) {
    // HRA exemption is minimum of:
    // 1. Actual HRA received
    // 2. Rent paid minus 10% of basic salary
    // 3. 50% of basic salary (for metro cities) or 40% (for non-metro)
    
    const exemption1 = hraReceived;
    const exemption2 = Math.max(0, rentPaid - (basicSalary * 0.10));
    const exemption3 = basicSalary * 0.50; // Assuming metro city
    
    this.declarations.hraExemption.exemptedAmount = Math.min(exemption1, exemption2, exemption3);
  }
  
  return this.save();
};

// Method to add monthly TDS record
taxManagementSchema.methods.addMonthlyTDS = function(month, year, grossSalary, tdsDeducted, payrollId) {
  // Remove existing record for the same month/year
  this.monthlyTDS = this.monthlyTDS.filter(record => 
    !(record.month === month && record.year === year)
  );
  
  // Calculate cumulative values
  const previousRecords = this.monthlyTDS.filter(record => 
    record.year < year || (record.year === year && record.month < month)
  );
  
  const cumulativeIncome = previousRecords.reduce((sum, record) => sum + record.grossSalary, 0) + grossSalary;
  const cumulativeTDS = previousRecords.reduce((sum, record) => sum + record.tdsDeducted, 0) + tdsDeducted;
  
  // Add new record
  this.monthlyTDS.push({
    month,
    year,
    grossSalary,
    tdsDeducted,
    cumulativeIncome,
    cumulativeTDS,
    payrollId
  });
  
  // Sort by year and month
  this.monthlyTDS.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
  
  return this.save();
};

// Method to generate Form 16
taxManagementSchema.methods.generateForm16 = function(generatedBy) {
  this.form16.generated = true;
  this.form16.generatedDate = new Date();
  this.form16.generatedBy = generatedBy;
  
  // Add audit trail
  this.auditTrail.push({
    action: 'Form 16 generated',
    performedBy: generatedBy,
    comments: 'Form 16 generated for financial year'
  });
  
  return this.save();
};

// Static method to get tax summary
taxManagementSchema.statics.getTaxSummary = function(financialYear) {
  return this.aggregate([
    { $match: { 'financialYear.startYear': financialYear } },
    {
      $group: {
        _id: null,
        totalEmployees: { $sum: 1 },
        totalTaxLiability: { $sum: '$taxCalculation.totalTaxLiability' },
        totalTDSDeducted: { $sum: '$annualSummary.totalTDSDeducted' },
        newRegimeCount: {
          $sum: { $cond: [{ $eq: ['$taxRegime', 'new'] }, 1, 0] }
        },
        oldRegimeCount: {
          $sum: { $cond: [{ $eq: ['$taxRegime', 'old'] }, 1, 0] }
        },
        form16Generated: {
          $sum: { $cond: ['$form16.generated', 1, 0] }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('TaxManagement', taxManagementSchema);