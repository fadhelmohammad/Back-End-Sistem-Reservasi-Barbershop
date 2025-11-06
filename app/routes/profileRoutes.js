const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { getAdminProfile, updateAdminProfile } = require('../controllers/adminController');
const { getCashierProfile, updateCashierProfile } = require('../controllers/cashierController');
const { getCustomerProfile, updateCustomerProfile } = require('../controllers/customerController');

// Universal profile getter based on role
router.get('/', authMiddleware, (req, res, next) => {
  const role = req.user.role?.toLowerCase();
  
  if (role === 'admin') {
    return getAdminProfile(req, res);
  } else if (role === 'cashier') {
    return getCashierProfile(req, res);
  } else if (role === 'customer') {
    return getCustomerProfile(req, res);
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied - Invalid role"
    });
  }
});

// Universal profile updater based on role
router.put('/', authMiddleware, (req, res, next) => {
  const role = req.user.role?.toLowerCase();
  
  if (role === 'admin') {
    return updateAdminProfile(req, res);
  } else if (role === 'cashier') {
    return updateCashierProfile(req, res);
  } else if (role === 'customer') {
    return updateCustomerProfile(req, res);
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied - Invalid role"
    });
  }
});

module.exports = router;