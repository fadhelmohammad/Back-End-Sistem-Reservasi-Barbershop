const express = require("express");
const router = express.Router();
const {
  getAllCashiers,
  getCashierById,
  createCashier,
  updateCashier,
  deleteCashier,
  getCashierProfile,    // TAMBAHAN
  updateCashierProfile  // TAMBAHAN
} = require("../controllers/cashierController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Get all cashiers (Admin only)
router.get("/", authMiddleware, checkRole('ADMIN'), getAllCashiers);

// Profile routes (self management)
router.get('/profile', authMiddleware, checkRole('CASHIER'), getCashierProfile);
router.put('/profile', authMiddleware, checkRole('CASHIER'), updateCashierProfile);

// Get cashier by ID (Admin only)
router.get("/:id", authMiddleware, checkRole('ADMIN'), getCashierById);

// Create new cashier (Admin only)
router.post("/", authMiddleware, checkRole('ADMIN'), createCashier);

// Update cashier (Admin only)
router.put("/:id", authMiddleware, checkRole('ADMIN'), updateCashier);

// Delete cashier (Admin only)
router.delete("/:id", authMiddleware, checkRole('ADMIN'), deleteCashier);

module.exports = router;