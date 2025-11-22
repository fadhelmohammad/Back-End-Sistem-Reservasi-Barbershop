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
    trim: true,
    lowercase: true,
    validate: {
      validator: function(email) {
        // ✅ Email not required for walk-in reservations
        if (this.isWalkIn && !email) {
          return true; // Allow null/undefined for walk-in
        }
        // ✅ If email provided, validate format
        if (email) {
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
        }
        // ✅ For non-walk-in, email is required
        return !this.isWalkIn ? false : true;
      },
      message: 'Please enter a valid email address'
    },
    required: function() {
      // ✅ Email required only for non-walk-in reservations
      return !this.isWalkIn;
    }
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
  },
  isWalkIn: {
    type: Boolean,
    default: false
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  serviceNotes: {
    type: String,
    trim: true,
    default: ''
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'e_wallet'],
    default: null
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

// ✅ Export pattern
delete mongoose.models.Reservation;
module.exports = mongoose.model("Reservation", reservationSchema);
