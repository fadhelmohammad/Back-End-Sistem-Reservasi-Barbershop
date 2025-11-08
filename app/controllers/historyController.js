const Reservation = require('../models/Reservation');
const { Payment } = require('../models/Payment');
const User = require('../models/User');

// Admin: Melihat seluruh riwayat reservasi dari semua customer (pending, confirmed, rejected)
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
    
    // Filter by reservation status (pending, confirmed, cancelled)
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (customerId) {
      query.customer = customerId;
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
      .populate('customer', 'name email phone userId')
      .populate('package', 'name price description services')
      .populate('barber', 'name barberId specialties')
      .populate('schedule', 'date timeSlot scheduled_time')
      .populate('confirmedBy', 'name email role userId')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get payment data separately to include rejected payments
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

    // Format response with complete data
    const formattedHistory = reservations.map(reservation => {
      const payment = paymentMap[reservation._id.toString()];
      
      return {
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
        customerEmail: reservation.customerEmail,
        
        // Service details
        package: {
          _id: reservation.package._id,
          name: reservation.package.name,
          price: reservation.package.price,
          description: reservation.package.description,
          services: reservation.package.services
        },
        barber: {
          _id: reservation.barber._id,
          name: reservation.barber.name,
          barberId: reservation.barber.barberId,
          specialties: reservation.barber.specialties
        },
        schedule: {
          _id: reservation.schedule._id,
          date: reservation.schedule.date,
          timeSlot: reservation.schedule.timeSlot,
          scheduled_time: reservation.schedule.scheduled_time
        },
        
        // Reservation details
        totalPrice: reservation.totalPrice,
        status: reservation.status,
        notes: reservation.notes,
        
        // Payment info (including rejected payments)
        payment: payment ? {
          paymentId: payment.paymentId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          status: payment.status, // pending, verified, rejected
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

// Admin: Melihat riwayat reservasi yang DIA verify (baik approve maupun reject) - SATU ENDPOINT
const getAdminVerificationHistory = async (req, res) => {
  try {
    const adminId = req.user.userId || req.user.id;
    const { 
      page = 1, 
      limit = 10, 
      action, // 'verified' atau 'rejected' atau 'all'
      startDate,
      endDate,
      customerId,
      barberId,
      sortBy = 'verifiedAt',
      sortOrder = 'desc'
    } = req.query;

    // Find admin user
    let adminObjectId;
    if (typeof adminId === 'string' && adminId.startsWith('USR-')) {
      const admin = await User.findOne({ userId: adminId });
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found"
        });
      }
      adminObjectId = admin._id;
    } else {
      adminObjectId = adminId;
    }

    // Build payment query - hanya payment yang di-verify oleh admin ini
    let paymentQuery = {
      verifiedBy: adminObjectId
    };
    
    // Filter by verification action
    if (action && action !== 'all') {
      paymentQuery.status = action; // 'verified' atau 'rejected'
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

    // Get payments that admin verified
    const payments = await Payment.find(paymentQuery)
      .populate({
        path: 'reservationId',
        populate: [
          { path: 'customer', select: 'name email phone userId' },
          { path: 'package', select: 'name price description' },
          { path: 'barber', select: 'name barberId specialties' },
          { path: 'schedule', select: 'date timeSlot scheduled_time' }
        ]
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Filter out payments where reservation doesn't exist (edge case)
    const validPayments = payments.filter(payment => payment.reservationId);

    const totalPayments = await Payment.countDocuments(paymentQuery);

    // Format response
    const formattedHistory = validPayments.map(payment => ({
      _id: payment._id,
      paymentId: payment.paymentId,
      
      // Verification info
      verificationAction: payment.status, // 'verified' atau 'rejected'
      verificationNote: payment.verificationNote,
      verifiedAt: payment.verifiedAt,
      
      // Payment details
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      bankAccount: payment.bankAccount,
      eWallet: payment.eWallet,
      
      // Reservation info
      reservation: {
        _id: payment.reservationId._id,
        reservationId: payment.reservationId.reservationId,
        status: payment.reservationId.status,
        totalPrice: payment.reservationId.totalPrice,
        notes: payment.reservationId.notes,
        
        // Customer info
        customer: payment.reservationId.customer,
        customerName: payment.reservationId.customerName,
        customerPhone: payment.reservationId.customerPhone,
        customerEmail: payment.reservationId.customerEmail,
        
        // Service details
        package: payment.reservationId.package,
        barber: payment.reservationId.barber,
        schedule: payment.reservationId.schedule,
        
        // Timestamps
        createdAt: payment.reservationId.createdAt,
        confirmedAt: payment.reservationId.confirmedAt,
        cancelledAt: payment.reservationId.cancelledAt
      }
    }));

    // Statistics for admin verification activity
    const verificationStats = await getAdminVerificationStats(adminObjectId);

    res.status(200).json({
      success: true,
      message: "Admin verification history retrieved successfully",
      data: {
        verifications: formattedHistory,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalPayments / limit),
          totalItems: totalPayments,
          itemsPerPage: parseInt(limit),
          hasNextPage: page * limit < totalPayments,
          hasPrevPage: page > 1
        },
        statistics: verificationStats,
        filters: {
          action: action || 'all',
          dateRange: { startDate, endDate },
          customerId,
          barberId
        }
      }
    });

  } catch (error) {
    console.error('Get admin verification history error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving admin verification history",
      error: error.message
    });
  }
};

// Customer: Melihat riwayat reservasi yang DIA lakukan
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
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
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
      .populate('package', 'name price description services duration')
      .populate('barber', 'name barberId specialties')
      .populate('schedule', 'date timeSlot scheduled_time')
      .populate('confirmedBy', 'name role userId')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get payment data for these reservations
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

    // Format response untuk customer (simplified, privacy-focused)
    const formattedHistory = reservations.map(reservation => {
      const payment = paymentMap[reservation._id.toString()];
      
      return {
        _id: reservation._id,
        reservationId: reservation.reservationId,
        
        // Service details
        package: {
          _id: reservation.package._id,
          name: reservation.package.name,
          price: reservation.package.price,
          description: reservation.package.description,
          services: reservation.package.services,
          duration: reservation.package.duration
        },
        barber: {
          _id: reservation.barber._id,
          name: reservation.barber.name,
          barberId: reservation.barber.barberId,
          specialties: reservation.barber.specialties
        },
        schedule: {
          _id: reservation.schedule._id,
          date: reservation.schedule.date,
          timeSlot: reservation.schedule.timeSlot,
          scheduled_time: reservation.schedule.scheduled_time
        },
        
        // Reservation details
        totalPrice: reservation.totalPrice,
        status: reservation.status,
        finalStatus: getFinalStatus(reservation.status, payment?.status),
        statusDescription: getStatusDescription(reservation.status, payment?.status),
        notes: reservation.notes,
        
        // Payment info (customer view - limited)
        payment: payment ? {
          paymentId: payment.paymentId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          verifiedAt: payment.verifiedAt,
          verificationNote: payment.status === 'rejected' ? payment.verificationNote : null
        } : null,
        
        // Service staff info (who confirmed)
        confirmedBy: reservation.confirmedBy ? reservation.confirmedBy.name : null,
        
        // Timestamps
        createdAt: reservation.createdAt,
        confirmedAt: reservation.confirmedAt,
        cancelledAt: reservation.cancelledAt,
        cancelReason: reservation.cancelReason,
        cancellationReason: reservation.cancellationReason
      };
    });

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
        statistics: customerStats,
        filters: {
          status: status || 'all',
          dateRange: { startDate, endDate }
        }
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

// Cashier: Melihat riwayat reservasi yang DIA terima/handle
const getCashierReservationHistory = async (req, res) => {
  try {
    const cashierId = req.user.userId || req.user.id;
    const { 
      page = 1, 
      limit = 10, 
      status,
      action, // 'verified' atau 'rejected' atau 'all'
      startDate,
      endDate,
      customerId,
      barberId,
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

    // Build payment query - hanya payment yang di-verify oleh cashier ini
    let paymentQuery = {
      verifiedBy: cashierObjectId
    };
    
    // Filter by verification action
    if (action && action !== 'all') {
      paymentQuery.status = action; // 'verified' atau 'rejected'
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
          { path: 'customer', select: 'name email phone userId' },
          { path: 'package', select: 'name price description services' },
          { path: 'barber', select: 'name barberId specialties' },
          { path: 'schedule', select: 'date timeSlot scheduled_time' }
        ]
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Filter out payments where reservation doesn't exist
    const validPayments = payments.filter(payment => payment.reservationId);

    // Additional filter by reservation status if needed
    let filteredPayments = validPayments;
    if (status && status !== 'all') {
      filteredPayments = validPayments.filter(payment => 
        payment.reservationId.status === status
      );
    }

    // Additional filter by customer if needed
    if (customerId) {
      filteredPayments = filteredPayments.filter(payment => 
        payment.reservationId.customer._id.toString() === customerId
      );
    }

    // Additional filter by barber if needed
    if (barberId) {
      filteredPayments = filteredPayments.filter(payment => 
        payment.reservationId.barber._id.toString() === barberId
      );
    }

    const totalPayments = await Payment.countDocuments(paymentQuery);

    // Format response for cashier view
    const formattedHistory = filteredPayments.map(payment => ({
      _id: payment._id,
      paymentId: payment.paymentId,
      
      // Verification action taken by cashier
      verificationAction: payment.status, // 'verified' atau 'rejected'
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
      
      // Reservation info
      reservation: {
        _id: payment.reservationId._id,
        reservationId: payment.reservationId.reservationId,
        status: payment.reservationId.status,
        finalStatus: getFinalReservationStatus(payment.reservationId.status, payment.status), // ✅ Use function defined below
        totalPrice: payment.reservationId.totalPrice,
        notes: payment.reservationId.notes,
        
        // Customer info
        customer: {
          _id: payment.reservationId.customer._id,
          name: payment.reservationId.customer.name,
          email: payment.reservationId.customer.email,
          phone: payment.reservationId.customer.phone,
          userId: payment.reservationId.customer.userId
        },
        customerName: payment.reservationId.customerName,
        customerPhone: payment.reservationId.customerPhone,
        customerEmail: payment.reservationId.customerEmail,
        
        // Service details
        package: {
          _id: payment.reservationId.package._id,
          name: payment.reservationId.package.name,
          price: payment.reservationId.package.price,
          description: payment.reservationId.package.description,
          services: payment.reservationId.package.services
        },
        barber: {
          _id: payment.reservationId.barber._id,
          name: payment.reservationId.barber.name,
          barberId: payment.reservationId.barber.barberId,
          specialties: payment.reservationId.barber.specialties
        },
        schedule: {
          _id: payment.reservationId.schedule._id,
          date: payment.reservationId.schedule.date,
          timeSlot: payment.reservationId.schedule.timeSlot,
          scheduled_time: payment.reservationId.schedule.scheduled_time
        },
        
        // Important timestamps
        createdAt: payment.reservationId.createdAt,
        confirmedAt: payment.reservationId.confirmedAt,
        cancelledAt: payment.reservationId.cancelledAt
      }
    }));

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
          dateRange: { startDate, endDate },
          customerId,
          barberId
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

// ✅ HELPER FUNCTIONS - Add these at the end of file

// Helper function untuk cashier stats
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

// ✅ Helper function untuk final status - ADD THIS FUNCTION
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

// Helper functions untuk admin statistics (jika belum ada)
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

const getAdminVerificationStats = async (adminId) => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    totalVerifications,
    totalApprovals,
    totalRejections,
    monthlyVerifications,
    monthlyApprovals,
    monthlyRejections
  ] = await Promise.all([
    Payment.countDocuments({ verifiedBy: adminId }),
    Payment.countDocuments({ verifiedBy: adminId, status: 'verified' }),
    Payment.countDocuments({ verifiedBy: adminId, status: 'rejected' }),
    Payment.countDocuments({ verifiedBy: adminId, verifiedAt: { $gte: startOfMonth } }),
    Payment.countDocuments({ verifiedBy: adminId, status: 'verified', verifiedAt: { $gte: startOfMonth } }),
    Payment.countDocuments({ verifiedBy: adminId, status: 'rejected', verifiedAt: { $gte: startOfMonth } })
  ]);

  return {
    totalVerifications,
    totalApprovals,
    totalRejections,
    monthlyVerifications,
    monthlyApprovals,
    monthlyRejections,
    approvalRate: totalVerifications > 0 ? ((totalApprovals / totalVerifications) * 100).toFixed(2) : 0,
    rejectionRate: totalVerifications > 0 ? ((totalRejections / totalVerifications) * 100).toFixed(2) : 0
  };
};

const getCustomerStats = async (customerId) => {
  try {
    const [
      totalReservations,
      pendingReservations,
      confirmedReservations,
      completedReservations,
      cancelledReservations,
      totalSpent
    ] = await Promise.all([
      Reservation.countDocuments({ customer: customerId }),
      Reservation.countDocuments({ customer: customerId, status: 'pending' }),
      Reservation.countDocuments({ customer: customerId, status: 'confirmed' }),
      Reservation.countDocuments({ customer: customerId, status: 'completed' }),
      Reservation.countDocuments({ customer: customerId, status: 'cancelled' }),
      Reservation.aggregate([
        { $match: { customer: customerId, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ])
    ]);

    return {
      totalReservations,
      pendingReservations,
      confirmedReservations,
      completedReservations,
      cancelledReservations,
      totalSpent: totalSpent[0]?.total || 0,
      loyaltyLevel: getLoyaltyLevel(completedReservations),
      completionRate: totalReservations > 0 ? ((completedReservations / totalReservations) * 100).toFixed(2) : 0
    };
  } catch (error) {
    console.error('Error getting customer stats:', error);
    return {
      totalReservations: 0, pendingReservations: 0, confirmedReservations: 0,
      completedReservations: 0, cancelledReservations: 0, totalSpent: 0,
      loyaltyLevel: 'Bronze', completionRate: 0
    };
  }
};

// Helper functions untuk status
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

const getLoyaltyLevel = (completedCount) => {
  if (completedCount >= 20) return 'VIP';
  if (completedCount >= 10) return 'Gold';
  if (completedCount >= 5) return 'Silver';
  return 'Bronze';
};

module.exports = {
  getAllReservationHistory,
  getAdminVerificationHistory,
  getCustomerReservationHistory,
  getCashierReservationHistory
};