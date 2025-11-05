const Reservation = require('../models/Reservation');
const Payment = require('../models/Payment');
const User = require('../models/User');

// Admin: Melihat seluruh riwayat reservasi dari semua customer
const getAllReservationHistory = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status,
      startDate,
      endDate,
      customerId,
      cashierId,
      barberId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (customerId) {
      query.customer = customerId;
    }
    
    if (cashierId) {
      query.confirmedBy = cashierId;
    }
    
    if (barberId) {
      query.barber = barberId;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const reservations = await Reservation.find(query)
      .populate('customer', 'name email phone userId')
      .populate('package', 'name price description')
      .populate('barber', 'name specialization')
      .populate('schedule', 'scheduled_time')
      .populate('confirmedBy', 'name email role') // Cashier yang confirm
      .populate({
        path: 'paymentId',
        model: 'Payment',
        select: 'paymentId amount paymentMethod status bankAccount eWallet verifiedAt verifiedBy',
        populate: {
          path: 'verifiedBy',
          select: 'name role'
        }
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalReservations = await Reservation.countDocuments(query);

    // Format response
    const formattedHistory = reservations.map(reservation => ({
      _id: reservation._id,
      reservationId: reservation.reservationId,
      
      // Customer info
      customer: {
        _id: reservation.customer._id,
        name: reservation.customer.name,
        email: reservation.customer.email,
        phone: reservation.customer.phone,
        userId: reservation.customer.userId
      },
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      
      // Service details
      package: reservation.package,
      barber: reservation.barber,
      schedule: reservation.schedule,
      
      // Reservation details
      totalPrice: reservation.totalPrice,
      status: reservation.status,
      notes: reservation.notes,
      paymentMethod: reservation.paymentId?.paymentMethod || reservation.paymentMethod || 'cash',
      
      // Payment info
      payment: reservation.paymentId ? {
        paymentId: reservation.paymentId.paymentId,
        amount: reservation.paymentId.amount,
        paymentMethod: reservation.paymentId.paymentMethod,
        status: reservation.paymentId.status,
        bankAccount: reservation.paymentId.bankAccount,
        eWallet: reservation.paymentId.eWallet,
        verifiedAt: reservation.paymentId.verifiedAt,
        verifiedBy: reservation.paymentId.verifiedBy
      } : null,
      
      // Tracking info - PENTING UNTUK ADMIN
      confirmedBy: reservation.confirmedBy ? {
        _id: reservation.confirmedBy._id,
        name: reservation.confirmedBy.name,
        email: reservation.confirmedBy.email,
        role: reservation.confirmedBy.role
      } : null,
      
      // Timestamps
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
      confirmedAt: reservation.confirmedAt,
      cancelledAt: reservation.cancelledAt,
      cancelReason: reservation.cancelReason
    }));

    // Statistics untuk dashboard admin
    const stats = await getReservationStats(query);

    res.status(200).json({
      success: true,
      message: "All reservation history retrieved successfully",
      data: {
        reservations: formattedHistory,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalReservations / limit),
          totalItems: totalReservations,
          itemsPerPage: parseInt(limit),
          hasNextPage: page * limit < totalReservations,
          hasPrevPage: page > 1
        },
        statistics: stats
      }
    });

  } catch (error) {
    console.error('Get all reservation history error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving reservation history",
      error: error.message
    });
  }
};

// Cashier: Melihat riwayat reservasi yang dikonfirmasi olehnya
const getCashierReservationHistory = async (req, res) => {
  try {
    const cashierId = req.user.userId || req.user.id;
    const { 
      page = 1, 
      limit = 10, 
      status = 'confirmed', // Default hanya yang confirmed
      startDate,
      endDate,
      sortBy = 'confirmedAt',
      sortOrder = 'desc'
    } = req.query;

    // Find cashier user
    let cashierObjectId;
    if (typeof cashierId === 'string' && cashierId.startsWith('USR-')) {
      const cashier = await User.findOne({ userId: cashierId });
      if (!cashier) {
        return res.status(404).json({
          success: false,
          message: "Cashier not found"
        });
      }
      cashierObjectId = cashier._id;
    } else {
      cashierObjectId = cashierId;
    }

    // Build query - hanya reservasi yang dikonfirmasi oleh cashier ini
    let query = {
      confirmedBy: cashierObjectId
    };
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.confirmedAt = {};
      if (startDate) {
        query.confirmedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.confirmedAt.$lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const reservations = await Reservation.find(query)
      .populate('customer', 'name email phone userId')
      .populate('package', 'name price description')
      .populate('barber', 'name specialization')
      .populate('schedule', 'scheduled_time')
      .populate({
        path: 'paymentId',
        model: 'Payment',
        select: 'paymentId amount paymentMethod status bankAccount eWallet verifiedAt'
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalReservations = await Reservation.countDocuments(query);

    // Format response
    const formattedHistory = reservations.map(reservation => ({
      _id: reservation._id,
      reservationId: reservation.reservationId,
      
      // Customer info
      customer: reservation.customer,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      
      // Service details
      package: reservation.package,
      barber: reservation.barber,
      schedule: reservation.schedule,
      
      // Reservation details
      totalPrice: reservation.totalPrice,
      status: reservation.status,
      notes: reservation.notes,
      paymentMethod: reservation.paymentId?.paymentMethod || reservation.paymentMethod || 'cash',
      
      // Payment info
      payment: reservation.paymentId ? {
        paymentId: reservation.paymentId.paymentId,
        amount: reservation.paymentId.amount,
        paymentMethod: reservation.paymentId.paymentMethod,
        status: reservation.paymentId.status,
        bankAccount: reservation.paymentId.bankAccount,
        eWallet: reservation.paymentId.eWallet,
        verifiedAt: reservation.paymentId.verifiedAt
      } : null,
      
      // Timestamps
      createdAt: reservation.createdAt,
      confirmedAt: reservation.confirmedAt,
      updatedAt: reservation.updatedAt
    }));

    // Statistics untuk cashier
    const stats = await getCashierStats(cashierObjectId);

    res.status(200).json({
      success: true,
      message: "Cashier reservation history retrieved successfully",
      data: {
        reservations: formattedHistory,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalReservations / limit),
          totalItems: totalReservations,
          itemsPerPage: parseInt(limit),
          hasNextPage: page * limit < totalReservations,
          hasPrevPage: page > 1
        },
        statistics: stats
      }
    });

  } catch (error) {
    console.error('Get cashier reservation history error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving cashier reservation history",
      error: error.message
    });
  }
};

// Customer: Melihat riwayat reservasi miliknya
const getCustomerReservationHistory = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { 
      page = 1, 
      limit = 10, 
      status,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Find customer user
    let customerObjectId;
    if (typeof userId === 'string' && userId.startsWith('USR-')) {
      const customer = await User.findOne({ userId: userId });
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found"
        });
      }
      customerObjectId = customer._id;
    } else {
      customerObjectId = userId;
    }

    // Build query - hanya reservasi milik customer ini
    let query = {
      customer: customerObjectId
    };
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const reservations = await Reservation.find(query)
      .populate('package', 'name price description')
      .populate('barber', 'name specialization')
      .populate('schedule', 'scheduled_time')
      .populate('confirmedBy', 'name role') // Info cashier yang confirm
      .populate({
        path: 'paymentId',
        model: 'Payment',
        select: 'paymentId amount paymentMethod status bankAccount eWallet verifiedAt',
        populate: {
          path: 'verifiedBy',
          select: 'name role'
        }
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalReservations = await Reservation.countDocuments(query);

    // Format response untuk customer
    const formattedHistory = reservations.map(reservation => ({
      _id: reservation._id,
      reservationId: reservation.reservationId,
      
      // Service details
      package: reservation.package,
      barber: reservation.barber,
      schedule: reservation.schedule,
      
      // Reservation details
      totalPrice: reservation.totalPrice,
      status: reservation.status,
      finalStatus: getFinalStatus(reservation.status, reservation.paymentId?.status),
      statusDescription: getStatusDescription(reservation.status, reservation.paymentId?.status),
      notes: reservation.notes,
      paymentMethod: reservation.paymentId?.paymentMethod || reservation.paymentMethod || 'cash',
      
      // Payment info (simplified untuk customer)
      payment: reservation.paymentId ? {
        paymentId: reservation.paymentId.paymentId,
        amount: reservation.paymentId.amount,
        paymentMethod: reservation.paymentId.paymentMethod,
        status: reservation.paymentId.status,
        verifiedAt: reservation.paymentId.verifiedAt,
        verifiedBy: reservation.paymentId.verifiedBy?.name
      } : null,
      
      // Cashier info (siapa yang confirm)
      confirmedBy: reservation.confirmedBy?.name || null,
      
      // Timestamps
      createdAt: reservation.createdAt,
      confirmedAt: reservation.confirmedAt,
      cancelledAt: reservation.cancelledAt,
      cancelReason: reservation.cancelReason
    }));

    // Statistics untuk customer
    const customerStats = await getCustomerStats(customerObjectId);

    res.status(200).json({
      success: true,
      message: "Customer reservation history retrieved successfully",
      data: {
        reservations: formattedHistory,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalReservations / limit),
          totalItems: totalReservations,
          itemsPerPage: parseInt(limit),
          hasNextPage: page * limit < totalReservations,
          hasPrevPage: page > 1
        },
        statistics: customerStats
      }
    });

  } catch (error) {
    console.error('Get customer reservation history error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving customer reservation history",
      error: error.message
    });
  }
};

// Helper functions untuk statistics
const getReservationStats = async (baseQuery = {}) => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  const [
    totalReservations,
    completedReservations,
    cancelledReservations,
    monthlyReservations,
    yearlyReservations,
    totalRevenue
  ] = await Promise.all([
    Reservation.countDocuments(baseQuery),
    Reservation.countDocuments({ ...baseQuery, status: 'completed' }),
    Reservation.countDocuments({ ...baseQuery, status: 'cancelled' }),
    Reservation.countDocuments({ ...baseQuery, createdAt: { $gte: startOfMonth } }),
    Reservation.countDocuments({ ...baseQuery, createdAt: { $gte: startOfYear } }),
    Reservation.aggregate([
      { $match: { ...baseQuery, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ])
  ]);

  return {
    total: totalReservations,
    completed: completedReservations,
    cancelled: cancelledReservations,
    pending: totalReservations - completedReservations - cancelledReservations,
    monthlyCount: monthlyReservations,
    yearlyCount: yearlyReservations,
    totalRevenue: totalRevenue[0]?.total || 0,
    completionRate: totalReservations > 0 ? ((completedReservations / totalReservations) * 100).toFixed(2) : 0
  };
};

const getCashierStats = async (cashierId) => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    totalConfirmed,
    monthlyConfirmed,
    totalRevenue
  ] = await Promise.all([
    Reservation.countDocuments({ confirmedBy: cashierId }),
    Reservation.countDocuments({ confirmedBy: cashierId, confirmedAt: { $gte: startOfMonth } }),
    Reservation.aggregate([
      { $match: { confirmedBy: cashierId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ])
  ]);

  return {
    totalConfirmed,
    monthlyConfirmed,
    totalRevenue: totalRevenue[0]?.total || 0
  };
};

const getCustomerStats = async (customerId) => {
  const [
    totalReservations,
    completedReservations,
    cancelledReservations,
    totalSpent
  ] = await Promise.all([
    Reservation.countDocuments({ customer: customerId }),
    Reservation.countDocuments({ customer: customerId, status: 'completed' }),
    Reservation.countDocuments({ customer: customerId, status: 'cancelled' }),
    Reservation.aggregate([
      { $match: { customer: customerId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ])
  ]);

  return {
    totalReservations,
    completedReservations,
    cancelledReservations,
    pendingReservations: totalReservations - completedReservations - cancelledReservations,
    totalSpent: totalSpent[0]?.total || 0,
    loyaltyLevel: getLoyaltyLevel(completedReservations)
  };
};

// Helper functions untuk status
const getFinalStatus = (reservationStatus, paymentStatus) => {
  if (reservationStatus === 'completed') return 'Completed';
  if (reservationStatus === 'cancelled') return 'Cancelled';
  if (reservationStatus === 'confirmed') return 'Confirmed';
  if (reservationStatus === 'pending' && paymentStatus === 'pending') return 'Payment Verification';
  if (reservationStatus === 'pending' && !paymentStatus) return 'Awaiting Payment';
  return 'Unknown';
};

const getStatusDescription = (reservationStatus, paymentStatus) => {
  if (reservationStatus === 'completed') return 'Service has been completed successfully';
  if (reservationStatus === 'cancelled') return 'Reservation was cancelled';
  if (reservationStatus === 'confirmed') return 'Reservation confirmed, ready for service';
  if (reservationStatus === 'pending' && paymentStatus === 'pending') return 'Payment uploaded, waiting for verification';
  if (reservationStatus === 'pending' && !paymentStatus) return 'Please upload payment proof';
  return 'Status unknown';
};

const getLoyaltyLevel = (completedCount) => {
  if (completedCount >= 20) return 'VIP';
  if (completedCount >= 10) return 'Gold';
  if (completedCount >= 5) return 'Silver';
  return 'Bronze';
};

module.exports = {
  getAllReservationHistory,
  getCashierReservationHistory,
  getCustomerReservationHistory
};