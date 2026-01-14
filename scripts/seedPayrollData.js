const mongoose = require('mongoose');
const moment = require('moment');
const Payroll = require('../models/Payroll');
const TaxManagement = require('../models/TaxManagement');
const SalaryDisbursement = require('../models/SalaryDisbursement');
const Reimbursement = require('../models/Reimbursement');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_payroll');
    console.log('MongoDB Connected for payroll seeding...');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const seedPayrollData = async () => {
  try {
    // Clear existing data
    await Payroll.deleteMany({});
    await TaxManagement.deleteMany({});
    await SalaryDisbursement.deleteMany({});
    await Reimbursement.deleteMany({});
    console.log('Cleared existing payroll data...');

    // Get all employees and users
    const employees = await Employee.find({});
    const adminUser = await User.findOne({ role: 'admin' });
    const hrUser = await User.findOne({ role: 'hr' });
    const financeUser = await User.findOne({ role: 'finance' }) || hrUser;

    if (employees.length === 0) {
      console.log('No employees found. Please run the main seed script first.');
      return;
    }

    console.log(`Found ${employees.length} employees. Creating comprehensive payroll data...`);

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // 1. Create Tax Management Records
    console.log('Creating tax management records...');
    const taxRecords = [];
    
    for (const employee of employees) {
      const financialYear = {
        startYear: currentYear - 1,
        endYear: currentYear,
        startDate: new Date(currentYear - 1, 3, 1), // April 1st
        endDate: new Date(currentYear, 2, 31) // March 31st
      };

      const taxRegime = Math.random() > 0.6 ? 'new' : 'old'; // 60% new regime
      
      const taxRecord = new TaxManagement({
        employeeId: employee._id,
        financialYear,
        taxRegime,
        annualSalary: {
          basicSalary: employee.salaryStructure.basicSalary,
          hra: employee.salaryStructure.hra,
          specialAllowance: employee.salaryStructure.specialAllowance,
          transportAllowance: employee.salaryStructure.transportAllowance * 12,
          medicalAllowance: employee.salaryStructure.medicalAllowance * 12,
          grossAnnualSalary: employee.salaryStructure.ctc
        },
        declarations: generateTaxDeclarations(employee.salaryStructure.ctc, taxRegime),
        status: 'approved',
        approvedBy: hrUser._id,
        approvedDate: new Date(currentYear - 1, 5, 15), // June 15th
        createdBy: employee.userId || adminUser._id,
        updatedBy: hrUser._id
      });

      // Calculate tax
      await taxRecord.calculateTax();
      await taxRecord.save();
      taxRecords.push(taxRecord);
    }

    console.log(`✅ Created ${taxRecords.length} tax management records!`);

    // 2. Create Payroll Records for last 6 months
    console.log('Creating payroll records...');
    const payrolls = [];
    
    for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
      const payrollMonth = moment().subtract(monthOffset, 'months');
      const month = payrollMonth.month() + 1;
      const year = payrollMonth.year();
      
      console.log(`Processing payroll for ${month}/${year}...`);
      
      for (const employee of employees) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const workingDays = calculateWorkingDays(startDate, endDate);
        
        // Get attendance data
        const attendanceData = await getEmployeeAttendanceData(employee._id, startDate, endDate);
        
        // Get tax record
        const taxRecord = taxRecords.find(tr => tr.employeeId.toString() === employee._id.toString());
        
        const payrollData = {
          employeeId: employee._id,
          payPeriod: {
            month,
            year,
            startDate,
            endDate,
            workingDays,
            actualWorkingDays: attendanceData.presentDays + (attendanceData.halfDays * 0.5)
          },
          salaryStructure: {
            ctc: employee.salaryStructure.ctc,
            basicSalary: employee.salaryStructure.basicSalary,
            hra: employee.salaryStructure.hra,
            specialAllowance: employee.salaryStructure.specialAllowance,
            transportAllowance: employee.salaryStructure.transportAllowance,
            medicalAllowance: employee.salaryStructure.medicalAllowance
          },
          earnings: {
            basicSalary: Math.round((employee.salaryStructure.basicSalary / 12) * (attendanceData.presentDays + attendanceData.halfDays * 0.5) / workingDays),
            hra: Math.round((employee.salaryStructure.hra / 12) * (attendanceData.presentDays + attendanceData.halfDays * 0.5) / workingDays),
            specialAllowance: Math.round((employee.salaryStructure.specialAllowance / 12) * (attendanceData.presentDays + attendanceData.halfDays * 0.5) / workingDays),
            transportAllowance: employee.salaryStructure.transportAllowance,
            medicalAllowance: employee.salaryStructure.medicalAllowance,
            bonus: monthOffset === 0 && Math.random() > 0.7 ? Math.floor(Math.random() * 10000) + 5000 : 0 // Random bonus for current month
          },
          attendanceData,
          status: monthOffset === 0 ? 'approved' : 'paid', // Current month approved, others paid
          approvedBy: hrUser._id,
          approvedDate: monthOffset === 0 ? new Date() : new Date(year, month - 1, 25),
          processedBy: monthOffset === 0 ? null : financeUser._id,
          processedDate: monthOffset === 0 ? null : new Date(year, month - 1, 28),
          createdBy: adminUser._id,
          updatedBy: hrUser._id
        };

        const payroll = new Payroll(payrollData);
        
        // Process calculations
        payroll.processAttendanceData(attendanceData);
        payroll.calculateStatutoryDeductions();
        
        if (taxRecord) {
          payroll.calculateIncomeTax(employee.salaryStructure.ctc, taxRecord.taxRegime);
          
          // Add monthly TDS record to tax management
          await taxRecord.addMonthlyTDS(month, year, payroll.grossPay, payroll.statutoryDeductions.incomeTax.taxDeducted, payroll._id);
        }

        await payroll.save();
        payrolls.push(payroll);
      }
    }

    console.log(`✅ Created ${payrolls.length} payroll records!`);

    // 3. Create Salary Disbursements for paid payrolls
    console.log('Creating salary disbursements...');
    const disbursements = [];
    const paidPayrolls = payrolls.filter(p => p.status === 'paid');
    
    // Group by month for batch processing
    const payrollsByMonth = {};
    paidPayrolls.forEach(payroll => {
      const key = `${payroll.payPeriod.year}-${payroll.payPeriod.month}`;
      if (!payrollsByMonth[key]) payrollsByMonth[key] = [];
      payrollsByMonth[key].push(payroll);
    });

    for (const [monthKey, monthPayrolls] of Object.entries(payrollsByMonth)) {
      const batchId = `BATCH-${monthKey}-${Date.now()}`;
      
      for (const payroll of monthPayrolls) {
        const employee = employees.find(e => e._id.toString() === payroll.employeeId.toString());
        
        const disbursementData = {
          batchId,
          payPeriod: payroll.payPeriod,
          employeeId: payroll.employeeId,
          payrollId: payroll._id,
          paymentDetails: {
            grossAmount: payroll.grossPay,
            netAmount: payroll.netPay,
            deductions: payroll.totalDeductions,
            bankAccount: {
              accountNumber: employee.bankDetails.accountNumber,
              ifscCode: employee.bankDetails.ifscCode,
              bankName: employee.bankDetails.bankName,
              branchName: employee.bankDetails.branchName,
              accountHolderName: employee.bankDetails.accountHolderName,
              accountType: employee.bankDetails.accountType
            },
            paymentMethod: 'neft'
          },
          transaction: {
            status: 'success',
            transactionId: `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`,
            utrNumber: `UTR${Date.now()}${Math.floor(Math.random() * 1000)}`,
            transactionDate: new Date(payroll.payPeriod.year, payroll.payPeriod.month - 1, 28)
          },
          processing: {
            initiatedBy: financeUser._id,
            initiatedAt: new Date(payroll.payPeriod.year, payroll.payPeriod.month - 1, 26),
            processedBy: financeUser._id,
            processedAt: new Date(payroll.payPeriod.year, payroll.payPeriod.month - 1, 28),
            validated: true,
            validatedBy: financeUser._id,
            validatedAt: new Date(payroll.payPeriod.year, payroll.payPeriod.month - 1, 25)
          },
          compliance: {
            tdsDeducted: payroll.statutoryDeductions.incomeTax.taxDeducted,
            pfDeducted: payroll.statutoryDeductions.pf.total,
            esiDeducted: payroll.statutoryDeductions.esi.total,
            ptDeducted: payroll.statutoryDeductions.professionalTax.amount
          },
          notifications: {
            employeeNotified: true,
            employeeNotifiedAt: new Date(payroll.payPeriod.year, payroll.payPeriod.month - 1, 28),
            smsNotification: { sent: true, sentAt: new Date(payroll.payPeriod.year, payroll.payPeriod.month - 1, 28) },
            emailNotification: { sent: true, sentAt: new Date(payroll.payPeriod.year, payroll.payPeriod.month - 1, 28) }
          },
          reconciliation: {
            reconciled: Math.random() > 0.1, // 90% reconciled
            reconciledAt: Math.random() > 0.1 ? new Date(payroll.payPeriod.year, payroll.payPeriod.month, 2) : null,
            reconciledBy: Math.random() > 0.1 ? financeUser._id : null
          },
          createdBy: financeUser._id,
          updatedBy: financeUser._id
        };

        const disbursement = new SalaryDisbursement(disbursementData);
        await disbursement.save();
        disbursements.push(disbursement);
      }
    }

    console.log(`✅ Created ${disbursements.length} salary disbursements!`);

    // 4. Create Reimbursements and Bonuses
    console.log('Creating reimbursements and bonuses...');
    const reimbursements = [];
    
    const expenseTypes = ['travel', 'accommodation', 'meals', 'fuel', 'medical', 'internet', 'phone', 'office-supplies', 'training'];
    const bonusTypes = ['performance', 'festival', 'spot-award', 'project-completion', 'sales-incentive'];
    
    for (const employee of employees) {
      // Create 3-5 reimbursements per employee
      const reimbCount = Math.floor(Math.random() * 3) + 3;
      
      for (let i = 0; i < reimbCount; i++) {
        const isBonus = Math.random() > 0.7; // 30% chance of bonus
        const expenseDate = moment().subtract(Math.floor(Math.random() * 180), 'days').toDate();
        
        let reimbursementData;
        
        if (isBonus) {
          const bonusType = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
          const amount = Math.floor(Math.random() * 25000) + 5000; // 5K to 30K
          
          reimbursementData = {
            employeeId: employee._id,
            claimType: 'bonus',
            category: 'other', // Add category for bonuses
            description: `${bonusType.replace('-', ' ')} bonus for excellent performance`,
            amount,
            expenseDate,
            bonusDetails: {
              bonusType,
              calculationMethod: 'fixed',
              baseAmount: amount,
              performanceMetrics: bonusType === 'performance' ? {
                rating: Math.floor(Math.random() * 2) + 4, // 4-5 rating
                kpiAchievement: Math.floor(Math.random() * 20) + 80, // 80-100%
                reviewPeriod: {
                  startDate: moment(expenseDate).subtract(3, 'months').toDate(),
                  endDate: expenseDate
                }
              } : undefined
            },
            status: Math.random() > 0.2 ? 'approved' : 'submitted', // Use 'submitted' instead of 'pending'
            approvalWorkflow: [
              {
                level: 1,
                approverRole: 'hr',
                status: Math.random() > 0.2 ? 'approved' : 'pending', // Use 'pending' for workflow
                approverId: Math.random() > 0.2 ? hrUser._id : null,
                actionDate: Math.random() > 0.2 ? moment(expenseDate).add(2, 'days').toDate() : null
              }
            ]
          };
        } else {
          const expenseType = expenseTypes[Math.floor(Math.random() * expenseTypes.length)];
          const amount = Math.floor(Math.random() * 5000) + 500; // 500 to 5500
          
          reimbursementData = {
            employeeId: employee._id,
            claimType: 'reimbursement',
            expenseType,
            category: getCategoryForExpenseType(expenseType),
            description: `${expenseType} expense for business purpose`,
            amount,
            expenseDate,
            businessPurpose: `Business ${expenseType} expense incurred during work`,
            status: Math.random() > 0.3 ? 'approved' : Math.random() > 0.5 ? 'submitted' : 'rejected',
            approvalWorkflow: [
              {
                level: 1,
                approverRole: 'manager',
                status: Math.random() > 0.3 ? 'approved' : Math.random() > 0.5 ? 'pending' : 'rejected',
                approverId: Math.random() > 0.3 ? hrUser._id : null,
                actionDate: Math.random() > 0.3 ? moment(expenseDate).add(1, 'days').toDate() : null
              }
            ]
          };
        }
        
        reimbursementData.submittedAt = moment(expenseDate).add(1, 'days').toDate();
        reimbursementData.submittedBy = employee.userId || adminUser._id;
        reimbursementData.createdBy = employee.userId || adminUser._id;
        reimbursementData.updatedBy = employee.userId || adminUser._id;

        const reimbursement = new Reimbursement(reimbursementData);
        await reimbursement.save();
        reimbursements.push(reimbursement);
      }
    }

    console.log(`✅ Created ${reimbursements.length} reimbursements and bonuses!`);

    // Generate summary
    const summary = await generatePayrollSummary();
    console.log('\n📊 Comprehensive Payroll Summary:');
    console.log(`Total Payroll Records: ${summary.payrolls.total}`);
    console.log(`Total Disbursements: ${summary.disbursements.total}`);
    console.log(`Total Reimbursements: ${summary.reimbursements.total}`);
    console.log(`Total Bonuses: ${summary.bonuses.total}`);
    console.log(`Total Tax Records: ${summary.taxRecords.total}`);
    
    console.log('\n💰 Financial Summary:');
    console.log(`Total Gross Pay: ₹${summary.financials.totalGrossPay.toLocaleString('en-IN')}`);
    console.log(`Total Net Pay: ₹${summary.financials.totalNetPay.toLocaleString('en-IN')}`);
    console.log(`Total Deductions: ₹${summary.financials.totalDeductions.toLocaleString('en-IN')}`);
    console.log(`Total Disbursed: ₹${summary.financials.totalDisbursed.toLocaleString('en-IN')}`);

  } catch (error) {
    console.error('Error seeding payroll data:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Helper Functions

function calculateWorkingDays(startDate, endDate) {
  let workingDays = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
}

async function getEmployeeAttendanceData(employeeId, startDate, endDate) {
  // Try to get actual attendance data, fallback to simulated data
  const attendanceRecords = await Attendance.find({
    employeeId,
    date: { $gte: startDate, $lte: endDate }
  });

  if (attendanceRecords.length > 0) {
    const data = {
      totalDays: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1,
      presentDays: 0,
      absentDays: 0,
      halfDays: 0,
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
      holidayDays: 0,
      overtimeHours: 0
    };

    attendanceRecords.forEach(record => {
      switch (record.status) {
        case 'present':
        case 'work-from-home':
          data.presentDays++;
          break;
        case 'absent':
          data.absentDays++;
          break;
        case 'half-day':
          data.halfDays++;
          break;
        case 'on-leave':
          data.paidLeaveDays++;
          break;
        case 'holiday':
          data.holidayDays++;
          break;
      }
      
      if (record.workingHours && record.workingHours.overtimeHours) {
        data.overtimeHours += record.workingHours.overtimeHours;
      }
    });

    return data;
  } else {
    // Simulate attendance data
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const workingDays = calculateWorkingDays(startDate, endDate);
    
    return {
      totalDays,
      presentDays: Math.floor(workingDays * (0.85 + Math.random() * 0.1)), // 85-95% attendance
      absentDays: Math.floor(Math.random() * 2), // 0-1 absent days
      halfDays: Math.floor(Math.random() * 2), // 0-1 half days
      paidLeaveDays: Math.floor(Math.random() * 3), // 0-2 leave days
      unpaidLeaveDays: 0,
      holidayDays: Math.floor(totalDays - workingDays), // Weekends
      overtimeHours: Math.floor(Math.random() * 10) // 0-9 overtime hours
    };
  }
}

function generateTaxDeclarations(ctc, regime) {
  if (regime === 'old') {
    return {
      section80C: {
        ppf: Math.floor(Math.random() * 50000) + 50000, // 50K-100K
        elss: Math.floor(Math.random() * 30000),
        lifePremium: Math.floor(Math.random() * 20000),
        total: 0,
        maxLimit: 150000
      },
      section80D: {
        selfAndFamily: Math.floor(Math.random() * 25000) + 10000, // 10K-35K
        parents: Math.floor(Math.random() * 15000),
        total: 0
      },
      section80E: Math.floor(Math.random() * 50000), // Education loan
      section24: Math.floor(Math.random() * 200000), // Home loan interest
      hraExemption: {
        rentPaid: Math.floor(ctc * 0.3), // 30% of CTC as rent
        hraReceived: Math.floor(ctc * 0.4 / 12), // 40% of basic as HRA
        exemptedAmount: 0
      },
      totalDeductions: 0
    };
  } else {
    return {
      section80C: { total: 0, maxLimit: 0 },
      section80D: { total: 0 },
      totalDeductions: 50000 // Standard deduction
    };
  }
}

function getCategoryForExpenseType(expenseType) {
  const categoryMap = {
    'travel': 'business-travel',
    'accommodation': 'business-travel',
    'meals': 'business-travel',
    'fuel': 'business-travel',
    'medical': 'medical',
    'internet': 'communication',
    'phone': 'communication',
    'office-supplies': 'office-expenses',
    'training': 'training'
  };
  return categoryMap[expenseType] || 'other';
}

async function generatePayrollSummary() {
  const payrolls = await Payroll.find({});
  const disbursements = await SalaryDisbursement.find({});
  const reimbursements = await Reimbursement.find({ claimType: 'reimbursement' });
  const bonuses = await Reimbursement.find({ claimType: 'bonus' });
  const taxRecords = await TaxManagement.find({});

  const totalGrossPay = payrolls.reduce((sum, p) => sum + p.grossPay, 0);
  const totalNetPay = payrolls.reduce((sum, p) => sum + p.netPay, 0);
  const totalDeductions = payrolls.reduce((sum, p) => sum + p.totalDeductions, 0);
  const totalDisbursed = disbursements.reduce((sum, d) => sum + d.paymentDetails.netAmount, 0);

  return {
    payrolls: { total: payrolls.length },
    disbursements: { total: disbursements.length },
    reimbursements: { total: reimbursements.length },
    bonuses: { total: bonuses.length },
    taxRecords: { total: taxRecords.length },
    financials: {
      totalGrossPay,
      totalNetPay,
      totalDeductions,
      totalDisbursed
    }
  };
}

// Run the seeding
connectDB().then(() => {
  seedPayrollData();
});