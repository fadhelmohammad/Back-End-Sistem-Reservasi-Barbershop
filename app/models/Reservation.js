const mongoose = require('mongoose');
require('./Package');      // ← FIX 100% ERROR


const reservationSchema = new mongoose.Schema({
  reservationId: {
    type: String,
    unique: true
    // HAPUS required: true, karena akan di-generate otomatis
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // ✅ CHANGED: tidak required untuk booking manual
  },
  customerName: {
    type: String,
    required: true
  },
  customerPhone: {
    type: String,
    required: true
  },
  customerEmail: {
    type: String,
    required: true
  },
  createdBy: { // ✅ TAMBAHAN: siapa yang membuat reservation
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  barber: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Barber',
    required: true
  },
  schedule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  notes: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  confirmedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  }
  
}, {
  timestamps: true
});

// Auto-generate reservationId before saving
reservationSchema.pre('save', async function(next) {
  if (!this.reservationId) {
    const count = await mongoose.model('Reservation').countDocuments();
    this.reservationId = `RES${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Indexes for better query performance
reservationSchema.index({ customer: 1, status: 1 });
reservationSchema.index({ createdBy: 1, status: 1 }); // ✅ NEW INDEX
reservationSchema.index({ barber: 1, status: 1 });
reservationSchema.index({ schedule: 1 });
reservationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Reservation', reservationSchema);
