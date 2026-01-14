const express = require('express');
const { body, validationResult } = require('express-validator');
const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const { auth, authorize } = require('../middleware/auth');
const moment = require('moment');

const router = express.Router();

// @route   GET /api/leaves
// @desc    Get leave requests with enhanced filtering
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      employeeId, 
      status, 
      leaveType, 
      startDate, 
      endDate,
      department,
      year = new Date().getFullYear()
    } = req.query;
    
    let query = {};
    
    // Employee filter
    if (employeeId) {
      query.employeeId = employeeId;
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    // Leave type filter
    if (leaveType) {
      query.leaveType = leaveType;
    }
    
    // Date range filter
    if (startDate && endDate) {
      query.$or = [
        {
          startDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
        },
        {
          endDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
        },
        {
          startDate: { $lte: new Date(startDate) },
          endDate: { $gte: new Date(endDate) }
        }
      ];
    } else if (year) {
      query.startDate = {
        $gte: new Date(year, 0, 1),
        $lte: new Date(year, 11, 31)
      };
    }

    // Build aggregation pipeline for department filter
    let pipeline = [
      { $match: query }
    ];

    // Add employee lookup
    pipeline.push({
      $lookup: {
        from: 'employees',
        localField: 'employeeId',
        foreignField: '_id',
        as: 'employee'
      }
    });

    pipeline.push({ $unwind: '$employee' });

    // Department filter
    if (department) {
      pipeline.push({
        $match: { 'employee.employment.department': department }
      });
    }

    // Add user lookups
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'approvedBy',
          foreignField: '_id',
          as: 'approver'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'appliedBy',
          foreignField: '_id',
          as: 'applicant'
        }
      }
    );

    // Sort and paginate
    pipeline.push(
      { $sort: { appliedDate: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    );

    const leaves = await Leave.aggregate(pipeline);
    
    // Get total count
    const totalPipeline = [
      { $match: query },
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
      totalPipeline.push({
        $match: { 'employee.employment.department': department }
      });
    }

    totalPipeline.push({ $count: 'total' });
    const totalResult = await Leave.aggregate(totalPipeline);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    res.json({
      leaves,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/leaves
// @desc    Apply for leave with enhanced validation
// @access  Private
router.post('/', [auth, [
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('leaveType').isIn([
    'casual-leave', 'sick-leave', 'earned-leave', 'unpaid-leave', 
    'maternity-leave', 'paternity-leave', 'bereavement-leave', 
    'marriage-leave', 'emergency-leave', 'compensatory-off'
  ]).withMessage('Invalid leave type'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('reason').isLength({ min: 10 }).withMessage('Reason must be at least 10 characters')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      employeeId, 
      leaveType, 
      startDate, 
      endDate, 
      reason, 
      isHalfDay = false,
      halfDayPeriod,
      isEmergency = false,
      description,
      handoverTo,
      handoverNotes
    } = req.body;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      return res.status(400).json({ message: 'Start date cannot be after end date' });
    }

    // Check if start date is in the past (except for emergency leaves)
    if (!isEmergency && start < new Date().setHours(0, 0, 0, 0)) {
      return res.status(400).json({ message: 'Cannot apply for past dates unless it\'s an emergency leave' });
    }

    // Get employee details
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check leave balance
    const currentYear = new Date().getFullYear();
    const leaveBalance = await getEmployeeLeaveBalance(employeeId, currentYear);
    
    const requestedDays = isHalfDay ? 0.5 : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    if (leaveBalance[leaveType] && leaveBalance[leaveType].remaining < requestedDays) {
      return res.status(400).json({ 
        message: `Insufficient leave balance. Available: ${leaveBalance[leaveType].remaining} days, Requested: ${requestedDays} days` 
      });
    }

    // Check for overlapping leave requests
    const overlappingLeave = await Leave.findOne({
      employeeId,
      status: { $in: ['pending', 'approved', 'submitted', 'under-review'] },
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      ]
    });

    if (overlappingLeave) {
      return res.status(400).json({ message: 'Leave request overlaps with existing leave' });
    }

    // Create leave application
    const leaveData = {
      employeeId,
      leaveType,
      startDate: start,
      endDate: end,
      totalDays: requestedDays,
      reason,
      description,
      isHalfDay,
      halfDayPeriod,
      isEmergency,
      appliedBy: req.user.id,
      createdBy: req.user.id,
      updatedBy: req.user.id
    };

    // Set leave category based on type
    const paidLeaveTypes = ['casual-leave', 'sick-leave', 'earned-leave', 'maternity-leave', 'paternity-leave', 'bereavement-leave', 'marriage-leave', 'compensatory-off'];
    leaveData.leaveCategory = paidLeaveTypes.includes(leaveType) ? 'paid' : 'unpaid';

    // Set up approval workflow
    leaveData.approvalWorkflow = [
      {
        level: 1,
        approverRole: 'manager',
        status: 'pending'
      },
      {
        level: 2,
        approverRole: 'hr',
        status: 'pending'
      }
    ];

    // For emergency leaves or sick leaves, skip manager approval
    if (isEmergency || leaveType === 'sick-leave') {
      leaveData.approvalWorkflow = [
        {
          level: 1,
          approverRole: 'hr',
          status: 'pending'
        }
      ];
    }

    // Add handover details if provided
    if (handoverTo) {
      leaveData.handoverDetails = {
        isRequired: true,
        handoverTo,
        handoverNotes,
        handoverCompleted: false
      };
    }

    const leave = new Leave(leaveData);
    await leave.save();

    // Update leave balance impact
    if (leaveBalance[leaveType]) {
      leave.balanceImpact = {
        leaveTypeBalance: {
          before: leaveBalance[leaveType].remaining,
          after: leaveBalance[leaveType].remaining - requestedDays,
          deducted: requestedDays
        }
      };
      await leave.save();
    }

    const populatedLeave = await Leave.findById(leave._id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('appliedBy', 'username email')
      .populate('handoverDetails.handoverTo', 'employeeId personalInfo');

    res.status(201).json({
      message: 'Leave request submitted successfully',
      leave: populatedLeave
    });
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/leaves/:id
// @desc    Update leave request (Admin/HR only)
// @access  Private (Admin/HR)
router.put('/:id', [auth, authorize(['admin', 'hr']), [
  body('leaveType').optional().isIn([
    'casual-leave', 'sick-leave', 'earned-leave', 'unpaid-leave', 
    'maternity-leave', 'paternity-leave', 'bereavement-leave', 
    'marriage-leave', 'emergency-leave', 'compensatory-off'
  ]).withMessage('Invalid leave type'),
  body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  body('reason').optional().isLength({ min: 10 }).withMessage('Reason must be at least 10 characters')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Store original values for audit
    const originalValues = {
      leaveType: leave.leaveType,
      startDate: leave.startDate,
      endDate: leave.endDate,
      totalDays: leave.totalDays,
      reason: leave.reason,
      status: leave.status
    };

    // Update fields
    const updateFields = ['leaveType', 'startDate', 'endDate', 'reason', 'description', 'status'];
    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        leave[field] = req.body[field];
      }
    });

    // Recalculate total days if dates changed
    if (req.body.startDate || req.body.endDate) {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      leave.totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    }

    leave.updatedBy = req.user.id;

    // Add audit trail
    leave.auditTrail.push({
      action: 'Leave updated by admin/HR',
      performedBy: req.user.id,
      oldValues: originalValues,
      newValues: req.body,
      comments: req.body.updateReason || 'Updated by admin/HR'
    });

    await leave.save();

    const populatedLeave = await Leave.findById(leave._id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('approvedBy', 'username email')
      .populate('appliedBy', 'username email');

    res.json({
      message: 'Leave request updated successfully',
      leave: populatedLeave
    });
  } catch (error) {
    console.error('Update leave error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/leaves/:id
// @desc    Delete leave request (Admin only)
// @access  Private (Admin)
router.delete('/:id', [auth, authorize(['admin'])], async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Check if leave can be deleted
    if (leave.status === 'approved' && new Date(leave.startDate) <= new Date()) {
      return res.status(400).json({ message: 'Cannot delete approved leave that has already started' });
    }

    await Leave.findByIdAndDelete(req.params.id);

    res.json({ message: 'Leave request deleted successfully' });
  } catch (error) {
    console.error('Delete leave error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/leaves/:id
// @desc    Get leave by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('approvedBy', 'username email');

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    res.json(leave);
  } catch (error) {
    console.error('Get leave error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/leaves/:id/approve
// @desc    Approve leave request with workflow
// @access  Private (HR/Manager/Admin)
router.put('/:id/approve', [auth, authorize(['admin', 'hr', 'manager']), [
  body('comments').optional().isLength({ max: 500 }).withMessage('Comments cannot exceed 500 characters')
]], async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    if (!['pending', 'submitted', 'under-review'].includes(leave.status)) {
      return res.status(400).json({ message: 'Leave request cannot be approved in current status' });
    }

    const { comments = '' } = req.body;
    const userRole = req.user.role;

    // Find the appropriate workflow level for this user
    const workflowLevel = leave.approvalWorkflow.find(w => 
      w.approverRole === userRole && w.status === 'pending'
    );

    if (!workflowLevel) {
      return res.status(403).json({ message: 'You are not authorized to approve this leave at this stage' });
    }

    // Process the approval
    await leave.processApproval(workflowLevel.level, req.user.id, 'approved', comments);

    // If fully approved, create attendance records and update balance
    if (leave.status === 'approved') {
      await createLeaveAttendanceRecords(leave);
      await updateEmployeeLeaveBalance(leave.employeeId, leave.leaveType, leave.totalDays, 'deduct');
    }

    const populatedLeave = await Leave.findById(leave._id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('approvedBy', 'username email')
      .populate('approvalWorkflow.approverId', 'username email');

    res.json({
      message: leave.status === 'approved' ? 'Leave request fully approved' : 'Leave request approved at your level',
      leave: populatedLeave
    });
  } catch (error) {
    console.error('Approve leave error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/leaves/:id/reject
// @desc    Reject leave request with workflow
// @access  Private (HR/Manager/Admin)
router.put('/:id/reject', [auth, authorize(['admin', 'hr', 'manager']), [
  body('comments').notEmpty().withMessage('Rejection reason is required')
]], async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    if (!['pending', 'submitted', 'under-review'].includes(leave.status)) {
      return res.status(400).json({ message: 'Leave request cannot be rejected in current status' });
    }

    const { comments } = req.body;
    const userRole = req.user.role;

    // Find the appropriate workflow level for this user
    const workflowLevel = leave.approvalWorkflow.find(w => 
      w.approverRole === userRole && w.status === 'pending'
    );

    if (!workflowLevel) {
      return res.status(403).json({ message: 'You are not authorized to reject this leave' });
    }

    // Process the rejection
    await leave.processApproval(workflowLevel.level, req.user.id, 'rejected', comments);

    const populatedLeave = await Leave.findById(leave._id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('approvedBy', 'username email')
      .populate('approvalWorkflow.approverId', 'username email');

    res.json({
      message: 'Leave request rejected',
      leave: populatedLeave
    });
  } catch (error) {
    console.error('Reject leave error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/leaves/:id/cancel
// @desc    Cancel leave request
// @access  Private
router.put('/:id/cancel', [auth, [
  body('reason').notEmpty().withMessage('Cancellation reason is required')
]], async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // Check if user can cancel this leave
    if (leave.appliedBy.toString() !== req.user.id && !['admin', 'hr'].includes(req.user.role)) {
      return res.status(403).json({ message: 'You can only cancel your own leave requests' });
    }

    if (!['pending', 'submitted', 'under-review', 'approved'].includes(leave.status)) {
      return res.status(400).json({ message: 'Leave request cannot be cancelled in current status' });
    }

    // If leave has started, don't allow cancellation
    if (leave.status === 'approved' && new Date(leave.startDate) <= new Date()) {
      return res.status(400).json({ message: 'Cannot cancel leave that has already started' });
    }

    await leave.cancelLeave(req.user.id, req.body.reason);

    // If leave was approved, restore the balance
    if (leave.status === 'cancelled' && leave.approvedBy) {
      await updateEmployeeLeaveBalance(leave.employeeId, leave.leaveType, leave.totalDays, 'restore');
    }

    const populatedLeave = await Leave.findById(leave._id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('cancellation.cancelledBy', 'username email');

    res.json({
      message: 'Leave request cancelled successfully',
      leave: populatedLeave
    });
  } catch (error) {
    console.error('Cancel leave error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/leaves/employee/:employeeId/balance
// @desc    Get comprehensive leave balance for employee
// @access  Private
router.get('/employee/:employeeId/balance', auth, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const employeeId = req.params.employeeId;

    // Get employee details
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const balance = await getEmployeeLeaveBalance(employeeId, year);

    res.json({
      employeeId,
      year: parseInt(year),
      balance,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Get leave balance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/leaves/calendar
// @desc    Get leave calendar view
// @access  Private
router.get('/calendar', auth, async (req, res) => {
  try {
    const { 
      startDate = moment().startOf('month').format('YYYY-MM-DD'),
      endDate = moment().endOf('month').format('YYYY-MM-DD'),
      department,
      employeeId
    } = req.query;

    let query = {
      status: { $in: ['approved', 'taken'] },
      $or: [
        {
          startDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
        },
        {
          endDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
        },
        {
          startDate: { $lte: new Date(startDate) },
          endDate: { $gte: new Date(endDate) }
        }
      ]
    };

    if (employeeId) {
      query.employeeId = employeeId;
    }

    // Build aggregation pipeline
    let pipeline = [
      { $match: query },
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

    // Department filter
    if (department) {
      pipeline.push({
        $match: { 'employee.employment.department': department }
      });
    }

    // Project required fields
    pipeline.push({
      $project: {
        leaveId: 1,
        leaveType: 1,
        startDate: 1,
        endDate: 1,
        totalDays: 1,
        status: 1,
        reason: 1,
        isHalfDay: 1,
        employee: {
          _id: '$employee._id',
          employeeId: '$employee.employeeId',
          name: {
            $concat: ['$employee.personalInfo.firstName', ' ', '$employee.personalInfo.lastName']
          },
          department: '$employee.employment.department',
          designation: '$employee.employment.designation'
        }
      }
    });

    const leaves = await Leave.aggregate(pipeline);

    // Group leaves by date for calendar view
    const calendarData = {};
    
    leaves.forEach(leave => {
      const startDate = moment(leave.startDate);
      const endDate = moment(leave.endDate);
      
      // Create entries for each date in the leave period
      for (let date = startDate.clone(); date.isSameOrBefore(endDate); date.add(1, 'day')) {
        const dateKey = date.format('YYYY-MM-DD');
        
        if (!calendarData[dateKey]) {
          calendarData[dateKey] = [];
        }
        
        calendarData[dateKey].push({
          leaveId: leave.leaveId,
          leaveType: leave.leaveType,
          employee: leave.employee,
          isHalfDay: leave.isHalfDay && (date.isSame(startDate) || date.isSame(endDate)),
          reason: leave.reason,
          status: leave.status
        });
      }
    });

    res.json({
      startDate,
      endDate,
      calendarData,
      totalLeaves: leaves.length
    });
  } catch (error) {
    console.error('Get leave calendar error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/leaves/pending-approvals
// @desc    Get pending leave approvals for current user
// @access  Private (HR/Manager/Admin)
router.get('/pending-approvals', [auth, authorize(['admin', 'hr', 'manager'])], async (req, res) => {
  try {
    const userRole = req.user.role;
    
    const pendingLeaves = await Leave.find({
      status: { $in: ['submitted', 'under-review', 'pending'] },
      'approvalWorkflow': {
        $elemMatch: {
          approverRole: userRole,
          status: 'pending'
        }
      }
    })
    .populate('employeeId', 'employeeId personalInfo employment')
    .populate('appliedBy', 'username email')
    .sort({ appliedDate: 1 });

    res.json({
      pendingApprovals: pendingLeaves,
      count: pendingLeaves.length
    });
  } catch (error) {
    console.error('Get pending approvals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/leaves/reports/summary
// @desc    Get leave summary report
// @access  Private (HR/Admin)
router.get('/reports/summary', [auth, authorize(['admin', 'hr'])], async (req, res) => {
  try {
    const { 
      year = new Date().getFullYear(),
      department,
      startDate,
      endDate
    } = req.query;

    let dateQuery = {};
    if (startDate && endDate) {
      dateQuery = {
        startDate: { $gte: new Date(startDate) },
        endDate: { $lte: new Date(endDate) }
      };
    } else {
      dateQuery = {
        startDate: {
          $gte: new Date(year, 0, 1),
          $lte: new Date(year, 11, 31)
        }
      };
    }

    // Build aggregation pipeline
    let pipeline = [
      { $match: dateQuery },
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

    // Department filter
    if (department) {
      pipeline.push({
        $match: { 'employee.employment.department': department }
      });
    }

    // Group by leave type and status
    pipeline.push({
      $group: {
        _id: {
          leaveType: '$leaveType',
          status: '$status',
          department: '$employee.employment.department'
        },
        count: { $sum: 1 },
        totalDays: { $sum: '$totalDays' },
        employees: { $addToSet: '$employeeId' }
      }
    });

    const summary = await Leave.aggregate(pipeline);

    // Process summary data
    const reportData = {
      byLeaveType: {},
      byStatus: {},
      byDepartment: {},
      totals: {
        totalApplications: 0,
        totalDays: 0,
        uniqueEmployees: new Set()
      }
    };

    summary.forEach(item => {
      const { leaveType, status, department } = item._id;
      
      // By leave type
      if (!reportData.byLeaveType[leaveType]) {
        reportData.byLeaveType[leaveType] = { count: 0, totalDays: 0 };
      }
      reportData.byLeaveType[leaveType].count += item.count;
      reportData.byLeaveType[leaveType].totalDays += item.totalDays;
      
      // By status
      if (!reportData.byStatus[status]) {
        reportData.byStatus[status] = { count: 0, totalDays: 0 };
      }
      reportData.byStatus[status].count += item.count;
      reportData.byStatus[status].totalDays += item.totalDays;
      
      // By department
      if (!reportData.byDepartment[department]) {
        reportData.byDepartment[department] = { count: 0, totalDays: 0 };
      }
      reportData.byDepartment[department].count += item.count;
      reportData.byDepartment[department].totalDays += item.totalDays;
      
      // Totals
      reportData.totals.totalApplications += item.count;
      reportData.totals.totalDays += item.totalDays;
      item.employees.forEach(emp => reportData.totals.uniqueEmployees.add(emp.toString()));
    });

    reportData.totals.uniqueEmployees = reportData.totals.uniqueEmployees.size;

    res.json({
      period: startDate && endDate ? { startDate, endDate } : { year },
      summary: reportData,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Get leave summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
// Helper function to get employee leave balance
async function getEmployeeLeaveBalance(employeeId, year) {
  try {
    // Get all approved and taken leaves for the year
    const approvedLeaves = await Leave.find({
      employeeId,
      status: { $in: ['approved', 'taken'] },
      startDate: {
        $gte: new Date(year, 0, 1),
        $lte: new Date(year, 11, 31)
      }
    });

    // Calculate used days by leave type
    const usedDays = approvedLeaves.reduce((acc, leave) => {
      acc[leave.leaveType] = (acc[leave.leaveType] || 0) + leave.totalDays;
      return acc;
    }, {});

    // Standard leave allocations (can be made configurable per employee/company)
    const allocations = {
      'casual-leave': 12,
      'sick-leave': 12,
      'earned-leave': 21,
      'unpaid-leave': 365, // No limit for unpaid leave
      'maternity-leave': 180,
      'paternity-leave': 15,
      'bereavement-leave': 5,
      'marriage-leave': 5,
      'emergency-leave': 3,
      'compensatory-off': 12
    };

    const balance = {};
    Object.keys(allocations).forEach(leaveType => {
      const allocated = allocations[leaveType];
      const used = usedDays[leaveType] || 0;
      const remaining = leaveType === 'unpaid-leave' ? 365 : Math.max(0, allocated - used);
      
      balance[leaveType] = {
        allocated,
        used,
        remaining,
        carryForward: 0 // Can be implemented based on company policy
      };
    });

    return balance;
  } catch (error) {
    console.error('Error getting leave balance:', error);
    throw error;
  }
}

// Helper function to update employee leave balance
async function updateEmployeeLeaveBalance(employeeId, leaveType, days, action) {
  try {
    // This function can be enhanced to update a separate LeaveBalance collection
    // For now, it's a placeholder for balance tracking logic
    console.log(`${action} ${days} days of ${leaveType} for employee ${employeeId}`);
    
    // In a real implementation, you might:
    // 1. Update a LeaveBalance collection
    // 2. Send notifications
    // 3. Update employee records
    // 4. Trigger workflow events
    
    return true;
  } catch (error) {
    console.error('Error updating leave balance:', error);
    throw error;
  }
}

// Helper function to create attendance records for approved leaves
async function createLeaveAttendanceRecords(leave) {
  try {
    const attendanceRecords = [];
    const startDate = moment(leave.startDate);
    const endDate = moment(leave.endDate);
    
    // Create attendance records for each day of leave
    for (let date = startDate.clone(); date.isSameOrBefore(endDate); date.add(1, 'day')) {
      // Skip weekends unless it's a special leave type
      if (date.day() === 0 || date.day() === 6) {
        continue;
      }
      
      const attendanceData = {
        employeeId: leave.employeeId,
        date: date.toDate(),
        status: 'on-leave',
        workingHours: {
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          productiveHours: 0,
          breakHours: 0
        },
        shift: {
          shiftType: 'general',
          startTime: '09:00',
          endTime: '18:00'
        },
        manualAdjustment: {
          isAdjusted: true,
          adjustedBy: leave.approvedBy,
          adjustedAt: new Date(),
          adjustmentReason: `Leave: ${leave.leaveType} - ${leave.reason}`
        },
        createdBy: leave.approvedBy,
        updatedBy: leave.approvedBy
      };
      
      // Handle half-day leaves
      if (leave.isHalfDay && (date.isSame(startDate) || date.isSame(endDate))) {
        attendanceData.status = 'half-day';
        attendanceData.workingHours.totalHours = 4;
        attendanceData.workingHours.regularHours = 4;
        attendanceData.workingHours.productiveHours = 4;
      }
      
      attendanceRecords.push(attendanceData);
    }
    
    // Create attendance records
    if (attendanceRecords.length > 0) {
      await Attendance.insertMany(attendanceRecords);
      
      // Update leave with attendance integration
      leave.attendanceIntegration.attendanceMarked = true;
      leave.attendanceIntegration.attendanceIds = attendanceRecords.map(record => record._id);
      await leave.save();
    }
    
    return attendanceRecords;
  } catch (error) {
    console.error('Error creating leave attendance records:', error);
    throw error;
  }
}

module.exports = router;