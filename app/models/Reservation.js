const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema({
  reservationId: {
    type: String,
    unique: true,
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerPhone: {
    type: String,
    required: true
  },
  customerEmail: String,
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Package",
    required: true
  },
  barber: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Barber",
    required: true
  },
  schedule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Schedule",
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "completed"],
    default: "pending"
  },
  notes: String,
  paymentMethod: {
    type: String,
    enum: ["cash", "bank_transfer", "e_wallet"],
    default: "cash"
  },
  
  // TAMBAHAN: Payment reference
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Payment"
  },
  
  // TAMBAHAN: Tracking fields
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  confirmedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancelReason: String,
  
  isWalkIn: {
    type: Boolean,
    default: false
  },
  isOwnProfile: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Generate reservationId before saving
reservationSchema.pre('save', async function(next) {
  if (!this.reservationId) {
    try {
      const count = await this.constructor.countDocuments();
      this.reservationId = `RES${String(count + 1).padStart(4, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("Reservation", reservationSchema);
