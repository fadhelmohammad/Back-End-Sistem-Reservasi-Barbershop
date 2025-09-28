const express = require("express");
const router = express.Router();

const {
  createPackage,
  getAllPackages,
  getPackageById,
  updatePackage,
  deletePackage,
  permanentDeletePackage
} = require("../controllers/packageController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Public routes
router.get("/", getAllPackages);
router.get("/:id", getPackageById);

// Admin routes
router.post("/", authMiddleware, checkRole('ADMIN'), createPackage);
router.put("/:id", authMiddleware, checkRole('ADMIN'), updatePackage);
router.delete("/:id", authMiddleware, checkRole('ADMIN'), deletePackage);
router.delete("/:id/permanent", authMiddleware, checkRole('ADMIN'), permanentDeletePackage);

module.exports = router;