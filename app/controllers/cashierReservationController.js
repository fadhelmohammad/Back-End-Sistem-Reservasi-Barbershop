const Reservation = require("../models/Reservation");
const Package = require("../models/Package");
const Barber = require("../models/Barber");
const Schedule = require("../models/Schedule");
const User = require("../models/User");

// ✅ Cashier can create reservation for walk-in customers
const createWalkInReservation = async (req, res) => {
  try {
    const { packageId, barberId, scheduleId, customerName, customerPhone, notes = "" } = req.body;
    const cashierIdentifier = req.user.userId || req.user.id;

    console.log('🔍 Create Walk-in Reservation:', {
      packageId, barberId, scheduleId, customerName, customerPhone
    });

    // ✅ Validate required fields (hanya nama dan phone)
    if (!packageId || !barberId || !scheduleId || !customerName || !customerPhone) {
      return res.status(400).json({
        success: false,
        message: "Package, barber, schedule, customer name, and phone are required"
      });
    }

    // ✅ Get cashier user
    let cashier;
    if (typeof cashierIdentifier === 'string' && cashierIdentifier.startsWith('USR-')) {
      cashier = await User.findOne({ userId: cashierIdentifier, role: 'cashier' }).select('_id userId name');
    } else {
      cashier = await User.findOne({ _id: cashierIdentifier, role: 'cashier' }).select('_id userId name');
    }

    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: "Cashier not found"
      });
    }

    // ✅ Validate package exists and is active
    const packageExists = await Package.findOne({ _id: packageId, isActive: true });
    if (!packageExists) {
      return res.status(404).json({
        success: false,
        message: "Active package not found"
      });
    }

    // ✅ Validate barber exists and is active
    const barberExists = await Barber.findOne({ _id: barberId, isActive: true });
    if (!barberExists) {
      return res.status(404).json({
        success: false,
        message: "Active barber not found"
      });
    }

    // ✅ Validate schedule is available
    const schedule = await Schedule.findOne({ 
      _id: scheduleId, 
      status: 'available',
      barber: barberId
    });
    
    if (!schedule) {
      return res.status(400).json({
        success: false,
        message: "Schedule is not available or doesn't belong to the specified barber"
      });
    }

    console.log('✅ Validations passed, creating walk-in reservation...');

    // ✅ Create walk-in reservation
    const reservation = new Reservation({
      customer: null, // ✅ No customer account for walk-in
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: null, // ✅ Email tidak wajib untuk walk-in
      createdBy: cashier._id, // ✅ Cashier yang membuat
      package: packageId,
      barber: barberId,
      schedule: scheduleId,
      totalPrice: packageExists.price,
      notes: notes.trim(),
      status: 'confirmed', // ✅ Walk-in langsung confirmed (tidak perlu verifikasi)
      confirmedBy: cashier._id, // ✅ Auto-confirmed by cashier
      confirmedAt: new Date(),
      isWalkIn: true // ✅ Flag untuk walk-in
    });

    // ✅ Save reservation
    const savedReservation = await reservation.save();

    console.log('✅ Walk-in reservation saved:', savedReservation.reservationId);

    // ✅ Update schedule status to booked
    await Schedule.findByIdAndUpdate(scheduleId, { 
      status: 'booked',
      reservation: savedReservation._id
    });

    console.log('✅ Schedule updated to booked');

    // ✅ Populate the saved reservation for response
    await savedReservation.populate([
      { path: 'createdBy', select: 'userId name email role' },
      { path: 'confirmedBy', select: 'userId name email role' },
      { path: 'package', select: 'packageId name price description' },
      { path: 'barber', select: 'barberId name specialization' },
      { path: 'schedule', select: 'scheduleId date timeSlot scheduled_time' }
    ]);

    res.status(201).json({
      success: true,
      message: "Walk-in reservation created successfully",
      data: {
        reservation: savedReservation,
        info: {
          isWalkIn: true,
          createdBy: savedReservation.createdBy,
          confirmedBy: savedReservation.confirmedBy,
          paymentRequired: false, // ✅ Walk-in tidak wajib upload bukti pembayaran
          autoConfirmed: true
        }
      }
    });

  } catch (error) {
    console.error("Error creating walk-in reservation:", error);
    res.status(500).json({
      success: false,
      message: "Error creating walk-in reservation",
      error: error.message
    });
  }
};

// ✅ Cashier can mark service as completed and handle payment
const completeService = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod = "cash", serviceNotes } = req.body;
    const cashierIdentifier = req.user.userId || req.user.id;

    // ✅ Get cashier
    let cashier;
    if (typeof cashierIdentifier === 'string' && cashierIdentifier.startsWith('USR-')) {
      cashier = await User.findOne({ userId: cashierIdentifier, role: 'cashier' }).select('_id userId name');
    } else {
      cashier = await User.findOne({ _id: cashierIdentifier, role: 'cashier' }).select('_id userId name');
    }

    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: "Cashier not found"
      });
    }

    const reservation = await Reservation.findById(id)
      .populate('package')
      .populate('barber');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    // ✅ Check if reservation can be completed
    if (!['confirmed'].includes(reservation.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot complete service. Invalid status."
      });
    }

    // ✅ Update reservation to completed
    reservation.status = 'completed';
    reservation.completedAt = new Date();
    reservation.completedBy = cashier._id;
    reservation.paymentMethod = paymentMethod;
    reservation.serviceNotes = serviceNotes || "";
    await reservation.save();

    // ✅ Update schedule to completed
    const schedule = await Schedule.findById(reservation.schedule);
    if (schedule) {
      schedule.status = 'completed';
      schedule.completedAt = new Date();
      await schedule.save();
    }

    console.log('✅ Service completed:', {
      reservationId: reservation.reservationId,
      completedBy: cashier.name,
      paymentMethod
    });

    res.status(200).json({
      success: true,
      message: "Service completed and payment processed",
      data: {
        reservationId: reservation.reservationId,
        customerName: reservation.customerName,
        package: reservation.package.name,
        totalPrice: reservation.totalPrice,
        paymentMethod: paymentMethod,
        completedAt: reservation.completedAt,
        completedBy: {
          _id: cashier._id,
          userId: cashier.userId,
          name: cashier.name
        }
      }
    });

  } catch (error) {
    console.error("Error completing service:", error);
    res.status(500).json({
      success: false,
      message: "Error completing service",
      error: error.message
    });
  }
};

// ✅ Get cashier's walk-in reservations
const getCashierWalkInReservations = async (req, res) => {
  try {
    const cashierIdentifier = req.user.userId || req.user.id;
    const { status, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // ✅ Get cashier
    let cashier;
    if (typeof cashierIdentifier === 'string' && cashierIdentifier.startsWith('USR-')) {
      cashier = await User.findOne({ userId: cashierIdentifier, role: 'cashier' }).select('_id');
    } else {
      cashier = await User.findOne({ _id: cashierIdentifier, role: 'cashier' }).select('_id');
    }

    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: "Cashier not found"
      });
    }

    // ✅ Build query
    let query = {
      createdBy: cashier._id,
      isWalkIn: true // ✅ Only walk-in reservations
    };

    // ✅ Filter by status if provided
    if (status) {
      if (status.includes(',')) {
        const statusArray = status.split(',').map(s => s.trim());
        query.status = { $in: statusArray };
      } else {
        query.status = status.trim();
      }
    }

    // ✅ Pagination
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // ✅ Execute query
    const reservations = await Reservation.find(query)
      .populate('package', 'packageId name price')
      .populate('barber', 'barberId name specialization')
      .populate('schedule', 'scheduleId date timeSlot scheduled_time')
      .populate('confirmedBy', 'userId name role')
      .populate('completedBy', 'userId name role')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalReservations = await Reservation.countDocuments(query);

    // ✅ Format response
    const formattedReservations = reservations.map(reservation => ({
      _id: reservation._id,
      reservationId: reservation.reservationId,
      status: reservation.status,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      notes: reservation.notes,
      serviceNotes: reservation.serviceNotes,
      totalPrice: reservation.totalPrice,
      paymentMethod: reservation.paymentMethod,
      isWalkIn: reservation.isWalkIn,
      
      // Service details
      package: reservation.package,
      barber: reservation.barber,
      schedule: reservation.schedule,
      confirmedBy: reservation.confirmedBy,
      completedBy: reservation.completedBy,
      
      // Timestamps
      createdAt: reservation.createdAt,
      confirmedAt: reservation.confirmedAt,
      completedAt: reservation.completedAt,
      updatedAt: reservation.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: "Cashier walk-in reservations retrieved successfully",
      data: formattedReservations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReservations / limit),
        totalItems: totalReservations,
        itemsPerPage: parseInt(limit),
        hasNextPage: page * limit < totalReservations,
        hasPrevPage: page > 1
      },
      summary: {
        total: totalReservations,
        currentPageCount: formattedReservations.length
      }
    });

  } catch (error) {
    console.error("Error getting cashier walk-in reservations:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving cashier walk-in reservations",
      error: error.message
    });
  }
};

module.exports = {
  createWalkInReservation,
  completeService,
  getCashierWalkInReservations
};