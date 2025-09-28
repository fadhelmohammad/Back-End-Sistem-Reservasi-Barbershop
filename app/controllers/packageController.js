const Package = require("../models/Package");

// Create package
const createPackage = async (req, res) => {
  try {
    const { name, price, description } = req.body;

    // Validate required fields
    if (!name || !price || !description) {
      return res.status(400).json({
        success: false,
        message: "Name, price, and description are required"
      });
    }

    // Check if package with same name exists
    const existingPackage = await Package.findOne({ name });
    if (existingPackage) {
      return res.status(400).json({
        success: false,
        message: "Package with this name already exists"
      });
    }

    const newPackage = new Package({
      name,
      price,
      description
    });

    const savedPackage = await newPackage.save();

    res.status(201).json({
      success: true,
      message: "Package created successfully",
      data: savedPackage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating package",
      error: error.message
    });
  }
};

// Get all packages
const getAllPackages = async (req, res) => {
  try {
    const packages = await Package.find({ isActive: true })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Packages retrieved successfully",
      data: packages,
      count: packages.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving packages",
      error: error.message
    });
  }
};

// Get package by ID
const getPackageById = async (req, res) => {
  try {
    const package = await Package.findById(req.params.id);

    if (!package) {
      return res.status(404).json({
        success: false,
        message: "Package not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Package retrieved successfully",
      data: package
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving package",
      error: error.message
    });
  }
};

// Update package
const updatePackage = async (req, res) => {
  try {
    const { name, price, description, isActive } = req.body;

    const updatedPackage = await Package.findByIdAndUpdate(
      req.params.id,
      { name, price, description, isActive },
      { new: true, runValidators: true }
    );

    if (!updatedPackage) {
      return res.status(404).json({
        success: false,
        message: "Package not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Package updated successfully",
      data: updatedPackage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating package",
      error: error.message
    });
  }
};

// Delete package (soft delete)
const deletePackage = async (req, res) => {
  try {
    const deletedPackage = await Package.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!deletedPackage) {
      return res.status(404).json({
        success: false,
        message: "Package not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Package deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting package",
      error: error.message
    });
  }
};

// Permanently delete package
const permanentDeletePackage = async (req, res) => {
  try {
    const deletedPackage = await Package.findByIdAndDelete(req.params.id);

    if (!deletedPackage) {
      return res.status(404).json({
        success: false,
        message: "Package not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Package permanently deleted"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting package permanently",
      error: error.message
    });
  }
};

module.exports = {
  createPackage,
  getAllPackages,
  getPackageById,
  updatePackage,
  deletePackage,
  permanentDeletePackage
};