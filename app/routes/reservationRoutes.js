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
  getBookingOptions,
  validateCustomerData,
  setBookingType
} = require("../controllers/customerDataController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Pre-reservation: Customer data options (CUSTOMER ACCESS)
router.get("/booking-options", authMiddleware, getBookingOptions);
router.post("/set-booking-type", authMiddleware, setBookingType);
router.get("/customer-data", authMiddleware, getRegisteredData);
router.post("/validate-customer", authMiddleware, validateCustomerData);

// Step-by-step reservation process (PUBLIC/CUSTOMER ACCESS)
router.get("/packages", getAvailablePackages);
router.get("/barbers", getAvailableBarbers);
router.get("/schedules/:barberId", getAvailableSchedules);

// Customer routes (CUSTOMER ACCESS)
router.get("/my-reservations", authMiddleware, getUserReservations);
router.post("/", authMiddleware, createReservation);
router.patch("/:id/cancel", authMiddleware, cancelReservation);

// Admin & Cashier routes (ADMIN or CASHIER ACCESS)
router.get("/", authMiddleware, checkRole(['ADMIN', 'cashier']), getAllReservations);
router.get("/:id", authMiddleware, checkRole(['ADMIN', 'cashier']), getReservationById);
router.patch("/:id/status", authMiddleware, checkRole(['ADMIN', 'cashier']), updateReservationStatus);
router.delete("/:id", authMiddleware, checkRole(['ADMIN', 'cashier']), deleteReservation);

module.exports = router;
