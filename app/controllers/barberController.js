const Barber = require("../models/Barber");
const cloudinary = require('../config/cloudinary');

// Helper function to upload to Cloudinary with better error handling
const uploadToCloudinary = (fileBuffer, folder = 'barbers') => {
  return new Promise((resolve, reject) => {
    // Validate buffer
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      reject(new Error('Invalid file buffer'));
      return;
    }

    cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'image',
        transformation: [
          { width: 500, height: 500, crop: 'fill' },
          { quality: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    ).end(fileBuffer);
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

// Create new barber
const createBarber = async (req, res) => {
  try {
    let { name, phone } = req.body;
    
    // Debug logs
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
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
    if (!req.file || !req.file.buffer) {
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
    console.log('Uploading to Cloudinary...');
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'barbers');
    console.log('Cloudinary upload result:', uploadResult.secure_url);

    // Create barber
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

// Update barber
const updateBarber = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, isActive } = req.body;
    
    console.log('Update request body:', req.body);
    console.log('Update request file:', req.file);
    
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
    if (req.file && req.file.buffer) {
      try {
        console.log('Uploading new photo to Cloudinary...');
        const uploadResult = await uploadToCloudinary(req.file.buffer, 'barbers');
        updateData.photo = uploadResult.secure_url;
        console.log('New photo uploaded:', uploadResult.secure_url);

        // Delete old image from Cloudinary if exists
        const oldPhotoUrl = existingBarber.photo;
        if (oldPhotoUrl && oldPhotoUrl.includes('cloudinary.com')) {
          try {
            const urlParts = oldPhotoUrl.split('/');
            const fileWithExtension = urlParts[urlParts.length - 1];
            const folderPath = urlParts.slice(-2, -1)[0];
            const publicId = `${folderPath}/${fileWithExtension.split('.')[0]}`;
            
            await cloudinary.uploader.destroy(publicId);
            console.log('Old photo deleted from Cloudinary');
          } catch (deleteError) {
            console.error('Error deleting old photo:', deleteError);
          }
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

// Toggle barber status
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

// Delete barber
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
        console.log('Photo deleted from Cloudinary');
      } catch (deleteError) {
        console.error('Error deleting photo from Cloudinary:', deleteError);
      }
    }

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

// Get active barbers
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

// Get inactive barbers
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
