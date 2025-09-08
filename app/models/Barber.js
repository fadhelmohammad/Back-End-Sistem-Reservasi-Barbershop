const mongoose = require("mongoose");

const barberSchema = new mongoose.Schema({
  barberId: {
    type: String,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });

// Pre-save middleware untuk generate barberId
barberSchema.pre('save', async function(next) {
  if (!this.barberId) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0,10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    this.barberId = `BBR-${dateStr}-${randomNum}`;
  }
  next();
});

module.exports = mongoose.model("Barber", barberSchema);
