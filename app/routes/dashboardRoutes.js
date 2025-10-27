const express = require("express");
const router = express.Router();
const { getDashboardStats, getDetailedStats } = require("../controllers/dashboardController");
const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Basic dashboard stats
router.get("/admin", authMiddleware, checkRole('ADMIN'), getDashboardStats);

// Detailed dashboard stats (optional)
router.get("/detailed", authMiddleware, checkRole('ADMIN'), getDetailedStats);

module.exports = router;