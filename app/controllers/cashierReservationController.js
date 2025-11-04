const Reservation = require("../models/Reservation");
const Package = require("../models/Package");
const Barber = require("../models/Barber");
const Schedule = require("../models/Schedule");
const User = require("../models/User");

// Cashier can create reservation for walk-in customers
const createWalkInReservation = async (req, res) => {
  try {
    const { packageId, barberId, scheduleId, customerData, notes } = req.body;
    const cashierId = req.user.userId || req.user.id;

    // Validate required fields
    if (!packageId || !barberId || !scheduleId || !customerData) {
      return res.status(400).json({
        success: false,
        message: "Package, barber, schedule, and customer data are required"
      });
    }

    // Validate customer data
    if (!customerData.name || !customerData.phone) {
      return res.status(400).json({
        success: false,
        message: "Customer name and phone are required"
      });
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

    // Create reservation (for walk-in, no customer user account needed)
    const reservation = new Reservation({
      customer: null, // No user account for walk-in
      package: packageId,
      barber: barberId,
      schedule: scheduleId,
      customerName: customerData.name,
      customerPhone: customerData.phone,
      totalPrice: package.price,
      notes: notes || "",
      status: "confirmed", // Walk-in reservations are immediately confirmed
      createdBy: cashierId,
      isWalkIn: true
    });

    await reservation.save();

    // Update schedule status to booked
    schedule.status = 'booked';
    schedule.reservation = reservation._id;
    await schedule.save();

    res.status(201).json({
      success: true,
      message: "Walk-in reservation created successfully",
      data: reservation
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

// Cashier can mark service as completed and handle payment
const completeService = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod = "cash", serviceNotes } = req.body;
    const cashierId = req.user.userId || req.user.id;

    const reservation = await Reservation.findById(id)
      .populate('package')
      .populate('barber');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    if (!['confirmed', 'in-progress'].includes(reservation.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot complete service. Invalid status."
      });
    }

    // Update reservation
    reservation.status = 'completed';
    reservation.completedAt = new Date();
    reservation.completedBy = cashierId;
    reservation.paymentMethod = paymentMethod;
    reservation.serviceNotes = serviceNotes || "";
    await reservation.save();

    // Update schedule
    const schedule = await Schedule.findById(reservation.schedule);
    if (schedule) {
      schedule.status = 'completed';
      schedule.completedAt = new Date();
      await schedule.save();
    }

    res.status(200).json({
      success: true,
      message: "Service completed and payment processed",
      data: {
        reservationId: reservation.reservationId,
        customerName: reservation.customerName,
        package: reservation.package.name,
        totalPrice: reservation.totalPrice,
        paymentMethod: paymentMethod,
        completedAt: reservation.completedAt
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

module.exports = {
  createWalkInReservation,
  completeService
};