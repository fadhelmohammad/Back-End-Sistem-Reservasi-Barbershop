const express = require("express");
const router = express.Router();
const {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  loginCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerProfile,    // TAMBAHAN
  updateCustomerProfile  // TAMBAHAN
} = require("../controllers/customerController");

const { authMiddleware, checkRole } = require("../middleware/authMiddleware");

// Public routes
router.post("/register", createCustomer);
router.post("/login", loginCustomer);

// Profile routes (self management)
router.get('/profile', authMiddleware, checkRole('CUSTOMER'), getCustomerProfile);
router.put('/profile', authMiddleware, checkRole('CUSTOMER'), updateCustomerProfile);

// Admin & Cashier routes
router.get("/", authMiddleware, checkRole(['ADMIN', 'CASHIER']), getAllCustomers);
router.get("/:id", authMiddleware, checkRole(['ADMIN', 'CASHIER']), getCustomerById);

// Admin only routes
router.put("/:id", authMiddleware, checkRole('ADMIN'), updateCustomer);
router.delete("/:id", authMiddleware, checkRole('ADMIN'), deleteCustomer);

module.exports = router;