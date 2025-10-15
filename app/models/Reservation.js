const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema({
  reservationId: {
    type: String,
    unique: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
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
    enum: ["pending", "confirmed", "in_progress", "completed", "cancelled"],
    default: "pending"
  },
  notes: {
    type: String,
    trim: true
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
