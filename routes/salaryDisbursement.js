const express = require('express');
const supabase = require('../config/supabase');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { data: disbursements, error } = await supabase
      .from('salary_disbursements')
      .select('*, employees(*)')
      .order('paid_at', { ascending: false });

    if (error) throw error;
    res.json(disbursements);
  } catch (error) {
    console.error('Get disbursements error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;