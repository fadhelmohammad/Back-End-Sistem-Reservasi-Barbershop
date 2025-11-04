const express = require("express");
const router = express.Router();
const {
  getAllSchedules,
  getAvailableSchedules,
  generateDefaultSchedules,
  updateScheduleStatus,
  bulkUpdateScheduleStatus,
  performCleanup,
  checkExpired
} = require("../controllers/scheduleController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Public routes
router.get("/available", getAvailableSchedules);

// Admin & Cashier routes
router.get("/", authMiddleware, checkRole(['ADMIN', 'CASHIER']), getAllSchedules);

// Admin only routes
router.post("/generate", authMiddleware, checkRole('ADMIN'), generateDefaultSchedules);
router.post("/cleanup", authMiddleware, checkRole('ADMIN'), performCleanup);
router.get("/check-expired", authMiddleware, checkRole('ADMIN'), checkExpired);

// Cashier routes untuk manage schedule availability
router.put("/:id/status", authMiddleware, checkRole(['ADMIN', 'CASHIER']), updateScheduleStatus);
router.put("/bulk/status", authMiddleware, checkRole(['ADMIN', 'CASHIER']), bulkUpdateScheduleStatus);

module.exports = router;
