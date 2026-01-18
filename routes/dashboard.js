const express = require('express');
const supabase = require('../config/supabase');
const { auth, authorize } = require('../middleware/auth');
const moment = require('moment');

const router = express.Router();

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const currentMonth = moment().startOf('month').toISOString();

    // Total Employees
    const { count: totalEmployees } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // New Employees This Month
    const { count: newEmployees } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .gte('date_of_joining', currentMonth);

    // Pending Leaves
    const { count: pendingLeaves } = await supabase
      .from('leaves')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Pending Expenses
    const { count: pendingExpenses } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'submitted');

    // Attendance for today
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('status')
      .eq('date', moment().format('YYYY-MM-DD'));

    const attendanceStats = {
      present: attendanceData?.filter(a => a.status === 'present').length || 0,
      absent: attendanceData?.filter(a => a.status === 'absent').length || 0,
    };

    // Department Distribution
    const { data: deptData } = await supabase
      .from('employees')
      .select('department')
      .eq('status', 'active');

    const departments = {};
    deptData?.forEach(emp => {
      departments[emp.department] = (departments[emp.department] || 0) + 1;
    });

    const formattedDepts = Object.keys(departments).map(dept => ({
      _id: dept,
      count: departments[dept]
    }));

    res.json({
      employees: {
        total: totalEmployees || 0,
        newThisMonth: newEmployees || 0
      },
      leaves: {
        pending: pendingLeaves || 0
      },
      expenses: {
        pending: pendingExpenses || 0
      },
      attendance: attendanceStats,
      departments: formattedDepts
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
    // Recent Employees
    const { data: recentEmployees } = await supabase
      .from('employees')
      .select('first_name, last_name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    // Recent Leaves
    const { data: recentLeaves } = await supabase
      .from('leaves')
      .select('*, employees(first_name, last_name)')
      .order('applied_at', { ascending: false })
      .limit(5);

    const activities = [
      ...(recentEmployees || []).map(emp => ({
        type: 'employee_added',
        description: `New employee ${emp.first_name} ${emp.last_name} joined`,
        date: emp.created_at
      })),
      ...(recentLeaves || []).map(leave => ({
        type: 'leave_request',
        description: `${leave.employees?.first_name} ${leave.employees?.last_name} requested ${leave.leave_type} leave`,
        date: leave.applied_at
      }))
    ];

    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(activities.slice(0, 10));
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;