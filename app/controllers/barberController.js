const Barber = require("../models/Barber");
const mongoose = require("mongoose");
const { cloudinary } = require("../config/cloudinary");

// Get all barbers (Admin only)
const getAllBarbers = async (req, res) => {
  try {
    const barbers = await Barber.find()
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Barbers retrieved successfully",
      data: barbers,
      count: barbers.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving barbers",
      error: error.message
    });
  }
};

// Get active barbers only (Public)
const getActiveBarbers = async (req, res) => {
  try {
    const barbers = await Barber.find({ isActive: true })
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      message: "Active barbers retrieved successfully",
      data: barbers,
      count: barbers.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving active barbers",
      error: error.message
    });
  }
};

// Get barber by ID
const getBarberById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid barber ID format"
      });
    }

    const barber = await Barber.findById(id);

    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Barber retrieved successfully",
      data: barber
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving barber",
      error: error.message
    });
  }
};

// Create barber with photo (simplified)
const createBarber = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and phone are required"
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

    // Check if email already exists
    const existingEmail = await Barber.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    // Check if phone already exists
    const existingPhone = await Barber.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: "Phone number already exists"
      });
    }

    // Prepare barber data
    const barberData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim()
    };

    // Add photo if uploaded
    if (req.file) {
      barberData.photo = {
        url: req.file.path,
        publicId: req.file.filename
      };
    }

    // Create barber
    const barber = new Barber(barberData);
    await barber.save();

    res.status(201).json({
      success: true,
      message: "Barber created successfully",
      data: barber
    });
  } catch (error) {
    // Delete uploaded file if error occurs
    if (req.file && req.file.filename) {
      try {
        await cloudinary.uploader.destroy(req.file.filename);
      } catch (deleteError) {
        console.error('Error deleting uploaded file:', deleteError);
      }
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      });
    }

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
      message: "Error creating barber",
      error: error.message
    });
  }
};

// Update barber (simplified)
const updateBarber = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid barber ID format"
      });
    }

    const barber = await Barber.findById(id);
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address"
        });
      }

      // Check if email already exists (exclude current barber)
      const existingEmail = await Barber.findOne({
        _id: { $ne: id },
        email: email.toLowerCase()
      });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already exists"
        });
      }
    }

    // Check if phone already exists (exclude current barber)
    if (phone) {
      const existingPhone = await Barber.findOne({
        _id: { $ne: id },
        phone
      });

      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "Phone number already exists"
        });
      }
    }

    // Update fields
    if (name) barber.name = name.trim();
    if (email) barber.email = email.toLowerCase().trim();
    if (phone) barber.phone = phone.trim();
    if (typeof isActive === 'boolean') barber.isActive = isActive;

    // Handle photo update
    if (req.file) {
      // Delete old photo from Cloudinary if exists
      if (barber.photo && barber.photo.publicId) {
        try {
          await cloudinary.uploader.destroy(barber.photo.publicId);
        } catch (deleteError) {
          console.error('Error deleting old photo:', deleteError);
        }
      }

      // Set new photo
      barber.photo = {
        url: req.file.path,
        publicId: req.file.filename
      };
    }

    await barber.save();

    res.status(200).json({
      success: true,
      message: "Barber updated successfully",
      data: barber
    });
  } catch (error) {
    if (req.file && req.file.filename) {
      try {
        await cloudinary.uploader.destroy(req.file.filename);
      } catch (deleteError) {
        console.error('Error deleting uploaded file:', deleteError);
      }
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      });
    }

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
      message: "Error updating barber",
      error: error.message
    });
  }
};

// Delete barber
const deleteBarber = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid barber ID format"
      });
    }

    const barber = await Barber.findById(id);
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    // Delete photo from Cloudinary if exists
    if (barber.photo && barber.photo.publicId) {
      try {
        await cloudinary.uploader.destroy(barber.photo.publicId);
      } catch (deleteError) {
        console.error('Error deleting photo from Cloudinary:', deleteError);
      }
    }

    await Barber.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Barber deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting barber",
      error: error.message
    });
  }
};

module.exports = {
  getAllBarbers,
  getActiveBarbers,
  getBarberById,
  createBarber,
  updateBarber,
  deleteBarber
};
