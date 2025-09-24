const express = require("express");
const router = express.Router();

const {
  createReservation,
  getAllReservations,
  getReservationById,
  getUserReservations,
  updateReservationStatus,
  cancelReservation,
  deleteReservation
} = require("../controllers/reservationController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Protected routes (require authentication)
router.post("/", authMiddleware, createReservation);
router.get("/my-reservations", authMiddleware, getUserReservations);
router.patch("/:id/cancel", authMiddleware, cancelReservation);

// Admin routes
router.get("/", authMiddleware, getAllReservations);
router.get("/:id", authMiddleware, getReservationById);
router.patch("/:id/status", authMiddleware, checkRole ('admin'), updateReservationStatus);
router.delete("/:id", authMiddleware, deleteReservation);

module.exports = router;
