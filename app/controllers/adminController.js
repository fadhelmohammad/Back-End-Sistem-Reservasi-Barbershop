const User = require("../models/User");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

// Get all admins (Admin only)
const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: "admin" })
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Admins retrieved successfully",
      data: admins,
      count: admins.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving admins",
      error: error.message
    });
  }
};

// Get admin by ID
const getAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin ID format"
      });
    }

    const admin = await User.findOne({ _id: id, role: "admin" })
      .select("-password");

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Admin retrieved successfully",
      data: admin
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving admin",
      error: error.message
    });
  }
};

// Create new admin (Only admin can create admin)
const createAdmin = async (req, res) => {
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
        message: "Email already exists"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin
    const admin = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: "admin"
    });

    await admin.save();

    // Remove password from response
    const adminResponse = {
      _id: admin._id,
      userId: admin.userId,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt
    };

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: adminResponse
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
      message: "Error creating admin",
      error: error.message
    });
  }
};

// Update admin
const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin ID format"
      });
    }

    const admin = await User.findOne({ _id: id, role: "admin" });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found"
      });
    }

    // Prevent admin from updating themselves (optional security)
    if (admin._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot update your own admin account"
      });
    }

    // Check if email already exists (exclude current admin)
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

    // Update fields
    if (name) admin.name = name.trim();
    if (email) admin.email = email.toLowerCase().trim();
    if (password) {
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(password, salt);
    }

    await admin.save();

    // Remove password from response
    const adminResponse = {
      _id: admin._id,
      userId: admin.userId,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt
    };

    res.status(200).json({
      success: true,
      message: "Admin updated successfully",
      data: adminResponse
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
      message: "Error updating admin",
      error: error.message
    });
  }
};

// Delete admin
const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin ID format"
      });
    }

    const admin = await User.findOne({ _id: id, role: "admin" });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found"
      });
    }

    // Prevent admin from deleting themselves
    if (admin._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own admin account"
      });
    }

    // Check if this is the last admin
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete the last admin account"
      });
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Admin deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting admin",
      error: error.message
    });
  }
};

// Get admin profile (self)
const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.userId || req.user.id;
    
    let admin;
    
    // Handle different ID formats
    if (typeof adminId === 'string' && adminId.startsWith('USR-')) {
      // Find by userId string
      admin = await User.findOne({ 
        userId: adminId, 
        role: "admin" 
      }).select("-password");
    } else {
      // Find by MongoDB _id
      admin = await User.findOne({ 
        _id: adminId, 
        role: "admin" 
      }).select("-password");
    }

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin profile not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Admin profile retrieved successfully",
      data: {
        _id: admin._id,
        userId: admin.userId,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
        profileType: "admin"
      }
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving admin profile",
      error: error.message
    });
  }
};

// Update admin profile (self)
const updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.userId || req.user.id;
    const { name, email, currentPassword, newPassword } = req.body;

    let admin;
    
    // Find admin
    if (typeof adminId === 'string' && adminId.startsWith('USR-')) {
      admin = await User.findOne({ userId: adminId, role: "admin" });
    } else {
      admin = await User.findOne({ _id: adminId, role: "admin" });
    }

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found"
      });
    }

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address"
        });
      }

      // Check if email already exists for other users
      const existingUser = await User.findOne({
        _id: { $ne: admin._id },
        email: email.toLowerCase()
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already exists"
        });
      }
    }

    // Handle password update
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to set new password"
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect"
        });
      }

      // Validate new password
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 6 characters long"
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(newPassword, salt);
    }

    // Update other fields
    if (name) admin.name = name.trim();
    if (email) admin.email = email.toLowerCase().trim();

    await admin.save();

    res.status(200).json({
      success: true,
      message: "Admin profile updated successfully",
      data: {
        _id: admin._id,
        userId: admin.userId,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        updatedAt: admin.updatedAt
      }
    });

  } catch (error) {
    console.error('Update admin profile error:', error);
    res.status(500).json({
      success: false,
      message: "Error updating admin profile",
      error: error.message
    });
  }
};

module.exports = {
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getAdminProfile,
  updateAdminProfile
};