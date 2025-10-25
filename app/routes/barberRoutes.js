const express = require("express");
const router = express.Router();

const {
  getAllBarbers,
  getBarberById,
  createBarber,
  updateBarber,
  activateBarber,
  deactivateBarber,
  toggleBarberStatus,
  deleteBarber,
  getActiveBarbers,
  getInactiveBarbers
} = require("../controllers/barberController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// Public routes
router.get("/", getAllBarbers);
router.get("/active", getActiveBarbers);
router.get("/inactive", getInactiveBarbers);
router.get("/:id", getBarberById);

// Admin/Cashier routes
router.post("/", 
  authMiddleware, 
  checkRole('ADMIN', 'CASHIER'), 
  upload.single('photo'),
  createBarber
);

router.put("/:id", 
  authMiddleware, 
  checkRole('ADMIN', 'CASHIER'), 
  upload.single('photo'),
  updateBarber
);

// Status management routes (Admin only)
router.patch("/:id/activate", 
  authMiddleware, 
  checkRole('ADMIN'), 
  activateBarber
);

router.patch("/:id/deactivate", 
  authMiddleware, 
  checkRole('ADMIN'), 
  deactivateBarber
);

router.patch("/:id/toggle-status", 
  authMiddleware, 
  checkRole('ADMIN'), 
  toggleBarberStatus
);

// Permanent delete (Admin only)
router.delete("/:id", 
  authMiddleware, 
  checkRole('ADMIN'), 
  deleteBarber
);

module.exports = router;
