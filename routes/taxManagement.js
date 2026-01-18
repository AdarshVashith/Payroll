const express = require('express');
const supabase = require('../config/supabase');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/:employeeId', auth, async (req, res) => {
  try {
    const { data: taxRecord, error } = await supabase
      .from('tax_management')
      .select('*')
      .eq('employee_id', req.params.employeeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json(taxRecord || {});
  } catch (error) {
    console.error('Get tax error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;