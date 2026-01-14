const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Employee = require('../models/Employee');
const SalaryStructure = require('../models/SalaryStructure');
const PayrollCycle = require('../models/PayrollCycle');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hr_payroll');
    console.log('MongoDB Connected for seeding...');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Employee.deleteMany({});
    await SalaryStructure.deleteMany({});
    await PayrollCycle.deleteMany({});
    await Attendance.deleteMany({});
    await Leave.deleteMany({});
    
    console.log('Cleared existing data...');

    // Create admin user
    const adminUser = new User({
      username: 'admin',
      email: 'admin@hrpro.com',
      password: 'admin123',
      role: 'admin'
    });
    await adminUser.save();

    // Create HR user
    const hrUser = new User({
      username: 'hr_manager',
      email: 'hr@hrpro.com',
      password: 'hr123456',
      role: 'hr'
    });
    await hrUser.save();

    // Create sample employees with enhanced data
    const employees = [
      {
        employeeId: 'EMP001',
        userId: adminUser._id,
        personalInfo: {
          firstName: 'Rajesh',
          lastName: 'Kumar',
          email: 'rajesh.kumar@hrpro.com',
          phone: '+91-9876543210',
          dateOfBirth: new Date('1990-05-15'),
          gender: 'male',
          maritalStatus: 'married',
          address: {
            street: '123 MG Road',
            city: 'Bangalore',
            state: 'Karnataka',
            zipCode: '560001',
            country: 'India'
          },
          emergencyContact: {
            name: 'Priya Kumar',
            relationship: 'Spouse',
            phone: '+91-9876543211'
          },
          panNumber: 'ABCDE1234F',
          aadhaarNumber: '1234 5678 9012',
          passportNumber: 'A1234567'
        },
        employment: {
          department: 'Engineering',
          designation: 'Senior Software Engineer',
          role: 'Full Stack Developer',
          employmentType: 'full-time',
          dateOfJoining: new Date('2022-01-15'),
          managerId: null,
          workLocation: 'Bangalore Office',
          status: 'active',
          workingDays: 5,
          workingHours: 8
        },
        salaryStructure: {
          ctc: 1200000, // 12 LPA
          basicSalary: 600000, // 50% of CTC
          hra: 240000, // 40% of basic
          specialAllowance: 340800, // Remaining amount
          transportAllowance: 1600,
          medicalAllowance: 1250,
          providentFund: 7200, // 12% of basic (monthly)
          esi: 0, // Not applicable for this salary
          professionalTax: 200,
          incomeTax: 15000,
          currency: 'INR',
          payFrequency: 'monthly',
          effectiveDate: new Date('2022-01-15')
        },
        bankDetails: {
          accountNumber: '1234567890123456',
          ifscCode: 'HDFC0001234',
          bankName: 'HDFC Bank',
          branchName: 'MG Road Branch',
          accountType: 'savings',
          accountHolderName: 'Rajesh Kumar'
        },
        taxInfo: {
          taxRegime: 'new',
          pfNumber: 'KA/BGE/12345/001',
          esiNumber: '',
          uanNumber: '123456789012'
        },
        benefits: {
          healthInsurance: true,
          lifeInsurance: true,
          gratuity: true,
          paidTimeOff: 21,
          sickLeave: 12,
          casualLeave: 12
        },
        leaveBalance: {
          casualLeave: 12,
          sickLeave: 12,
          earnedLeave: 21,
          unpaidLeave: 0
        },
        createdBy: adminUser._id,
        updatedBy: adminUser._id
      },
      {
        employeeId: 'EMP002',
        userId: hrUser._id,
        personalInfo: {
          firstName: 'Priya',
          lastName: 'Sharma',
          email: 'priya.sharma@hrpro.com',
          phone: '+91-9876543220',
          dateOfBirth: new Date('1992-08-22'),
          gender: 'female',
          maritalStatus: 'single',
          address: {
            street: '456 Brigade Road',
            city: 'Bangalore',
            state: 'Karnataka',
            zipCode: '560025',
            country: 'India'
          },
          emergencyContact: {
            name: 'Suresh Sharma',
            relationship: 'Father',
            phone: '+91-9876543221'
          },
          panNumber: 'BCDEF2345G',
          aadhaarNumber: '2345 6789 0123'
        },
        employment: {
          department: 'HR',
          designation: 'HR Manager',
          role: 'Human Resources',
          employmentType: 'full-time',
          dateOfJoining: new Date('2021-03-10'),
          workLocation: 'Bangalore Office',
          status: 'active',
          workingDays: 5,
          workingHours: 8
        },
        salaryStructure: {
          ctc: 900000, // 9 LPA
          basicSalary: 450000,
          hra: 180000,
          specialAllowance: 250800,
          transportAllowance: 1600,
          medicalAllowance: 1250,
          providentFund: 5400,
          esi: 0,
          professionalTax: 200,
          incomeTax: 8000,
          currency: 'INR',
          payFrequency: 'monthly',
          effectiveDate: new Date('2021-03-10')
        },
        bankDetails: {
          accountNumber: '2345678901234567',
          ifscCode: 'ICICI0001234',
          bankName: 'ICICI Bank',
          branchName: 'Brigade Road Branch',
          accountType: 'savings',
          accountHolderName: 'Priya Sharma'
        },
        taxInfo: {
          taxRegime: 'old',
          pfNumber: 'KA/BGE/12345/002',
          uanNumber: '234567890123'
        },
        benefits: {
          healthInsurance: true,
          lifeInsurance: true,
          gratuity: true,
          paidTimeOff: 21,
          sickLeave: 12,
          casualLeave: 12
        },
        leaveBalance: {
          casualLeave: 10,
          sickLeave: 12,
          earnedLeave: 18,
          unpaidLeave: 0
        },
        createdBy: adminUser._id,
        updatedBy: adminUser._id
      },
      {
        employeeId: 'EMP003',
        personalInfo: {
          firstName: 'Amit',
          lastName: 'Patel',
          email: 'amit.patel@hrpro.com',
          phone: '+91-9876543230',
          dateOfBirth: new Date('1988-12-05'),
          gender: 'male',
          maritalStatus: 'married',
          address: {
            street: '789 Commercial Street',
            city: 'Bangalore',
            state: 'Karnataka',
            zipCode: '560001',
            country: 'India'
          },
          panNumber: 'CDEFG3456H',
          aadhaarNumber: '3456 7890 1234'
        },
        employment: {
          department: 'Finance',
          designation: 'Finance Manager',
          role: 'Financial Planning',
          employmentType: 'full-time',
          dateOfJoining: new Date('2020-06-01'),
          workLocation: 'Bangalore Office',
          status: 'active',
          workingDays: 5,
          workingHours: 8
        },
        salaryStructure: {
          ctc: 1500000, // 15 LPA
          basicSalary: 750000,
          hra: 300000,
          specialAllowance: 431000,
          transportAllowance: 1600,
          medicalAllowance: 1250,
          providentFund: 9000,
          esi: 0,
          professionalTax: 200,
          incomeTax: 25000,
          currency: 'INR',
          payFrequency: 'monthly',
          effectiveDate: new Date('2020-06-01')
        },
        bankDetails: {
          accountNumber: '3456789012345678',
          ifscCode: 'SBI0001234',
          bankName: 'State Bank of India',
          branchName: 'Commercial Street Branch',
          accountType: 'savings',
          accountHolderName: 'Amit Patel'
        },
        taxInfo: {
          taxRegime: 'new',
          pfNumber: 'KA/BGE/12345/003',
          uanNumber: '345678901234'
        },
        benefits: {
          healthInsurance: true,
          lifeInsurance: true,
          gratuity: true,
          paidTimeOff: 21,
          sickLeave: 12,
          casualLeave: 12
        },
        leaveBalance: {
          casualLeave: 8,
          sickLeave: 10,
          earnedLeave: 15,
          unpaidLeave: 0
        },
        createdBy: adminUser._id,
        updatedBy: adminUser._id
      },
      {
        employeeId: 'EMP004',
        personalInfo: {
          firstName: 'Sneha',
          lastName: 'Reddy',
          email: 'sneha.reddy@hrpro.com',
          phone: '+91-9876543240',
          dateOfBirth: new Date('1995-03-18'),
          gender: 'female',
          maritalStatus: 'single',
          address: {
            street: '321 Koramangala',
            city: 'Bangalore',
            state: 'Karnataka',
            zipCode: '560034',
            country: 'India'
          },
          panNumber: 'DEFGH4567I',
          aadhaarNumber: '4567 8901 2345'
        },
        employment: {
          department: 'Marketing',
          designation: 'Marketing Executive',
          role: 'Digital Marketing',
          employmentType: 'full-time',
          dateOfJoining: new Date('2023-02-15'),
          workLocation: 'Bangalore Office',
          status: 'active',
          workingDays: 5,
          workingHours: 8
        },
        salaryStructure: {
          ctc: 600000, // 6 LPA
          basicSalary: 300000,
          hra: 120000,
          specialAllowance: 161000,
          transportAllowance: 1600,
          medicalAllowance: 1250,
          providentFund: 3600,
          esi: 1125, // Applicable for this salary range
          professionalTax: 200,
          incomeTax: 2000,
          currency: 'INR',
          payFrequency: 'monthly',
          effectiveDate: new Date('2023-02-15')
        },
        bankDetails: {
          accountNumber: '4567890123456789',
          ifscCode: 'AXIS0001234',
          bankName: 'Axis Bank',
          branchName: 'Koramangala Branch',
          accountType: 'savings',
          accountHolderName: 'Sneha Reddy'
        },
        taxInfo: {
          taxRegime: 'new',
          pfNumber: 'KA/BGE/12345/004',
          esiNumber: 'ESI123456789',
          uanNumber: '456789012345'
        },
        benefits: {
          healthInsurance: true,
          lifeInsurance: false,
          gratuity: true,
          paidTimeOff: 21,
          sickLeave: 12,
          casualLeave: 12
        },
        leaveBalance: {
          casualLeave: 12,
          sickLeave: 12,
          earnedLeave: 21,
          unpaidLeave: 0
        },
        createdBy: adminUser._id,
        updatedBy: adminUser._id
      },
      {
        employeeId: 'EMP005',
        personalInfo: {
          firstName: 'Vikram',
          lastName: 'Singh',
          email: 'vikram.singh@hrpro.com',
          phone: '+91-9876543250',
          dateOfBirth: new Date('1987-09-12'),
          gender: 'male',
          maritalStatus: 'married',
          address: {
            street: '654 Indiranagar',
            city: 'Bangalore',
            state: 'Karnataka',
            zipCode: '560038',
            country: 'India'
          },
          panNumber: 'EFGHI5678J',
          aadhaarNumber: '5678 9012 3456'
        },
        employment: {
          department: 'Sales',
          designation: 'Sales Manager',
          role: 'Business Development',
          employmentType: 'full-time',
          dateOfJoining: new Date('2019-11-20'),
          workLocation: 'Bangalore Office',
          status: 'active',
          workingDays: 5,
          workingHours: 8
        },
        salaryStructure: {
          ctc: 1800000, // 18 LPA
          basicSalary: 900000,
          hra: 360000,
          specialAllowance: 521000,
          transportAllowance: 1600,
          medicalAllowance: 1250,
          providentFund: 10800,
          esi: 0,
          professionalTax: 200,
          incomeTax: 35000,
          currency: 'INR',
          payFrequency: 'monthly',
          effectiveDate: new Date('2019-11-20')
        },
        bankDetails: {
          accountNumber: '5678901234567890',
          ifscCode: 'KOTAK0001234',
          bankName: 'Kotak Mahindra Bank',
          branchName: 'Indiranagar Branch',
          accountType: 'savings',
          accountHolderName: 'Vikram Singh'
        },
        taxInfo: {
          taxRegime: 'old',
          pfNumber: 'KA/BGE/12345/005',
          uanNumber: '567890123456'
        },
        benefits: {
          healthInsurance: true,
          lifeInsurance: true,
          gratuity: true,
          paidTimeOff: 21,
          sickLeave: 12,
          casualLeave: 12
        },
        leaveBalance: {
          casualLeave: 5,
          sickLeave: 8,
          earnedLeave: 12,
          unpaidLeave: 0
        },
        createdBy: adminUser._id,
        updatedBy: adminUser._id
      }
    ];

    // Create employees
    const createdEmployees = [];
    for (const empData of employees) {
      // Create user account for employees without userId
      if (!empData.userId) {
        const user = new User({
          username: empData.employeeId.toLowerCase(),
          email: empData.personalInfo.email,
          password: 'employee123',
          role: 'employee'
        });
        await user.save();
        empData.userId = user._id;
      }
      
      const employee = new Employee(empData);
      await employee.save();
      createdEmployees.push(employee);
    }

    console.log(`Created ${createdEmployees.length} employees...`);

    // Create sample attendance records for the last 30 days
    const attendanceRecords = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      for (const employee of createdEmployees) {
        // 90% attendance rate
        if (Math.random() > 0.1) {
          const checkIn = new Date(date);
          checkIn.setHours(9, Math.floor(Math.random() * 30), 0, 0); // 9:00-9:30 AM
          
          const checkOut = new Date(date);
          checkOut.setHours(18, Math.floor(Math.random() * 60), 0, 0); // 6:00-7:00 PM
          
          const regularHours = (checkOut - checkIn) / (1000 * 60 * 60);
          const overtimeHours = Math.max(0, regularHours - 8);
          
          attendanceRecords.push({
            employeeId: employee._id,
            date: date,
            checkIn: checkIn,
            checkOut: checkOut,
            regularHours: Math.min(8, regularHours),
            overtimeHours: overtimeHours,
            status: 'present',
            workLocation: 'office',
            createdBy: adminUser._id
          });
        }
      }
    }

    await Attendance.insertMany(attendanceRecords);
    console.log(`Created ${attendanceRecords.length} attendance records...`);

    // Create sample leave applications
    const leaveApplications = [
      {
        leaveId: 'LV-202401-001',
        employeeId: createdEmployees[0]._id,
        leaveType: 'casual-leave',
        leaveCategory: 'paid',
        startDate: new Date('2024-01-20'),
        endDate: new Date('2024-01-22'),
        totalDays: 3,
        reason: 'Personal work',
        status: 'approved',
        appliedDate: new Date('2024-01-15'),
        appliedBy: createdEmployees[0].userId,
        approvedBy: hrUser._id,
        approvedDate: new Date('2024-01-16'),
        createdBy: createdEmployees[0].userId,
        updatedBy: hrUser._id
      },
      {
        leaveId: 'LV-202401-002',
        employeeId: createdEmployees[1]._id,
        leaveType: 'sick-leave',
        leaveCategory: 'paid',
        startDate: new Date('2024-01-25'),
        endDate: new Date('2024-01-26'),
        totalDays: 2,
        reason: 'Fever and cold',
        status: 'pending',
        appliedDate: new Date('2024-01-24'),
        appliedBy: createdEmployees[1].userId,
        createdBy: createdEmployees[1].userId,
        updatedBy: createdEmployees[1].userId
      }
    ];

    await Leave.insertMany(leaveApplications);
    console.log(`Created ${leaveApplications.length} leave applications...`);

    console.log('✅ Database seeded successfully with enhanced HR data!');
    console.log('\n📊 Summary:');
    console.log(`👥 Users: ${await User.countDocuments()}`);
    console.log(`👨‍💼 Employees: ${await Employee.countDocuments()}`);
    console.log(`📅 Attendance Records: ${await Attendance.countDocuments()}`);
    console.log(`🏖️ Leave Applications: ${await Leave.countDocuments()}`);
    
    console.log('\n🔐 Login Credentials:');
    console.log('Admin: admin@hrpro.com / admin123');
    console.log('HR Manager: hr@hrpro.com / hr123456');
    console.log('Employee: emp001 / employee123');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the seeding
connectDB().then(() => {
  seedData();
});