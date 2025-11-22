const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  scheduleId: {
    type: String,
    unique: true
  },
  barber: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Barber',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  timeSlot: {
    type: String,
    required: true // e.g., "11:00", "12:00", "13:00"
  },
  scheduled_time: {
    type: Date,
    required: true // Full datetime for the appointment
  },
  status: {
    type: String,
    enum: ['available', 'booked', 'unavailable', 'completed', 'expired'],
    default: 'available'
  },
  reservation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reservation',
    default: null
  },
  isDefaultSlot: {
    type: Boolean,
    default: true
  },
  dayOfWeek: {
    type: Number, // 0=Sunday, 1=Monday, etc.
    required: true
  },
  completedAt: {
    type: Date,
    default: null
  },
  
  // Tracking fields for slot management
  lastModifiedBy: {
    type: String, // userId who last modified
    default: null
  },
  lastModifiedAt: {
    type: Date,
    default: null
  },
  lastModificationReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Auto-generate scheduleId
scheduleSchema.pre('save', async function(next) {
  if (!this.scheduleId) {
    const count = await mongoose.model('Schedule').countDocuments();
    this.scheduleId = `SCH${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

// Compound unique index
scheduleSchema.index({ barber: 1, date: 1, timeSlot: 1 }, { unique: true });

// Performance indexes
scheduleSchema.index({ status: 1, scheduled_time: 1 });
scheduleSchema.index({ barber: 1, status: 1 });
scheduleSchema.index({ barber: 1, date: 1 });

// ✅ Export pattern
delete mongoose.models.Schedule;
module.exports = mongoose.model("Schedule", scheduleSchema);
