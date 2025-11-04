const Reservation = require("../models/Reservation");
const Package = require("../models/Package");
const Barber = require("../models/Barber");
const Schedule = require("../models/Schedule");
const User = require("../models/User");

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
    const { packageId, barberId, scheduleId, notes, customerData } = req.body;
    const userIdentifier = req.user.userId || req.user.id;

    // Validate required fields
    if (!packageId || !barberId || !scheduleId) {
      return res.status(400).json({
        success: false,
        message: "Package, barber, and schedule are required"
      });
    }

    // Get user data and MongoDB _id
    let user;
    if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
      user = await User.findOne({ userId: userIdentifier }).select('_id name phone email userId');
    } else {
      user = await User.findById(userIdentifier).select('_id name phone email userId');
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Determine customer info
    let customerInfo = {};
    
    if (customerData && customerData.name && customerData.phone) {
      // Manual customer data (booking for others)
      customerInfo = {
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email || "",
        isOwnProfile: customerData.isOwnProfile || false
      };
    } else {
      // Use profile data (booking for self)
      customerInfo = {
        name: user.name,
        phone: user.phone,
        email: user.email,
        isOwnProfile: true
      };
    }

    // Validate package exists
    const package = await Package.findById(packageId);
    if (!package) {
      return res.status(404).json({
        success: false,
        message: "Package not found"
      });
    }

    // Validate barber exists
    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    // Validate and update schedule
    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found"
      });
    }

    if (schedule.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: "Selected time slot is no longer available"
      });
    }

    // Create reservation using MongoDB _id for customer field
    const reservation = new Reservation({
      customer: user._id,  // Use MongoDB _id, not userId string
      package: packageId,
      barber: barberId,
      schedule: scheduleId,
      customerName: customerInfo.name,
      customerPhone: customerInfo.phone,
      customerEmail: customerInfo.email,
      totalPrice: package.price,
      notes: notes || "",
      status: "pending",
      isOwnProfile: customerInfo.isOwnProfile
    });

    await reservation.save();

    // Update schedule status to booked
    schedule.status = 'booked';
    schedule.reservation = reservation._id;
    await schedule.save();

    // Populate reservation for response
    const populatedReservation = await Reservation.findById(reservation._id)
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

    res.status(201).json({
      success: true,
      message: "Reservation created successfully. Please wait for admin confirmation.",
      data: populatedReservation
    });

  } catch (error) {
    console.error("Error creating reservation:", error);
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

    // Query reservations using MongoDB _id
    const reservations = await Reservation.find({ customer: user._id })
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

    res.status(200).json({
      success: true,
      message: "User reservations retrieved successfully",
      data: reservations,
      count: reservations.length
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
  updateReservationStatus,
  cancelReservation,
  deleteReservation
};
