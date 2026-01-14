const mongoose = require('mongoose');
const moment = require('moment');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const User = require('../models/User');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_payroll');
    console.log('MongoDB Connected for attendance seeding...');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const seedAttendanceData = async () => {
  try {
    // Clear existing attendance data
    await Attendance.deleteMany({});
    console.log('Cleared existing attendance data...');

    // Get all employees
    const employees = await Employee.find({});
    const adminUser = await User.findOne({ role: 'admin' });

    if (employees.length === 0) {
      console.log('No employees found. Please run the main seed script first.');
      return;
    }

    console.log(`Found ${employees.length} employees. Creating attendance data...`);

    const attendanceRecords = [];
    const today = moment();
    
    // Create attendance for the last 60 days
    for (let i = 0; i < 60; i++) {
      const date = moment().subtract(i, 'days');
      
      // Skip weekends for most records
      if (date.day() === 0 || date.day() === 6) {
        // Only 20% chance of weekend work
        if (Math.random() > 0.2) continue;
      }

      for (const employee of employees) {
        // 95% attendance rate
        if (Math.random() > 0.05) {
          const attendanceRecord = await createAttendanceRecord(employee, date, adminUser);
          if (attendanceRecord) {
            attendanceRecords.push(attendanceRecord);
          }
        }
      }
    }

    // Insert all records
    if (attendanceRecords.length > 0) {
      await Attendance.insertMany(attendanceRecords);
    }

    console.log(`✅ Created ${attendanceRecords.length} attendance records!`);

    // Generate summary
    const summary = await generateAttendanceSummary();
    console.log('\n📊 Attendance Summary:');
    console.log(`Present: ${summary.present}`);
    console.log(`Absent: ${summary.absent}`);
    console.log(`Half-day: ${summary.halfDay}`);
    console.log(`Work from Home: ${summary.wfh}`);
    console.log(`On Leave: ${summary.onLeave}`);
    console.log(`Holiday: ${summary.holiday}`);
    console.log(`Total Working Hours: ${summary.totalHours}`);
    console.log(`Total Overtime Hours: ${summary.overtimeHours}`);

  } catch (error) {
    console.error('Error seeding attendance data:', error);
  } finally {
    mongoose.connection.close();
  }
};

async function createAttendanceRecord(employee, date, adminUser) {
  const attendanceDate = date.startOf('day').toDate();
  
  // Determine status based on probability
  const statusProbability = Math.random();
  let status, checkIn, checkOut, workingHours, isWFH = false, isHalfDay = false;

  if (statusProbability < 0.70) {
    // 70% - Present (normal day)
    status = 'present';
    checkIn = getRandomCheckInTime(date);
    checkOut = getRandomCheckOutTime(date, checkIn);
    workingHours = calculateWorkingHours(checkIn, checkOut);
  } else if (statusProbability < 0.80) {
    // 10% - Work from Home
    status = 'work-from-home';
    isWFH = true;
    checkIn = getRandomCheckInTime(date, true); // WFH can start later
    checkOut = getRandomCheckOutTime(date, checkIn, true);
    workingHours = calculateWorkingHours(checkIn, checkOut);
  } else if (statusProbability < 0.85) {
    // 5% - Half day
    status = 'half-day';
    isHalfDay = true;
    checkIn = getRandomCheckInTime(date);
    checkOut = moment(checkIn).add(4, 'hours').toDate(); // 4 hours for half day
    workingHours = {
      totalHours: 4,
      regularHours: 4,
      overtimeHours: 0,
      productiveHours: 4,
      breakHours: 0
    };
  } else if (statusProbability < 0.90) {
    // 5% - On Leave
    status = 'on-leave';
    workingHours = {
      totalHours: 0,
      regularHours: 0,
      overtimeHours: 0,
      productiveHours: 0,
      breakHours: 0
    };
  } else if (statusProbability < 0.95) {
    // 5% - Absent
    status = 'absent';
    workingHours = {
      totalHours: 0,
      regularHours: 0,
      overtimeHours: 0,
      productiveHours: 0,
      breakHours: 0
    };
  } else {
    // 5% - Holiday
    status = 'holiday';
    workingHours = {
      totalHours: 0,
      regularHours: 0,
      overtimeHours: 0,
      productiveHours: 0,
      breakHours: 0
    };
  }

  const attendanceRecord = {
    employeeId: employee._id,
    date: attendanceDate,
    status,
    workingHours,
    shift: {
      shiftType: 'general',
      startTime: '09:00',
      endTime: '18:00',
      breakDuration: 60
    },
    createdBy: adminUser._id,
    updatedBy: adminUser._id
  };

  // Add check-in/check-out times if present
  if (checkIn) {
    attendanceRecord.checkIn = {
      time: checkIn,
      method: Math.random() > 0.8 ? 'mobile' : 'web',
      location: {
        address: isWFH ? 'Home' : 'Office'
      }
    };
  }

  if (checkOut) {
    attendanceRecord.checkOut = {
      time: checkOut,
      method: Math.random() > 0.8 ? 'mobile' : 'web',
      location: {
        address: isWFH ? 'Home' : 'Office'
      }
    };
  }

  // Add WFH details
  if (isWFH) {
    attendanceRecord.workFromHome = {
      isWFH: true,
      reason: 'Remote work',
      isApproved: true,
      approvedBy: adminUser._id,
      approvedAt: moment(attendanceDate).subtract(1, 'day').toDate(),
      tasks: ['Development work', 'Team meetings', 'Code review'],
      productivity: {
        tasksCompleted: Math.floor(Math.random() * 5) + 3,
        hoursWorked: workingHours.productiveHours,
        rating: Math.floor(Math.random() * 2) + 4 // 4-5 rating
      }
    };
  }

  // Add overtime details if applicable
  if (workingHours.overtimeHours > 0) {
    attendanceRecord.overtime = {
      isOvertime: true,
      overtimeHours: workingHours.overtimeHours,
      reason: 'Project deadline',
      isApproved: true,
      approvedBy: adminUser._id,
      overtimeRate: 1.5,
      overtimePay: calculateOvertimePay(employee, workingHours.overtimeHours)
    };
  }

  // Add late arrival if applicable
  if (checkIn && status === 'present') {
    const expectedCheckIn = moment(attendanceDate).hour(9).minute(0).second(0);
    const actualCheckIn = moment(checkIn);
    
    if (actualCheckIn.isAfter(expectedCheckIn)) {
      const lateByMinutes = actualCheckIn.diff(expectedCheckIn, 'minutes');
      if (lateByMinutes > 5) { // Consider late if more than 5 minutes
        attendanceRecord.lateArrival = {
          isLate: true,
          lateByMinutes,
          reason: getRandomLateReason(),
          isApproved: lateByMinutes < 30 // Auto-approve if less than 30 minutes
        };

        // Add compliance violation
        attendanceRecord.compliance = {
          isCompliant: false,
          violations: [{
            type: 'late',
            description: `Late by ${lateByMinutes} minutes`,
            severity: lateByMinutes > 30 ? 'high' : lateByMinutes > 15 ? 'medium' : 'low'
          }]
        };
      }
    }
  }

  // Add breaks for present days
  if (['present', 'work-from-home'].includes(status) && checkIn && checkOut) {
    attendanceRecord.breaks = generateBreaks(checkIn, checkOut);
  }

  return attendanceRecord;
}

function getRandomCheckInTime(date, isWFH = false) {
  const baseHour = isWFH ? 9 : 8; // WFH can start at 9, office at 8
  const hour = baseHour + Math.floor(Math.random() * 2); // 8-10 AM or 9-11 AM for WFH
  const minute = Math.floor(Math.random() * 60);
  
  return moment(date).hour(hour).minute(minute).second(0).toDate();
}

function getRandomCheckOutTime(date, checkIn, isWFH = false) {
  const checkInMoment = moment(checkIn);
  const minWorkHours = isWFH ? 7 : 8; // Minimum work hours
  const maxWorkHours = 10; // Maximum work hours
  
  const workHours = minWorkHours + Math.random() * (maxWorkHours - minWorkHours);
  
  return checkInMoment.add(workHours, 'hours').toDate();
}

function calculateWorkingHours(checkIn, checkOut) {
  const checkInMoment = moment(checkIn);
  const checkOutMoment = moment(checkOut);
  
  const totalHours = checkOutMoment.diff(checkInMoment, 'hours', true);
  const breakHours = 1; // Assume 1 hour break
  const productiveHours = Math.max(0, totalHours - breakHours);
  
  const regularHours = Math.min(8, productiveHours);
  const overtimeHours = Math.max(0, productiveHours - 8);
  
  return {
    totalHours: Math.round(totalHours * 100) / 100,
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    productiveHours: Math.round(productiveHours * 100) / 100,
    breakHours: breakHours
  };
}

function calculateOvertimePay(employee, overtimeHours) {
  const monthlySalary = employee.salaryStructure?.ctc ? employee.salaryStructure.ctc / 12 : 50000;
  const hourlyRate = monthlySalary / (30 * 8); // Assuming 30 days, 8 hours per day
  return Math.round(overtimeHours * hourlyRate * 1.5); // 1.5x overtime rate
}

function getRandomLateReason() {
  const reasons = [
    'Traffic jam',
    'Public transport delay',
    'Personal emergency',
    'Medical appointment',
    'Vehicle breakdown',
    'Weather conditions',
    'Family commitment'
  ];
  return reasons[Math.floor(Math.random() * reasons.length)];
}

function generateBreaks(checkIn, checkOut) {
  const breaks = [];
  const checkInMoment = moment(checkIn);
  const checkOutMoment = moment(checkOut);
  
  // Lunch break (usually around 1-2 PM)
  const lunchStart = checkInMoment.clone().hour(13).minute(Math.floor(Math.random() * 30));
  const lunchEnd = lunchStart.clone().add(45 + Math.floor(Math.random() * 30), 'minutes'); // 45-75 minutes
  
  if (lunchStart.isBefore(checkOutMoment) && lunchEnd.isBefore(checkOutMoment)) {
    breaks.push({
      startTime: lunchStart.toDate(),
      endTime: lunchEnd.toDate(),
      duration: lunchEnd.diff(lunchStart, 'minutes'),
      type: 'lunch',
      location: 'Cafeteria'
    });
  }
  
  // Tea break (optional, 30% chance)
  if (Math.random() < 0.3) {
    const teaStart = checkInMoment.clone().hour(16).minute(Math.floor(Math.random() * 30));
    const teaEnd = teaStart.clone().add(10 + Math.floor(Math.random() * 10), 'minutes'); // 10-20 minutes
    
    if (teaStart.isBefore(checkOutMoment) && teaEnd.isBefore(checkOutMoment)) {
      breaks.push({
        startTime: teaStart.toDate(),
        endTime: teaEnd.toDate(),
        duration: teaEnd.diff(teaStart, 'minutes'),
        type: 'tea',
        location: 'Pantry'
      });
    }
  }
  
  return breaks;
}

async function generateAttendanceSummary() {
  const summary = await Attendance.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalHours: { $sum: '$workingHours.productiveHours' },
        overtimeHours: { $sum: '$workingHours.overtimeHours' }
      }
    }
  ]);

  const result = {
    present: 0,
    absent: 0,
    halfDay: 0,
    wfh: 0,
    onLeave: 0,
    holiday: 0,
    totalHours: 0,
    overtimeHours: 0
  };

  summary.forEach(item => {
    switch (item._id) {
      case 'present':
        result.present = item.count;
        break;
      case 'absent':
        result.absent = item.count;
        break;
      case 'half-day':
        result.halfDay = item.count;
        break;
      case 'work-from-home':
        result.wfh = item.count;
        break;
      case 'on-leave':
        result.onLeave = item.count;
        break;
      case 'holiday':
        result.holiday = item.count;
        break;
    }
    result.totalHours += item.totalHours || 0;
    result.overtimeHours += item.overtimeHours || 0;
  });

  result.totalHours = Math.round(result.totalHours);
  result.overtimeHours = Math.round(result.overtimeHours);

  return result;
}

// Run the seeding
connectDB().then(() => {
  seedAttendanceData();
});