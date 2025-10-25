const express = require("express");
const router = express.Router();

const {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  loginCustomer,
  updateCustomer,
  deleteCustomer
} = require("../controllers/customerController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Public routes
router.post("/register", createCustomer);
router.post("/login", loginCustomer);

// Admin-only routes for customer management
router.get("/", authMiddleware, checkRole('ADMIN'), getAllCustomers);
router.get("/:id", authMiddleware, checkRole('ADMIN'), getCustomerById);
router.put("/:id", authMiddleware, checkRole('ADMIN'), updateCustomer);
router.delete("/:id", authMiddleware, checkRole('ADMIN'), deleteCustomer);

module.exports = router;