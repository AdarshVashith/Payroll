const express = require('express');
const { body, validationResult } = require('express-validator');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const { auth, authorize } = require('../middleware/auth');
const moment = require('moment');

const router = express.Router();

// @route   GET /api/attendance
// @desc    Get attendance records
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, employeeId, startDate, endDate, status } = req.query;
    
    let query = {};
    
    if (employeeId) {
      query.employeeId = employeeId;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const attendanceRecords = await Attendance.find(query)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('approvedBy', 'username')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date: -1 });

    const total = await Attendance.countDocuments(query);

    res.json({
      attendanceRecords,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/attendance/manual-entry
// @desc    Manual attendance entry (Admin/HR only)
// @access  Private (Admin/HR)
router.post('/manual-entry', [auth, authorize(['admin', 'hr']), [
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('status').isIn(['present', 'absent', 'half-day', 'work-from-home', 'on-leave', 'holiday']).withMessage('Invalid status'),
  body('checkIn').optional().isISO8601().withMessage('Valid check-in time required'),
  body('checkOut').optional().isISO8601().withMessage('Valid check-out time required'),
  body('reason').optional().isLength({ min: 3 }).withMessage('Reason must be at least 3 characters')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employeeId, date, status, checkIn, checkOut, reason, workingHours, overtimeHours } = req.body;
    const attendanceDate = moment(date).startOf('day').toDate();

    // Check if employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check if attendance already exists for this date
    let attendance = await Attendance.findOne({
      employeeId,
      date: attendanceDate
    });

    const attendanceData = {
      employeeId,
      date: attendanceDate,
      status,
      manualAdjustment: {
        isAdjusted: true,
        adjustedBy: req.user.id,
        adjustedAt: new Date(),
        adjustmentReason: reason || 'Manual entry by admin/HR'
      },
      createdBy: req.user.id,
      updatedBy: req.user.id
    };

    // Set check-in and check-out times if provided
    if (checkIn) {
      attendanceData.checkIn = {
        time: new Date(checkIn),
        method: 'manual'
      };
    }

    if (checkOut) {
      attendanceData.checkOut = {
        time: new Date(checkOut),
        method: 'manual'
      };
    }

    // Handle different statuses
    switch (status) {
      case 'work-from-home':
        attendanceData.workFromHome = {
          isWFH: true,
          reason: reason || 'Work from home',
          isApproved: true,
          approvedBy: req.user.id,
          approvedAt: new Date()
        };
        break;
      
      case 'half-day':
        // For half-day, set working hours to 4
        attendanceData.workingHours = {
          totalHours: 4,
          regularHours: 4,
          overtimeHours: 0,
          productiveHours: 4
        };
        break;
      
      case 'absent':
        // For absent, set all hours to 0
        attendanceData.workingHours = {
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          productiveHours: 0
        };
        break;
    }

    // Override working hours if provided
    if (workingHours !== undefined) {
      attendanceData.workingHours = {
        totalHours: workingHours,
        regularHours: Math.min(workingHours, 8),
        overtimeHours: Math.max(0, workingHours - 8),
        productiveHours: workingHours
      };
    }

    if (attendance) {
      // Update existing attendance
      attendanceData.manualAdjustment.originalStatus = attendance.status;
      Object.assign(attendance, attendanceData);
      await attendance.save();
    } else {
      // Create new attendance record
      attendance = new Attendance(attendanceData);
      await attendance.save();
    }

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('manualAdjustment.adjustedBy', 'username');

    res.json({
      message: 'Manual attendance entry created successfully',
      attendance: populatedAttendance
    });
  } catch (error) {
    console.error('Manual attendance entry error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/attendance/:id
// @desc    Update attendance record (Admin/HR only)
// @access  Private (Admin/HR)
router.put('/:id', [auth, authorize(['admin', 'hr']), [
  body('status').optional().isIn(['present', 'absent', 'half-day', 'work-from-home', 'on-leave', 'holiday']).withMessage('Invalid status'),
  body('checkIn').optional().isISO8601().withMessage('Valid check-in time required'),
  body('checkOut').optional().isISO8601().withMessage('Valid check-out time required'),
  body('reason').optional().isLength({ min: 3 }).withMessage('Reason must be at least 3 characters')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    const { status, checkIn, checkOut, reason, workingHours } = req.body;

    // Store original status for audit
    const originalStatus = attendance.status;

    // Update fields
    if (status) attendance.status = status;
    if (checkIn) {
      attendance.checkIn = {
        time: new Date(checkIn),
        method: 'manual'
      };
    }
    if (checkOut) {
      attendance.checkOut = {
        time: new Date(checkOut),
        method: 'manual'
      };
    }

    // Mark as manually adjusted
    attendance.manualAdjustment = {
      isAdjusted: true,
      adjustedBy: req.user.id,
      adjustedAt: new Date(),
      originalStatus,
      adjustmentReason: reason || 'Updated by admin/HR'
    };

    attendance.updatedBy = req.user.id;

    await attendance.save();

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('manualAdjustment.adjustedBy', 'username');

    res.json({
      message: 'Attendance record updated successfully',
      attendance: populatedAttendance
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record (Admin only)
// @access  Private (Admin)
router.delete('/:id', [auth, authorize(['admin'])], async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    await Attendance.findByIdAndDelete(req.params.id);

    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/attendance/bulk-entry
// @desc    Bulk attendance entry (Admin/HR only)
// @access  Private (Admin/HR)
router.post('/bulk-entry', [auth, authorize(['admin', 'hr']), [
  body('entries').isArray().withMessage('Entries must be an array'),
  body('entries.*.employeeId').notEmpty().withMessage('Employee ID is required'),
  body('entries.*.date').isISO8601().withMessage('Valid date is required'),
  body('entries.*.status').isIn(['present', 'absent', 'half-day', 'work-from-home', 'on-leave', 'holiday']).withMessage('Invalid status')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { entries, reason } = req.body;
    const results = [];
    const errors_list = [];

    for (const entry of entries) {
      try {
        const { employeeId, date, status, checkIn, checkOut, workingHours } = entry;
        const attendanceDate = moment(date).startOf('day').toDate();

        // Check if employee exists
        const employee = await Employee.findById(employeeId);
        if (!employee) {
          errors_list.push({ employeeId, error: 'Employee not found' });
          continue;
        }

        // Check if attendance already exists
        let attendance = await Attendance.findOne({
          employeeId,
          date: attendanceDate
        });

        const attendanceData = {
          employeeId,
          date: attendanceDate,
          status,
          manualAdjustment: {
            isAdjusted: true,
            adjustedBy: req.user.id,
            adjustedAt: new Date(),
            adjustmentReason: reason || 'Bulk entry by admin/HR'
          },
          createdBy: req.user.id,
          updatedBy: req.user.id
        };

        // Set times if provided
        if (checkIn) {
          attendanceData.checkIn = {
            time: new Date(checkIn),
            method: 'manual'
          };
        }

        if (checkOut) {
          attendanceData.checkOut = {
            time: new Date(checkOut),
            method: 'manual'
          };
        }

        // Handle status-specific logic
        switch (status) {
          case 'half-day':
            attendanceData.workingHours = {
              totalHours: 4,
              regularHours: 4,
              overtimeHours: 0,
              productiveHours: 4
            };
            break;
          case 'absent':
            attendanceData.workingHours = {
              totalHours: 0,
              regularHours: 0,
              overtimeHours: 0,
              productiveHours: 0
            };
            break;
          case 'work-from-home':
            attendanceData.workFromHome = {
              isWFH: true,
              reason: 'Work from home',
              isApproved: true,
              approvedBy: req.user.id,
              approvedAt: new Date()
            };
            break;
        }

        if (attendance) {
          attendanceData.manualAdjustment.originalStatus = attendance.status;
          Object.assign(attendance, attendanceData);
          await attendance.save();
        } else {
          attendance = new Attendance(attendanceData);
          await attendance.save();
        }

        results.push({ employeeId, status: 'success', attendanceId: attendance._id });
      } catch (error) {
        errors_list.push({ employeeId: entry.employeeId, error: error.message });
      }
    }

    res.json({
      message: `Bulk attendance entry completed. ${results.length} successful, ${errors_list.length} failed.`,
      results,
      errors: errors_list
    });
  } catch (error) {
    console.error('Bulk attendance entry error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/attendance/calculate-pay/:employeeId
// @desc    Calculate pay based on attendance
// @access  Private
router.get('/calculate-pay/:employeeId', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const employeeId = req.params.employeeId;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    // Get employee details
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Get attendance records for the period
    const attendanceRecords = await Attendance.find({
      employeeId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });

    // Calculate totals
    let totalWorkingDays = 0;
    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let wfhDays = 0;
    let totalWorkingHours = 0;
    let totalOvertimeHours = 0;
    let lopDays = 0;

    attendanceRecords.forEach(record => {
      totalWorkingDays++;
      
      switch (record.status) {
        case 'present':
          presentDays++;
          totalWorkingHours += record.workingHours?.productiveHours || 8;
          totalOvertimeHours += record.workingHours?.overtimeHours || 0;
          break;
        case 'work-from-home':
          wfhDays++;
          totalWorkingHours += record.workingHours?.productiveHours || 8;
          totalOvertimeHours += record.workingHours?.overtimeHours || 0;
          break;
        case 'half-day':
          halfDays++;
          totalWorkingHours += 4;
          break;
        case 'absent':
          absentDays++;
          lopDays++;
          break;
        case 'on-leave':
          // Paid leave, no LOP
          break;
        case 'holiday':
          // Paid holiday, no LOP
          break;
      }
    });

    // Calculate pay
    const monthlySalary = employee.salaryStructure?.ctc ? employee.salaryStructure.ctc / 12 : 0;
    const dailyRate = monthlySalary / 30; // Assuming 30 days per month
    const hourlyRate = dailyRate / 8; // Assuming 8 hours per day

    // Basic pay calculation
    const effectiveWorkingDays = presentDays + wfhDays + (halfDays * 0.5);
    const basicPay = effectiveWorkingDays * dailyRate;
    
    // LOP calculation
    const lopAmount = lopDays * dailyRate;
    
    // Overtime calculation (1.5x rate)
    const overtimePay = totalOvertimeHours * hourlyRate * 1.5;
    
    // Net pay
    const grossPay = basicPay + overtimePay;
    const netPay = grossPay - lopAmount;

    // Attendance percentage
    const attendancePercentage = totalWorkingDays > 0 ? ((effectiveWorkingDays / totalWorkingDays) * 100).toFixed(2) : 0;

    const payCalculation = {
      employee: {
        id: employee._id,
        employeeId: employee.employeeId,
        name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        department: employee.employment.department,
        designation: employee.employment.designation
      },
      period: {
        startDate,
        endDate,
        totalDays: totalWorkingDays
      },
      attendance: {
        presentDays,
        absentDays,
        halfDays,
        wfhDays,
        lopDays,
        totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
        totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
        attendancePercentage: parseFloat(attendancePercentage)
      },
      salary: {
        monthlySalary: Math.round(monthlySalary),
        dailyRate: Math.round(dailyRate),
        hourlyRate: Math.round(hourlyRate)
      },
      payCalculation: {
        basicPay: Math.round(basicPay),
        overtimePay: Math.round(overtimePay),
        lopAmount: Math.round(lopAmount),
        grossPay: Math.round(grossPay),
        netPay: Math.round(netPay)
      }
    };

    res.json(payCalculation);
  } catch (error) {
    console.error('Calculate pay error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/attendance/daily-report
// @desc    Get daily attendance report
// @access  Private (Admin/HR)
router.get('/daily-report', [auth, authorize(['admin', 'hr'])], async (req, res) => {
  try {
    const { date = moment().format('YYYY-MM-DD'), department } = req.query;
    const reportDate = moment(date).startOf('day').toDate();

    let employeeQuery = {};
    if (department) {
      employeeQuery['employment.department'] = department;
    }

    // Get all employees
    const employees = await Employee.find(employeeQuery).select('employeeId personalInfo employment');
    
    // Get attendance for the date
    const attendanceRecords = await Attendance.find({
      date: reportDate
    }).populate('employeeId', 'employeeId personalInfo employment');

    // Create attendance map
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      if (record.employeeId) {
        attendanceMap[record.employeeId._id.toString()] = record;
      }
    });

    // Build report
    const report = employees.map(employee => {
      const attendance = attendanceMap[employee._id.toString()];
      
      return {
        employee: {
          id: employee._id,
          employeeId: employee.employeeId,
          name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
          department: employee.employment.department,
          designation: employee.employment.designation
        },
        attendance: attendance ? {
          status: attendance.status,
          checkIn: attendance.checkIn?.time,
          checkOut: attendance.checkOut?.time,
          workingHours: attendance.workingHours?.productiveHours || 0,
          overtimeHours: attendance.workingHours?.overtimeHours || 0,
          isLate: attendance.lateArrival?.isLate || false,
          lateByMinutes: attendance.lateArrival?.lateByMinutes || 0,
          isWFH: attendance.workFromHome?.isWFH || false
        } : {
          status: 'absent',
          checkIn: null,
          checkOut: null,
          workingHours: 0,
          overtimeHours: 0,
          isLate: false,
          lateByMinutes: 0,
          isWFH: false
        }
      };
    });

    // Calculate summary
    const summary = {
      totalEmployees: employees.length,
      present: report.filter(r => ['present', 'work-from-home'].includes(r.attendance.status)).length,
      absent: report.filter(r => r.attendance.status === 'absent').length,
      halfDay: report.filter(r => r.attendance.status === 'half-day').length,
      wfh: report.filter(r => r.attendance.status === 'work-from-home').length,
      onLeave: report.filter(r => r.attendance.status === 'on-leave').length,
      late: report.filter(r => r.attendance.isLate).length
    };

    res.json({
      date: moment(reportDate).format('YYYY-MM-DD'),
      summary,
      employees: report
    });
  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/attendance/checkin
// @desc    Check in employee
// @access  Private
router.post('/checkin', [auth, [
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('location.latitude').optional().isNumeric().withMessage('Invalid latitude'),
  body('location.longitude').optional().isNumeric().withMessage('Invalid longitude')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employeeId, location, method = 'web' } = req.body;
    const today = moment().startOf('day').toDate();

    // Check if already checked in today
    const existingAttendance = await Attendance.findOne({
      employeeId,
      date: today
    });

    if (existingAttendance && existingAttendance.checkIn.time) {
      return res.status(400).json({ message: 'Already checked in today' });
    }

    let attendance;
    if (existingAttendance) {
      // Update existing record
      existingAttendance.checkIn = {
        time: new Date(),
        location,
        method
      };
      attendance = await existingAttendance.save();
    } else {
      // Create new attendance record
      attendance = new Attendance({
        employeeId,
        date: today,
        checkIn: {
          time: new Date(),
          location,
          method
        },
        status: 'present'
      });
      await attendance.save();
    }

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('employeeId', 'employeeId personalInfo');

    res.json({
      message: 'Checked in successfully',
      attendance: populatedAttendance
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
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('location.latitude').optional().isNumeric().withMessage('Invalid latitude'),
  body('location.longitude').optional().isNumeric().withMessage('Invalid longitude')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employeeId, location, method = 'web' } = req.body;
    const today = moment().startOf('day').toDate();

    const attendance = await Attendance.findOne({
      employeeId,
      date: today
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No check-in record found for today' });
    }

    if (!attendance.checkIn.time) {
      return res.status(400).json({ message: 'Must check in before checking out' });
    }

    if (attendance.checkOut.time) {
      return res.status(400).json({ message: 'Already checked out today' });
    }

    attendance.checkOut = {
      time: new Date(),
      location,
      method
    };

    await attendance.save();

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('employeeId', 'employeeId personalInfo');

    res.json({
      message: 'Checked out successfully',
      attendance: populatedAttendance
    });
  } catch (error) {
    console.error('Check out error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/attendance/break/start
// @desc    Start break
// @access  Private
router.post('/break/start', [auth, [
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('type').optional().isIn(['lunch', 'coffee', 'other']).withMessage('Invalid break type')
]], async (req, res) => {
  try {
    const { employeeId, type = 'other' } = req.body;
    const today = moment().startOf('day').toDate();

    const attendance = await Attendance.findOne({
      employeeId,
      date: today
    });

    if (!attendance || !attendance.checkIn.time) {
      return res.status(400).json({ message: 'Must check in before starting break' });
    }

    // Check if there's an ongoing break
    const ongoingBreak = attendance.breaks.find(b => b.startTime && !b.endTime);
    if (ongoingBreak) {
      return res.status(400).json({ message: 'Break already in progress' });
    }

    attendance.breaks.push({
      startTime: new Date(),
      type
    });

    await attendance.save();

    res.json({
      message: 'Break started successfully',
      attendance
    });
  } catch (error) {
    console.error('Start break error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/attendance/break/end
// @desc    End break
// @access  Private
router.post('/break/end', [auth, [
  body('employeeId').notEmpty().withMessage('Employee ID is required')
]], async (req, res) => {
  try {
    const { employeeId } = req.body;
    const today = moment().startOf('day').toDate();

    const attendance = await Attendance.findOne({
      employeeId,
      date: today
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No attendance record found for today' });
    }

    // Find ongoing break
    const ongoingBreak = attendance.breaks.find(b => b.startTime && !b.endTime);
    if (!ongoingBreak) {
      return res.status(400).json({ message: 'No ongoing break found' });
    }

    ongoingBreak.endTime = new Date();
    ongoingBreak.duration = Math.round((ongoingBreak.endTime - ongoingBreak.startTime) / (1000 * 60)); // in minutes

    await attendance.save();

    res.json({
      message: 'Break ended successfully',
      attendance
    });
  } catch (error) {
    console.error('End break error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/attendance/employee/:employeeId/today
// @desc    Get today's attendance for employee
// @access  Private
router.get('/employee/:employeeId/today', auth, async (req, res) => {
  try {
    const today = moment().startOf('day').toDate();
    
    const attendance = await Attendance.findOne({
      employeeId: req.params.employeeId,
      date: today
    }).populate('employeeId', 'employeeId personalInfo');

    res.json(attendance);
  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/attendance/reports/summary
// @desc    Get attendance summary report
// @access  Private (HR/Admin)
router.get('/reports/summary', auth, async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    let matchQuery = {};
    
    if (startDate && endDate) {
      matchQuery.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' }
    ];

    if (department) {
      pipeline.push({
        $match: { 'employee.employment.department': department }
      });
    }

    pipeline.push({
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalHours: { $sum: '$totalHours' },
        averageHours: { $avg: '$totalHours' }
      }
    });

    const summary = await Attendance.aggregate(pipeline);

    res.json(summary);
  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// @route   POST /api/attendance/checkin
// @desc    Check in employee
// @access  Private
router.post('/checkin', [auth, [
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('location.latitude').optional().isNumeric().withMessage('Invalid latitude'),
  body('location.longitude').optional().isNumeric().withMessage('Invalid longitude')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employeeId, location, method = 'web' } = req.body;
    const today = moment().startOf('day').toDate();

    // Check if already checked in today
    const existingAttendance = await Attendance.findOne({
      employeeId,
      date: today
    });

    if (existingAttendance && existingAttendance.checkIn.time) {
      return res.status(400).json({ message: 'Already checked in today' });
    }

    let attendance;
    if (existingAttendance) {
      // Update existing record
      existingAttendance.checkIn = {
        time: new Date(),
        location,
        method
      };
      attendance = await existingAttendance.save();
    } else {
      // Create new attendance record
      attendance = new Attendance({
        employeeId,
        date: today,
        checkIn: {
          time: new Date(),
          location,
          method
        },
        status: 'present',
        shift: {
          shiftType: 'general',
          startTime: '09:00',
          endTime: '18:00'
        },
        createdBy: req.user.id
      });
      await attendance.save();
    }

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('employeeId', 'employeeId personalInfo');

    res.json({
      message: 'Checked in successfully',
      attendance: populatedAttendance
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
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('location.latitude').optional().isNumeric().withMessage('Invalid latitude'),
  body('location.longitude').optional().isNumeric().withMessage('Invalid longitude')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { employeeId, location, method = 'web' } = req.body;
    const today = moment().startOf('day').toDate();

    const attendance = await Attendance.findOne({
      employeeId,
      date: today
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No check-in record found for today' });
    }

    if (!attendance.checkIn.time) {
      return res.status(400).json({ message: 'Must check in before checking out' });
    }

    if (attendance.checkOut.time) {
      return res.status(400).json({ message: 'Already checked out today' });
    }

    attendance.checkOut = {
      time: new Date(),
      location,
      method
    };

    await attendance.save();

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('employeeId', 'employeeId personalInfo');

    res.json({
      message: 'Checked out successfully',
      attendance: populatedAttendance
    });
  } catch (error) {
    console.error('Check out error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/attendance/employee/:employeeId/today
// @desc    Get today's attendance for employee
// @access  Private
router.get('/employee/:employeeId/today', auth, async (req, res) => {
  try {
    const today = moment().startOf('day').toDate();
    
    const attendance = await Attendance.findOne({
      employeeId: req.params.employeeId,
      date: today
    }).populate('employeeId', 'employeeId personalInfo');

    res.json(attendance);
  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/attendance/reports/summary
// @desc    Get attendance summary report
// @access  Private (HR/Admin)
router.get('/reports/summary', auth, async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    
    let matchQuery = {};
    
    if (startDate && endDate) {
      matchQuery.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' }
    ];

    if (department) {
      pipeline.push({
        $match: { 'employee.employment.department': department }
      });
    }

    pipeline.push({
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalHours: { $sum: '$totalHours' },
        averageHours: { $avg: '$totalHours' }
      }
    });

    const summary = await Attendance.aggregate(pipeline);

    res.json(summary);
  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
// @route   GET /api/attendance/test-auth
// @desc    Test authorization
// @access  Private (Admin/HR)
router.get('/test-auth', [auth, authorize(['admin', 'hr'])], async (req, res) => {
  try {
    res.json({
      message: 'Authorization successful',
      user: req.user
    });
  } catch (error) {
    console.error('Test auth error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});