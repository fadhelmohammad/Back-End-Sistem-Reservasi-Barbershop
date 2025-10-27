const Package = require("../models/Package");
const mongoose = require("mongoose");

// Get all packages (Admin only)
const getAllPackages = async (req, res) => {
  try {
    const packages = await Package.find()
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
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID format"
      });
    }

    const package = await Package.findById(id);

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

// Create new package dengan retry mechanism
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

    // Validate price
    if (price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be greater than 0"
      });
    }

    // Check if package with same name already exists
    const existingPackage = await Package.findOne({ 
      name: new RegExp(`^${name}$`, 'i') 
    });

    if (existingPackage) {
      return res.status(400).json({
        success: false,
        message: "Package with this name already exists"
      });
    }

    // Create package dengan retry untuk duplikasi packageId
    let package;
    let maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        package = new Package({
          name: name.trim(),
          price,
          description: description.trim()
        });

        await package.save();
        break; // Berhasil, keluar dari loop
        
      } catch (error) {
        if (error.code === 11000 && error.keyPattern?.packageId) {
          // Duplikasi packageId, coba lagi
          attempt++;
          if (attempt >= maxRetries) {
            return res.status(500).json({
              success: false,
              message: "Unable to generate unique package ID. Please try again.",
              error: "Package ID generation failed"
            });
          }
          continue;
        } else {
          // Error lain, throw
          throw error;
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Package created successfully",
      data: package
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

    if (error.code === 11000) {
      let field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Duplicate ${field}. This ${field} already exists.`
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating package",
      error: error.message
    });
  }
};

// Update package
const updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description, isActive } = req.body;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID format"
      });
    }

    const package = await Package.findById(id);
    if (!package) {
      return res.status(404).json({
        success: false,
        message: "Package not found"
      });
    }

    // Check if name already exists (exclude current package)
    if (name) {
      const existingPackage = await Package.findOne({
        _id: { $ne: id },
        name: new RegExp(`^${name}$`, 'i')
      });

      if (existingPackage) {
        return res.status(400).json({
          success: false,
          message: "Package with this name already exists"
        });
      }
    }

    // Validate price if provided
    if (price !== undefined && price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be greater than 0"
      });
    }

    // Update fields
    if (name) package.name = name.trim();
    if (price) package.price = price;
    if (description) package.description = description.trim();
    if (typeof isActive === 'boolean') package.isActive = isActive;

    await package.save();

    res.status(200).json({
      success: true,
      message: "Package updated successfully",
      data: package
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
      message: "Error updating package",
      error: error.message
    });
  }
};

// Delete package
const deletePackage = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package ID format"
      });
    }

    const package = await Package.findById(id);
    if (!package) {
      return res.status(404).json({
        success: false,
        message: "Package not found"
      });
    }

    await Package.findByIdAndDelete(id);

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

// Get active packages only (Public)
const getActivePackages = async (req, res) => {
  try {
    const packages = await Package.find({ isActive: true })
      .sort({ price: 1 });

    res.status(200).json({
      success: true,
      message: "Active packages retrieved successfully",
      data: packages,
      count: packages.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving active packages",
      error: error.message
    });
  }
};

module.exports = {
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  getActivePackages
};