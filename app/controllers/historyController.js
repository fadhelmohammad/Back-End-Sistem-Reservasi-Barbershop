const Reservation = require('../models/Reservation');
const { Payment } = require('../models/Payment');
const User = require('../models/User');
const Package = require('../models/Package');
const Barber = require('../models/Barber');
const Schedule = require('../models/Schedule');

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

    console.log('🔍 DEBUG - Query:', query);

    const reservations = await Reservation.find(query)
      .populate('package', 'name price description services duration')
      .populate('barber', 'name barberId specialties')
      .populate('schedule', 'date timeSlot scheduled_time')
      .populate('confirmedBy', 'name role userId')
      .populate('createdBy', 'name email userId')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    console.log('🔍 DEBUG - Found reservations:', reservations.length);

    // Get payment data for these reservations
    const reservationIds = reservations.map(r => r._id);
    const payments = await Payment.find({ 
      reservationId: { $in: reservationIds },
      status: { $in: ['pending', 'verified', 'rejected'] }
    })
      .populate('verifiedBy', 'name role userId')
      .select('reservationId paymentId amount paymentMethod status verifiedAt verificationNote');

    // Map payments to reservations
    const paymentMap = {};
    payments.forEach(payment => {
      paymentMap[payment.reservationId.toString()] = payment;
    });

    const totalReservations = await Reservation.countDocuments(query);

    // ✅ Count langsung dari database
    const completedCount = await Reservation.countDocuments({
      ...query,
      status: 'completed'
    });
    
    const cancelledCount = await Reservation.countDocuments({
      ...query,
      status: 'cancelled'
    });

    // ✅ FORMAT RESPONSE
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

    // ✅ Response TANPA pagination
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

// Cashier: Melihat riwayat reservasi yang DIA verifikasi paymentnya + walk-in reservations yang DIA buat
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
      sortOrder = 'desc',
      includeWalkIn = 'true'
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

    // ✅ Base query untuk completed & cancelled reservations
    let baseQuery = {
      status: { $in: ['completed', 'cancelled'] }
    };
    
    // Optional: Allow further filtering if status query param provided
    if (status && ['completed', 'cancelled'].includes(status)) {
      baseQuery.status = status;
    }
    
    // Date range filter
    if (startDate || endDate) {
      baseQuery.createdAt = {};
      if (startDate) {
        baseQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        baseQuery.createdAt.$lte = endDateObj;
      }
    }

    // ✅ 1. Get regular reservations yang payment-nya diverifikasi oleh cashier ini
    const paymentsVerifiedByCashier = await Payment.find({
      verifiedBy: cashierObjectId,
      status: 'verified'
    }).select('reservationId');

    const reservationIdsVerifiedByCashier = paymentsVerifiedByCashier.map(p => p.reservationId);

    // ✅ 2. Build combined query
    let combinedQuery = [];

    // Regular reservations yang payment-nya diverifikasi oleh cashier
    if (reservationIdsVerifiedByCashier.length > 0) {
      combinedQuery.push({
        ...baseQuery,
        _id: { $in: reservationIdsVerifiedByCashier },
        isWalkIn: { $ne: true }
      });
    }

    // ✅ Walk-in reservations yang dibuat oleh cashier ini
    if (includeWalkIn === 'true') {
      combinedQuery.push({
        ...baseQuery,
        $or: [
          { createdBy: cashierObjectId },
          { completedBy: cashierObjectId }
        ],
        isWalkIn: true
      });
    }

    // ✅ Final query using $or
    const finalQuery = combinedQuery.length > 0 ? { $or: combinedQuery } : { _id: { $in: [] } };

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const reservations = await Reservation.find(finalQuery)
      .populate('package', 'name price description services duration')
      .populate('barber', 'name barberId specialties')
      .populate('schedule', 'date timeSlot scheduled_time')
      .populate('confirmedBy', 'name role userId')
      .populate('createdBy', 'name email userId')
      .populate('completedBy', 'name role userId')
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

    const totalReservations = await Reservation.countDocuments(finalQuery);

    // ✅ Count dari database
    const completedCount = await Reservation.countDocuments({
      $and: [
        finalQuery,
        { status: 'completed' }
      ]
    });
    
    const cancelledCount = await Reservation.countDocuments({
      $and: [
        finalQuery,
        { status: 'cancelled' }
      ]
    });

    // ✅ Format response
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
        serviceNotes: reservation.serviceNotes,
        
        // ✅ Walk-in specific info
        isWalkIn: reservation.isWalkIn || false,
        paymentMethod: reservation.paymentMethod,
        
        // Payment info
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
        
        // Staff info
        confirmedBy: reservation.confirmedBy ? {
          name: reservation.confirmedBy.name,
          role: reservation.confirmedBy.role,
          userId: reservation.confirmedBy.userId
        } : null,
        
        completedBy: reservation.completedBy ? {
          name: reservation.completedBy.name,
          role: reservation.completedBy.role,
          userId: reservation.completedBy.userId
        } : null,
        
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

    // ✅ Response TANPA pagination
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

// ✅ Customer: Melihat riwayat reservasi customer sendiri
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

    // Find customer user
    let customerObjectId;
    if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
      const customer = await User.findOne({ userId: userIdentifier });
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found"
        });
      }
      customerObjectId = customer._id;
    } else {
      customerObjectId = userIdentifier;
    }

    // Build query - all reservations created by this customer
    let query = {
      createdBy: customerObjectId,
      status: { $in: ['completed', 'cancelled'] }
    };
    
    // Optional status filter
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
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get payment data for these reservations
    const reservationIds = reservations.map(r => r._id);
    const payments = await Payment.find({ reservationId: { $in: reservationIds } })
      .select('reservationId paymentId amount paymentMethod status verifiedAt');

    // Map payments to reservations
    const paymentMap = {};
    payments.forEach(payment => {
      paymentMap[payment.reservationId.toString()] = payment;
    });

    const totalReservations = await Reservation.countDocuments(query);

    // ✅ Count dari database
    const completedCount = await Reservation.countDocuments({
      ...query,
      status: 'completed'
    });
    
    const cancelledCount = await Reservation.countDocuments({
      ...query,
      status: 'cancelled'
    });

    // Format response for customer view
    const formattedHistory = reservations.map(reservation => {
      const payment = paymentMap[reservation._id.toString()];
      
      return {
        _id: reservation._id,
        reservationId: reservation.reservationId,
        
        // Service details
        package: reservation.package,
        barber: reservation.barber,
        schedule: reservation.schedule,
        
        // Reservation details
        totalPrice: reservation.totalPrice,
        status: reservation.status,
        finalStatus: getFinalReservationStatus(reservation.status, payment?.status),
        notes: reservation.notes,
        
        // Payment info (customer view - limited info)
        payment: payment ? {
          paymentId: payment.paymentId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          verifiedAt: payment.verifiedAt
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

    // ✅ Response TANPA pagination
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
    console.error('Get customer reservation history error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving customer reservation history",
      error: error.message
    });
  }
};

// ✅ Helper functions
const getFinalReservationStatus = (reservationStatus, paymentStatus) => {
  if (reservationStatus === 'completed' && paymentStatus === 'verified') return 'Service Completed (Verified Payment)';
  if (reservationStatus === 'completed') return 'Service Completed';
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