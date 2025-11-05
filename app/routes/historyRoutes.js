const express = require('express');
const router = express.Router();

const {
  getAllReservationHistory,
  getCashierReservationHistory,
  getCustomerReservationHistory
} = require('../controllers/historyController');

const { authMiddleware, checkRole } = require('../middleware/authMiddleware');

// Admin routes - dapat melihat semua riwayat
router.get('/admin', authMiddleware, checkRole(['admin']), getAllReservationHistory);

// Cashier routes - hanya riwayat yang dikonfirmasi olehnya
router.get('/cashier', authMiddleware, checkRole(['cashier']), getCashierReservationHistory);

// Customer routes - riwayat reservasi miliknya
router.get('/customer', authMiddleware, checkRole(['customer']), getCustomerReservationHistory);

// Generic route berdasarkan role
router.get('/', authMiddleware, (req, res, next) => {
  const role = req.user.role?.toLowerCase();
  
  if (role === 'admin') {
    return getAllReservationHistory(req, res);
  } else if (role === 'cashier') {
    return getCashierReservationHistory(req, res);
  } else if (role === 'customer') {
    return getCustomerReservationHistory(req, res);
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied"
    });
  }
});

module.exports = router;