const express = require('express');
const router = express.Router();

const {
  getAllReservationHistory,
  getAdminVerificationHistory,
  getCustomerReservationHistory,
  getCashierReservationHistory
} = require('../controllers/historyController');

const { authMiddleware, checkRole } = require('../middleware/authMiddleware');

// ✅ Simplified Admin routes - HANYA SATU ENDPOINT
router.get('/admin', authMiddleware, checkRole(['ADMIN']), getAllReservationHistory);

// Cashier routes
router.get('/cashier', authMiddleware, checkRole(['CASHIER']), getCashierReservationHistory);

// Customer routes
router.get('/customer', authMiddleware, checkRole(['CUSTOMER']), getCustomerReservationHistory);

// Generic route berdasarkan role
router.get('/', authMiddleware, (req, res, next) => {
  const role = req.user.role?.toUpperCase();
  
  if (role === 'ADMIN') {
    return getAllReservationHistory(req, res);
  } else if (role === 'CASHIER') {
    return getCashierReservationHistory(req, res);
  } else if (role === 'CUSTOMER') {
    return getCustomerReservationHistory(req, res);
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied"
    });
  }
});

module.exports = router;