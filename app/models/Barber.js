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
    set: function(value) {
      // Convert to title case
      return value
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  },
  photo: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true 
});

// Pre-save middleware untuk generate barberId
barberSchema.pre('save', async function(next) {
  if (!this.barberId) {
    const count = await this.constructor.countDocuments();
    this.barberId = `BRB${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

module.exports = mongoose.model("Barber", barberSchema);
