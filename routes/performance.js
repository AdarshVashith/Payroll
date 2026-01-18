const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/reviews', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, employeeId, status } = req.query;
    let query = supabase.from('performance_reviews').select('*, employees(*)', { count: 'exact' });
    if (employeeId) query = query.eq('employee_id', employeeId);
    if (status) query = query.eq('status', status);

    const start = (page - 1) * limit;
    const end = start + parseInt(limit) - 1;
    const { data: reviews, count, error } = await query.range(start, end).order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ reviews, totalPages: Math.ceil(count / limit), currentPage: parseInt(page), total: count });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/reviews', [auth, authorize(['admin', 'hr'])], async (req, res) => {
  try {
    const { employeeId, reviewPeriodStart, reviewPeriodEnd, rating, feedback } = req.body;
    const { data: review, error } = await supabase.from('performance_reviews').insert([{
      employee_id: employeeId,
      review_period_start: reviewPeriodStart,
      review_period_end: reviewPeriodEnd,
      rating,
      feedback,
      status: 'completed',
      reviewed_at: new Date().toISOString()
    }]).select().single();

    if (error) throw error;
    res.status(201).json({ message: 'Review created', review });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;