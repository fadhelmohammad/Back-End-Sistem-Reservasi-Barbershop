const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
  scheduleId: {
    type: String,
    unique: true,
  },
  barber: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Barber",
    required: true,
  },
  scheduled_time: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["available", "booked", "unavailable"],
    default: "available",
  },
  __v: { // OCC versioning
    type: Number,
    select: true,
  },
}, { timestamps: true });

// Pre-save middleware untuk generate scheduleId
scheduleSchema.pre('save', async function(next) {
  if (!this.scheduleId) {
    // Format: SCH-YYYYMMDD-XXXX (X adalah random number)
    const date = new Date(this.scheduled_time);
    const dateStr = date.toISOString().slice(0,10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 digit random number
    this.scheduleId = `SCH-${dateStr}-${randomNum}`;
  }
  next();
});

module.exports = mongoose.model("Schedule", scheduleSchema);
