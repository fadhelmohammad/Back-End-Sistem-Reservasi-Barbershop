const express = require("express");
const router = express.Router();
const {
  getAllSchedules,
  getBarberSchedules,
  getAvailableSchedules,
  generateDefaultSchedules,
  generateSchedulesForBarber,
  getBarberScheduleStats,
  toggleScheduleSlot,
  bulkToggleScheduleSlots,
  getScheduleAvailabilityOverview,
  updateScheduleStatus,
  bulkUpdateScheduleStatus,
  performCleanup,
  checkExpired,
  createSchedule
} = require("../controllers/scheduleController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Public routes
router.get("/available", getAvailableSchedules);

// Admin & Cashier routes
router.get("/", authMiddleware, checkRole(['ADMIN', 'CASHIER']), getAllSchedules);

// Barber-specific schedule management
router.get("/barber/:barberId", authMiddleware, checkRole(['ADMIN', 'CASHIER']), getBarberSchedules);
router.get("/barber/:barberId/overview", authMiddleware, checkRole(['ADMIN', 'CASHIER']), getScheduleAvailabilityOverview);

// Individual slot management
router.put("/slot/:scheduleId/toggle", authMiddleware, checkRole(['ADMIN', 'CASHIER']), toggleScheduleSlot);

// Bulk slot management for specific barber
router.put("/barber/:barberId/bulk-toggle", authMiddleware, checkRole(['ADMIN', 'CASHIER']), bulkToggleScheduleSlots);

// Admin & Cashier routes (UPDATED - Allow both)
router.post("/", authMiddleware, checkRole(['ADMIN', 'CASHIER']), createSchedule);
router.post("/generate", authMiddleware, checkRole(['ADMIN', 'CASHIER']), generateDefaultSchedules);

// Admin only routes
router.post("/cleanup", authMiddleware, checkRole('ADMIN'), performCleanup);
router.get("/check-expired", authMiddleware, checkRole('ADMIN'), checkExpired);

// Generate schedules for specific barber (Admin & Cashier)
router.post('/generate/:barberId', authMiddleware, checkRole(['ADMIN', 'CASHIER']), generateSchedulesForBarber);
router.get('/stats/:barberId', authMiddleware, checkRole(['ADMIN', 'CASHIER']), getBarberScheduleStats);

// Legacy routes (still supported)
router.put("/:id/status", authMiddleware, checkRole(['ADMIN', 'CASHIER']), updateScheduleStatus);
router.put("/bulk/status", authMiddleware, checkRole(['ADMIN', 'CASHIER']), bulkUpdateScheduleStatus);

module.exports = router;
