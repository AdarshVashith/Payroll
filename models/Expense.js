const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  expenseType: {
    type: String,
    enum: ['travel', 'meals', 'accommodation', 'transportation', 'office-supplies', 'training', 'other'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  expenseDate: {
    type: Date,
    required: true
  },
  submittedDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected', 'paid'],
    default: 'draft'
  },
  approvalWorkflow: [{
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    level: Number,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected']
    },
    comments: String,
    actionDate: Date
  }],
  receipts: [{
    filename: String,
    originalName: String,
    url: String,
    uploadDate: { type: Date, default: Date.now }
  }],
  category: {
    type: String,
    required: true
  },
  project: {
    type: String
  },
  businessPurpose: {
    type: String,
    required: true
  },
  reimbursementMethod: {
    type: String,
    enum: ['direct-deposit', 'check', 'petty-cash'],
    default: 'direct-deposit'
  },
  paidDate: {
    type: Date
  },
  paidAmount: {
    type: Number
  },
  notes: {
    type: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp before saving
expenseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);