const Reservation = require('../models/Reservation');
const { Payment } = require('../models/Payment');
const User = require('../models/User');
const { getUserReservations } = require('./reservationController');

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
      barberId,
      paymentStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = {};
    
    // Filter by reservation status
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (customerId) {
      query.createdBy = customerId;
    }
    
    if (barberId) {
      query.barber = barberId;
    }
    
    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDateObj;
      }
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const reservations = await Reservation.find(query)
      .populate('createdBy', 'name email phone userId')
      .populate('package', 'name price description services')
      .populate('barber', 'name barberId specialties')
      .populate('schedule', 'date timeSlot scheduled_time')
      .populate('confirmedBy', 'name email role userId')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get payment data separately
    const reservationIds = reservations.map(r => r._id);
    const payments = await Payment.find({ reservationId: { $in: reservationIds } })
      .populate('verifiedBy', 'name role userId')
      .select('reservationId paymentId amount paymentMethod status bankAccount eWallet verifiedAt verifiedBy verificationNote');

    // Map payments to reservations
    const paymentMap = {};
    payments.forEach(payment => {
      paymentMap[payment.reservationId.toString()] = payment;
    });

    const totalReservations = await Reservation.countDocuments(query);

    // ✅ Format response for admin - all reservations (with null checks)
    const formattedHistory = reservations.map(reservation => {
      const payment = paymentMap[reservation._id.toString()];
      
      return {
        _id: reservation._id,
        reservationId: reservation.reservationId,
        
        // Customer info (manual data)
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        customerEmail: reservation.customerEmail,
        
        // ✅ Who created this reservation (with null check)
        createdBy: reservation.createdBy ? {
          _id: reservation.createdBy._id,
          name: reservation.createdBy.name,
          email: reservation.createdBy.email,
          phone: reservation.createdBy.phone,
          userId: reservation.createdBy.userId
        } : null,
        
        // ✅ Service details (with null checks)
        package: reservation.package ? {
          _id: reservation.package._id,
          name: reservation.package.name,
          price: reservation.package.price,
          description: reservation.package.description,
          services: reservation.package.services
        } : null,
        barber: reservation.barber ? {
          _id: reservation.barber._id,
          name: reservation.barber.name,
          barberId: reservation.barber.barberId,
          specialties: reservation.barber.specialties
        } : null,
        schedule: reservation.schedule ? {
          _id: reservation.schedule._id,
          date: reservation.schedule.date,
          timeSlot: reservation.schedule.timeSlot,
          scheduled_time: reservation.schedule.scheduled_time
        } : null,
        
        // Reservation details
        totalPrice: reservation.totalPrice,
        status: reservation.status,
        finalStatus: getFinalStatus(reservation.status, payment?.status),
        notes: reservation.notes,
        
        // Payment info (full details for admin)
        payment: payment ? {
          paymentId: payment.paymentId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          bankAccount: payment.bankAccount,
          eWallet: payment.eWallet,
          verificationNote: payment.verificationNote,
          verifiedAt: payment.verifiedAt,
          verifiedBy: payment.verifiedBy ? {
            _id: payment.verifiedBy._id,
            name: payment.verifiedBy.name,
            role: payment.verifiedBy.role,
            userId: payment.verifiedBy.userId
          } : null
        } : null,
        
        // Confirmation info
        confirmedBy: reservation.confirmedBy ? {
          _id: reservation.confirmedBy._id,
          name: reservation.confirmedBy.name,
          email: reservation.confirmedBy.email,
          role: reservation.confirmedBy.role,
          userId: reservation.confirmedBy.userId
        } : null,
        
        // Timestamps
        createdAt: reservation.createdAt,
        updatedAt: reservation.updatedAt,
        confirmedAt: reservation.confirmedAt,
        completedAt: reservation.completedAt,
        cancelledAt: reservation.cancelledAt,
        cancelReason: reservation.cancelReason,
        cancellationReason: reservation.cancellationReason
      };
    });

    // Statistics for admin dashboard
    const stats = await getAdminStats(query);

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
        statistics: stats,
        filters: {
          status: status || 'all',
          paymentStatus: paymentStatus || 'all',
          dateRange: { startDate, endDate },
          customerId,
          barberId
        }
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

// Cashier: Melihat riwayat reservasi yang DIA verifikasi paymentnya
const getCashierReservationHistory = async (req, res) => {
  try {
    const cashierId = req.user.userId || req.user.id;
    const { 
      page = 1, 
      limit = 10, 
      status,
      action,
      startDate,
      endDate,
      sortBy = 'verifiedAt',
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

    // ✅ Build payment query - hanya payment yang di-verify oleh cashier ini
    let paymentQuery = {
      verifiedBy: cashierObjectId,
      status: { $in: ['verified', 'rejected'] } // ✅ Only processed payments
    };
    
    // Filter by verification action
    if (action && action !== 'all') {
      paymentQuery.status = action;
    }
    
    // Filter by verification date
    if (startDate || endDate) {
      paymentQuery.verifiedAt = {};
      if (startDate) {
        paymentQuery.verifiedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        paymentQuery.verifiedAt.$lte = endDateObj;
      }
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Get payments that cashier verified
    const payments = await Payment.find(paymentQuery)
      .populate({
        path: 'reservationId',
        populate: [
          { path: 'createdBy', select: 'name email phone userId' },
          { path: 'package', select: 'name price description services' },
          { path: 'barber', select: 'name barberId specialties' },
          { path: 'schedule', select: 'date timeSlot scheduled_time' }
        ]
      })
      .populate('verifiedBy', 'name role userId')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // ✅ Filter out payments where reservation doesn't exist
    let validPayments = payments.filter(payment => payment.reservationId);

    // Additional filter by reservation status if needed
    if (status && status !== 'all') {
      validPayments = validPayments.filter(payment => 
        payment.reservationId && payment.reservationId.status === status
      );
    }

    const totalPayments = await Payment.countDocuments(paymentQuery);

    // ✅ Format response for cashier - reservations they handled (with null checks)
    const formattedHistory = validPayments.map(payment => {
      // ✅ Add null check for reservationId
      if (!payment.reservationId) {
        return null; // Skip this payment
      }

      return {
        _id: payment._id,
        paymentId: payment.paymentId,
        
        // Verification action taken by cashier
        verificationAction: payment.status,
        verificationNote: payment.verificationNote,
        verifiedAt: payment.verifiedAt,
        actionTaken: payment.status === 'verified' ? 'Approved Payment' : 'Rejected Payment',
        
        // Payment details
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        bankAccount: payment.bankAccount,
        eWallet: payment.eWallet,
        proofOfPayment: payment.proofOfPayment ? {
          url: payment.proofOfPayment.url,
          originalName: payment.proofOfPayment.originalName
        } : null,
        
        // ✅ Verified by info
        verifiedBy: payment.verifiedBy ? {
          _id: payment.verifiedBy._id,
          name: payment.verifiedBy.name,
          role: payment.verifiedBy.role,
          userId: payment.verifiedBy.userId
        } : null,
        
        // ✅ Reservation info with null checks
        reservation: {
          _id: payment.reservationId._id,
          reservationId: payment.reservationId.reservationId,
          status: payment.reservationId.status,
          finalStatus: getFinalReservationStatus(payment.reservationId.status, payment.status),
          totalPrice: payment.reservationId.totalPrice,
          notes: payment.reservationId.notes,
          
          // Customer info (manual data from reservation)
          customerName: payment.reservationId.customerName,
          customerPhone: payment.reservationId.customerPhone,
          customerEmail: payment.reservationId.customerEmail,
          
          // ✅ Who created this reservation (with null check)
          createdBy: payment.reservationId.createdBy ? {
            _id: payment.reservationId.createdBy._id,
            name: payment.reservationId.createdBy.name,
            email: payment.reservationId.createdBy.email,
            phone: payment.reservationId.createdBy.phone,
            userId: payment.reservationId.createdBy.userId
          } : null,
          
          // ✅ Service details (with null checks)
          package: payment.reservationId.package ? {
            _id: payment.reservationId.package._id,
            name: payment.reservationId.package.name,
            price: payment.reservationId.package.price,
            description: payment.reservationId.package.description,
            services: payment.reservationId.package.services
          } : null,
          barber: payment.reservationId.barber ? {
            _id: payment.reservationId.barber._id,
            name: payment.reservationId.barber.name,
            barberId: payment.reservationId.barber.barberId,
            specialties: payment.reservationId.barber.specialties
          } : null,
          schedule: payment.reservationId.schedule ? {
            _id: payment.reservationId.schedule._id,
            date: payment.reservationId.schedule.date,
            timeSlot: payment.reservationId.schedule.timeSlot,
            scheduled_time: payment.reservationId.schedule.scheduled_time
          } : null,
          
          // Important timestamps
          createdAt: payment.reservationId.createdAt,
          confirmedAt: payment.reservationId.confirmedAt,
          completedAt: payment.reservationId.completedAt,
          cancelledAt: payment.reservationId.cancelledAt
        }
      };
    }).filter(item => item !== null); // ✅ Remove null items

    // Statistics for cashier performance
    const cashierStats = await getCashierStats(cashierObjectId);

    res.status(200).json({
      success: true,
      message: "Cashier reservation history retrieved successfully",
      data: {
        handledReservations: formattedHistory,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalPayments / limit),
          totalItems: totalPayments,
          itemsPerPage: parseInt(limit),
          hasNextPage: page * limit < totalPayments,
          hasPrevPage: page > 1
        },
        statistics: cashierStats,
        filters: {
          status: status || 'all',
          action: action || 'all',
          dateRange: { startDate, endDate }
        }
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

// Customer: Melihat riwayat reservasi (completed & cancelled only)
const getCustomerReservationHistory = async (req, res) => {
  try {
    const userIdentifier = req.user.userId || req.user.id;
    const { 
      page = 1, 
      limit = 10, 
      status,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // ✅ Find user first to get MongoDB _id (sama seperti getUserReservations)
    let user;
    if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
      user = await User.findOne({ userId: userIdentifier }).select('_id name email');
    } else {
      user = await User.findById(userIdentifier).select('_id name email');
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // ✅ Build query - FILTER HANYA completed dan cancelled
    let query = {
      createdBy: user._id, 
      status: { $in: ['completed', 'cancelled'] } // ✅ HARD FILTER - tidak bisa diubah
    };
    
    // Optional: Allow further filtering if status query param provided
    if (status && ['completed', 'cancelled'].includes(status)) {
      query.status = status; // Override dengan status spesifik jika valid
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDateObj;
      }
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // ✅ Query reservations - sama persis seperti getUserReservations tapi dengan filter history
    const reservations = await Reservation.find(query)
      .populate({
        path: 'createdBy',
        select: 'name email userId'
      })
      .populate({
        path: 'package',
        select: 'name price description duration'
      })
      .populate({
        path: 'barber',
        select: 'name email phone specialization'
      })
      .populate({
        path: 'schedule',
        select: 'scheduled_time timeSlot date'
      })
      .populate({
        path: 'confirmedBy',
        select: 'name email'
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get payment data for these reservations (optional untuk history)
    const reservationIds = reservations.map(r => r._id);
    const payments = await Payment.find({ reservationId: { $in: reservationIds } })
      .populate('verifiedBy', 'name role userId')
      .select('reservationId paymentId amount paymentMethod status verifiedAt verificationNote');

    // Map payments to reservations
    const paymentMap = {};
    payments.forEach(payment => {
      paymentMap[payment.reservationId.toString()] = payment;
    });

    const totalReservations = await Reservation.countDocuments(query);

    // ✅ Format response - sama seperti getUserReservations format
    const formattedHistory = reservations.map(reservation => {
      const payment = paymentMap[reservation._id.toString()];
      
      return {
        _id: reservation._id,
        reservationId: reservation.reservationId,
        status: reservation.status,
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        customerEmail: reservation.customerEmail,
        notes: reservation.notes,
        totalPrice: reservation.totalPrice,
        
        // Related data
        createdBy: reservation.createdBy,
        package: reservation.package,
        barber: reservation.barber,
        schedule: reservation.schedule,
        confirmedBy: reservation.confirmedBy,
        
        // Payment info (limited untuk customer)
        payment: payment ? {
          paymentId: payment.paymentId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          verifiedAt: payment.verifiedAt,
          verificationNote: payment.status === 'rejected' ? payment.verificationNote : null
        } : null,
        
        // Status descriptions
        finalStatus: getFinalStatus(reservation.status, payment?.status),
        statusDescription: getStatusDescription(reservation.status, payment?.status),
        
        // Timestamps
        createdAt: reservation.createdAt,
        updatedAt: reservation.updatedAt,
        confirmedAt: reservation.confirmedAt,
        completedAt: reservation.completedAt,
        cancelledAt: reservation.cancelledAt,
        cancellationReason: reservation.cancellationReason
      };
    });

    // ✅ Summary dengan breakdown status (hanya untuk completed dan cancelled)
    const completedCount = formattedHistory.filter(r => r.status === 'completed').length;
    const cancelledCount = formattedHistory.filter(r => r.status === 'cancelled').length;

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
        summary: {
          total: formattedHistory.length,
          completed: completedCount,
          cancelled: cancelledCount,
          statusFilter: ['completed', 'cancelled']
        },
        filters: {
          status: status || 'completed,cancelled',
          statusFilter: ['completed', 'cancelled'],
          dateRange: { startDate, endDate }
        }
      }
    });

  } catch (error) {
    console.error("Error retrieving customer reservation history:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving customer reservation history",
      error: error.message
    });
  }
};

// ✅ HELPER FUNCTIONS (unchanged)
const getAdminStats = async (baseQuery = {}) => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  try {
    const [
      totalReservations,
      pendingReservations,
      confirmedReservations,
      cancelledReservations,
      completedReservations,
      monthlyReservations,
      yearlyReservations,
      totalRevenue,
      monthlyRevenue
    ] = await Promise.all([
      Reservation.countDocuments(baseQuery),
      Reservation.countDocuments({ ...baseQuery, status: 'pending' }),
      Reservation.countDocuments({ ...baseQuery, status: 'confirmed' }),
      Reservation.countDocuments({ ...baseQuery, status: 'cancelled' }),
      Reservation.countDocuments({ ...baseQuery, status: 'completed' }),
      Reservation.countDocuments({ ...baseQuery, createdAt: { $gte: startOfMonth } }),
      Reservation.countDocuments({ ...baseQuery, createdAt: { $gte: startOfYear } }),
      Reservation.aggregate([
        { $match: { ...baseQuery, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ]),
      Reservation.aggregate([
        { $match: { ...baseQuery, status: 'completed', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ])
    ]);

    return {
      total: totalReservations,
      pending: pendingReservations,
      confirmed: confirmedReservations,
      cancelled: cancelledReservations,
      completed: completedReservations,
      monthlyCount: monthlyReservations,
      yearlyCount: yearlyReservations,
      totalRevenue: totalRevenue[0]?.total || 0,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      completionRate: totalReservations > 0 ? ((completedReservations / totalReservations) * 100).toFixed(2) : 0
    };
  } catch (error) {
    console.error('Error getting admin stats:', error);
    return {
      total: 0, pending: 0, confirmed: 0, cancelled: 0, completed: 0,
      monthlyCount: 0, yearlyCount: 0, totalRevenue: 0, monthlyRevenue: 0, completionRate: 0
    };
  }
};

const getCashierStats = async (cashierId) => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  try {
    const [
      totalHandled,
      totalApproved,
      totalRejected,
      weeklyHandled,
      monthlyHandled,
      weeklyApproved,
      monthlyApproved,
      todayHandled,
      todayApproved
    ] = await Promise.all([
      Payment.countDocuments({ verifiedBy: cashierId }),
      Payment.countDocuments({ verifiedBy: cashierId, status: 'verified' }),
      Payment.countDocuments({ verifiedBy: cashierId, status: 'rejected' }),
      Payment.countDocuments({ verifiedBy: cashierId, verifiedAt: { $gte: startOfWeek } }),
      Payment.countDocuments({ verifiedBy: cashierId, verifiedAt: { $gte: startOfMonth } }),
      Payment.countDocuments({ verifiedBy: cashierId, status: 'verified', verifiedAt: { $gte: startOfWeek } }),
      Payment.countDocuments({ verifiedBy: cashierId, status: 'verified', verifiedAt: { $gte: startOfMonth } }),
      Payment.countDocuments({ 
        verifiedBy: cashierId, 
        verifiedAt: { 
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }),
      Payment.countDocuments({ 
        verifiedBy: cashierId, 
        status: 'verified',
        verifiedAt: { 
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      })
    ]);

    return {
      performance: {
        totalHandled,
        totalApproved,
        totalRejected,
        approvalRate: totalHandled > 0 ? ((totalApproved / totalHandled) * 100).toFixed(2) : 0,
        rejectionRate: totalHandled > 0 ? ((totalRejected / totalHandled) * 100).toFixed(2) : 0
      },
      productivity: {
        todayHandled,
        todayApproved,
        weeklyHandled,
        weeklyApproved,
        monthlyHandled,
        monthlyApproved
      },
      efficiency: {
        averagePerDay: monthlyHandled > 0 ? (monthlyHandled / 30).toFixed(1) : 0,
        averagePerWeek: monthlyHandled > 0 ? (monthlyHandled / 4).toFixed(1) : 0
      }
    };
  } catch (error) {
    console.error('Error getting cashier stats:', error);
    return {
      performance: { totalHandled: 0, totalApproved: 0, totalRejected: 0, approvalRate: 0, rejectionRate: 0 },
      productivity: { todayHandled: 0, todayApproved: 0, weeklyHandled: 0, weeklyApproved: 0, monthlyHandled: 0, monthlyApproved: 0 },
      efficiency: { averagePerDay: 0, averagePerWeek: 0 }
    };
  }
};

const getFinalReservationStatus = (reservationStatus, paymentStatus) => {
  if (reservationStatus === 'completed') return 'Service Completed';
  if (reservationStatus === 'confirmed' && paymentStatus === 'verified') return 'Ready for Service';
  if (reservationStatus === 'cancelled' && paymentStatus === 'rejected') return 'Payment Rejected';
  if (reservationStatus === 'pending' && paymentStatus === 'verified') return 'Payment Approved';
  if (reservationStatus === 'pending' && paymentStatus === 'rejected') return 'Payment Rejected';
  if (reservationStatus === 'confirmed') return 'Confirmed';
  if (reservationStatus === 'pending') return 'Pending Payment';
  if (reservationStatus === 'cancelled') return 'Cancelled';
  return reservationStatus;
};

const getFinalStatus = (reservationStatus, paymentStatus) => {
  if (reservationStatus === 'completed') return 'Completed';
  if (reservationStatus === 'cancelled') return 'Cancelled';
  if (reservationStatus === 'confirmed') return 'Confirmed';
  if (reservationStatus === 'pending' && paymentStatus === 'pending') return 'Payment Verification';
  if (reservationStatus === 'pending' && paymentStatus === 'rejected') return 'Payment Rejected';
  if (reservationStatus === 'pending' && !paymentStatus) return 'Awaiting Payment';
  return 'Unknown';
};

const getStatusDescription = (reservationStatus, paymentStatus) => {
  if (reservationStatus === 'completed') return 'Service has been completed successfully';
  if (reservationStatus === 'cancelled') return 'Reservation was cancelled';
  if (reservationStatus === 'confirmed') return 'Reservation confirmed, ready for service';
  if (reservationStatus === 'pending' && paymentStatus === 'pending') return 'Payment uploaded, waiting for verification';
  if (reservationStatus === 'pending' && paymentStatus === 'rejected') return 'Payment was rejected, please reupload proof';
  if (reservationStatus === 'pending' && !paymentStatus) return 'Please upload payment proof';
  return 'Status unknown';
};

module.exports = {
  getAllReservationHistory,
  getCashierReservationHistory,
  getCustomerReservationHistory
};