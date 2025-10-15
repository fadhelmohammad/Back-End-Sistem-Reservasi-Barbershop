const User = require("../models/User");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

// Get all cashiers
const getAllCashiers = async (req, res) => {
  try {
    const cashiers = await User.find({ role: "cashier" })
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Cashiers retrieved successfully",
      data: cashiers,
      count: cashiers.length
    });
  } catch (error) {
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

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid cashier ID format"
      });
    }

    const cashier = await User.findOne({ _id: id, role: "cashier" })
      .select("-password");

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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address"
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
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
      role: "cashier"
    });

    await cashier.save();

    // Remove password from response
    const cashierResponse = {
      _id: cashier._id,
      userId: cashier.userId,
      name: cashier.name,
      email: cashier.email,
      role: cashier.role,
      createdAt: cashier.createdAt,
      updatedAt: cashier.updatedAt
    };

    res.status(201).json({
      success: true,
      message: "Cashier created successfully",
      data: cashierResponse
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: messages
      });
    }

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
    
    // Debug logging
    console.log('Request body:', req.body);
    console.log('Request body keys:', Object.keys(req.body || {}));
    console.log('Request headers:', req.headers['content-type']);
    
    // Check if req.body exists and has data
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No data provided for update",
        debug: {
          body: req.body,
          bodyKeys: Object.keys(req.body || {}),
          contentType: req.headers['content-type']
        }
      });
    }

    const { name, email, password } = req.body;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid cashier ID format"
      });
    }

    const cashier = await User.findOne({ _id: id, role: "cashier" });
    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: "Cashier not found"
      });
    }

    // Check if email already exists (exclude current cashier)
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address"
        });
      }

      const existingUser = await User.findOne({
        _id: { $ne: id },
        email: email.toLowerCase()
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already exists"
        });
      }
    }

    // Validate password if provided
    if (password && password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    // Update fields only if they are provided
    if (name !== undefined && name !== null) {
      cashier.name = name.trim();
    }
    
    if (email !== undefined && email !== null) {
      cashier.email = email.toLowerCase().trim();
    }
    
    if (password !== undefined && password !== null && password !== '') {
      const salt = await bcrypt.genSalt(10);
      cashier.password = await bcrypt.hash(password, salt);
    }

    await cashier.save();

    // Remove password from response
    const cashierResponse = {
      _id: cashier._id,
      userId: cashier.userId,
      name: cashier.name,
      email: cashier.email,
      role: cashier.role,
      createdAt: cashier.createdAt,
      updatedAt: cashier.updatedAt
    };

    res.status(200).json({
      success: true,
      message: "Cashier updated successfully",
      data: cashierResponse
    });
  } catch (error) {
    console.error('Update cashier error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: messages
      });
    }

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

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid cashier ID format"
      });
    }

    const cashier = await User.findOne({ _id: id, role: "cashier" });
    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: "Cashier not found"
      });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Cashier deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting cashier",
      error: error.message
    });
  }
};

module.exports = {
  getAllCashiers,
  getCashierById,
  createCashier,
  updateCashier,
  deleteCashier
};