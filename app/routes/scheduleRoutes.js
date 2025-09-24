const express = require("express");
const router = express.Router();
const {
  createSchedule,
  getAllSchedules,
  getAvailableSchedules,
  getScheduleById
} = require("../controllers/scheduleController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");


router.post("/",authMiddleware, checkRole('cashier','admin'), createSchedule);
router.get("/", authMiddleware, getAllSchedules);
router.get("/available", authMiddleware, getAvailableSchedules);
router.get("/:id", authMiddleware, getScheduleById);

module.exports = router;
