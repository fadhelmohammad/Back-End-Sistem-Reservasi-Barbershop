const Reservation = require("../models/Reservation");
const Package = require("../models/Package");
const Barber = require("../models/Barber");
const Schedule = require("../models/Schedule");
const User = require("../models/User");

// ✅ SIMPLIFIED: Create walk-in reservation (langsung completed)
const manageWalkInReservation = async (req, res) => {
  try {
    const { 
      packageId, 
      barberId, 
      scheduleId, 
      customerName, 
      customerPhone, 
      customerEmail, 
      paymentMethod = "cash",
      notes = "",
      serviceNotes = ""
    } = req.body;
    
    const cashierIdentifier = req.user.userId || req.user.id;

    console.log('🔍 Create Walk-in Reservation (Direct Complete):', {
      packageId, barberId, scheduleId, customerName, customerPhone, paymentMethod
    });

    // ✅ Validate required fields
    if (!packageId || !barberId || !scheduleId || !customerName || !customerPhone || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Package, barber, schedule, customer name, phone, and payment method are required for walk-in reservation"
      });
    }

    // ✅ Validate payment method
    const validPaymentMethods = ['cash', 'bank_transfer', 'e_wallet'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method. Allowed: cash, bank_transfer, e_wallet",
        allowedMethods: validPaymentMethods
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

    console.log('✅ Validations passed, creating walk-in reservation (direct complete)...');

    const completionTime = new Date();

    // ✅ Create walk-in reservation (LANGSUNG COMPLETED)
    const reservation = new Reservation({
      customer: null, // ✅ No customer account for walk-in
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail ? customerEmail.trim() : null,
      createdBy: cashier._id,
      package: packageId,
      barber: barberId,
      schedule: scheduleId,
      totalPrice: packageExists.price,
      notes: notes.trim(),
      serviceNotes: serviceNotes.trim(),
      
      // ✅ LANGSUNG COMPLETED STATUS
      status: 'completed', // ✅ Walk-in langsung completed
      confirmedBy: cashier._id,
      confirmedAt: completionTime,
      completedBy: cashier._id, // ✅ Cashier yang complete
      completedAt: completionTime, // ✅ Langsung completed
      
      // ✅ PAYMENT INFO
      paymentMethod: paymentMethod, // ✅ Payment method dari body
      
      // ✅ WALK-IN FLAGS
      isWalkIn: true
    });

    // ✅ Save reservation
    const savedReservation = await reservation.save();

    console.log('✅ Walk-in reservation saved (completed):', savedReservation.reservationId);

    // ✅ Update schedule status to completed (bukan booked)
    await Schedule.findByIdAndUpdate(scheduleId, { 
      status: 'completed', // ✅ Langsung completed
      reservation: savedReservation._id,
      completedAt: completionTime
    });

    console.log('✅ Schedule updated to completed');

    // ✅ Populate the saved reservation for response
    await savedReservation.populate([
      { path: 'createdBy', select: 'userId name email role' },
      { path: 'confirmedBy', select: 'userId name email role' },
      { path: 'completedBy', select: 'userId name email role' },
      { path: 'package', select: 'packageId name price description' },
      { path: 'barber', select: 'barberId name specialization' },
      { path: 'schedule', select: 'scheduleId date timeSlot scheduled_time' }
    ]);

    res.status(201).json({
      success: true,
      message: "Walk-in service completed and payment processed successfully",
      data: {
        reservation: savedReservation,
        summary: {
          reservationId: savedReservation.reservationId,
          customerName: savedReservation.customerName,
          customerPhone: savedReservation.customerPhone,
          package: savedReservation.package.name,
          barber: savedReservation.barber.name,
          schedule: `${savedReservation.schedule.date} at ${savedReservation.schedule.timeSlot}`,
          totalPrice: savedReservation.totalPrice,
          paymentMethod: savedReservation.paymentMethod,
          serviceNotes: savedReservation.serviceNotes,
          completedAt: savedReservation.completedAt,
          completedBy: savedReservation.completedBy.name
        },
        info: {
          isWalkIn: true,
          directCompletion: true,
          paymentProcessed: true,
          scheduleCompleted: true
        }
      }
    });

  } catch (error) {
    console.error("Error creating walk-in reservation:", error);
    res.status(500).json({
      success: false,
      message: "Error processing walk-in service",
      error: error.message
    });
  }
};

// ✅ Get cashier's walk-in reservations (updated for completed status)
const getCashierWalkInReservations = async (req, res) => {
  try {
    const cashierIdentifier = req.user.userId || req.user.id;
    const { 
      status = 'completed', // ✅ Default to completed since walk-ins are auto-completed
      page = 1, 
      limit = 10, 
      sortBy = 'completedAt', // ✅ Sort by completion time
      sortOrder = 'desc' 
    } = req.query;

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

    // ✅ Build query - filter by cashier's walk-in reservations
    let query = {
      $or: [
        { createdBy: cashier._id }, // ✅ Created by this cashier
        { completedBy: cashier._id } // ✅ Or completed by this cashier
      ],
      isWalkIn: true
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
      .populate('createdBy', 'userId name role')
      .populate('confirmedBy', 'userId name role')
      .populate('completedBy', 'userId name role')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalReservations = await Reservation.countDocuments(query);

    // ✅ Format response with enhanced walk-in info
    const formattedReservations = reservations.map(reservation => ({
      _id: reservation._id,
      reservationId: reservation.reservationId,
      status: reservation.status,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      customerEmail: reservation.customerEmail,
      notes: reservation.notes,
      serviceNotes: reservation.serviceNotes,
      totalPrice: reservation.totalPrice,
      paymentMethod: reservation.paymentMethod,
      isWalkIn: reservation.isWalkIn,
      
      // ✅ Enhanced service details
      package: reservation.package,
      barber: reservation.barber,
      schedule: reservation.schedule,
      
      // ✅ Staff info
      createdBy: reservation.createdBy,
      confirmedBy: reservation.confirmedBy,
      completedBy: reservation.completedBy,
      
      // ✅ Timestamps with duration calculation
      createdAt: reservation.createdAt,
      confirmedAt: reservation.confirmedAt,
      completedAt: reservation.completedAt,
      updatedAt: reservation.updatedAt,
      serviceDuration: reservation.completedAt && reservation.createdAt 
        ? Math.round((new Date(reservation.completedAt) - new Date(reservation.createdAt)) / 1000 / 60) // minutes
        : null
    }));

    // ✅ Enhanced summary with payment breakdown
    const paymentSummary = formattedReservations.reduce((acc, reservation) => {
      if (reservation.paymentMethod) {
        acc[reservation.paymentMethod] = (acc[reservation.paymentMethod] || 0) + reservation.totalPrice;
      }
      return acc;
    }, {});

    const totalRevenue = formattedReservations.reduce((sum, reservation) => sum + reservation.totalPrice, 0);

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
        currentPageCount: formattedReservations.length,
        totalRevenue: totalRevenue,
        paymentBreakdown: paymentSummary,
        averageServiceTime: formattedReservations.length > 0 
          ? Math.round(formattedReservations
              .filter(r => r.serviceDuration)
              .reduce((sum, r) => sum + r.serviceDuration, 0) / formattedReservations.length)
          : 0
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
  manageWalkInReservation,
  getCashierWalkInReservations
};