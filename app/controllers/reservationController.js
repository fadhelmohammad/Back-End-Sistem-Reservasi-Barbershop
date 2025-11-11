const Reservation = require("../models/Reservation");
const Package = require("../models/Package");
const Barber = require("../models/Barber");
const Schedule = require("../models/Schedule");
const User = require("../models/User");
const bcrypt = require('bcryptjs');

// Get available packages for reservation
const getAvailablePackages = async (req, res) => {
  try {
    const packages = await Package.find({ isActive: true })
      .select('packageId name price description')
      .sort({ price: 1 });

    res.status(200).json({
      success: true,
      message: "Available packages retrieved successfully",
      data: packages,
      count: packages.length
    });
  } catch (error) {
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
    const barbers = await Barber.find({ isActive: true })
      .select('name email phone specialization experience');

    res.status(200).json({
      success: true,
      message: "Available barbers retrieved successfully",
      data: barbers
    });
  } catch (error) {
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

    const schedules = await Schedule.find(query)
      .populate('barber', 'name')
      .sort({ scheduled_time: 1 });

    res.status(200).json({
      success: true,
      message: "Available schedules retrieved successfully",
      data: schedules
    });
  } catch (error) {
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

    // Validate required fields
    if (!packageId || !barberId || !scheduleId || !name || !phone || !email) {
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

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "Current user not found"
      });
    }

    // Validate package exists and is active
    const packageExists = await Package.findOne({ _id: packageId, isActive: true });
    if (!packageExists) {
      return res.status(404).json({
        success: false,
        message: "Active package not found"
      });
    }

    // Validate barber exists and is active
    const barberExists = await Barber.findOne({ _id: barberId, isActive: true });
    if (!barberExists) {
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
      return res.status(400).json({
        success: false,
        message: "Schedule is not available or doesn't belong to the specified barber"
      });
    }

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

    // Save reservation
    const savedReservation = await reservation.save();

    // Update schedule status to booked
    await Schedule.findByIdAndUpdate(scheduleId, { 
      status: 'booked',
      reservation: savedReservation._id
    });

    // Populate the saved reservation for response
    await savedReservation.populate([
      { path: 'customer', select: 'userId name email phone' },
      { path: 'createdBy', select: 'userId name email' },
      { path: 'package', select: 'name price duration' },
      { path: 'barber', select: 'name barberId' },
      { path: 'schedule', select: 'date timeSlot scheduled_time' }
    ]);

    res.status(201).json({
      success: true,
      message: "Reservation created successfully",
      data: {
        reservation: savedReservation,
        info: {
          createdBy: savedReservation.createdBy,
          isManualBooking: true // ✅ Always manual
        }
      }
    });

  } catch (error) {
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

// Get all reservations with full details
const getAllReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate('customer', 'name email')
      .populate('package', 'name price description')
      .populate('barber', 'name email phone')
      .populate('schedule', 'scheduled_time')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Reservations retrieved successfully",
      data: reservations,
      count: reservations.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving reservations",
      error: error.message
    });
  }
};

// Get reservation by ID
const getReservationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userIdentifier = req.user.userId || req.user.id;
    const userRole = req.user.role;

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
    console.error("Error retrieving reservation:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving reservation",
      error: error.message
    });
  }
};

// Get user's reservations
const getUserReservations = async (req, res) => {
  try {
    const userIdentifier = req.user.userId || req.user.id;
    
    // Find user first to get MongoDB _id
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

    // ✅ Query reservations - include both customer and createdBy
    const reservations = await Reservation.find({
      $or: [
        { customer: user._id }, // Reservations where user is the customer (self booking)
        { createdBy: user._id }  // Reservations created by user (manual booking)
      ]
    })
      .populate({
        path: 'customer',
        select: 'name email phone userId'
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
      .sort({ createdAt: -1 });

    // ✅ Format response with booking type info
    const formattedReservations = reservations.map(reservation => ({
      _id: reservation._id,
      reservationId: reservation.reservationId,
      status: reservation.status,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      customerEmail: reservation.customerEmail,
      notes: reservation.notes,
      totalPrice: reservation.totalPrice,
      
      // Booking type info
      bookingType: reservation.customer ? "self" : "manual",
      isSelfBooking: reservation.customer && reservation.customer._id.toString() === user._id.toString(),
      isManualBooking: !reservation.customer,
      canPayment: true, // ✅ Always true karena user yang buat reservation
      
      // Related data
      customer: reservation.customer,
      createdBy: reservation.createdBy,
      package: reservation.package,
      barber: reservation.barber,
      schedule: reservation.schedule,
      
      // Timestamps
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: "User reservations retrieved successfully",
      data: formattedReservations,
      count: formattedReservations.length,
      summary: {
        selfBookings: formattedReservations.filter(r => r.isSelfBooking).length,
        manualBookings: formattedReservations.filter(r => r.isManualBooking).length,
        total: formattedReservations.length
      }
    });

  } catch (error) {
    console.error("Error retrieving user reservations:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving user reservations",
      error: error.message
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

    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    // Make schedule available again if reservation is deleted
    await Schedule.findByIdAndUpdate(reservation.schedule, { 
      status: "available" 
    });

    await Reservation.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Reservation deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting reservation",
      error: error.message
    });
  }
};

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
  deleteReservation
};
