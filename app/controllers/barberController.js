const Barber = require("../models/Barber");

// Create barber
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

    // Check if barber already exists
    const existingBarber = await Barber.findOne({ email });
    if (existingBarber) {
      return res.status(400).json({
        success: false,
        message: "Barber with this email already exists"
      });
    }

    const barber = new Barber({ 
      name, 
      email, 
      phone
    });
    
    const savedBarber = await barber.save();
    
    res.status(201).json({
      success: true,
      message: "Barber created successfully",
      data: savedBarber
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Failed to create barber",
      error: error.message 
    });
  }
};

// Get all barbers
const getAllBarbers = async (req, res) => {
  try {
    const barbers = await Barber.find({ isActive: true });
    res.json({
      success: true,
      data: barbers
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch barbers",
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

    res.json({
      success: true,
      data: barber
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch barber",
      error: error.message 
    });
  }
};

// Update barber
const updateBarber = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    const barber = await Barber.findByIdAndUpdate(
      req.params.id,
      { name, email, phone },
      { new: true, runValidators: true }
    );
    
    if (!barber) {
      return res.status(404).json({ 
        success: false,
        message: "Barber not found" 
      });
    }
    
    res.json({
      success: true,
      message: "Barber updated successfully",
      data: barber
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Failed to update barber",
      error: error.message 
    });
  }
};

// Delete barber
const deleteBarber = async (req, res) => {
  try {
    const barber = await Barber.findByIdAndDelete(req.params.id);
    
    if (!barber) {
      return res.status(404).json({ 
        success: false,
        message: "Barber not found" 
      });
    }
    
    res.json({ 
      success: true,
      message: "Barber deleted successfully" 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Failed to delete barber",
      error: error.message 
    });
  }
};

module.exports = {
  createBarber,
  getAllBarbers,
  getBarberById,
  updateBarber,
  deleteBarber
};
