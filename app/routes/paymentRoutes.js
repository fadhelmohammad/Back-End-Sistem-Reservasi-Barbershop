const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');

const {
  getPaymentMethods,
  uploadPaymentProof,
  getPaymentDetails,
  getPendingPayments,
  getPendingReservationsWithPayment, // TAMBAHAN
  getPaymentById,
  verifyPayment
} = require('../controllers/paymentController');

const { authMiddleware, checkRole } = require('../middleware/authMiddleware');

// Public routes
router.get('/methods', getPaymentMethods);

// Customer routes (authentication required)
router.post('/upload-proof', authMiddleware, upload.single('paymentProof'), uploadPaymentProof);
router.get('/details/:reservationId', authMiddleware, getPaymentDetails);

// Admin/Cashier routes
router.get('/pending', authMiddleware, checkRole(['admin', 'cashier']), getPendingPayments);
router.get('/pending-reservations', authMiddleware, checkRole(['admin', 'cashier']), getPendingReservationsWithPayment); // TAMBAHAN
router.get('/:paymentId', authMiddleware, checkRole(['admin', 'cashier']), getPaymentById);
router.patch('/verify/:paymentId', authMiddleware, checkRole(['admin', 'cashier']), verifyPayment);

module.exports = router;