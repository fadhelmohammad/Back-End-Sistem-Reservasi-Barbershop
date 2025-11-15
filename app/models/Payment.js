const mongoose = require('mongoose');

// Payment Option Schema
const paymentOptionSchema = new mongoose.Schema({
  optionId: { type: String, unique: true },
  type: { type: String, enum: ['bank_transfer', 'e_wallet'], required: true },
  name: { type: String, required: true },
  accountNumber: {
    type: String,
    required: function() { return this.type === 'bank_transfer'; }
  },
  accountName: {
    type: String,
    required: function() { return this.type === 'bank_transfer'; }
  },
  phoneNumber: {
    type: String,
    required: function() { return this.type === 'e_wallet'; }
  },
  walletName: {
    type: String,
    required: function() { return this.type === 'e_wallet'; }
  },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

// Auto ID
paymentOptionSchema.pre('save', async function(next) {
  if (!this.optionId) {
    const count = await mongoose.models.PaymentOption.countDocuments();
    this.optionId = `PMT${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// Payment Schema
const paymentSchema = new mongoose.Schema({
  paymentId: { type: String, unique: true, required: true },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['bank_transfer', 'e_wallet'], required: true },
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
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    originalName: String
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verificationNote: String,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date
}, { timestamps: true });

// Auto ID
paymentSchema.pre('save', async function(next) {
  if (!this.paymentId) {
    const count = await mongoose.models.Payment.countDocuments();
    this.paymentId = `PAY${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// FIX EXPORT
const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
const PaymentOption = mongoose.models.PaymentOption || mongoose.model('PaymentOption', paymentOptionSchema);

module.exports = { Payment, PaymentOption };
