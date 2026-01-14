const express = require('express');
const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Expense = require('../models/Expense');
const { auth, authorize } = require('../middleware/auth');
const moment = require('moment');

const router = express.Router();

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const currentMonth = moment().startOf('month');
    const currentYear = moment().startOf('year');
    
    // Employee statistics
    const totalEmployees = await Employee.countDocuments({ 'employment.status': 'active' });
    const newEmployeesThisMonth = await Employee.countDocuments({
      'employment.status': 'active',
      'employment.dateOfJoining': { $gte: currentMonth.toDate() }
    });

    // Attendance statistics for today
    const today = moment().startOf('day');
    const todayAttendance = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: today.toDate(), $lt: moment(today).add(1, 'day').toDate() }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const attendanceStats = {
      present: 0,
      absent: 0,
      late: 0,
      total: totalEmployees
    };

    todayAttendance.forEach(stat => {
      attendanceStats[stat._id] = stat.count;
    });

    // Leave statistics
    const pendingLeaves = await Leave.countDocuments({ status: 'pending' });
    const approvedLeavesToday = await Leave.countDocuments({
      status: 'approved',
      startDate: { $lte: today.toDate() },
      endDate: { $gte: today.toDate() }
    });

    // Payroll statistics
    const currentMonthPayroll = await Payroll.aggregate([
      {
        $match: {
          'payPeriod.startDate': { $gte: currentMonth.toDate() },
          status: { $in: ['processed', 'paid'] }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$netPay' },
          count: { $sum: 1 }
        }
      }
    ]);

    const payrollStats = currentMonthPayroll[0] || { totalAmount: 0, count: 0 };

    // Expense statistics
    const pendingExpenses = await Expense.countDocuments({ status: 'submitted' });
    const monthlyExpenses = await Expense.aggregate([
      {
        $match: {
          expenseDate: { $gte: currentMonth.toDate() },
          status: { $in: ['approved', 'paid'] }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const expenseStats = monthlyExpenses[0] || { totalAmount: 0, count: 0 };

    // Department-wise employee distribution
    const departmentStats = await Employee.aggregate([
      {
        $match: { 'employment.status': 'active' }
      },
      {
        $group: {
          _id: '$employment.department',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      employees: {
        total: totalEmployees,
        newThisMonth: newEmployeesThisMonth
      },
      attendance: attendanceStats,
      leaves: {
        pending: pendingLeaves,
        onLeaveToday: approvedLeavesToday
      },
      payroll: {
        monthlyTotal: payrollStats.totalAmount,
        processedCount: payrollStats.count
      },
      expenses: {
        pending: pendingExpenses,
        monthlyTotal: expenseStats.totalAmount,
        monthlyCount: expenseStats.count
      },
      departments: departmentStats
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/recent-activities
// @desc    Get recent activities
// @access  Private
router.get('/recent-activities', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // Recent employee additions
    const recentEmployees = await Employee.find({ 'employment.status': 'active' })
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('employeeId personalInfo employment createdAt');

    // Recent leave requests
    const recentLeaves = await Leave.find()
      .populate('employeeId', 'employeeId personalInfo')
      .sort({ appliedDate: -1 })
      .limit(5)
      .select('leaveType startDate endDate status appliedDate');

    // Recent expense claims
    const recentExpenses = await Expense.find()
      .populate('employeeId', 'employeeId personalInfo')
      .sort({ submittedDate: -1 })
      .limit(5)
      .select('expenseType amount status submittedDate');

    // Recent payroll processing
    const recentPayrolls = await Payroll.find()
      .populate('employeeId', 'employeeId personalInfo')
      .sort({ processedDate: -1 })
      .limit(5)
      .select('netPay status processedDate payPeriod');

    const activities = [
      ...recentEmployees.filter(emp => emp && emp.personalInfo).map(emp => ({
        type: 'employee_added',
        description: `New employee ${emp.personalInfo.firstName} ${emp.personalInfo.lastName} joined`,
        date: emp.createdAt,
        data: emp
      })),
      ...recentLeaves.filter(leave => leave && leave.employeeId && leave.employeeId.personalInfo).map(leave => ({
        type: 'leave_request',
        description: `${leave.employeeId.personalInfo.firstName} ${leave.employeeId.personalInfo.lastName} requested ${leave.leaveType} leave`,
        date: leave.appliedDate,
        data: leave
      })),
      ...recentExpenses.filter(expense => expense && expense.employeeId && expense.employeeId.personalInfo).map(expense => ({
        type: 'expense_claim',
        description: `${expense.employeeId.personalInfo.firstName} ${expense.employeeId.personalInfo.lastName} submitted ${expense.expenseType} expense`,
        date: expense.submittedDate,
        data: expense
      })),
      ...recentPayrolls.filter(payroll => payroll && payroll.employeeId && payroll.employeeId.personalInfo).map(payroll => ({
        type: 'payroll_processed',
        description: `Payroll processed for ${payroll.employeeId.personalInfo.firstName} ${payroll.employeeId.personalInfo.lastName}`,
        date: payroll.processedDate,
        data: payroll
      }))
    ];

    // Sort by date and limit
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    const limitedActivities = activities.slice(0, limit);

    res.json(limitedActivities);
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/charts/attendance
// @desc    Get attendance chart data
// @access  Private
router.get('/charts/attendance', auth, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    let startDate, groupBy;

    if (period === 'week') {
      startDate = moment().startOf('week');
      groupBy = { $dayOfWeek: '$date' };
    } else if (period === 'month') {
      startDate = moment().startOf('month');
      groupBy = { $dayOfMonth: '$date' };
    } else {
      startDate = moment().startOf('year');
      groupBy = { $month: '$date' };
    }

    const attendanceData = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startDate.toDate() }
        }
      },
      {
        $group: {
          _id: {
            period: groupBy,
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.period',
          data: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json(attendanceData);
  } catch (error) {
    console.error('Get attendance chart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/charts/payroll
// @desc    Get payroll chart data
// @access  Private
router.get('/charts/payroll', auth, async (req, res) => {
  try {
    const { period = 'year' } = req.query;
    let startDate, groupBy;

    if (period === 'year') {
      startDate = moment().startOf('year');
      groupBy = { $month: '$payPeriod.startDate' };
    } else {
      startDate = moment().subtract(12, 'months').startOf('month');
      groupBy = {
        year: { $year: '$payPeriod.startDate' },
        month: { $month: '$payPeriod.startDate' }
      };
    }

    const payrollData = await Payroll.aggregate([
      {
        $match: {
          'payPeriod.startDate': { $gte: startDate.toDate() },
          status: { $in: ['processed', 'paid'] }
        }
      },
      {
        $group: {
          _id: groupBy,
          totalGross: { $sum: '$earnings.totalEarnings' },
          totalNet: { $sum: '$netPay' },
          totalDeductions: { $sum: '$deductions.totalDeductions' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json(payrollData);
  } catch (error) {
    console.error('Get payroll chart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/charts/employee-growth
// @desc    Get employee growth chart data
// @access  Private
router.get('/charts/employee-growth', auth, async (req, res) => {
  try {
    const { period = 'year' } = req.query;
    let startDate, groupBy, dateFormat;

    if (period === 'year') {
      startDate = moment().subtract(11, 'months').startOf('month');
      groupBy = {
        year: { $year: '$employment.dateOfJoining' },
        month: { $month: '$employment.dateOfJoining' }
      };
      dateFormat = 'YYYY-MM';
    } else if (period === '6months') {
      startDate = moment().subtract(5, 'months').startOf('month');
      groupBy = {
        year: { $year: '$employment.dateOfJoining' },
        month: { $month: '$employment.dateOfJoining' }
      };
      dateFormat = 'YYYY-MM';
    } else {
      startDate = moment().subtract(2, 'years').startOf('year');
      groupBy = { $year: '$employment.dateOfJoining' };
      dateFormat = 'YYYY';
    }

    // Get employees joined by period
    const employeeGrowth = await Employee.aggregate([
      {
        $match: {
          'employment.dateOfJoining': { $gte: startDate.toDate() },
          'employment.status': 'active'
        }
      },
      {
        $group: {
          _id: groupBy,
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Generate complete date range with zero values for missing months
    const result = [];
    const current = moment(startDate);
    const end = moment();

    while (current.isSameOrBefore(end, period === 'year' || period === '6months' ? 'month' : 'year')) {
      const periodKey = period === 'year' || period === '6months' 
        ? { year: current.year(), month: current.month() + 1 }
        : current.year();
      
      const found = employeeGrowth.find(item => {
        if (period === 'year' || period === '6months') {
          return item._id.year === periodKey.year && item._id.month === periodKey.month;
        } else {
          return item._id === periodKey;
        }
      });

      result.push({
        period: period === 'year' || period === '6months' 
          ? current.format('MMM YYYY')
          : current.format('YYYY'),
        count: found ? found.count : 0,
        cumulative: 0 // Will be calculated below
      });

      if (period === 'year' || period === '6months') {
        current.add(1, 'month');
      } else {
        current.add(1, 'year');
      }
    }

    // Calculate cumulative totals
    let cumulative = 0;
    const totalEmployeesAtStart = await Employee.countDocuments({
      'employment.dateOfJoining': { $lt: startDate.toDate() },
      'employment.status': 'active'
    });
    
    cumulative = totalEmployeesAtStart;
    
    result.forEach(item => {
      cumulative += item.count;
      item.cumulative = cumulative;
    });

    res.json(result);
  } catch (error) {
    console.error('Get employee growth chart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;