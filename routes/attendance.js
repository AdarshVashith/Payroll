const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { auth, authorize } = require('../middleware/auth');
const moment = require('moment');
const { mapAttendance } = require('../utils/mappers');

const router = express.Router();

// @route   GET /api/attendance
// @desc    Get attendance records
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, employeeId, startDate, endDate, status } = req.query;

    let query = supabase.from('attendance').select('*, employees(*)', { count: 'exact' });

    if (employeeId) query = query.eq('employee_id', employeeId);
    if (status) query = query.eq('status', status);
    if (startDate && endDate) query = query.gte('date', startDate).lte('date', endDate);

    const start = (page - 1) * limit;
    const end = start + parseInt(limit) - 1;

    const { data: attendanceRecords, count, error } = await query
      .range(start, end)
      .order('date', { ascending: false });

    if (error) throw error;

    res.json({
      attendanceRecords: (attendanceRecords || []).map(mapAttendance),
      totalPages: Math.ceil((count || 0) / limit),
      currentPage: parseInt(page),
      total: count || 0
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/attendance/checkin
// @desc    Check in employee
// @access  Private
router.post('/checkin', [auth, [
  body('employeeId').notEmpty().withMessage('Employee ID is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { employeeId } = req.body;
    const today = moment().format('YYYY-MM-DD');

    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .single();

    if (existingAttendance && existingAttendance.check_in) {
      return res.status(400).json({ message: 'Already checked in today' });
    }

    let result;
    if (existingAttendance) {
      const { data, error } = await supabase
        .from('attendance')
        .update({ check_in: new Date().toISOString(), status: 'present' })
        .eq('id', existingAttendance.id)
        .select('*, employees(*)').single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('attendance')
        .insert([{
          employee_id: employeeId,
          date: today,
          check_in: new Date().toISOString(),
          status: 'present'
        }])
        .select('*, employees(*)').single();
      if (error) throw error;
      result = data;
    }

    res.json({
      message: 'Checked in successfully',
      attendance: mapAttendance(result)
    });
  } catch (error) {
    console.error('Check in error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/attendance/checkout
// @desc    Check out employee
// @access  Private
router.post('/checkout', [auth, [
  body('employeeId').notEmpty().withMessage('Employee ID is required')
]], async (req, res) => {
  try {
    const { employeeId } = req.body;
    const today = moment().format('YYYY-MM-DD');

    const { data: attendance, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .single();

    if (!attendance || fetchError) return res.status(400).json({ message: 'No check-in record found for today' });

    const { data: result, error: updateError } = await supabase
      .from('attendance')
      .update({ check_out: new Date().toISOString() })
      .eq('id', attendance.id)
      .select('*, employees(*)').single();

    if (updateError) throw updateError;

    res.json({
      message: 'Checked out successfully',
      attendance: mapAttendance(result)
    });
  } catch (error) {
    console.error('Check out error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/employee/:employeeId/today', auth, async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');
    const { data: attendance, error } = await supabase
      .from('attendance')
      .select('*, employees(*)')
      .eq('employee_id', req.params.employeeId)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json(mapAttendance(attendance));
  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;