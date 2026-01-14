const express = require('express');
const { body, validationResult } = require('express-validator');
const PayrollCycle = require('../models/PayrollCycle');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Payslip = require('../models/Payslip');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/payroll-cycle
// @desc    Get all payroll cycles
// @access  Private (HR/Admin)
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, year } = req.query;
    
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (year) {
      query['payPeriod.year'] = parseInt(year);
    }

    const cycles = await PayrollCycle.find(query)
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ 'payPeriod.year': -1, 'payPeriod.month': -1 });

    const total = await PayrollCycle.countDocuments(query);

    res.json({
      cycles,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get payroll cycles error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/payroll-cycle/:id
// @desc    Get payroll cycle by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const cycle = await PayrollCycle.findById(req.params.id)
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email')
      .populate('approvalWorkflow.approverId', 'username email');

    if (!cycle) {
      return res.status(404).json({ message: 'Payroll cycle not found' });
    }

    res.json(cycle);
  } catch (error) {
    console.error('Get payroll cycle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payroll-cycle
// @desc    Create new payroll cycle
// @access  Private (HR/Admin)
router.post('/', [auth, authorize('admin', 'hr'), [
  body('payPeriod.month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  body('payPeriod.year').isInt({ min: 2020 }).withMessage('Year must be valid'),
  body('payPeriod.startDate').isISO8601().withMessage('Valid start date is required'),
  body('payPeriod.endDate').isISO8601().withMessage('Valid end date is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if cycle already exists for this period
    const existingCycle = await PayrollCycle.findOne({
      'payPeriod.month': req.body.payPeriod.month,
      'payPeriod.year': req.body.payPeriod.year
    });

    if (existingCycle) {
      return res.status(400).json({ message: 'Payroll cycle already exists for this period' });
    }

    const cycle = new PayrollCycle({
      ...req.body,
      createdBy: req.user.userId,
      updatedBy: req.user.userId
    });

    await cycle.save();

    const populatedCycle = await PayrollCycle.findById(cycle._id)
      .populate('createdBy', 'username');

    res.status(201).json({
      message: 'Payroll cycle created successfully',
      cycle: populatedCycle
    });
  } catch (error) {
    console.error('Create payroll cycle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/payroll-cycle/:id
// @desc    Update payroll cycle
// @access  Private (HR/Admin)
router.put('/:id', [auth, authorize('admin', 'hr')], async (req, res) => {
  try {
    const cycle = await PayrollCycle.findById(req.params.id);
    
    if (!cycle) {
      return res.status(404).json({ message: 'Payroll cycle not found' });
    }

    if (['processed', 'disbursed', 'completed'].includes(cycle.status)) {
      return res.status(400).json({ message: 'Cannot modify processed payroll cycle' });
    }

    const updatedCycle = await PayrollCycle.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user.userId },
      { new: true, runValidators: true }
    ).populate('createdBy', 'username');

    res.json({
      message: 'Payroll cycle updated successfully',
      cycle: updatedCycle
    });
  } catch (error) {
    console.error('Update payroll cycle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payroll-cycle/:id/lock-attendance
// @desc    Lock attendance for payroll cycle
// @access  Private (HR/Admin)
router.post('/:id/lock-attendance', [auth, authorize('admin', 'hr')], async (req, res) => {
  try {
    const cycle = await PayrollCycle.findById(req.params.id);
    
    if (!cycle) {
      return res.status(404).json({ message: 'Payroll cycle not found' });
    }

    if (cycle.status !== 'draft') {
      return res.status(400).json({ message: 'Can only lock attendance from draft status' });
    }

    // Validate attendance data exists for the period
    const attendanceCount = await Attendance.countDocuments({
      date: {
        $gte: cycle.payPeriod.startDate,
        $lte: cycle.payPeriod.endDate
      }
    });

    if (attendanceCount === 0) {
      return res.status(400).json({ message: 'No attendance data found for this period' });
    }

    cycle.updateStatus('attendance-locked', req.user.userId, req.body.remarks, req.ip);
    await cycle.save();

    res.json({
      message: 'Attendance locked successfully',
      cycle
    });
  } catch (error) {
    console.error('Lock attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payroll-cycle/:id/calculate
// @desc    Calculate payroll for cycle
// @access  Private (HR/Admin)
router.post('/:id/calculate', [auth, authorize('admin', 'hr')], async (req, res) => {
  try {
    const cycle = await PayrollCycle.findById(req.params.id);
    
    if (!cycle) {
      return res.status(404).json({ message: 'Payroll cycle not found' });
    }

    if (cycle.status !== 'attendance-locked') {
      return res.status(400).json({ message: 'Attendance must be locked before calculation' });
    }

    // Get all active employees
    const employees = await Employee.find({ 'employment.status': 'active' })
      .populate('userId', 'username email');

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let processedCount = 0;
    const errors = [];

    // Calculate payroll for each employee
    for (const employee of employees) {
      try {
        // Get attendance for the period
        const attendance = await Attendance.find({
          employeeId: employee._id,
          date: {
            $gte: cycle.payPeriod.startDate,
            $lte: cycle.payPeriod.endDate
          }
        });

        // Calculate attendance summary
        const totalWorkingDays = 22; // Assuming 22 working days per month
        const presentDays = attendance.filter(a => a.status === 'present').length;
        const absentDays = attendance.filter(a => a.status === 'absent').length;
        const halfDays = attendance.filter(a => a.status === 'half-day').length;

        // Calculate pro-rata salary
        const actualWorkingDays = presentDays + (halfDays * 0.5);
        const proRataRatio = actualWorkingDays / totalWorkingDays;

        // Calculate earnings
        const basicSalary = Math.round((employee.salaryStructure.basicSalary / 12) * proRataRatio);
        const hra = Math.round((employee.salaryStructure.hra / 12) * proRataRatio);
        const specialAllowance = Math.round((employee.salaryStructure.specialAllowance / 12) * proRataRatio);
        const transportAllowance = employee.salaryStructure.transportAllowance || 1600;
        const medicalAllowance = employee.salaryStructure.medicalAllowance || 1250;

        const grossEarnings = basicSalary + hra + specialAllowance + transportAllowance + medicalAllowance;

        // Calculate deductions
        const pf = Math.round(basicSalary * 0.12);
        const esi = employee.salaryStructure.ctc <= 252000 ? Math.round(grossEarnings * 0.0075) : 0;
        const pt = employee.salaryStructure.professionalTax || 200;
        const tds = employee.salaryStructure.incomeTax || 0;

        const totalDeduction = pf + esi + pt + tds;
        const netSalary = grossEarnings - totalDeduction;

        // Create or update payslip
        const payslipData = {
          employeeId: employee._id,
          payrollCycleId: cycle._id,
          payPeriod: {
            month: cycle.payPeriod.month,
            year: cycle.payPeriod.year,
            startDate: cycle.payPeriod.startDate,
            endDate: cycle.payPeriod.endDate,
            payDate: new Date(cycle.payPeriod.endDate.getTime() + 5 * 24 * 60 * 60 * 1000) // 5 days after period end
          },
          employeeDetails: {
            employeeId: employee.employeeId,
            fullName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
            designation: employee.employment.designation,
            department: employee.employment.department,
            dateOfJoining: employee.employment.dateOfJoining,
            panNumber: employee.personalInfo.panNumber,
            pfNumber: employee.taxInfo.pfNumber,
            esiNumber: employee.taxInfo.esiNumber,
            uanNumber: employee.taxInfo.uanNumber,
            bankAccount: {
              accountNumber: employee.bankDetails.accountNumber,
              ifscCode: employee.bankDetails.ifscCode,
              bankName: employee.bankDetails.bankName
            }
          },
          attendanceDetails: {
            totalWorkingDays,
            actualWorkingDays,
            presentDays,
            absentDays,
            halfDays,
            weeklyOffs: 8, // Assuming 8 weekly offs per month
            holidays: 2, // Assuming 2 holidays per month
            paidLeaves: 0,
            unpaidLeaves: Math.max(0, absentDays - 2), // Allow 2 casual leaves
            overtimeHours: 0,
            lateComingDays: 0
          },
          salaryStructure: {
            ctc: employee.salaryStructure.ctc,
            basicSalary: employee.salaryStructure.basicSalary,
            earnings: {
              basic: basicSalary,
              hra,
              specialAllowance,
              transportAllowance,
              medicalAllowance,
              lunchAllowance: 0,
              phoneAllowance: 0,
              internetAllowance: 0,
              performanceBonus: 0,
              incentives: 0,
              overtimePay: 0,
              arrears: 0,
              customEarnings: [],
              totalEarnings: grossEarnings
            },
            deductions: {
              providentFund: pf,
              esi,
              professionalTax: pt,
              incomeTax: tds,
              loanDeduction: 0,
              advanceDeduction: 0,
              lateComingFine: 0,
              lopDeduction: 0,
              customDeductions: [],
              totalDeductions: totalDeduction
            },
            netSalary
          },
          status: 'calculated',
          createdBy: req.user.userId,
          updatedBy: req.user.userId
        };

        // Check if payslip already exists
        const existingPayslip = await Payslip.findOne({
          employeeId: employee._id,
          payrollCycleId: cycle._id
        });

        if (existingPayslip) {
          await Payslip.findByIdAndUpdate(existingPayslip._id, payslipData);
        } else {
          await Payslip.create(payslipData);
        }

        totalGross += grossEarnings;
        totalDeductions += totalDeduction;
        totalNet += netSalary;
        processedCount++;

      } catch (error) {
        console.error(`Error calculating payroll for employee ${employee.employeeId}:`, error);
        errors.push({
          employeeId: employee._id,
          errorType: 'calculation_error',
          errorMessage: error.message,
          isResolved: false
        });
      }
    }

    // Update cycle summary
    cycle.summary = {
      totalEmployees: employees.length,
      activeEmployees: employees.length,
      processedEmployees: processedCount,
      totalGrossSalary: totalGross,
      totalDeductions,
      totalNetSalary: totalNet,
      totalPF: Math.round(totalGross * 0.12),
      totalESI: Math.round(totalGross * 0.0075),
      totalPT: processedCount * 200,
      totalTDS: 0
    };

    cycle.errors = errors;
    cycle.updateStatus('calculated', req.user.userId, req.body.remarks, req.ip);
    await cycle.save();

    res.json({
      message: 'Payroll calculated successfully',
      cycle,
      summary: {
        processedEmployees: processedCount,
        totalEmployees: employees.length,
        totalGross,
        totalNet,
        errors: errors.length
      }
    });
  } catch (error) {
    console.error('Calculate payroll error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payroll-cycle/:id/approve
// @desc    Approve payroll cycle
// @access  Private (Admin)
router.post('/:id/approve', [auth, authorize('admin')], async (req, res) => {
  try {
    const cycle = await PayrollCycle.findById(req.params.id);
    
    if (!cycle) {
      return res.status(404).json({ message: 'Payroll cycle not found' });
    }

    if (cycle.status !== 'reviewed') {
      return res.status(400).json({ message: 'Payroll must be reviewed before approval' });
    }

    if (!cycle.canProcess()) {
      return res.status(400).json({ message: 'Payroll cycle has unresolved errors' });
    }

    cycle.updateStatus('approved', req.user.userId, req.body.remarks, req.ip);
    await cycle.save();

    // Update all payslips to approved status
    await Payslip.updateMany(
      { payrollCycleId: cycle._id },
      { status: 'approved', updatedBy: req.user.userId }
    );

    res.json({
      message: 'Payroll cycle approved successfully',
      cycle
    });
  } catch (error) {
    console.error('Approve payroll cycle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payroll-cycle/:id/process
// @desc    Process payroll cycle (generate payslips)
// @access  Private (HR/Admin)
router.post('/:id/process', [auth, authorize('admin', 'hr')], async (req, res) => {
  try {
    const cycle = await PayrollCycle.findById(req.params.id);
    
    if (!cycle) {
      return res.status(404).json({ message: 'Payroll cycle not found' });
    }

    if (cycle.status !== 'approved') {
      return res.status(400).json({ message: 'Payroll must be approved before processing' });
    }

    // Update payslips to processed status
    await Payslip.updateMany(
      { payrollCycleId: cycle._id },
      { status: 'processed', updatedBy: req.user.userId }
    );

    cycle.updateStatus('processed', req.user.userId, req.body.remarks, req.ip);
    await cycle.save();

    res.json({
      message: 'Payroll cycle processed successfully',
      cycle
    });
  } catch (error) {
    console.error('Process payroll cycle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/payroll-cycle/:id/payslips
// @desc    Get payslips for payroll cycle
// @access  Private
router.get('/:id/payslips', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, department, status } = req.query;
    
    let query = { payrollCycleId: req.params.id };
    
    if (status) {
      query.status = status;
    }

    const payslips = await Payslip.find(query)
      .populate('employeeId', 'employeeId personalInfo employment')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ 'employeeDetails.fullName': 1 });

    // Filter by department if specified
    let filteredPayslips = payslips;
    if (department) {
      filteredPayslips = payslips.filter(p => p.employeeId.employment.department === department);
    }

    const total = await Payslip.countDocuments(query);

    res.json({
      payslips: filteredPayslips,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get cycle payslips error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/payroll-cycle/current
// @desc    Get current payroll cycle
// @access  Private
router.get('/current', auth, async (req, res) => {
  try {
    const currentCycle = await PayrollCycle.getCurrentCycle();
    
    if (!currentCycle) {
      return res.status(404).json({ message: 'No current payroll cycle found' });
    }

    res.json(currentCycle);
  } catch (error) {
    console.error('Get current cycle error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;