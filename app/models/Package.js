const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema({
  packageId: {
    type: String,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true // Tambahkan unique pada name juga
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
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

// Pre-save middleware untuk generate packageId
packageSchema.pre('save', async function(next) {
  if (!this.packageId) {
    try {
      const count = await this.constructor.countDocuments();
      this.packageId = `PKG${String(count + 1).padStart(3, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("Package", packageSchema);