const Barber = require("../models/Barber");
const User = require("../models/User");
const Reservation = require("../models/Reservation");

const getDashboardStats = async (req, res) => {
  try {
    // Fallback counts jika ada model yang error
    let totalCapster = 0;
    let totalLayanan = 0;
    let totalCustomer = 0;
    let totalAdmin = 0;
    let totalReservasi = 0;

    // Count Barbers
    try {
      totalCapster = await Barber.countDocuments({ isActive: true });
    } catch (error) {
      console.error('Error counting barbers:', error.message);
    }

    // Count Packages dengan import yang lebih robust
    try {
      const Package = require("../models/Package");
      console.log('Package model loaded:', !!Package); // Debug log
      
      if (Package && typeof Package.countDocuments === 'function') {
        totalLayanan = await Package.countDocuments({ isActive: true });
        console.log('Total packages found:', totalLayanan); // Debug log
      } else {
        console.error('Package model is not properly loaded');
      }
    } catch (error) {
      console.error('Package model error:', error.message);
      console.error('Package model stack:', error.stack);
      totalLayanan = 0;
    }

    // Count Users (Customers)
    try {
      totalCustomer = await User.countDocuments({ role: "customer" });
    } catch (error) {
      console.error('Error counting customers:', error.message);
    }

    // Count Admins
    try {
      totalAdmin = await User.countDocuments({ role: "admin" });
    } catch (error) {
      console.error('Error counting admins:', error.message);
    }

    // Count Reservations
    try {
      totalReservasi = await Reservation.countDocuments();
    } catch (error) {
      console.error('Error counting reservations:', error.message);
    }

    res.status(200).json({
      success: true,
      message: "Dashboard statistics retrieved successfully",
      data: {
        totalCapster,
        totalLayanan,
        totalCustomer,
        totalAdmin,
        totalReservasi
      }
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
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