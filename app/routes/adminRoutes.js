const express = require("express");
const router = express.Router();
const {
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getAdminProfile,    // TAMBAHAN
  updateAdminProfile  // TAMBAHAN
} = require("../controllers/adminController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Get all admins (Admin only)
router.get("/", authMiddleware, checkRole('ADMIN'), getAllAdmins);

// Profile routes (self management)
router.get('/profile', authMiddleware, checkRole('ADMIN'), getAdminProfile);
router.put('/profile', authMiddleware, checkRole('ADMIN'), updateAdminProfile);

// Get admin by ID (Admin only)
router.get("/:id", authMiddleware, checkRole('ADMIN'), getAdminById);

// Create new admin (Admin only)
router.post("/", authMiddleware, checkRole('ADMIN'), createAdmin);

// Update admin (Admin only)
router.patch("/:id", authMiddleware, checkRole('ADMIN'), updateAdmin);

// Delete admin (Admin only)
router.delete("/:id", authMiddleware, checkRole('ADMIN'), deleteAdmin);

module.exports = router;