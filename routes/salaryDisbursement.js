const express = require('express');
const { body, validationResult } = require('express-validator');
const SalaryDisbursement = require('../models/SalaryDisbursement');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/salary-disbursement
// @desc    Get salary disbursement records with filtering
// @access  Private (Finance/Admin)
router.get('/', [auth, authorize(['admin', 'finance', 'hr'])], async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      batchId,
      employeeId, 
      status, 
      month, 
      year = new Date().getFullYear(),
      paymentMethod 
    } = req.query;
    
    let query = {};
    
    // Filters
    if (batchId) query.batchId = batchId;
    if (employeeId) query.employeeId = employeeId;
    if (status) query['transaction.status'] = status;
    if (paymentMethod) query['paymentDetails.paymentMethod'] = paymentMethod;
    
    // Date filters
    if (year) query['payPeriod.year'] = parseInt(year);
    if (month) query['payPeriod.month'] = parseInt(month);

    const disbursements = await SalaryDisbursement.find(query)
      .populate('employeeId', 'employeeId personalInfo employment bankDetails')
      .populate('payrollId', 'payrollId grossPay netPay')
      .populate('processing.initiatedBy', 'username email')
      .populate('processing.processedBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SalaryDisbursement.countDocuments(query);

    res.json({
      disbursements,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get disbursements error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/salary-disbursement/batch/:batchId
// @desc    Get disbursements by batch ID
// @access  Private (Finance/Admin)
router.get('/batch/:batchId', [auth, authorize(['admin', 'finance'])], async (req, res) => {
  try {
    const disbursements = await SalaryDisbursement.find({ batchId: req.params.batchId })
      .populate('employeeId', 'employeeId personalInfo employment bankDetails')
      .populate('payrollId', 'payrollId grossPay netPay')
      .sort({ createdAt: -1 });

    if (disbursements.length === 0) {
      return res.status(404).json({ message: 'No disbursements found for this batch' });
    }

    // Get batch summary
    const summary = await SalaryDisbursement.getDisbursementSummary(null, null, req.params.batchId);

    res.json({
      batchId: req.params.batchId,
      disbursements,
      summary: summary[0] || {}
    });
  } catch (error) {
    console.error('Get batch disbursements error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/salary-disbursement/:id/initiate
// @desc    Initiate payment for disbursement
// @access  Private (Finance/Admin)
router.put('/:id/initiate', [auth, authorize(['admin', 'finance'])], async (req, res) => {
  try {
    const disbursement = await SalaryDisbursement.findById(req.params.id)
      .populate('employeeId', 'employeeId personalInfo bankDetails');
    
    if (!disbursement) {
      return res.status(404).json({ message: 'Disbursement not found' });
    }

    if (disbursement.transaction.status !== 'pending') {
      return res.status(400).json({ message: 'Disbursement cannot be initiated in current status' });
    }

    // Validate disbursement before initiating
    await disbursement.validateDisbursement(req.user.id);
    
    if (!disbursement.processing.validated) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: disbursement.processing.validationErrors 
      });
    }

    // Initiate payment
    await disbursement.initiatePayment(req.user.id);

    // Here you would integrate with payment gateway
    // For demo purposes, we'll simulate the payment process
    await simulatePaymentProcess(disbursement);

    res.json({
      message: 'Payment initiated successfully',
      disbursement
    });

  } catch (error) {
    console.error('Initiate payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/salary-disbursement/:id/update-status
// @desc    Update payment status (webhook endpoint)
// @access  Private (System/Finance)
router.put('/:id/update-status', [auth, authorize(['admin', 'finance']), [
  body('status').isIn(['pending', 'processing', 'queued', 'success', 'failed', 'cancelled', 'reversed']).withMessage('Valid status is required'),
  body('transactionId').optional().isString(),
  body('utrNumber').optional().isString(),
  body('failureReason').optional().isString()
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const disbursement = await SalaryDisbursement.findById(req.params.id);
    
    if (!disbursement) {
      return res.status(404).json({ message: 'Disbursement not found' });
    }

    const { status, transactionId, utrNumber, failureReason, gatewayResponse } = req.body;

    // Update payment status
    await disbursement.updatePaymentStatus(status, {
      transactionId,
      utrNumber,
      failureReason,
      gatewayResponse,
      updatedBy: req.user.id,
      reason: `Status updated to ${status}`,
      transactionDate: status === 'success' ? new Date() : null
    });

    // Send notifications on success
    if (status === 'success') {
      await disbursement.sendNotifications('all');
    }

    res.json({
      message: `Payment status updated to ${status}`,
      disbursement
    });

  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/salary-disbursement/:id/retry
// @desc    Retry failed payment
// @access  Private (Finance/Admin)
router.put('/:id/retry', [auth, authorize(['admin', 'finance'])], async (req, res) => {
  try {
    const disbursement = await SalaryDisbursement.findById(req.params.id)
      .populate('employeeId', 'employeeId personalInfo');
    
    if (!disbursement) {
      return res.status(404).json({ message: 'Disbursement not found' });
    }

    // Retry payment
    await disbursement.retryPayment(req.user.id);

    // Simulate retry process
    await simulatePaymentProcess(disbursement);

    res.json({
      message: 'Payment retry initiated successfully',
      disbursement
    });

  } catch (error) {
    console.error('Retry payment error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   POST /api/salary-disbursement/batch/:batchId/process
// @desc    Process entire batch
// @access  Private (Finance/Admin)
router.post('/batch/:batchId/process', [auth, authorize(['admin', 'finance'])], async (req, res) => {
  try {
    const disbursements = await SalaryDisbursement.find({ 
      batchId: req.params.batchId,
      'transaction.status': 'pending'
    });

    if (disbursements.length === 0) {
      return res.status(404).json({ message: 'No pending disbursements found for this batch' });
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: []
    };

    for (const disbursement of disbursements) {
      try {
        // Validate disbursement
        await disbursement.validateDisbursement(req.user.id);
        
        if (!disbursement.processing.validated) {
          results.failed++;
          results.errors.push(`Validation failed for ${disbursement.disbursementId}: ${disbursement.processing.validationErrors.join(', ')}`);
          continue;
        }

        // Initiate payment
        await disbursement.initiatePayment(req.user.id);
        
        // Simulate payment process
        await simulatePaymentProcess(disbursement);
        
        results.processed++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Error processing ${disbursement.disbursementId}: ${error.message}`);
      }
    }

    res.json({
      message: `Batch processing completed`,
      batchId: req.params.batchId,
      results
    });

  } catch (error) {
    console.error('Process batch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/salary-disbursement/:id/reconcile
// @desc    Reconcile payment with bank statement
// @access  Private (Finance/Admin)
router.post('/:id/reconcile', [auth, authorize(['admin', 'finance']), [
  body('bankStatementEntry.date').isISO8601().withMessage('Valid date is required'),
  body('bankStatementEntry.amount').isNumeric().withMessage('Valid amount is required'),
  body('bankStatementEntry.reference').isString().withMessage('Reference is required')
]], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const disbursement = await SalaryDisbursement.findById(req.params.id);
    
    if (!disbursement) {
      return res.status(404).json({ message: 'Disbursement not found' });
    }

    if (disbursement.transaction.status !== 'success') {
      return res.status(400).json({ message: 'Can only reconcile successful payments' });
    }

    const { bankStatementEntry } = req.body;

    // Reconcile payment
    await disbursement.reconcilePayment(bankStatementEntry, req.user.id);

    res.json({
      message: 'Payment reconciled successfully',
      reconciliation: disbursement.reconciliation
    });

  } catch (error) {
    console.error('Reconcile payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/salary-disbursement/failed-payments
// @desc    Get failed payments for retry
// @access  Private (Finance/Admin)
router.get('/failed-payments', [auth, authorize(['admin', 'finance'])], async (req, res) => {
  try {
    const failedPayments = await SalaryDisbursement.getFailedPaymentsForRetry();

    res.json({
      failedPayments,
      count: failedPayments.length
    });

  } catch (error) {
    console.error('Get failed payments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/salary-disbursement/reports/summary
// @desc    Get disbursement summary report
// @access  Private (Finance/Admin)
router.get('/reports/summary', [auth, authorize(['admin', 'finance', 'hr'])], async (req, res) => {
  try {
    const { year, month, batchId } = req.query;
    
    const summary = await SalaryDisbursement.getDisbursementSummary(year, month, batchId);
    
    res.json({
      period: { year, month, batchId },
      summary: summary[0] || {},
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Get disbursement summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/salary-disbursement/reports/reconciliation
// @desc    Get reconciliation report
// @access  Private (Finance/Admin)
router.get('/reports/reconciliation', [auth, authorize(['admin', 'finance'])], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    const reconciliationData = await SalaryDisbursement.aggregate([
      {
        $match: {
          'transaction.transactionDate': {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          },
          'transaction.status': 'success'
        }
      },
      {
        $group: {
          _id: null,
          totalDisbursements: { $sum: 1 },
          totalAmount: { $sum: '$paymentDetails.netAmount' },
          reconciledCount: {
            $sum: { $cond: ['$reconciliation.reconciled', 1, 0] }
          },
          unreconciledCount: {
            $sum: { $cond: [{ $not: '$reconciliation.reconciled' }, 1, 0] }
          },
          discrepancyCount: {
            $sum: { $cond: ['$reconciliation.discrepancy.found', 1, 0] }
          },
          totalDiscrepancyAmount: {
            $sum: { $cond: ['$reconciliation.discrepancy.found', '$reconciliation.discrepancy.amount', 0] }
          }
        }
      }
    ]);

    res.json({
      period: { startDate, endDate },
      reconciliation: reconciliationData[0] || {},
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Get reconciliation report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to simulate payment process
async function simulatePaymentProcess(disbursement) {
  // Simulate payment gateway processing
  setTimeout(async () => {
    try {
      // Simulate random success/failure (90% success rate)
      const isSuccess = Math.random() > 0.1;
      
      if (isSuccess) {
        await disbursement.updatePaymentStatus('success', {
          transactionId: `TXN${Date.now()}`,
          utrNumber: `UTR${Date.now()}`,
          transactionDate: new Date(),
          reason: 'Payment processed successfully'
        });
        
        // Send notifications
        await disbursement.sendNotifications('all');
      } else {
        await disbursement.updatePaymentStatus('failed', {
          failureReason: 'Insufficient funds in account',
          failureCode: 'INSUF_FUNDS',
          reason: 'Payment failed due to insufficient funds'
        });
      }
    } catch (error) {
      console.error('Error in simulated payment process:', error);
    }
  }, 2000); // 2 second delay to simulate processing time
}

module.exports = router;