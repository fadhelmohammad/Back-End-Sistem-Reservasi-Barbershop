const mongoose = require('mongoose');

// Payment Option Schema (embedded in Payment.js)
const paymentOptionSchema = new mongoose.Schema({
  optionId: {
    type: String,
    unique: true
  },
  type: {
    type: String,
    enum: ['bank_transfer', 'e_wallet'],
    required: true
  },
  name: {
    type: String,
    required: true // e.g., "BCA", "Mandiri", "GoPay", "OVO"
  },
  displayName: {
    type: String,
    required: true // e.g., "Bank Central Asia", "GoPay (Gojek)"
  },
  accountNumber: {
    type: String,
    required: function() {
      return this.type === 'bank_transfer';
    }
  },
  accountName: {
    type: String,
    required: function() {
      return this.type === 'bank_transfer';
    }
  },
  phoneNumber: {
    type: String,
    required: function() {
      return this.type === 'e_wallet';
    }
  },
  walletName: {
    type: String,
    required: function() {
      return this.type === 'e_wallet';
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    default: ""
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Auto-generate optionId for PaymentOption
paymentOptionSchema.pre('save', async function(next) {
  if (!this.optionId) {
    const count = await mongoose.model('PaymentOption').countDocuments();
    this.optionId = `PMT${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// Payment Schema (existing)
const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    unique: true,
    required: true
  },
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reservation',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'e_wallet'],
    required: true
  },
  bankAccount: {
    bankName: String,
    accountNumber: String,
    accountName: String
  },
  eWallet: {
    walletType: String,
    walletNumber: String,
    walletName: String
  },
  proofOfPayment: {
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    originalName: String
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verificationNote: String,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date
}, {
  timestamps: true
});

// Generate paymentId before saving
paymentSchema.pre('save', async function(next) {
  if (!this.paymentId) {
    const count = await mongoose.model('Payment').countDocuments();
    this.paymentId = `PAY${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// Indexes for PaymentOption
paymentOptionSchema.index({ type: 1, isActive: 1 });
paymentOptionSchema.index({ sortOrder: 1 });

// Export both models
const Payment = mongoose.model('Payment', paymentSchema);
const PaymentOption = mongoose.model('PaymentOption', paymentOptionSchema);

module.exports = { Payment, PaymentOption };