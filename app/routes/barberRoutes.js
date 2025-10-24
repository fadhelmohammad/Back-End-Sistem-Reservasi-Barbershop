const express = require("express");
const router = express.Router();

const {
  getAllBarbers,
  getActiveBarbers,
  getBarberById,
  createBarber,
  updateBarber,
  deleteBarber
} = require("../controllers/barberController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");
const { handleUpload } = require("../middleware/uploadMiddleware");

// Public routes
router.get("/active", getActiveBarbers);

// Admin routes with photo upload
router.get("/", authMiddleware, checkRole('ADMIN'), getAllBarbers);
router.get("/:id", authMiddleware, checkRole('ADMIN'), getBarberById);
router.post("/", authMiddleware, checkRole('ADMIN'), handleUpload, createBarber);
router.put("/:id", authMiddleware, checkRole('ADMIN'), handleUpload, updateBarber);
router.delete("/:id", authMiddleware, checkRole('ADMIN'), deleteBarber);

module.exports = router;
