const express = require("express");
const router = express.Router();

const {
  getAllCashiers,
  getCashierById,
  createCashier,
  updateCashier,
  deleteCashier
} = require("../controllers/cashierController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// All routes require admin access
router.use(authMiddleware);
router.use(checkRole('ADMIN'));

// Cashier CRUD routes
router.get("/", getAllCashiers);
router.get("/:id", getCashierById);
router.post("/", createCashier);
router.put("/:id", updateCashier);
router.delete("/:id", deleteCashier);

module.exports = router;