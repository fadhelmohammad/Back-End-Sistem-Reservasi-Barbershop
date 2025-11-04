const express = require("express");
const router = express.Router();

const {
  getAllCashiers,
  getCashierById,
  createCashier,
  updateCashier,
  deleteCashier
} = require("../controllers/cashierController");

const {
  createWalkInReservation,
  completeService
} = require("../controllers/cashierReservationController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Admin-only routes for cashier management
router.use(authMiddleware);

// Cashier CRUD routes (Admin only)
router.get("/", checkRole(['ADMIN']), getAllCashiers);
router.get("/:id", checkRole(['ADMIN']), getCashierById);
router.post("/", checkRole(['ADMIN']), createCashier);
router.put("/:id", checkRole(['ADMIN']), updateCashier);
router.delete("/:id", checkRole(['ADMIN']), deleteCashier);

// Cashier operational routes (Admin or Cashier access)
router.post("/reservations/walk-in", checkRole(['ADMIN', 'cashier']), createWalkInReservation);
router.patch("/reservations/:id/complete", checkRole(['ADMIN', 'cashier']), completeService);

module.exports = router;