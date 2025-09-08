const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema({
  reservationId: {
    type: String,
    unique: true,
  },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  schedule: { type: mongoose.Schema.Types.ObjectId, ref: "Schedule", required: true },
  status: { type: String, enum: ["pending", "confirmed", "cancelled", "rejected"], default: "pending" },
}, { timestamps: true, optimisticConcurrency: true });

// Pre-save middleware untuk generate reservationId
reservationSchema.pre('save', async function(next) {
  if (!this.reservationId) {
    const date = new Date(this.createdAt || Date.now());
    const dateStr = date.toISOString().slice(0,10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    this.reservationId = `RSV-${dateStr}-${randomNum}`;
  }
  next();
});

module.exports = mongoose.model("Reservation", reservationSchema);
