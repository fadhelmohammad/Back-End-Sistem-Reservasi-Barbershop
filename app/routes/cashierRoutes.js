const express = require('express');
const router = express.Router();
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');

// ✅ Import from cashierController (existing functions)
const {
  getAllCashiers,
  getCashierById,
  createCashier,
  updateCashier,
  deleteCashier,
  updateCashierPassword
} = require('../controllers/cashierController');

// ✅ Import from cashierReservationController (NEW functions)
const {
  manageWalkInReservation, // ✅ GABUNG FUNCTION
  getCashierWalkInReservations
} = require('../controllers/cashierReservationController');

// ===== CASHIER MANAGEMENT ROUTES (Admin only) =====
router.get('/', authMiddleware, checkRole(['ADMIN']), getAllCashiers);
router.get('/:id', authMiddleware, checkRole(['ADMIN']), getCashierById);
router.post('/', authMiddleware, checkRole(['ADMIN']), createCashier);
router.put('/:id', authMiddleware, checkRole(['ADMIN']), updateCashier);
router.delete('/:id', authMiddleware, checkRole(['ADMIN']), deleteCashier);
router.patch('/:id/password', authMiddleware, checkRole(['ADMIN']), updateCashierPassword);

// ===== WALK-IN RESERVATION ROUTES (Cashier only) =====
router.post('/walk-in-reservation', authMiddleware, checkRole(['CASHIER']), manageWalkInReservation); // ✅ GABUNG ENDPOINT
router.get('/walk-in-reservations', authMiddleware, checkRole(['CASHIER']), getCashierWalkInReservations);

module.exports = router;