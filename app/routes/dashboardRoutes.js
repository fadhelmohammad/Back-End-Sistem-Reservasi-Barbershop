const express = require("express");
const router = express.Router();

const { getDashboardStats } = require("../controllers/dashboardController");
const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

router.get("/stats", authMiddleware, checkRole('ADMIN'), getDashboardStats);

module.exports = router;