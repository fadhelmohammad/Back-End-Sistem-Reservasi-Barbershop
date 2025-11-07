const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware'); // Use existing middleware

const {
  // Payment Option functions
  getAllPaymentOptions,
  getPaymentOptionById,
  createPaymentOption,
  updatePaymentOption,
  deletePaymentOption,
  togglePaymentOptionStatus,
  
  // Payment functions
  getPaymentMethods,
  uploadPaymentProof,
  getPaymentDetails,
  getPendingPayments,
  getPendingReservationsWithPayment,
  getPaymentById,
  verifyPayment
} = require('../controllers/paymentController');

const { authMiddleware, checkRole } = require('../middleware/authMiddleware');

// ========================
// PAYMENT OPTION ROUTES
// ========================

// Public routes for payment options
router.get('/methods', getPaymentMethods);

// Admin & Cashier routes for payment options
router.get('/options', authMiddleware, checkRole(['ADMIN', 'CASHIER']), getAllPaymentOptions);
router.get('/options/:id', authMiddleware, checkRole(['ADMIN', 'CASHIER']), getPaymentOptionById);

// Admin only routes for payment options
router.post('/options', authMiddleware, checkRole('ADMIN'), createPaymentOption);
router.put('/options/:id', authMiddleware, checkRole('ADMIN'), updatePaymentOption);
router.delete('/options/:id', authMiddleware, checkRole('ADMIN'), deletePaymentOption);
router.patch('/options/:id/toggle', authMiddleware, checkRole('ADMIN'), togglePaymentOptionStatus);

// ========================
// PAYMENT ROUTES
// ========================

// Customer routes
router.post('/upload', 
  authMiddleware, 
  checkRole('CUSTOMER'), 
  upload.single('paymentProof'),  // Use your existing middleware
  uploadPaymentProof
);

router.get('/reservation/:reservationId', authMiddleware, getPaymentDetails);

// Admin & Cashier routes  
router.get('/pending', authMiddleware, checkRole(['ADMIN', 'CASHIER']), getPendingPayments);
router.get('/pending-reservations', authMiddleware, checkRole(['ADMIN', 'CASHIER']), getPendingReservationsWithPayment);
router.get('/:paymentId', authMiddleware, checkRole(['ADMIN', 'CASHIER']), getPaymentById);
router.patch('/:paymentId/verify', authMiddleware, checkRole(['ADMIN', 'CASHIER']), verifyPayment);

module.exports = router;