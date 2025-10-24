const mongoose = require("mongoose");

const barberSchema = new mongoose.Schema({
  barberId: {
    type: String,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  // Photo fields
  photo: {
    url: {
      type: String,
      default: null
    },
    publicId: {
      type: String,
      default: null
    }
  },
  isActive: {
    type: Boolean,
    default: true,
  }
}, { 
  timestamps: true 
});

// Pre-save middleware untuk generate barberId
barberSchema.pre('save', async function(next) {
  if (!this.barberId) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000);
    this.barberId = `BBR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${random}`;
  }
  next();
});

module.exports = mongoose.model("Barber", barberSchema);
