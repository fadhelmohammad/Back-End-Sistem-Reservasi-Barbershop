const User = require("../models/User");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

// Get all cashiers
const getAllCashiers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build search query
    let query = { role: 'cashier' };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const cashiers = await User.find(query)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalCashiers = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Cashiers retrieved successfully",
      data: cashiers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCashiers / limit),
        totalItems: totalCashiers,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Error getting all cashiers:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving cashiers",
      error: error.message
    });
  }
};

// Get cashier by ID
const getCashierById = async (req, res) => {
  try {
    const { id } = req.params;

    let cashier;
    if (mongoose.isValidObjectId(id)) {
      cashier = await User.findOne({ _id: id, role: 'cashier' }).select('-password');
    } else {
      cashier = await User.findOne({ userId: id, role: 'cashier' }).select('-password');
    }

    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: "Cashier not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Cashier retrieved successfully",
      data: cashier
    });

  } catch (error) {
    console.error("Error getting cashier by ID:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving cashier",
      error: error.message
    });
  }
};

// Create new cashier
const createCashier = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required"
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create cashier
    const cashier = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'cashier'
      // Note: phone is not required for cashier
    });

    await cashier.save();

    // Remove password from response
    const cashierResponse = cashier.toObject();
    delete cashierResponse.password;

    res.status(201).json({
      success: true,
      message: "Cashier created successfully",
      data: cashierResponse
    });

  } catch (error) {
    console.error("Error creating cashier:", error);
    res.status(500).json({
      success: false,
      message: "Error creating cashier",
      error: error.message
    });
  }
};

// Update cashier
const updateCashier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    // Find cashier
    let cashier;
    if (mongoose.isValidObjectId(id)) {
      cashier = await User.findOne({ _id: id, role: 'cashier' });
    } else {
      cashier = await User.findOne({ userId: id, role: 'cashier' });
    }

    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: "Cashier not found"
      });
    }

    // Check if email is being changed and already exists
    if (email && email.toLowerCase() !== cashier.email) {
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: cashier._id }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already exists"
        });
      }
    }

    // Update fields
    if (name) cashier.name = name.trim();
    if (email) cashier.email = email.toLowerCase().trim();

    await cashier.save();

    // Remove password from response
    const cashierResponse = cashier.toObject();
    delete cashierResponse.password;

    res.status(200).json({
      success: true,
      message: "Cashier updated successfully",
      data: cashierResponse
    });

  } catch (error) {
    console.error("Error updating cashier:", error);
    res.status(500).json({
      success: false,
      message: "Error updating cashier",
      error: error.message
    });
  }
};

// Delete cashier
const deleteCashier = async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete cashier
    let cashier;
    if (mongoose.isValidObjectId(id)) {
      cashier = await User.findOneAndDelete({ _id: id, role: 'cashier' });
    } else {
      cashier = await User.findOneAndDelete({ userId: id, role: 'cashier' });
    }

    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: "Cashier not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Cashier deleted successfully",
      data: {
        deletedCashier: {
          _id: cashier._id,
          userId: cashier.userId,
          name: cashier.name,
          email: cashier.email
        }
      }
    });

  } catch (error) {
    console.error("Error deleting cashier:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting cashier",
      error: error.message
    });
  }
};

// Update cashier password
const updateCashierPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, confirmPassword } = req.body;

    // Validate passwords
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password are required"
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    // Find cashier
    let cashier;
    if (mongoose.isValidObjectId(id)) {
      cashier = await User.findOne({ _id: id, role: 'cashier' });
    } else {
      cashier = await User.findOne({ userId: id, role: 'cashier' });
    }

    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: "Cashier not found"
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    cashier.password = hashedPassword;
    await cashier.save();

    res.status(200).json({
      success: true,
      message: "Cashier password updated successfully",
      data: {
        userId: cashier.userId,
        name: cashier.name,
        email: cashier.email,
        updatedAt: cashier.updatedAt
      }
    });

  } catch (error) {
    console.error("Error updating cashier password:", error);
    res.status(500).json({
      success: false,
      message: "Error updating cashier password",
      error: error.message
    });
  }
};

module.exports = {
  getAllCashiers,
  getCashierById,
  createCashier,
  updateCashier,
  deleteCashier,
  updateCashierPassword
};