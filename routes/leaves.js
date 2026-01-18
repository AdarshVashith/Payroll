const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { auth, authorize } = require('../middleware/auth');
const moment = require('moment');
const { mapLeave } = require('../utils/mappers');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, employeeId, status } = req.query;

    let query = supabase.from('leaves').select('*, employees(*)', { count: 'exact' });

    if (employeeId) query = query.eq('employee_id', employeeId);
    if (status) query = query.eq('status', status);

    const start = (page - 1) * limit;
    const end = start + parseInt(limit) - 1;

    const { data: leaves, count, error } = await query
      .range(start, end)
      .order('applied_at', { ascending: false });

    if (error) throw error;

    res.json({
      leaves: (leaves || []).map(mapLeave),
      totalPages: Math.ceil((count || 0) / limit),
      currentPage: parseInt(page),
      total: count || 0
    });
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', [auth, [
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('leaveType').notEmpty().withMessage('Leave type is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { employeeId, leaveType, startDate, endDate, reason } = req.body;
    const totalDays = moment(endDate).diff(moment(startDate), 'days') + 1;

    const { data: leave, error } = await supabase
      .from('leaves')
      .insert([{
        employee_id: employeeId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason,
        total_days: totalDays,
        status: 'pending'
      }])
      .select('*, employees(*)').single();

    if (error) throw error;

    res.status(201).json({
      message: 'Leave application submitted successfully',
      leave: mapLeave(leave)
    });
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/status', [auth, authorize(['admin', 'hr'])], async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const { data: leave, error } = await supabase
      .from('leaves')
      .update({ status, remarks })
      .eq('id', req.params.id)
      .select('*, employees(*)').single();

    if (error) throw error;
    res.json({ message: `Leave ${status} successfully`, leave: mapLeave(leave) });
  } catch (error) {
    console.error('Update leave status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;