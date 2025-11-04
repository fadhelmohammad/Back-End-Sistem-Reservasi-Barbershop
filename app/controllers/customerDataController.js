const User = require("../models/User");

// Get registered data for auto-fill (booking untuk diri sendiri)
const getRegisteredData = async (req, res) => {
  try {
    const userIdentifier = req.user.userId || req.user.id;
    
    let user;
    
    if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
      user = await User.findOne({ userId: userIdentifier }).select('name phone email userId');
    } else {
      user = await User.findById(userIdentifier).select('name phone email userId');
    }
    
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
        phone: user.phone,
        email: user.email,
        userId: user.userId || user._id,
        isOwnProfile: true
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

// Get booking options (diri sendiri atau orang lain)
const getBookingOptions = async (req, res) => {
  try {
    // Check what field contains the user identifier
    const userIdentifier = req.user.userId || req.user.id;
    
    console.log("User identifier from token:", userIdentifier); // Debug log
    
    let user;
    
    // Try to find by userId field first (if it's a custom string ID)
    if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
      user = await User.findOne({ userId: userIdentifier }).select('name phone email userId');
    } else {
      // Try to find by MongoDB _id
      user = await User.findById(userIdentifier).select('name phone email userId');
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking options retrieved successfully",
      data: {
        bookingOptions: [
          {
            type: "self",
            label: "Booking untuk diri sendiri",
            description: "Gunakan data profil yang sudah terdaftar",
            profileData: {
              name: user.name,
              phone: user.phone,
              email: user.email,
              userId: user.userId || user._id
            }
          },
          {
            type: "other", 
            label: "Booking untuk orang lain",
            description: "Isi data customer secara manual",
            profileData: null
          }
        ]
      }
    });
  } catch (error) {
    console.error("Error in getBookingOptions:", error); // Debug log
    res.status(500).json({
      success: false,
      message: "Error retrieving booking options",
      error: error.message
    });
  }
};

// Validate customer data (untuk manual input atau update profile)
const validateCustomerData = async (req, res) => {
  try {
    const { name, phone, email, bookingType = "other" } = req.body;

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

    // Validate email format if provided
    if (email && email.trim() !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address"
        });
      }
    }

    // Normalize phone number
    let normalizedPhone = phone;
    if (phone.startsWith('+62')) {
      normalizedPhone = '0' + phone.slice(3);
    } else if (phone.startsWith('62')) {
      normalizedPhone = '0' + phone.slice(2);
    }

    const validatedData = {
      name: name.trim(),
      phone: normalizedPhone,
      email: email ? email.toLowerCase().trim() : "",
      bookingType: bookingType,
      isOwnProfile: bookingType === "self",
      canProceed: true
    };

    res.status(200).json({
      success: true,
      message: "Customer data validated successfully",
      data: validatedData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error validating customer data",
      error: error.message
    });
  }
};

// Set booking type preference
const setBookingType = async (req, res) => {
  try {
    const { bookingType } = req.body;
    const userIdentifier = req.user.userId || req.user.id;

    if (!bookingType || !["self", "other"].includes(bookingType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking type. Must be 'self' or 'other'"
      });
    }

    let responseData = {
      bookingType: bookingType,
      customerData: null
    };

    // Jika booking untuk diri sendiri, ambil data profile
    if (bookingType === "self") {
      let user;
      
      if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
        user = await User.findOne({ userId: userIdentifier }).select('name phone email userId');
      } else {
        user = await User.findById(userIdentifier).select('name phone email userId');
      }
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User profile not found"
        });
      }

      responseData.customerData = {
        name: user.name,
        phone: user.phone,
        email: user.email,
        userId: user.userId || user._id,
        isOwnProfile: true
      };
    }

    res.status(200).json({
      success: true,
      message: `Booking type set to ${bookingType === "self" ? "self (using profile)" : "other (manual input)"}`,
      data: responseData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error setting booking type",
      error: error.message
    });
  }
};

module.exports = {
  getRegisteredData,
  getBookingOptions,
  validateCustomerData,
  setBookingType
};