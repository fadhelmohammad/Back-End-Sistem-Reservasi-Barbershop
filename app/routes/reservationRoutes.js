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
  updateReservationStatus,
  cancelReservation,
  deleteReservation
} = require("../controllers/reservationController");

const {
  getRegisteredData,
  validateCustomerData
} = require("../controllers/customerDataController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Pre-reservation: Customer data
router.get("/customer-data", authMiddleware, getRegisteredData);
router.post("/validate-customer", authMiddleware, validateCustomerData);

// Step-by-step reservation process (Public access untuk flexibility)
router.get("/packages", getAvailablePackages);  // ← Ini untuk reservation flow
router.get("/barbers", getAvailableBarbers);  
router.get("/schedules/:barberId", getAvailableSchedules);

// Customer routes
router.post("/", authMiddleware, createReservation);
router.get("/my-reservations", authMiddleware, getUserReservations);
router.patch("/:id/cancel", authMiddleware, cancelReservation);

// Admin routes
router.get("/", authMiddleware, checkRole('ADMIN'), getAllReservations);
router.get("/:id", authMiddleware, checkRole('ADMIN'), getReservationById);
router.patch("/:id/status", authMiddleware, checkRole('ADMIN'), updateReservationStatus);
router.delete("/:id", authMiddleware, checkRole('ADMIN'), deleteReservation);

module.exports = router;
