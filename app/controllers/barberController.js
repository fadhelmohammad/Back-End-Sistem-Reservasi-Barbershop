const Barber = require("../models/Barber");

// Get all barbers
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

// Get barber by ID
const getBarberById = async (req, res) => {
  try {
    const barber = await Barber.findById(req.params.id);

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

// Create new barber
const createBarber = async (req, res) => {
  try {
    const { name, photo } = req.body;

    // Validate required fields
    if (!name || !photo) {
      return res.status(400).json({
        success: false,
        message: "Name and photo are required"
      });
    }

    // Check if barber with same name already exists
    const existingBarber = await Barber.findOne({ 
      name: new RegExp(`^${name}$`, 'i') 
    });

    if (existingBarber) {
      return res.status(400).json({
        success: false,
        message: "Barber with this name already exists"
      });
    }

    // Create barber
    const barber = new Barber({
      name: name.trim(),
      photo: photo.trim()
    });

    await barber.save();

    res.status(201).json({
      success: true,
      message: "Barber created successfully",
      data: barber
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
      message: "Error creating barber",
      error: error.message
    });
  }
};

// Update barber
const updateBarber = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, photo, isActive } = req.body;

    const barber = await Barber.findById(id);
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    // Check if name already exists (exclude current barber)
    if (name) {
      const existingBarber = await Barber.findOne({
        _id: { $ne: id },
        name: new RegExp(`^${name}$`, 'i')
      });

      if (existingBarber) {
        return res.status(400).json({
          success: false,
          message: "Barber with this name already exists"
        });
      }
    }

    // Update fields
    if (name) barber.name = name.trim();
    if (photo) barber.photo = photo.trim();
    if (typeof isActive === 'boolean') barber.isActive = isActive;

    await barber.save();

    res.status(200).json({
      success: true,
      message: "Barber updated successfully",
      data: barber
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
      message: "Error updating barber",
      error: error.message
    });
  }
};

// Delete barber
const deleteBarber = async (req, res) => {
  try {
    const { id } = req.params;

    const barber = await Barber.findById(id);
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
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

// Get active barbers only
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

module.exports = {
  getAllBarbers,
  getBarberById,
  createBarber,
  updateBarber,
  deleteBarber,
  getActiveBarbers
};
