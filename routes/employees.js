const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { auth, authorize } = require('../middleware/auth');
const { mapEmployee } = require('../utils/mappers');

const router = express.Router();

// @route   GET /api/employees
// @desc    Get all employees
// @access  Private (HR/Admin)
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, department, status, search } = req.query;

    let query = supabase.from('employees').select('*, users(username, email, role)', { count: 'exact' });

    if (department) query = query.eq('department', department);
    if (status) query = query.eq('status', status);
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_id.ilike.%${search}%`);
    }

    const start = (page - 1) * limit;
    const end = start + parseInt(limit) - 1;

    const { data: employees, count, error } = await query
      .range(start, end)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      employees: employees.map(mapEmployee),
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/employees/:id
// @desc    Get employee by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const { data: employee, error } = await supabase
      .from('employees')
      .select('*, users(username, email, role)')
      .eq('id', req.params.id)
      .single();

    if (!employee || error) return res.status(404).json({ message: 'Employee not found' });

    res.json(mapEmployee(employee));
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/employees
// @desc    Create new employee
// @access  Private (Admin)
router.post('/', [auth, authorize('admin')], async (req, res) => {
  try {
    const { employeeId, personalInfo, employment, salaryStructure, bankDetails } = req.body;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('employee123', salt);

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert([{
        username: employeeId,
        email: personalInfo.email,
        password: hashedPassword,
        role: 'employee'
      }])
      .select().single();

    if (userError) throw userError;

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .insert([{
        user_id: newUser.id,
        employee_id: employeeId,
        first_name: personalInfo.firstName,
        last_name: personalInfo.lastName,
        email: personalInfo.email,
        phone: personalInfo.phone,
        department: employment.department,
        designation: employment.designation,
        role: employment.role,
        employment_type: employment.employmentType,
        date_of_joining: employment.dateOfJoining,
        status: employment.status || 'active',
        ctc: salaryStructure.ctc,
        basic_salary: salaryStructure.basicSalary,
        bank_details: bankDetails
      }])
      .select().single();

    if (empError) throw empError;

    res.status(201).json({
      message: 'Employee created successfully',
      employee: mapEmployee(employee)
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const { error } = await supabase
      .from('employees')
      .update({ status: 'exited' })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Employee terminated successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;