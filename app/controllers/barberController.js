const Barber = require("../models/Barber");
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

// Helper function to upload to Cloudinary
const uploadToCloudinary = (fileBuffer, folder = 'barbers') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        transformation: [
          { width: 500, height: 500, crop: 'fill' },
          { quality: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

// Get all barbers
const getAllBarbers = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const barbers = await Barber.find(filter).sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      message: "Barbers retrieved successfully",
      data: barbers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching barbers",
      error: error.message
    });
  }
};

// Get barber by ID
const getBarberById = async (req, res) => {
  try {
    const { id } = req.params;
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
      message: "Error fetching barber",
      error: error.message
    });
  }
};

// Create new barber with manual photo upload
const createBarber = async (req, res) => {
  try {
    let { name, phone } = req.body;
    
    // Normalize input
    name = name?.trim();
    phone = phone?.trim();
    
    // Validate required fields
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone are required"
      });
    }

    // Check if photo is uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Photo is required"
      });
    }
    
    // Check if phone already exists
    const existingBarber = await Barber.findOne({ phone });
    
    if (existingBarber) {
      return res.status(400).json({
        success: false,
        message: "Phone number already registered"
      });
    }

    // Upload image to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'barbers');

    // Create barber with Cloudinary photo URL
    const barber = new Barber({
      name,
      phone,
      photo: uploadResult.secure_url
    });

    await barber.save();

    res.status(201).json({
      success: true,
      message: "Barber created successfully",
      data: barber
    });
  } catch (error) {
    console.error('Create barber error:', error);
    
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

// Update barber with optional photo upload
const updateBarber = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, isActive } = req.body;
    
    // Check if barber exists
    const existingBarber = await Barber.findById(id);
    
    if (!existingBarber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }
    
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (phone) updateData.phone = phone.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // If new photo is uploaded
    if (req.file) {
      try {
        // Upload new image to Cloudinary
        const uploadResult = await uploadToCloudinary(req.file.buffer, 'barbers');
        updateData.photo = uploadResult.secure_url;

        // Delete old image from Cloudinary if exists
        const oldPhotoUrl = existingBarber.photo;
        if (oldPhotoUrl && oldPhotoUrl.includes('cloudinary.com')) {
          const urlParts = oldPhotoUrl.split('/');
          const fileWithExtension = urlParts[urlParts.length - 1];
          const folderPath = urlParts.slice(-2, -1)[0];
          const publicId = `${folderPath}/${fileWithExtension.split('.')[0]}`;
          
          await cloudinary.uploader.destroy(publicId);
        }
      } catch (uploadError) {
        console.error('Photo upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: "Error uploading photo",
          error: uploadError.message
        });
      }
    }
    
    // Check if phone already exists (exclude current barber)
    if (phone) {
      const existingPhone = await Barber.findOne({
        _id: { $ne: id },
        phone: phone
      });
      
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "Phone number already exists"
        });
      }
    }

    const barber = await Barber.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Barber updated successfully",
      data: barber
    });
  } catch (error) {
    console.error('Update barber error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: messages
      });
    }
    
    res.status(400).json({
      success: false,
      message: "Error updating barber",
      error: error.message
    });
  }
};

// Activate barber
const activateBarber = async (req, res) => {
  try {
    const { id } = req.params;
    
    const barber = await Barber.findById(id);
    
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    if (barber.isActive) {
      return res.status(400).json({
        success: false,
        message: "Barber is already active"
      });
    }

    barber.isActive = true;
    await barber.save();
    
    res.status(200).json({
      success: true,
      message: "Barber activated successfully",
      data: barber
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error activating barber",
      error: error.message
    });
  }
};

// Deactivate barber
const deactivateBarber = async (req, res) => {
  try {
    const { id } = req.params;
    
    const barber = await Barber.findById(id);
    
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    if (!barber.isActive) {
      return res.status(400).json({
        success: false,
        message: "Barber is already inactive"
      });
    }

    barber.isActive = false;
    await barber.save();
    
    res.status(200).json({
      success: true,
      message: "Barber deactivated successfully",
      data: barber
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deactivating barber",
      error: error.message
    });
  }
};

// Toggle barber status (activate/deactivate)
const toggleBarberStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const barber = await Barber.findById(id);
    
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    // Toggle status
    barber.isActive = !barber.isActive;
    await barber.save();
    
    const statusMessage = barber.isActive ? "activated" : "deactivated";
    
    res.status(200).json({
      success: true,
      message: `Barber ${statusMessage} successfully`,
      data: barber
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error toggling barber status",
      error: error.message
    });
  }
};

// Delete barber (permanent delete)
const deleteBarber = async (req, res) => {
  try {
    const { id } = req.params;
    const { deletePhoto } = req.query;
    
    const barber = await Barber.findById(id);
    
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    // Delete from Cloudinary if requested
    if (deletePhoto === 'true' && barber.photo && barber.photo.includes('cloudinary.com')) {
      try {
        const urlParts = barber.photo.split('/');
        const fileWithExtension = urlParts[urlParts.length - 1];
        const folderPath = urlParts.slice(-2, -1)[0];
        const publicId = `${folderPath}/${fileWithExtension.split('.')[0]}`;
        
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteError) {
        console.error('Error deleting photo from Cloudinary:', deleteError);
      }
    }

    // Permanent delete
    await Barber.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: "Barber deleted permanently",
      data: {
        _id: barber._id,
        name: barber.name,
        phone: barber.phone
      }
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
    const barbers = await Barber.find({ isActive: true }).sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      message: "Active barbers retrieved successfully",
      data: barbers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching active barbers",
      error: error.message
    });
  }
};

// Get inactive barbers only
const getInactiveBarbers = async (req, res) => {
  try {
    const barbers = await Barber.find({ isActive: false }).sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      message: "Inactive barbers retrieved successfully",
      data: barbers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching inactive barbers",
      error: error.message
    });
  }
};

module.exports = {
  getAllBarbers,
  getBarberById,
  createBarber,
  updateBarber,
  activateBarber,
  deactivateBarber,
  toggleBarberStatus,
  deleteBarber,
  getActiveBarbers,
  getInactiveBarbers
};
