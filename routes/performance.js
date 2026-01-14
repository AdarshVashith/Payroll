const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Performance Review Schema
const performanceReviewSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  reviewPeriod: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }
  },
  reviewType: {
    type: String,
    enum: ['annual', 'quarterly', 'probation', 'project'],
    default: 'annual'
  },
  goals: [{
    title: { type: String, required: true },
    description: String,
    kra: String, // Key Result Area
    targetDate: Date,
    status: {
      type: String,
      enum: ['not-started', 'in-progress', 'completed', 'overdue'],
      default: 'not-started'
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    selfRating: { type: Number, min: 1, max: 5 },
    managerRating: { type: Number, min: 1, max: 5 },
    comments: String
  }],
  overallRatings: {
    selfRating: { type: Number, min: 1, max: 5 },
    managerRating: { type: Number, min: 1, max: 5 },
    finalRating: { type: Number, min: 1, max: 5 }
  },
  competencies: [{
    name: { type: String, required: true },
    selfRating: { type: Number, min: 1, max: 5 },
    managerRating: { type: Number, min: 1, max: 5 },
    comments: String
  }],
  achievements: [String],
  areasForImprovement: [String],
  developmentPlan: [{
    area: String,
    action: String,
    timeline: String,
    resources: String
  }],
  managerComments: String,
  employeeComments: String,
  status: {
    type: String,
    enum: ['draft', 'self-review', 'manager-review', 'completed'],
    default: 'draft'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewDate: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const PerformanceReview = mongoose.model('PerformanceReview', performanceReviewSchema);

// @route   GET /api/performance/reviews
// @desc    Get performance reviews
// @access  Private
router.get('/reviews', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, employeeId, status, reviewType } = req.query;
    
    let query = {};
    
    if (employeeId) {
      query.employeeId = employeeId;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (reviewType) {
      query.reviewType = reviewType;
    }

    const reviews = await PerformanceReview.find(query)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('reviewedBy', 'username')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await PerformanceReview.countDocuments(query);

    res.json({
      reviews,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get performance reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/performance/reviews
// @desc    Create performance review
// @access  Private (HR/Manager)
router.post('/reviews', [auth, [
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('reviewPeriod.startDate').isISO8601().withMessage('Valid start date is required'),
  body('reviewPeriod.endDate').isISO8601().withMessage('Valid end date is required'),
  body('reviewType').isIn(['annual', 'quarterly', 'probation', 'project']).withMessage('Invalid review type')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if employee exists
    const employee = await Employee.findById(req.body.employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const review = new PerformanceReview(req.body);
    await review.save();

    const populatedReview = await PerformanceReview.findById(review._id)
      .populate('employeeId', 'employeeId personalInfo employment');

    res.status(201).json({
      message: 'Performance review created successfully',
      review: populatedReview
    });
  } catch (error) {
    console.error('Create performance review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/performance/reviews/:id
// @desc    Update performance review
// @access  Private
router.put('/reviews/:id', auth, async (req, res) => {
  try {
    const review = await PerformanceReview.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate('employeeId', 'employeeId personalInfo employment');

    if (!review) {
      return res.status(404).json({ message: 'Performance review not found' });
    }

    res.json({
      message: 'Performance review updated successfully',
      review
    });
  } catch (error) {
    console.error('Update performance review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/performance/reviews/:id/submit-self-review
// @desc    Submit self review
// @access  Private
router.put('/reviews/:id/submit-self-review', auth, async (req, res) => {
  try {
    const review = await PerformanceReview.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({ message: 'Performance review not found' });
    }

    if (review.status !== 'self-review') {
      return res.status(400).json({ message: 'Review is not in self-review stage' });
    }

    review.status = 'manager-review';
    review.updatedAt = Date.now();
    
    await review.save();

    res.json({
      message: 'Self review submitted successfully',
      review
    });
  } catch (error) {
    console.error('Submit self review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/performance/reviews/:id/complete
// @desc    Complete performance review
// @access  Private (HR/Manager)
router.put('/reviews/:id/complete', auth, async (req, res) => {
  try {
    const review = await PerformanceReview.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({ message: 'Performance review not found' });
    }

    review.status = 'completed';
    review.reviewedBy = req.user.userId;
    review.reviewDate = new Date();
    review.updatedAt = Date.now();
    
    await review.save();

    const populatedReview = await PerformanceReview.findById(review._id)
      .populate('employeeId', 'employeeId personalInfo')
      .populate('reviewedBy', 'username');

    res.json({
      message: 'Performance review completed successfully',
      review: populatedReview
    });
  } catch (error) {
    console.error('Complete performance review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/performance/goals/employee/:employeeId
// @desc    Get employee goals
// @access  Private
router.get('/goals/employee/:employeeId', auth, async (req, res) => {
  try {
    const reviews = await PerformanceReview.find({
      employeeId: req.params.employeeId,
      status: { $in: ['self-review', 'manager-review', 'completed'] }
    }).populate('employeeId', 'employeeId personalInfo');

    // Extract all goals from reviews
    const goals = reviews.reduce((acc, review) => {
      return acc.concat(review.goals.map(goal => ({
        ...goal.toObject(),
        reviewId: review._id,
        reviewPeriod: review.reviewPeriod
      })));
    }, []);

    res.json(goals);
  } catch (error) {
    console.error('Get employee goals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/performance/reviews/:id
// @desc    Get performance review by ID
// @access  Private
router.get('/reviews/:id', auth, async (req, res) => {
  try {
    const review = await PerformanceReview.findById(req.params.id)
      .populate('employeeId', 'employeeId personalInfo employment')
      .populate('reviewedBy', 'username email');

    if (!review) {
      return res.status(404).json({ message: 'Performance review not found' });
    }

    res.json(review);
  } catch (error) {
    console.error('Get performance review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// @desc    Get performance summary report
// @access  Private (HR/Admin)
router.get('/reports/summary', auth, async (req, res) => {
  try {
    const { department, reviewType, year } = req.query;
    
    let matchQuery = {};
    
    if (reviewType) {
      matchQuery.reviewType = reviewType;
    }

    if (year) {
      matchQuery['reviewPeriod.startDate'] = {
        $gte: new Date(year, 0, 1),
        $lte: new Date(year, 11, 31)
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
        _id: {
          status: '$status',
          department: '$employee.employment.department'
        },
        count: { $sum: 1 },
        averageRating: { $avg: '$overallRatings.finalRating' },
        completedGoals: {
          $sum: {
            $size: {
              $filter: {
                input: '$goals',
                cond: { $eq: ['$$this.status', 'completed'] }
              }
            }
          }
        },
        totalGoals: { $sum: { $size: '$goals' } }
      }
    });

    const summary = await PerformanceReview.aggregate(pipeline);

    res.json(summary);
  } catch (error) {
    console.error('Get performance summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;