const Barber = require("../models/Barber");
const User = require("../models/User");
const Reservation = require("../models/Reservation");
const mongoose = require("mongoose");

const getDashboardStats = async (req, res) => {
  try {
    // Fallback counts jika ada model yang error
    let totalCapster = 0;
    let totalLayanan = 0;
    let totalCustomer = 0;
    let totalAdmin = 0;
    let totalCashier = 0;
    let totalReservasi = 0;

    // Count Barbers
    try {
      totalCapster = await Barber.countDocuments({ isActive: true });
    } catch (error) {
      console.error('Error counting barbers:', error.message);
    }

    // Count Packages dengan multiple fallback methods
    try {
      // Method 1: Try importing model fresh
      delete mongoose.models.Package;
      delete mongoose.modelSchemas.Package;
      
      const Package = require("../models/Package");
      
      if (Package && typeof Package.countDocuments === 'function') {
        totalLayanan = await Package.countDocuments({ isActive: true });
        console.log('✅ Package count via model:', totalLayanan);
      } else {
        throw new Error('Package model countDocuments not available');
      }
      
    } catch (error) {
      console.error('❌ Package model error:', error.message);
      
      // Method 2: Direct database query fallback
      try {
        const db = mongoose.connection.db;
        if (db) {
          totalLayanan = await db.collection('packages').countDocuments({ isActive: true });
          console.log('✅ Package count via direct query:', totalLayanan);
        }
      } catch (dbError) {
        console.error('❌ Direct DB query error:', dbError.message);
        totalLayanan = 0;
      }
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

    // Count Cashiers
    try {
      totalCashier = await User.countDocuments({ role: "cashier" });
      console.log('✅ Cashier count:', totalCashier);
    } catch (error) {
      console.error('Error counting cashiers:', error.message);
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
        totalCashier,
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

// Get detailed statistics (optional - untuk dashboard yang lebih detail)
const getDetailedStats = async (req, res) => {
  try {
    // User statistics by role
    const userStats = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 }
        }
      }
    ]);

    // Active vs Inactive barbers
    const barberStats = await Barber.aggregate([
      {
        $group: {
          _id: "$isActive",
          count: { $sum: 1 }
        }
      }
    ]);

    // Package statistics
    let packageStats = [];
    try {
      const Package = require("../models/Package");
      packageStats = await Package.aggregate([
        {
          $group: {
            _id: "$isActive",
            count: { $sum: 1 },
            totalPrice: { $sum: "$price" },
            avgPrice: { $avg: "$price" }
          }
        }
      ]);
    } catch (error) {
      console.error('Error getting package stats:', error.message);
    }

    // Reservation statistics by status
    const reservationStats = await Reservation.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentReservations = await Reservation.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    const recentUsers = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    res.status(200).json({
      success: true,
      message: "Detailed dashboard statistics retrieved successfully",
      data: {
        userStats,
        barberStats,
        packageStats,
        reservationStats,
        recentActivity: {
          newReservations: recentReservations,
          newUsers: recentUsers
        }
      }
    });
  } catch (error) {
    console.error("Detailed stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving detailed statistics",
      error: error.message
    });
  }
};

module.exports = {
  getDashboardStats,
  getDetailedStats
};