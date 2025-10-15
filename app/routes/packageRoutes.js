const express = require("express");
const router = express.Router();

const {
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  getActivePackages
} = require("../controllers/packageController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// ✅ PUBLIC ROUTE - Customer bisa akses
router.get("/active", getActivePackages);

// Admin routes
router.get("/", authMiddleware, checkRole('ADMIN'), getAllPackages);
router.get("/:id", authMiddleware, checkRole('ADMIN'), getPackageById);
router.post("/", authMiddleware, checkRole('ADMIN'), createPackage);
router.put("/:id", authMiddleware, checkRole('ADMIN'), updatePackage);
router.delete("/:id", authMiddleware, checkRole('ADMIN'), deletePackage);

module.exports = router;