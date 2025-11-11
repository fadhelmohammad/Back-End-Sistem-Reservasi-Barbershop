const Reservation = require('../models/Reservation');
const { Payment } = require('../models/Payment');
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
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // ✅ Build query - completed dan cancelled only
    let query = {
      status: { $in: ['completed', 'cancelled'] }
    };
    
    // Optional: Allow further filtering if status query param provided
    if (status && ['completed', 'cancelled'].includes(status)) {
      query.status = status;
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

    const reservations = await Reservation.find(query)
      .populate('package', 'name price description services duration')
      .populate('barber', 'name barberId specialties')
      .populate('schedule', 'date timeSlot scheduled_time')
      .populate('confirmedBy', 'name role userId')
      .populate('createdBy', 'name email userId')
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

    // ✅ Format response untuk admin history
    const formattedHistory = reservations.map(reservation => {
      const payment = paymentMap[reservation._id.toString()];
      
      return {
        _id: reservation._id,
        reservationId: reservation.reservationId,
        
        // Customer data
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        customerEmail: reservation.customerEmail,
        
        // Service details
        package: reservation.package ? {
          _id: reservation.package._id,
          name: reservation.package.name,
          price: reservation.package.price,
          description: reservation.package.description,
          services: reservation.package.services,
          duration: reservation.package.duration
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
        finalStatus: getFinalReservationStatus(reservation.status, payment?.status),
        notes: reservation.notes,
        
        // Payment info (admin view - full access)
        payment: payment ? {
          paymentId: payment.paymentId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          verifiedAt: payment.verifiedAt,
          verificationNote: payment.verificationNote,
          verifiedBy: payment.verifiedBy ? {
            name: payment.verifiedBy.name,
            role: payment.verifiedBy.role,
            userId: payment.verifiedBy.userId
          } : null
        } : null,
        
        // Service staff info
        confirmedBy: reservation.confirmedBy ? {
          name: reservation.confirmedBy.name,
          role: reservation.confirmedBy.role,
          userId: reservation.confirmedBy.userId
        } : null,
        
        // Who created this reservation
        createdBy: reservation.createdBy ? {
          name: reservation.createdBy.name,
          email: reservation.createdBy.email,
          userId: reservation.createdBy.userId
        } : null,
        
        // Timestamps
        createdAt: reservation.createdAt,
        confirmedAt: reservation.confirmedAt,
        completedAt: reservation.completedAt,
        cancelledAt: reservation.cancelledAt,
        cancelReason: reservation.cancelReason,
        cancellationReason: reservation.cancellationReason
      };
    });

    // ✅ Count breakdown
    const completedCount = formattedHistory.filter(r => r.status === 'completed').length;
    const cancelledCount = formattedHistory.filter(r => r.status === 'cancelled').length;

    res.status(200).json({
      success: true,
      message: "All reservation history retrieved successfully",
      data: formattedHistory,
      summary: {
        total: totalReservations,
        completed: completedCount,
        cancelled: cancelledCount,
        statusFilter: ['completed', 'cancelled']
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

    // Find cashier user
    let cashierObjectId;
    if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
      const cashier = await User.findOne({ userId: userIdentifier });
      if (!cashier) {
        return res.status(404).json({
          success: false,
          message: "Cashier not found"
        });
      }
      cashierObjectId = cashier._id;
    } else {
      cashierObjectId = userIdentifier;
    }

    // ✅ Build query untuk reservasi completed & cancelled yang payment-nya diverifikasi oleh cashier ini
    let query = {
      status: { $in: ['completed', 'cancelled'] }
    };
    
    // Optional: Allow further filtering if status query param provided
    if (status && ['completed', 'cancelled'].includes(status)) {
      query.status = status;
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

    // ✅ Get payments verified by this cashier
    const paymentsVerifiedByCashier = await Payment.find({
      verifiedBy: cashierObjectId,
      status: 'verified'
    }).select('reservationId');

    const reservationIdsVerifiedByCashier = paymentsVerifiedByCashier.map(p => p.reservationId);

    // ✅ Add filter untuk reservasi yang payment-nya diverifikasi oleh cashier ini
    query._id = { $in: reservationIdsVerifiedByCashier };

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const reservations = await Reservation.find(query)
      .populate('package', 'name price description services duration')
      .populate('barber', 'name barberId specialties')
      .populate('schedule', 'date timeSlot scheduled_time')
      .populate('confirmedBy', 'name role userId')
      .populate('createdBy', 'name email userId')
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

    // ✅ Format response untuk cashier history
    const formattedHistory = reservations.map(reservation => {
      const payment = paymentMap[reservation._id.toString()];
      
      return {
        _id: reservation._id,
        reservationId: reservation.reservationId,
        
        // Customer data
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        customerEmail: reservation.customerEmail,
        
        // Service details
        package: reservation.package ? {
          _id: reservation.package._id,
          name: reservation.package.name,
          price: reservation.package.price,
          description: reservation.package.description,
          services: reservation.package.services,
          duration: reservation.package.duration
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
        finalStatus: getFinalReservationStatus(reservation.status, payment?.status),
        notes: reservation.notes,
        
        // Payment info (cashier view - yang dia verifikasi)
        payment: payment ? {
          paymentId: payment.paymentId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          verifiedAt: payment.verifiedAt,
          verificationNote: payment.verificationNote,
          verifiedBy: payment.verifiedBy ? {
            name: payment.verifiedBy.name,
            role: payment.verifiedBy.role,
            userId: payment.verifiedBy.userId
          } : null
        } : null,
        
        // Service staff info
        confirmedBy: reservation.confirmedBy ? {
          name: reservation.confirmedBy.name,
          role: reservation.confirmedBy.role,
          userId: reservation.confirmedBy.userId
        } : null,
        
        // Who created this reservation
        createdBy: reservation.createdBy ? {
          name: reservation.createdBy.name,
          email: reservation.createdBy.email,
          userId: reservation.createdBy.userId
        } : null,
        
        // Timestamps
        createdAt: reservation.createdAt,
        confirmedAt: reservation.confirmedAt,
        completedAt: reservation.completedAt,
        cancelledAt: reservation.cancelledAt,
        cancelReason: reservation.cancelReason,
        cancellationReason: reservation.cancellationReason
      };
    });

    // ✅ Count breakdown
    const completedCount = formattedHistory.filter(r => r.status === 'completed').length;
    const cancelledCount = formattedHistory.filter(r => r.status === 'cancelled').length;

    res.status(200).json({
      success: true,
      message: "Cashier reservation history retrieved successfully",
      data: formattedHistory,
      summary: {
        total: totalReservations,
        completed: completedCount,
        cancelled: cancelledCount,
        statusFilter: ['completed', 'cancelled']
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

    // ✅ Count breakdown
    const completedCount = formattedHistory.filter(r => r.status === 'completed').length;
    const cancelledCount = formattedHistory.filter(r => r.status === 'cancelled').length;

    res.status(200).json({
      success: true,
      message: "Customer reservation history retrieved successfully",
      data: formattedHistory,
      summary: {
        total: totalReservations,
        completed: completedCount,
        cancelled: cancelledCount,
        statusFilter: ['completed', 'cancelled']
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

// ✅ HELPER FUNCTIONS
const getFinalReservationStatus = (reservationStatus, paymentStatus) => {
  if (reservationStatus === 'completed' && paymentStatus === 'verified') return 'Service Completed';
  if (reservationStatus === 'completed') return 'Completed';
  if (reservationStatus === 'cancelled' && paymentStatus === 'verified') return 'Cancelled (Paid)';
  if (reservationStatus === 'cancelled' && paymentStatus === 'rejected') return 'Cancelled (Payment Rejected)';
  if (reservationStatus === 'cancelled') return 'Cancelled';
  return reservationStatus || 'Unknown';
};

const getFinalStatus = (reservationStatus, paymentStatus) => {
  if (reservationStatus === 'completed' && paymentStatus === 'verified') return 'Service Completed';
  if (reservationStatus === 'completed') return 'Completed';
  if (reservationStatus === 'cancelled' && paymentStatus === 'verified') return 'Cancelled (Paid)';
  if (reservationStatus === 'cancelled' && paymentStatus === 'rejected') return 'Cancelled (Payment Rejected)';
  if (reservationStatus === 'cancelled') return 'Cancelled';
  return reservationStatus || 'Unknown';
};

const getStatusDescription = (reservationStatus, paymentStatus) => {
  if (reservationStatus === 'completed' && paymentStatus === 'verified') 
    return 'Service has been completed successfully';
  if (reservationStatus === 'completed') 
    return 'Service has been completed';
  if (reservationStatus === 'cancelled' && paymentStatus === 'verified') 
    return 'Reservation was cancelled but payment was processed';
  if (reservationStatus === 'cancelled' && paymentStatus === 'rejected') 
    return 'Reservation was cancelled due to payment rejection';
  if (reservationStatus === 'cancelled') 
    return 'Reservation was cancelled';
  return 'Status unknown';
};

module.exports = {
  getAllReservationHistory,
  getCashierReservationHistory,
  getCustomerReservationHistory,
  getFinalReservationStatus,
  getFinalStatus,
  getStatusDescription
};