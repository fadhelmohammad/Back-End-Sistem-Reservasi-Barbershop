const express = require("express");
const router = express.Router();

const {
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin
} = require("../controllers/adminController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// All admin routes require ADMIN role
router.get("/", authMiddleware, checkRole('ADMIN'), getAllAdmins);
router.get("/:id", authMiddleware, checkRole('ADMIN'), getAdminById);
router.post("/", authMiddleware, checkRole('ADMIN'), createAdmin);
router.put("/:id", authMiddleware, checkRole('ADMIN'), updateAdmin);
router.delete("/:id", authMiddleware, checkRole('ADMIN'), deleteAdmin);

module.exports = router;