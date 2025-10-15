const express = require("express");
const router = express.Router();

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
    set: function(value) {
      // Convert to title case
      return value
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  },
  price: {
    type: Number,
    required: true,
    min: [1, 'Price must be greater than 0']
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
    const count = await this.constructor.countDocuments();
    this.packageId = `PKG${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

module.exports = mongoose.model("Package", packageSchema);

const {
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  getActivePackages
} = require("../controllers/packageController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Public routes
router.get("/active", getActivePackages);

// Admin routes
router.get("/", authMiddleware, checkRole('ADMIN'), getAllPackages);
router.get("/:id", authMiddleware, checkRole('ADMIN'), getPackageById);
router.post("/", authMiddleware, checkRole('ADMIN'), createPackage);
router.put("/:id", authMiddleware, checkRole('ADMIN'), updatePackage);
router.delete("/:id", authMiddleware, checkRole('ADMIN'), deletePackage);

module.exports = router;