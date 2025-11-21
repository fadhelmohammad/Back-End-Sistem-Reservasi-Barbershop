const express = require("express");
const router = express.Router();

const {
  getAvailablePackages,
  getAvailableBarbers,
  getAvailableSchedules,
  createReservation,
  getAllReservations,
  getReservationById,
  getUserReservations,
  getConfirmedReservations,
  updateReservationStatus,
  cancelReservation,
  deleteReservation,
  checkPaymentDeadline
} = require("../controllers/reservationController");

const {
  submitCustomerData
} = require("../controllers/preReservationController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// ✅ NEW: Pre-reservation data input (CUSTOMER ACCESS)
router.post("/customer-data", authMiddleware, submitCustomerData);

// Step-by-step reservation process (PUBLIC/CUSTOMER ACCESS)
router.get("/packages", getAvailablePackages);
router.get("/barbers", getAvailableBarbers);
router.get("/schedules/:barberId", getAvailableSchedules);

// Customer routes (CUSTOMER ACCESS)
router.get("/my-reservations", authMiddleware, getUserReservations);
router.post("/", authMiddleware, createReservation);
router.patch("/:id/cancel", authMiddleware, cancelReservation);

// ✅ Check payment deadline (CUSTOMER ACCESS) - FIXED: use authMiddleware
router.get('/check-deadline/:reservationId', authMiddleware, checkPaymentDeadline);

// Admin & Cashier routes (ADMIN or CASHIER ACCESS)
router.get("/", authMiddleware, checkRole(['ADMIN', 'cashier']), getAllReservations);
router.get("/confirmed", authMiddleware, checkRole(['ADMIN', 'cashier']), getConfirmedReservations);
router.get("/:id", authMiddleware, checkRole(['ADMIN', 'cashier']), getReservationById);
router.patch("/:id/status", authMiddleware, checkRole(['ADMIN', 'cashier']), updateReservationStatus);
router.delete("/:id", authMiddleware, checkRole(['ADMIN']), deleteReservation);

module.exports = router;
