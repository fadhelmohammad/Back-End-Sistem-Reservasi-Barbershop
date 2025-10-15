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

    // Validate phone format
    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid Indonesian mobile number"
      });
    }

    // Normalize phone number
    let normalizedPhone = phone;
    if (phone.startsWith('+62')) {
      normalizedPhone = '0' + phone.slice(3);
    } else if (phone.startsWith('62')) {
      normalizedPhone = '0' + phone.slice(2);
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

module.exports = {
  getRegisteredData,
  validateCustomerData
};