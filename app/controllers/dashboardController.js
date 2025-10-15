const User = require("../models/User");
const Package = require("../models/Package");
const Barber = require("../models/Barber");
const Reservation = require("../models/Reservation");

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalCapster,
      totalLayanan,
      totalCustomer,
      totalReservasi
    ] = await Promise.all([
      Barber.countDocuments({ isActive: true }),
      Package.countDocuments({ isActive: true }),
      User.countDocuments({ role: "customer" }),
      Reservation.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      message: "Dashboard statistics retrieved successfully",
      data: {
        totalCapster,
        totalLayanan,
        totalCustomer,
        totalReservasi
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving dashboard statistics",
      error: error.message
    });
  }
};

module.exports = {
  getDashboardStats
};