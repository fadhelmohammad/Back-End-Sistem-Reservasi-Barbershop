const express = require("express");
const router = express.Router();

const {
  getAllBarbers,
  getBarberById,
  createBarber,
  updateBarber,
  deleteBarber,
  getActiveBarbers
} = require("../controllers/barberController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Public routes
router.get("/active", getActiveBarbers);

// Admin routes
router.get("/", authMiddleware, checkRole('admin'), getAllBarbers);
router.get("/:id", authMiddleware, checkRole('admin'), getBarberById);
router.post("/", authMiddleware, checkRole('admin'), createBarber);
router.put("/:id", authMiddleware, checkRole('admin'), updateBarber);
router.delete("/:id", authMiddleware, checkRole('admin'), deleteBarber);

module.exports = router;
