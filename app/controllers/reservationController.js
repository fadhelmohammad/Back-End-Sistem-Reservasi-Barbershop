const Reservation = require("../models/Reservation");
const Package = require("../models/Package");
const Barber = require("../models/Barber");
const Schedule = require("../models/Schedule");

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
      customerName, 
      customerPhone, 
      packageId, 
      barberId, 
      scheduleId, 
      notes 
    } = req.body;
    const customerId = req.user.userId;

    // Validate customer data
    if (!customerName || !customerPhone) {
      return res.status(400).json({
        success: false,
        message: "Customer name and phone are required"
      });
    }

    // Validate package exists
    const selectedPackage = await Package.findById(packageId);
    if (!selectedPackage) {
      return res.status(404).json({
        success: false,
        message: "Package not found"
      });
    }

    // Validate barber exists
    const selectedBarber = await Barber.findById(barberId);
    if (!selectedBarber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    // Validate schedule exists and is available
    const selectedSchedule = await Schedule.findById(scheduleId);
    if (!selectedSchedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found"
      });
    }

    if (selectedSchedule.status !== "available") {
      return res.status(400).json({
        success: false,
        message: "Selected schedule is not available"
      });
    }

    // Check if schedule belongs to selected barber
    if (selectedSchedule.barber.toString() !== barberId) {
      return res.status(400).json({
        success: false,
        message: "Schedule does not belong to selected barber"
      });
    }

    // Create reservation
    const reservation = new Reservation({
      customer: customerId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      package: packageId,
      barber: barberId,
      schedule: scheduleId,
      totalPrice: selectedPackage.price,
      notes
    });

    await reservation.save();

    // Update schedule status to booked
    await Schedule.findByIdAndUpdate(scheduleId, { 
      status: "booked" 
    });

    // Populate reservation data for response
    const populatedReservation = await Reservation.findById(reservation._id)
      .populate('customer', 'name email')
      .populate('package', 'name price description')
      .populate('barber', 'name email phone')
      .populate('schedule', 'scheduled_time');

    res.status(201).json({
      success: true,
      message: "Reservation created successfully. Please wait for admin confirmation.",
      data: populatedReservation
    });
  } catch (error) {
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
    const reservation = await Reservation.findById(req.params.id)
      .populate('customer', 'name email')
      .populate('package', 'name price description')
      .populate('barber', 'name email phone')
      .populate('schedule', 'scheduled_time');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Reservation retrieved successfully",
      data: reservation
    });
  } catch (error) {
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
    const customerId = req.user.userId;

    const reservations = await Reservation.find({ customer: customerId })
      .populate('package', 'name price description')
      .populate('barber', 'name email phone')
      .populate('schedule', 'scheduled_time')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "User reservations retrieved successfully",
      data: reservations
    });
  } catch (error) {
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
    const customerId = req.user.userId;

    const reservation = await Reservation.findOne({ 
      _id: id, 
      customer: customerId 
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    if (reservation.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel completed reservation"
      });
    }

    // Update reservation status
    reservation.status = "cancelled";
    await reservation.save();

    // Make schedule available again
    await Schedule.findByIdAndUpdate(reservation.schedule, { 
      status: "available" 
    });

    res.status(200).json({
      success: true,
      message: "Reservation cancelled successfully"
    });
  } catch (error) {
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
