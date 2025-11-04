const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
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
    required: true // e.g., "09:00", "09:30", "10:00"
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
  }
}, {
  timestamps: true
});

// Compound unique index untuk mencegah duplicate
scheduleSchema.index({ barber: 1, date: 1, timeSlot: 1 }, { unique: true });

// Index untuk query performance
scheduleSchema.index({ status: 1, scheduled_time: 1 });
scheduleSchema.index({ barber: 1, status: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);
