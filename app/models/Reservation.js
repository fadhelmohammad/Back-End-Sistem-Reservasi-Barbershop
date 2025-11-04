const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema({
  reservationId: {
    type: String,
    unique: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false // Allow null for walk-in customers
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerPhone: {
    type: String,
    required: true,
    trim: true
  },
  customerEmail: {
    type: String,
    trim: true,
    default: ""
  },
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
    enum: ["pending", "confirmed", "in-progress", "completed", "cancelled"],
    default: "pending"
  },
  notes: {
    type: String,
    trim: true
  },
  serviceNotes: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ["cash", "card", "digital_wallet"],
    default: "cash"
  },
  isWalkIn: {
    type: Boolean,
    default: false
  },
  isOwnProfile: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String, // userId of who created the reservation
    required: false
  },
  completedBy: {
    type: String, // userId of cashier who completed the service
    required: false
  },
  completedAt: {
    type: Date,
    required: false
  }
}, { 
  timestamps: true 
});

// Pre-save middleware untuk generate reservationId
reservationSchema.pre('save', async function(next) {
  if (!this.reservationId) {
    const count = await this.constructor.countDocuments();
    this.reservationId = `RES${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model("Reservation", reservationSchema);
