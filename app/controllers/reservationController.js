const Reservation = require("../models/Reservation");
const Schedule = require("../models/Schedule");

// Create reservation
const createReservation = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    const { schedule, status = "pending" } = req.body;

    // Validate required fields
    if (!schedule) {
      return res.status(400).json({
        success: false,
        message: "Schedule ID is required"
      });
    }

    // Check if schedule exists
    const scheduleExists = await Schedule.findById(schedule);
    if (!scheduleExists) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found"
      });
    }

    // Create reservation
    const reservation = new Reservation({
      customer: req.user.userId,
      schedule,
      status
    });

    const savedReservation = await reservation.save();
    
    // Populate customer and schedule data
    await savedReservation.populate('customer', 'name email phone');
    await savedReservation.populate('schedule');
    
    res.status(201).json({
      success: true,
      message: "Reservation created successfully",
      data: {
        schedule: {
          barber: {
            name: savedReservation.schedule.barber.name,
            phone: savedReservation.schedule.barber.phone
          },
          scheduled_time: savedReservation.schedule.scheduled_time
        },
        status: savedReservation.status,
        customer: savedReservation.customer,
        _id: savedReservation._id,
        createdAt: savedReservation.createdAt
      }
    });

  } catch (error) {
    console.error("Create reservation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create reservation",
      error: error.message
    });
  }
};

// Get all reservations
const getAllReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate('customer', 'name email phone')
      .populate({
        path: 'schedule',
        populate: {
          path: 'barber',
          select: 'name email phone specialization experience'
        }
      })
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
      .populate('customer', 'name email phone')
      .populate('schedule');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    res.json({
      success: true,
      data: reservation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch reservation",
      error: error.message
    });
  }
};

// Get user's reservations
const getUserReservations = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    const reservations = await Reservation.find({ customer: req.user.userId })
      .populate('schedule')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reservations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch user reservations",
      error: error.message
    });
  }
};

// Update reservation status
const updateReservationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const reservationId = req.params.id;

    // Validate status
    const validStatuses = ["pending", "confirmed", "cancelled", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: " + validStatuses.join(", ")
      });
    }

    const reservation = await Reservation.findByIdAndUpdate(
      reservationId,
      { status },
      { new: true }
    ).populate('customer', 'name email phone').populate('schedule');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    res.json({
      success: true,
      message: "Reservation status updated successfully",
      data: reservation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update reservation status",
      error: error.message
    });
  }
};

// Cancel reservation (for users)
const cancelReservation = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    const reservation = await Reservation.findOne({
      _id: req.params.id,
      customer: req.user.userId
    });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found or not authorized"
      });
    }

    if (reservation.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Reservation is already cancelled"
      });
    }

    reservation.status = "cancelled";
    await reservation.save();

    res.json({
      success: true,
      message: "Reservation cancelled successfully",
      data: reservation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to cancel reservation",
      error: error.message
    });
  }
};

// Delete reservation
const deleteReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findByIdAndDelete(req.params.id);
    
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    res.json({
      success: true,
      message: "Reservation deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete reservation",
      error: error.message
    });
  }
};

module.exports = {
  createReservation,
  getAllReservations,
  getReservationById,
  getUserReservations,
  updateReservationStatus,
  cancelReservation,
  deleteReservation
};
