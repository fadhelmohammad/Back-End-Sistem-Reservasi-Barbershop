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

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Step-by-step reservation process
router.get("/packages", getAvailablePackages); // Step 1: Get packages
router.get("/barbers", getAvailableBarbers); // Step 2: Get barbers  
router.get("/schedules/:barberId", getAvailableSchedules); // Step 3: Get schedules

// Customer routes
router.post("/", authMiddleware, createReservation); // Step 4: Create reservation
router.get("/my-reservations", authMiddleware, getUserReservations);
router.patch("/:id/cancel", authMiddleware, cancelReservation);

// Admin routes
router.get("/", authMiddleware, checkRole('admin'), getAllReservations);
router.get("/:id", authMiddleware, checkRole('admin'), getReservationById);
router.patch("/:id/status", authMiddleware, checkRole('admin'), updateReservationStatus);
router.delete("/:id", authMiddleware, checkRole('admin'), deleteReservation);

module.exports = router;
