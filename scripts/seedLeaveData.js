const mongoose = require('mongoose');
const moment = require('moment');
const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const User = require('../models/User');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_payroll');
    console.log('MongoDB Connected for leave seeding...');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const seedLeaveData = async () => {
  try {
    // Clear existing leave data
    await Leave.deleteMany({});
    console.log('Cleared existing leave data...');

    // Get all employees and users
    const employees = await Employee.find({});
    const adminUser = await User.findOne({ role: 'admin' });
    const hrUser = await User.findOne({ role: 'hr' });

    if (employees.length === 0) {
      console.log('No employees found. Please run the main seed script first.');
      return;
    }

    console.log(`Found ${employees.length} employees. Creating leave data...`);

    const leaveApplications = [];
    const currentYear = new Date().getFullYear();

    // Leave types with their characteristics
    const leaveTypes = [
      { type: 'casual-leave', category: 'paid', maxDays: 3, commonReasons: ['Personal work', 'Family function', 'Home maintenance', 'Personal appointment'] },
      { type: 'sick-leave', category: 'paid', maxDays: 5, commonReasons: ['Fever and cold', 'Food poisoning', 'Migraine', 'Medical checkup', 'Dental treatment'] },
      { type: 'earned-leave', category: 'paid', maxDays: 10, commonReasons: ['Vacation with family', 'Wedding to attend', 'Religious festival', 'Long weekend trip'] },
      { type: 'unpaid-leave', category: 'unpaid', maxDays: 7, commonReasons: ['Extended family emergency', 'Personal reasons', 'Financial constraints', 'Study purposes'] },
      { type: 'emergency-leave', category: 'paid', maxDays: 2, commonReasons: ['Family emergency', 'Medical emergency', 'Accident', 'Natural calamity'] },
      { type: 'bereavement-leave', category: 'paid', maxDays: 3, commonReasons: ['Death in family', 'Funeral attendance', 'Last rites ceremony'] },
      { type: 'marriage-leave', category: 'paid', maxDays: 5, commonReasons: ['Own marriage', 'Sibling marriage', 'Close relative marriage'] },
      { type: 'compensatory-off', category: 'paid', maxDays: 1, commonReasons: ['Weekend work compensation', 'Holiday work compensation', 'Overtime compensation'] }
    ];

    // Create leave applications for each employee
    for (const employee of employees) {
      const numApplications = Math.floor(Math.random() * 8) + 3; // 3-10 applications per employee
      
      for (let i = 0; i < numApplications; i++) {
        const leaveTypeInfo = leaveTypes[Math.floor(Math.random() * leaveTypes.length)];
        const startDate = getRandomDate(currentYear);
        const days = Math.floor(Math.random() * leaveTypeInfo.maxDays) + 1;
        const endDate = moment(startDate).add(days - 1, 'days').toDate();
        
        // Determine status based on date and randomness
        let status = 'pending';
        let approvedBy = null;
        let approvedDate = null;
        let rejectionReason = null;
        
        if (startDate < new Date()) {
          // Past leaves - mostly approved
          const statusRandom = Math.random();
          if (statusRandom < 0.8) {
            status = 'approved';
            approvedBy = Math.random() > 0.5 ? hrUser._id : adminUser._id;
            approvedDate = moment(startDate).subtract(Math.floor(Math.random() * 7) + 1, 'days').toDate();
          } else if (statusRandom < 0.9) {
            status = 'rejected';
            approvedBy = hrUser._id;
            approvedDate = moment(startDate).subtract(Math.floor(Math.random() * 7) + 1, 'days').toDate();
            rejectionReason = getRandomRejectionReason();
          } else {
            status = 'cancelled';
          }
        } else {
          // Future leaves - mix of statuses
          const statusRandom = Math.random();
          if (statusRandom < 0.4) {
            status = 'approved';
            approvedBy = Math.random() > 0.5 ? hrUser._id : adminUser._id;
            approvedDate = new Date();
          } else if (statusRandom < 0.6) {
            status = 'pending';
          } else if (statusRandom < 0.7) {
            status = 'under-review';
          } else if (statusRandom < 0.8) {
            status = 'rejected';
            approvedBy = hrUser._id;
            approvedDate = new Date();
            rejectionReason = getRandomRejectionReason();
          }
        }

        const leaveApplication = {
          employeeId: employee._id,
          leaveType: leaveTypeInfo.type,
          leaveCategory: leaveTypeInfo.category,
          startDate,
          endDate,
          totalDays: days,
          reason: leaveTypeInfo.commonReasons[Math.floor(Math.random() * leaveTypeInfo.commonReasons.length)],
          description: generateLeaveDescription(leaveTypeInfo.type),
          isHalfDay: days === 1 && Math.random() < 0.3, // 30% chance for single day leaves
          isEmergency: leaveTypeInfo.type === 'emergency-leave',
          status,
          appliedDate: moment(startDate).subtract(Math.floor(Math.random() * 14) + 1, 'days').toDate(),
          appliedBy: employee.userId || adminUser._id,
          approvedBy,
          approvedDate,
          rejectionReason,
          createdBy: employee.userId || adminUser._id,
          updatedBy: employee.userId || adminUser._id,
          
          // Approval workflow
          approvalWorkflow: createApprovalWorkflow(leaveTypeInfo.type, status, approvedBy, approvedDate),
          
          // Balance impact
          balanceImpact: {
            leaveTypeBalance: {
              before: Math.floor(Math.random() * 20) + 10,
              after: Math.floor(Math.random() * 15) + 5,
              deducted: days
            }
          },
          
          // Salary impact for unpaid leaves
          salaryImpact: {
            isPaidLeave: leaveTypeInfo.category === 'paid',
            salaryDeduction: leaveTypeInfo.category === 'unpaid' ? calculateSalaryDeduction(employee, days) : 0,
            lopDays: leaveTypeInfo.category === 'unpaid' ? days : 0
          },
          
          // Handover details for longer leaves
          handoverDetails: days > 3 ? {
            isRequired: true,
            handoverNotes: 'Work handover completed to team members',
            handoverCompleted: status === 'approved'
          } : { isRequired: false },
          
          // Audit trail
          auditTrail: [{
            action: 'Leave application submitted',
            performedBy: employee.userId || adminUser._id,
            performedAt: moment(startDate).subtract(Math.floor(Math.random() * 14) + 1, 'days').toDate(),
            comments: 'Leave application submitted for approval'
          }]
        };

        // Add approval audit trail if approved/rejected
        if (status === 'approved' || status === 'rejected') {
          leaveApplication.auditTrail.push({
            action: `Leave ${status}`,
            performedBy: approvedBy,
            performedAt: approvedDate,
            comments: status === 'rejected' ? rejectionReason : 'Leave approved'
          });
        }

        leaveApplications.push(leaveApplication);
      }
    }

    // Insert all leave applications
    if (leaveApplications.length > 0) {
      await Leave.insertMany(leaveApplications);
    }

    console.log(`✅ Created ${leaveApplications.length} leave applications!`);

    // Generate summary
    const summary = await generateLeaveSummary();
    console.log('\n📊 Leave Summary:');
    console.log(`Total Applications: ${summary.total}`);
    console.log(`Approved: ${summary.approved}`);
    console.log(`Pending: ${summary.pending}`);
    console.log(`Rejected: ${summary.rejected}`);
    console.log(`Cancelled: ${summary.cancelled}`);
    console.log('\n📋 By Leave Type:');
    Object.entries(summary.byType).forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });

  } catch (error) {
    console.error('Error seeding leave data:', error);
  } finally {
    mongoose.connection.close();
  }
};

function getRandomDate(year) {
  const start = new Date(year - 1, 6, 1); // Start from July of previous year
  const end = new Date(year + 1, 5, 30); // End in June of next year
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function getRandomRejectionReason() {
  const reasons = [
    'Insufficient notice period',
    'Peak business period',
    'Team unavailable for coverage',
    'Previous leave not completed',
    'Exceeds monthly leave limit',
    'Documentation incomplete',
    'Business critical period'
  ];
  return reasons[Math.floor(Math.random() * reasons.length)];
}

function generateLeaveDescription(leaveType) {
  const descriptions = {
    'casual-leave': 'Need to attend to personal matters that require my immediate attention.',
    'sick-leave': 'Feeling unwell and need rest to recover. Will provide medical certificate if required.',
    'earned-leave': 'Planning to take a break to spend time with family and recharge.',
    'unpaid-leave': 'Personal circumstances require extended time off beyond available paid leave.',
    'emergency-leave': 'Urgent family situation requires immediate attention.',
    'bereavement-leave': 'Need time to attend funeral and be with family during this difficult time.',
    'marriage-leave': 'Wedding ceremony and related functions require time off.',
    'compensatory-off': 'Worked extra hours/weekends and taking compensatory time off.'
  };
  return descriptions[leaveType] || 'Leave required for personal reasons.';
}

function createApprovalWorkflow(leaveType, status, approvedBy, approvedDate) {
  const workflow = [];
  
  // Emergency and sick leaves go directly to HR
  if (leaveType === 'emergency-leave' || leaveType === 'sick-leave') {
    workflow.push({
      level: 1,
      approverRole: 'hr',
      status: ['approved', 'rejected'].includes(status) ? status : 'pending',
      approverId: approvedBy,
      actionDate: approvedDate
    });
  } else {
    // Regular workflow: Manager -> HR
    workflow.push({
      level: 1,
      approverRole: 'manager',
      status: ['approved', 'rejected'].includes(status) ? 'approved' : 'pending',
      approverId: status === 'approved' ? approvedBy : null,
      actionDate: status === 'approved' ? approvedDate : null
    });
    
    workflow.push({
      level: 2,
      approverRole: 'hr',
      status: ['approved', 'rejected'].includes(status) ? status : 'pending',
      approverId: approvedBy,
      actionDate: approvedDate
    });
  }
  
  return workflow;
}

function calculateSalaryDeduction(employee, days) {
  const monthlySalary = employee.salaryStructure?.ctc ? employee.salaryStructure.ctc / 12 : 50000;
  const dailyRate = monthlySalary / 30;
  return Math.round(dailyRate * days);
}

async function generateLeaveSummary() {
  const summary = await Leave.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
      }
    }
  ]);

  const byType = await Leave.aggregate([
    {
      $group: {
        _id: '$leaveType',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = summary[0] || { total: 0, approved: 0, pending: 0, rejected: 0, cancelled: 0 };
  result.byType = {};
  byType.forEach(item => {
    result.byType[item._id] = item.count;
  });

  return result;
}

// Run the seeding
connectDB().then(() => {
  seedLeaveData();
});