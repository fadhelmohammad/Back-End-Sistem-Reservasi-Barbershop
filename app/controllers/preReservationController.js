const User = require("../models/User");

// Get registered data for auto-fill
const getRegisteredData = async (req, res) => {
  try {
    const customerId = req.user.userId;
    
    const user = await User.findById(customerId).select('name phone');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Registered data retrieved successfully",
      data: {
        name: user.name,
        phone: user.phone
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving registered data",
      error: error.message
    });
  }
};

// Validate customer data before showing packages
const validateCustomerData = async (req, res) => {
  try {
    const { name, phone } = req.body;

    // Validate required fields
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone number are required"
      });
    }

    // ✅ Updated phone validation - max 16 digits
    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,14}$/; // Max 16 digits total
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid Indonesian mobile number (8-16 digits)"
      });
    }

    // Check total length after normalization
    let normalizedPhone = phone;
    if (phone.startsWith('+62')) {
      normalizedPhone = '0' + phone.slice(3);
    } else if (phone.startsWith('62')) {
      normalizedPhone = '0' + phone.slice(2);
    }

    // ✅ Check max length
    if (normalizedPhone.length > 16) {
      return res.status(400).json({
        success: false,
        message: "Phone number cannot exceed 16 digits"
      });
    }

    // Store data in session/temporary storage for this customer
    res.status(200).json({
      success: true,
      message: "Customer data validated successfully",
      data: {
        name: name.trim(),
        phone: normalizedPhone,
        canProceed: true
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error validating customer data",
      error: error.message
    });
  }
};

// Submit customer data manually
const submitCustomerData = async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    // Validate required fields
    if (!name || !phone || !email) {
      return res.status(400).json({
        success: false,
        message: "Name, phone, and email are required"
      });
    }

    // Validate name (minimum 2 characters, only letters and spaces)
    const nameRegex = /^[a-zA-Z\s]{2,50}$/;
    if (!nameRegex.test(name.trim())) {
      return res.status(400).json({
        success: false,
        message: "Name must be 2-50 characters and contain only letters and spaces"
      });
    }

    // ✅ Updated phone validation - max 16 digits
    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,14}$/; // Max 16 digits total
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format. Use Indonesian phone number format (8-16 digits)"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // Normalize phone number
    let normalizedPhone = phone;
    if (phone.startsWith('+62')) {
      normalizedPhone = '0' + phone.substring(3);
    } else if (phone.startsWith('62')) {
      normalizedPhone = '0' + phone.substring(2);
    }

    // ✅ Check max length after normalization
    if (normalizedPhone.length > 16) {
      return res.status(400).json({
        success: false,
        message: "Phone number cannot exceed 16 digits"
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Get current user info
    const userIdentifier = req.user.userId || req.user.id;
    let currentUser;
    if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
      currentUser = await User.findOne({ userId: userIdentifier }).select('_id userId name');
    } else {
      currentUser = await User.findById(userIdentifier).select('_id userId name');
    }

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Success response - data ready for reservation
    res.status(200).json({
      success: true,
      message: "Customer data submitted successfully. You can now proceed to select packages.",
      data: {
        customerData: {
          name: name.trim(),
          phone: normalizedPhone,
          email: normalizedEmail
        },
        submittedBy: {
          userId: currentUser.userId || currentUser._id,
          name: currentUser.name
        },
        nextStep: "Select package from available packages"
      }
    });

  } catch (error) {
    console.error("Submit customer data error:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting customer data",
      error: error.message
    });
  }
};

module.exports = {
  getRegisteredData,
  validateCustomerData,
  submitCustomerData
};