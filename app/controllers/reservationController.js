const Reservation = require("../models/Reservation");
const Package = require("../models/Package");        
const Barber = require("../models/Barber");          
const Schedule = require("../models/Schedule");      
const User = require("../models/User");              
const { Payment } = require('../models/Payment');   
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// ✅ ADD DEBUG FUNCTION
const debugReservation = (functionName, data) => {
  console.log(`\n🔍 DEBUG [${functionName}] - ${new Date().toISOString()}`);
  console.log('📊 Data:', JSON.stringify(data, null, 2));
  console.log('==========================================\n');
};

// Get available packages for reservation
const getAvailablePackages = async (req, res) => {
  try {
    debugReservation('getAvailablePackages - START', {
      user: req.user,
      query: req.query
    });

    const packages = await Package.find({ isActive: true })
      .select('packageId name price description')
      .sort({ price: 1 });

    debugReservation('getAvailablePackages - RESULT', {
      count: packages.length,
      packages: packages.map(p => ({ id: p._id, name: p.name, price: p.price }))
    });

    res.status(200).json({
      success: true,
      message: "Available packages retrieved successfully",
      data: packages,
      count: packages.length
    });
  } catch (error) {
    debugReservation('getAvailablePackages - ERROR', {
      message: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Error retrieving available packages",
      error: error.message
    });
  }
};

// Step 2: Get available barbers
const getAvailableBarbers = async (req, res) => {
  try {
    debugReservation('getAvailableBarbers - START', {
      user: req.user,
      query: req.query
    });

    const barbers = await Barber.find({ isActive: true })
      .select('name email phone specialization experience');

    debugReservation('getAvailableBarbers - RESULT', {
      count: barbers.length,
      barbers: barbers.map(b => ({ id: b._id, name: b.name, specialization: b.specialization }))
    });

    res.status(200).json({
      success: true,
      message: "Available barbers retrieved successfully",
      data: barbers
    });
  } catch (error) {
    debugReservation('getAvailableBarbers - ERROR', {
      message: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Error retrieving barbers",
      error: error.message
    });
  }
};

// Step 3: Get available schedules for selected barber
const getAvailableSchedules = async (req, res) => {
  try {
    const { barberId } = req.params;
    const { date } = req.query;

    debugReservation('getAvailableSchedules - START', {
      barberId,
      date,
      user: req.user
    });

    let query = { 
      barber: barberId, 
      status: "available" 
    };

    // Filter by date if provided
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      query.scheduled_time = {
        $gte: startDate,
        $lte: endDate
      };
    } else {
      // Only show future schedules
      query.scheduled_time = { $gte: new Date() };
    }

    debugReservation('getAvailableSchedules - QUERY', {
      query,
      dateFilter: date ? 'specific date' : 'future dates only'
    });

    const schedules = await Schedule.find(query)
      .populate('barber', 'name')
      .sort({ scheduled_time: 1 });

    debugReservation('getAvailableSchedules - RESULT', {
      count: schedules.length,
      schedules: schedules.map(s => ({ 
        id: s._id, 
        timeSlot: s.timeSlot, 
        date: s.date,
        barberName: s.barber?.name 
      }))
    });

    res.status(200).json({
      success: true,
      message: "Available schedules retrieved successfully",
      data: schedules
    });
  } catch (error) {
    debugReservation('getAvailableSchedules - ERROR', {
      message: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: "Error retrieving schedules",
      error: error.message
    });
  }
};

// Step 4: Create reservation
const createReservation = async (req, res) => {
  try {
    const {
      packageId,
      barberId,
      scheduleId,
      notes = "",
      name,
      phone,
      email
    } = req.body;

    debugReservation('createReservation - START', {
      body: req.body,
      user: req.user
    });

    // Validate required fields
    if (!packageId || !barberId || !scheduleId || !name || !phone || !email) {
      debugReservation('createReservation - VALIDATION_ERROR', {
        missing: {
          packageId: !packageId,
          barberId: !barberId,
          scheduleId: !scheduleId,
          name: !name,
          phone: !phone,
          email: !email
        }
      });

      return res.status(400).json({
        success: false,
        message: "Package, barber, schedule, name, phone, and email are required"
      });
    }

    // ✅ Get current user (who is creating the reservation)
    const userIdentifier = req.user.userId || req.user.id;
    let currentUser;
    if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
      currentUser = await User.findOne({ userId: userIdentifier }).select('_id userId name');
    } else {
      currentUser = await User.findById(userIdentifier).select('_id userId name');
    }

    debugReservation('createReservation - USER_LOOKUP', {
      userIdentifier,
      userFound: !!currentUser,
      currentUserId: currentUser?._id,
      currentUserName: currentUser?.name
    });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "Current user not found"
      });
    }

    // Validate package exists and is active
    const packageExists = await Package.findOne({ _id: packageId, isActive: true });
    if (!packageExists) {
      debugReservation('createReservation - PACKAGE_NOT_FOUND', { packageId });
      return res.status(404).json({
        success: false,
        message: "Active package not found"
      });
    }

    // Validate barber exists and is active
    const barberExists = await Barber.findOne({ _id: barberId, isActive: true });
    if (!barberExists) {
      debugReservation('createReservation - BARBER_NOT_FOUND', { barberId });
      return res.status(404).json({
        success: false,
        message: "Active barber not found"
      });
    }

    // Validate schedule is available
    const schedule = await Schedule.findOne({ 
      _id: scheduleId, 
      status: 'available',
      barber: barberId
    });
    
    if (!schedule) {
      debugReservation('createReservation - SCHEDULE_NOT_AVAILABLE', { 
        scheduleId, 
        barberId,
        scheduleFound: !!schedule 
      });
      return res.status(400).json({
        success: false,
        message: "Schedule is not available or doesn't belong to the specified barber"
      });
    }

    debugReservation('createReservation - VALIDATIONS_PASSED', {
      package: { id: packageExists._id, name: packageExists.name, price: packageExists.price },
      barber: { id: barberExists._id, name: barberExists.name },
      schedule: { id: schedule._id, timeSlot: schedule.timeSlot, date: schedule.date }
    });

    // ✅ SIMPLIFIED: Always manual booking - no customer reference
    const reservation = new Reservation({
      customer: null, // ✅ Always null - manual booking only
      customerName: name.trim(),
      customerPhone: phone.trim(),
      customerEmail: email.toLowerCase().trim(),
      createdBy: currentUser._id, // ✅ User yang membuat reservation
      package: packageId,
      barber: barberId,
      schedule: scheduleId,
      totalPrice: packageExists.price,
      notes: notes.trim(),
      status: 'pending'
    });

    // ✅ Calculate payment deadline
    const createdAt = new Date();
    const paymentDeadline = new Date(createdAt.getTime() + 10 * 60 * 1000); // 10 minutes from now

    // Save reservation
    const savedReservation = await reservation.save();

    debugReservation('createReservation - RESERVATION_SAVED', {
      reservationId: savedReservation.reservationId,
      _id: savedReservation._id,
      status: savedReservation.status,
      totalPrice: savedReservation.totalPrice,
      paymentDeadline: paymentDeadline
    });

    // Update schedule status to booked
    await Schedule.findByIdAndUpdate(scheduleId, { 
      status: 'booked',
      reservation: savedReservation._id
    });

    debugReservation('createReservation - SCHEDULE_UPDATED', {
      scheduleId,
      newStatus: 'booked',
      linkedReservation: savedReservation._id
    });

    // Populate the saved reservation for response
    await savedReservation.populate([
      { path: 'customer', select: 'userId name email phone' },
      { path: 'createdBy', select: 'userId name email' },
      { path: 'package', select: 'name price duration' },
      { path: 'barber', select: 'name barberId' },
      { path: 'schedule', select: 'date timeSlot scheduled_time' }
    ]);

    debugReservation('createReservation - SUCCESS', {
      reservationId: savedReservation.reservationId,
      customerName: savedReservation.customerName,
      packageName: savedReservation.package?.name,
      barberName: savedReservation.barber?.name,
      scheduledTime: savedReservation.schedule?.scheduled_time
    });

    res.status(201).json({
      success: true,
      message: "Reservation created successfully",
      data: {
        reservation: savedReservation,
        info: {
          createdBy: savedReservation.createdBy,
          isManualBooking: true
        },
        // ✅ ADD PAYMENT DEADLINE INFO
        paymentInfo: {
          deadline: paymentDeadline,
          timeLimit: '10 minutes',
          warning: 'Please upload payment proof within 10 minutes or your reservation will be automatically cancelled'
        }
      }
    });

  } catch (error) {
    debugReservation('createReservation - ERROR', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    console.error('Create reservation error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate reservation error",
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating reservation",
      error: error.message
    });
  }
};

// Get all reservations with full details AND FILTER
const getAllReservations = async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      barberId,
      packageId,
      startDate,
      endDate
    } = req.query;

    debugReservation('getAllReservations - START', {
      query: req.query,
      user: req.user
    });

    // ✅ Build query object with filters
    let query = {};

    // ✅ Filter by status
    if (status) {
      if (status.includes(',')) {
        // Multiple statuses: ?status=pending,confirmed
        const statusArray = status.split(',').map(s => s.trim());
        query.status = { $in: statusArray };
      } else {
        // Single status: ?status=pending
        query.status = status.trim();
      }
    }

    // ✅ Filter by barber
    if (barberId) {
      query.barber = barberId;
    }

    // ✅ Filter by package
    if (packageId) {
      query.package = packageId;
    }

    // ✅ Filter by date range
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

    // ✅ Pagination
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    debugReservation('getAllReservations - QUERY_BUILT', {
      query,
      pagination: { page, limit, skip },
      sort,
      filters: { status, barberId, packageId, startDate, endDate }
    });

    // ✅ Execute query with filters
    const reservations = await Reservation.find(query)
      .populate('customer', 'name email phone userId')
      .populate('createdBy', 'name email userId')
      .populate('package', 'name price description')
      .populate('barber', 'name email phone specialization')
      .populate('schedule', 'scheduled_time date timeSlot')
      .populate('confirmedBy', 'name email role')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    debugReservation('getAllReservations - RESERVATIONS_FOUND', {
      count: reservations.length,
      statusBreakdown: reservations.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {}),
      reservationIds: reservations.map(r => r.reservationId),
      firstReservation: reservations[0] ? {
        id: reservations[0]._id,
        status: reservations[0].status,
        customerName: reservations[0].customerName,
        packageName: reservations[0].package?.name,
        barberName: reservations[0].barber?.name
      } : null
    });

    // ✅ Get payment data for these reservations
    const reservationIds = reservations.map(r => r._id);
    const payments = await Payment.find({ 
      reservationId: { $in: reservationIds },
      status: { $in: ['pending', 'verified', 'rejected'] }
    })
      .populate('verifiedBy', 'name role userId')
      .select('reservationId paymentId amount paymentMethod status verifiedAt verificationNote uploadedAt rejectedAt');

    debugReservation('getAllReservations - PAYMENTS_FOUND', {
      count: payments.length,
      paymentsByStatus: payments.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {}),
      paymentIds: payments.map(p => p.paymentId),
      reservationPaymentMap: payments.map(p => ({
        reservationId: p.reservationId,
        paymentId: p.paymentId,
        status: p.status
      }))
    });

    // ✅ Map payments to reservations
    const paymentMap = {};
    payments.forEach(payment => {
      paymentMap[payment.reservationId.toString()] = payment;
    });

    // ✅ Total count for pagination
    const totalReservations = await Reservation.countDocuments(query);

    // ✅ Format response with payment info
    const formattedReservations = reservations.map(reservation => {
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
        customer: reservation.customer,
        createdBy: reservation.createdBy,
        package: reservation.package,
        barber: reservation.barber,
        schedule: reservation.schedule,
        confirmedBy: reservation.confirmedBy,
        
        // Payment information
        payment: payment ? {
          paymentId: payment.paymentId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          verificationNote: payment.verificationNote,
          uploadedAt: payment.uploadedAt,
          verifiedAt: payment.verifiedAt,
          rejectedAt: payment.rejectedAt,
          verifiedBy: payment.verifiedBy ? {
            name: payment.verifiedBy.name,
            role: payment.verifiedBy.role,
            userId: payment.verifiedBy.userId
          } : null
        } : null,
        
        // Status descriptions
        finalStatus: getFinalStatus(reservation.status, payment?.status),
        statusDescription: getStatusDescription(reservation.status, payment?.status),
        
        // Timestamps
        createdAt: reservation.createdAt,
        updatedAt: reservation.updatedAt,
        confirmedAt: reservation.confirmedAt,
        completedAt: reservation.completedAt,
        cancelledAt: reservation.cancelledAt
      };
    });

    debugReservation('getAllReservations - FINAL_RESULT', {
      totalReservations,
      formattedCount: formattedReservations.length,
      finalStatusBreakdown: formattedReservations.reduce((acc, r) => {
        acc[r.finalStatus] = (acc[r.finalStatus] || 0) + 1;
        return acc;
      }, {}),
      sampleFormattedData: formattedReservations[0] || null
    });

    // ✅ SIMPLIFIED RESPONSE - HANYA COUNT
    res.status(200).json({
      success: true,
      message: "Reservations retrieved successfully",
      data: formattedReservations,
      count: totalReservations // ✅ Hanya count saja
    });

  } catch (error) {
    debugReservation('getAllReservations - ERROR', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    console.error('Get all reservations error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving reservations",
      error: error.message,
      debug: {
        timestamp: new Date().toISOString(),
        function: 'getAllReservations'
      }
    });
  }
};

// Get reservation by ID
const getReservationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userIdentifier = req.user.userId || req.user.id;
    const userRole = req.user.role;

    debugReservation('getReservationById - START', {
      id,
      userIdentifier,
      userRole
    });

    const reservation = await Reservation.findById(id)
      .populate({
        path: 'customer',
        select: 'name email phone userId'
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
      });

    debugReservation('getReservationById - RESULT', {
      reservationFound: !!reservation,
      reservationId: reservation?.reservationId,
      status: reservation?.status,
      customerName: reservation?.customerName
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    // Check authorization - customer can only view their own reservations
    if (userRole === 'customer') {
      // Find user to get MongoDB _id for comparison
      let user;
      if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
        user = await User.findOne({ userId: userIdentifier }).select('_id');
      } else {
        user = await User.findById(userIdentifier).select('_id');
      }
      
      if (!user || !reservation.customer._id.equals(user._id)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your own reservations."
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Reservation retrieved successfully",
      data: reservation
    });

  } catch (error) {
    debugReservation('getReservationById - ERROR', {
      message: error.message,
      stack: error.stack
    });

    console.error("Error retrieving reservation:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving reservation",
      error: error.message
    });
  }
};

// Get user's reservations (hanya pending dan confirmed)
const getUserReservations = async (req, res) => {
  try {
    const userIdentifier = req.user.userId || req.user.id;

    debugReservation('getUserReservations - START', {
      userIdentifier,
      user: req.user,
      query: req.query
    });
    
    // Find user first to get MongoDB _id
    let user;
    if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
      user = await User.findOne({ userId: userIdentifier }).select('_id name email');
    } else {
      user = await User.findById(userIdentifier).select('_id name email');
    }
    
    debugReservation('getUserReservations - USER_LOOKUP', {
      userIdentifier,
      userFound: !!user,
      userId: user?._id,
      userName: user?.name
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // ✅ Query reservations - filter hanya status pending dan confirmed
    const reservations = await Reservation.find({
      createdBy: user._id,
      status: { $in: ['pending', 'confirmed'] } // ✅ FILTER STATUS
    })
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
      .sort({ createdAt: -1 });

    debugReservation('getUserReservations - RESERVATIONS_FOUND', {
      count: reservations.length,
      statusBreakdown: reservations.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {}),
      reservationIds: reservations.map(r => r.reservationId)
    });

    // ✅ Get payment data for these reservations
    const reservationIds = reservations.map(r => r._id);
    const payments = await Payment.find({ reservationId: { $in: reservationIds } })
      .populate('verifiedBy', 'name role userId')
      .select('reservationId paymentId amount paymentMethod status verifiedAt verificationNote uploadedAt rejectedAt');

    debugReservation('getUserReservations - PAYMENTS_FOUND', {
      count: payments.length,
      paymentsByStatus: payments.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {}),
      paymentIds: payments.map(p => p.paymentId)
    });

    // ✅ Map payments to reservations
    const paymentMap = {};
    payments.forEach(payment => {
      paymentMap[payment.reservationId.toString()] = payment;
    });

    // ✅ Format response with payment deadline info
    const formattedReservations = reservations.map(reservation => {
      const payment = paymentMap[reservation._id.toString()];
      
      // ✅ Calculate remaining time for pending reservations
      let paymentDeadline = null;
      let remainingMinutes = null;
      let isExpiringSoon = false;
      
      if (reservation.status === 'pending' && !payment) {
        paymentDeadline = new Date(reservation.createdAt.getTime() + 10 * 60 * 1000);
        const now = new Date();
        const remainingMs = paymentDeadline - now;
        remainingMinutes = Math.floor(remainingMs / 60000);
        isExpiringSoon = remainingMinutes <= 5 && remainingMinutes > 0;
      }
      
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
        
        // Payment information
        payment: payment ? {
          paymentId: payment.paymentId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          verificationNote: payment.verificationNote,
          uploadedAt: payment.uploadedAt,
          verifiedAt: payment.verifiedAt,
          rejectedAt: payment.rejectedAt,
          verifiedBy: payment.verifiedBy ? {
            name: payment.verifiedBy.name,
            role: payment.verifiedBy.role,
            userId: payment.verifiedBy.userId
          } : null
        } : null,
        
        // ✅ Payment deadline info
        paymentDeadline: paymentDeadline,
        remainingMinutes: remainingMinutes,
        isExpiringSoon: isExpiringSoon,
        deadlineWarning: isExpiringSoon ? 
          `Only ${remainingMinutes} minutes left to upload payment!` : 
          (remainingMinutes > 0 ? `${remainingMinutes} minutes remaining` : null),
        
        // Overall status descriptions
        finalStatus: getFinalStatus(reservation.status, payment?.status),
        statusDescription: getStatusDescription(reservation.status, payment?.status),
        canUploadPayment: reservation.status === 'pending' && (!payment || payment.status === 'rejected'),
        
        // Timestamps
        createdAt: reservation.createdAt,
        updatedAt: reservation.updatedAt,
        confirmedAt: reservation.confirmedAt
      };
    });

    // ✅ Summary dengan breakdown status dan payment
    const pendingCount = formattedReservations.filter(r => r.status === 'pending').length;
    const confirmedCount = formattedReservations.filter(r => r.status === 'confirmed').length;
    const pendingPaymentCount = formattedReservations.filter(r => r.payment?.status === 'pending').length;
    const verifiedPaymentCount = formattedReservations.filter(r => r.payment?.status === 'verified').length;
    const rejectedPaymentCount = formattedReservations.filter(r => r.payment?.status === 'rejected').length;
    const noPaymentCount = formattedReservations.filter(r => !r.payment).length;

    debugReservation('getUserReservations - FINAL_RESULT', {
      totalReservations: formattedReservations.length,
      summary: {
        pendingCount,
        confirmedCount,
        pendingPaymentCount,
        verifiedPaymentCount,
        rejectedPaymentCount,
        noPaymentCount
      }
    });

    res.status(200).json({
      success: true,
      message: "User reservations retrieved successfully",
      data: formattedReservations,
      summary: {
        total: formattedReservations.length,
        reservationStatus: {
          pending: pendingCount,
          confirmed: confirmedCount
        },
        paymentStatus: {
          verified: verifiedPaymentCount,
          pending: pendingPaymentCount,
          rejected: rejectedPaymentCount,
          notUploaded: noPaymentCount
        },
        statusFilter: ['pending', 'confirmed']
      }
    });

  } catch (error) {
    debugReservation('getUserReservations - ERROR', {
      message: error.message,
      stack: error.stack
    });

    console.error("Error retrieving user reservations:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving user reservations",
      error: error.message,
      debug: {
        timestamp: new Date().toISOString(),
        function: 'getUserReservations'
      }
    });
  }
};

// Get all confirmed reservations
const getConfirmedReservations = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Query untuk reservation dengan status confirmed
    const reservations = await Reservation.find({ status: 'confirmed' })
      .populate('customer', 'name email phone userId')
      .populate('package', 'name price description duration')
      .populate('barber', 'name specialization')
      .populate('schedule', 'scheduled_time')
      .populate({
        path: 'paymentId',
        model: 'Payment',
        select: 'paymentId amount paymentMethod status verifiedAt verifiedBy',
        populate: {
          path: 'verifiedBy',
          select: 'name role'
        }
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Count total confirmed reservations
    const totalConfirmed = await Reservation.countDocuments({ status: 'confirmed' });

    // Format response
    const formattedReservations = reservations.map(reservation => ({
      _id: reservation._id,
      reservationId: reservation.reservationId,
      status: reservation.status,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      notes: reservation.notes,
      totalPrice: reservation.totalPrice,
      
      // Service details
      customer: reservation.customer,
      package: reservation.package,
      barber: reservation.barber,
      schedule: reservation.schedule,
      
      // Payment info
      payment: reservation.paymentId ? {
        paymentId: reservation.paymentId.paymentId,
        amount: reservation.paymentId.amount,
        paymentMethod: reservation.paymentId.paymentMethod,
        status: reservation.paymentId.status,
        verifiedAt: reservation.paymentId.verifiedAt,
        verifiedBy: reservation.paymentId.verifiedBy
      } : null,
      
      // Timestamps
      createdAt: reservation.createdAt,
      confirmedAt: reservation.confirmedAt,
      updatedAt: reservation.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: "Confirmed reservations retrieved successfully",
      data: {
        reservations: formattedReservations,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalConfirmed / limit),
          totalItems: totalConfirmed,
          itemsPerPage: parseInt(limit),
          hasNextPage: page * limit < totalConfirmed,
          hasPrevPage: page > 1
        },
        summary: {
          totalConfirmed: totalConfirmed,
          currentPageCount: formattedReservations.length
        }
      }
    });

  } catch (error) {
    console.error('Get confirmed reservations error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving confirmed reservations",
      error: error.message
    });
  }
};

// Update reservation status (Admin only)
const updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const reservation = await Reservation.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate('customer', 'name email')
     .populate('package', 'name price')
     .populate('barber', 'name email')
     .populate('schedule', 'scheduled_time');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Reservation status updated successfully",
      data: reservation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating reservation status",
      error: error.message
    });
  }
};

// Cancel reservation
const cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const userIdentifier = req.user.userId || req.user.id;

    // Find user first
    let user;
    if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
      user = await User.findOne({ userId: userIdentifier }).select('_id');
    } else {
      user = await User.findById(userIdentifier).select('_id');
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const reservation = await Reservation.findById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    // Check if user owns this reservation
    if (!reservation.customer.equals(user._id)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only cancel your own reservations."
      });
    }

    // Check if reservation can be cancelled
    if (!['pending', 'confirmed'].includes(reservation.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel reservation. Current status does not allow cancellation."
      });
    }

    // Update reservation status
    reservation.status = 'cancelled';
    reservation.cancelledAt = new Date();
    reservation.cancelReason = 'Customer cancelled';
    await reservation.save();

    // Free up the schedule
    const schedule = await Schedule.findById(reservation.schedule);
    if (schedule) {
      schedule.status = 'available';
      schedule.reservation = null;
      await schedule.save();
    }

    res.status(200).json({
      success: true,
      message: "Reservation cancelled successfully",
      data: {
        _id: reservation._id,
        status: reservation.status,
        cancelledAt: reservation.cancelledAt,
        cancelReason: reservation.cancelReason
      }
    });

  } catch (error) {
    console.error("Error cancelling reservation:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling reservation",
      error: error.message
    });
  }
};

// Delete reservation (Admin only)
const deleteReservation = async (req, res) => {
  try {
    const { id } = req.params;

    debugReservation('deleteReservation - START', {
      id,
      user: req.user
    });

    const reservation = await Reservation.findById(id)
      .populate('schedule', 'timeSlot date');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    debugReservation('deleteReservation - FOUND', {
      reservationId: reservation.reservationId,
      status: reservation.status,
      schedule: reservation.schedule
    });

    // Free up schedule if it was booked
    if (reservation.schedule && reservation.status === 'pending') {
      await Schedule.findByIdAndUpdate(reservation.schedule._id, {
        status: 'available',
        reservation: null
      });
      debugReservation('deleteReservation - SCHEDULE_FREED', {
        scheduleId: reservation.schedule._id,
        timeSlot: reservation.schedule.timeSlot
      });
    }

    // Delete associated payment if exists
    if (reservation.paymentId) {
      await Payment.findOneAndDelete({ reservationId: reservation._id });
      debugReservation('deleteReservation - PAYMENT_DELETED', {
        paymentId: reservation.paymentId
      });
    }

    // Delete reservation
    await Reservation.findByIdAndDelete(id);

    debugReservation('deleteReservation - SUCCESS', {
      deletedReservationId: reservation.reservationId
    });

    res.status(200).json({
      success: true,
      message: "Reservation deleted successfully",
      data: {
        _id: reservation._id,
        reservationId: reservation.reservationId,
        status: reservation.status
      }
    });

  } catch (error) {
    debugReservation('deleteReservation - ERROR', {
      message: error.message,
      stack: error.stack
    });

    console.error('Delete reservation error:', error);
    res.status(500).json({
      success: false,
      message: "Error deleting reservation",
      error: error.message
    });
  }
};

// ✅ NEW FUNCTION: Check payment deadline status
const checkPaymentDeadline = async (req, res) => {
  try {
    const { reservationId } = req.params;
    
    debugReservation('checkPaymentDeadline - START', {
      reservationId,
      user: req.user
    });

    const reservation = await Reservation.findById(reservationId)
      .select('createdAt status paymentId schedule')
      .populate('schedule', 'timeSlot date');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    debugReservation('checkPaymentDeadline - FOUND', {
      reservationId: reservation._id,
      status: reservation.status,
      hasPayment: !!reservation.paymentId,
      createdAt: reservation.createdAt
    });

    // Check if reservation is still pending and no payment
    if (reservation.status === 'pending' && !reservation.paymentId) {
      const createdAt = new Date(reservation.createdAt);
      const deadline = new Date(createdAt.getTime() + 10 * 60 * 1000); // 10 minutes
      const now = new Date();
      const remainingMs = deadline - now;
      const remainingMinutes = Math.floor(remainingMs / 60000);
      const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);

      debugReservation('checkPaymentDeadline - CALCULATING', {
        createdAt: createdAt.toISOString(),
        deadline: deadline.toISOString(),
        now: now.toISOString(),
        remainingMs,
        remainingMinutes,
        remainingSeconds
      });

      // Check if expired
      if (remainingMs <= 0) {
        debugReservation('checkPaymentDeadline - EXPIRED', {
          expiredBy: Math.abs(remainingMs) + 'ms'
        });

        // Auto-cancel if backend checker hasn't run yet
        reservation.status = 'cancelled';
        reservation.cancelledAt = now;
        reservation.cancelReason = 'Payment timeout - No payment uploaded within 10 minutes';
        await reservation.save();

        // Free schedule
        if (reservation.schedule) {
          await Schedule.findByIdAndUpdate(reservation.schedule._id, {
            status: 'available',
            reservation: null
          });
          
          debugReservation('checkPaymentDeadline - SCHEDULE_FREED', {
            scheduleId: reservation.schedule._id,
            timeSlot: reservation.schedule.timeSlot
          });
        }

        return res.status(200).json({
          success: false,
          isExpired: true,
          message: "Payment deadline has expired. Reservation cancelled.",
          data: {
            status: 'cancelled',
            expiredAt: deadline,
            cancelledAt: now
          }
        });
      }

      // Still valid
      debugReservation('checkPaymentDeadline - STILL_VALID', {
        remainingMinutes,
        remainingSeconds,
        isExpiringSoon: remainingMinutes < 3
      });

      return res.status(200).json({
        success: true,
        isExpired: false,
        message: "Payment deadline is still active",
        data: {
          deadline: deadline,
          remainingTime: {
            minutes: remainingMinutes,
            seconds: remainingSeconds,
            totalMs: remainingMs,
            formatted: `${remainingMinutes}:${String(remainingSeconds).padStart(2, '0')}`
          },
          isExpiringSoon: remainingMinutes < 3,
          isUrgent: remainingMinutes < 1,
          status: reservation.status
        }
      });
    }

    // Reservation already has payment or not pending
    debugReservation('checkPaymentDeadline - NO_DEADLINE_NEEDED', {
      status: reservation.status,
      hasPayment: !!reservation.paymentId
    });

    return res.status(200).json({
      success: true,
      message: "Reservation status checked",
      data: {
        status: reservation.status,
        hasPayment: !!reservation.paymentId,
        noDeadline: true,
        reason: reservation.status !== 'pending' ? 'Reservation is not pending' : 'Payment already uploaded'
      }
    });

  } catch (error) {
    debugReservation('checkPaymentDeadline - ERROR', {
      message: error.message,
      stack: error.stack
    });

    console.error('Check deadline error:', error);
    res.status(500).json({
      success: false,
      message: "Error checking payment deadline",
      error: error.message
    });
  }
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

// Helper function untuk final status
const getFinalStatus = (reservationStatus, paymentStatus) => {
  if (reservationStatus === 'confirmed' && paymentStatus === 'verified') return 'Ready for Service';
  if (reservationStatus === 'confirmed') return 'Confirmed';
  if (reservationStatus === 'pending' && paymentStatus === 'verified') return 'Payment Approved';
  if (reservationStatus === 'pending' && paymentStatus === 'rejected') return 'Payment Rejected';
  if (reservationStatus === 'pending' && paymentStatus === 'pending') return 'Payment Under Review';
  if (reservationStatus === 'pending' && !paymentStatus) return 'Awaiting Payment';
  return reservationStatus || 'Unknown';
};

// Helper function untuk status description
const getStatusDescription = (reservationStatus, paymentStatus) => {
  if (reservationStatus === 'confirmed' && paymentStatus === 'verified') 
    return 'Your reservation is confirmed and ready for service';
  if (reservationStatus === 'confirmed') 
    return 'Your reservation is confirmed';
  if (reservationStatus === 'pending' && paymentStatus === 'verified') 
    return 'Payment approved, waiting for admin confirmation';
  if (reservationStatus === 'pending' && paymentStatus === 'rejected') 
    return 'Payment was rejected, please upload new payment proof';
  if (reservationStatus === 'pending' && paymentStatus === 'pending') 
    return 'Payment uploaded, waiting for verification';
  if (reservationStatus === 'pending' && !paymentStatus) 
    return 'Please upload payment proof to continue';
  return 'Status unknown';
};

// ✅ UPDATE MODULE.EXPORTS - TAMBAHKAN HELPER FUNCTIONS
module.exports = {
  getAvailablePackages,
  getAvailableBarbers,
  getAvailableSchedules,
  createReservation,
  getAllReservations,
  getReservationById,
  getUserReservations,
  getConfirmedReservations,
  updateReservationStatus,
  cancelReservation,
  deleteReservation,
  checkPaymentDeadline, // ✅ Now properly defined
  getFinalStatus,
  getStatusDescription
};
