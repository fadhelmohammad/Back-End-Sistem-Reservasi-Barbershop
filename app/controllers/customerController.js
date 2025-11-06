const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Get all customers
const getAllCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' }).select("-password");
    res.status(200).json({
      success: true,
      message: "Customers retrieved successfully",
      data: customers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching customers",
      error: error.message
    });
  }
};

// Get customer by ID
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await User.findOne({ 
      _id: id, 
      role: 'customer' 
    }).select("-password");
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Customer retrieved successfully",
      data: customer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching customer",
      error: error.message
    });
  }
};

// Register/Create customer
const createCustomer = async (req, res) => {
  try {
    let { name, email, phone, password, confirmPassword } = req.body;
    
    // Normalize input
    name = name?.trim();
    email = email?.toLowerCase().trim();
    phone = phone?.trim();
    
    // Validate required fields
    if (!name || !email || !phone || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }
    
    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }
    
    // Check if customer already exists (email or phone)
    const existingUser = await User.findOne({ 
      $or: [{ email }, { phone }] 
    });
    
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({
          success: false,
          message: "Email already registered"
        });
      }
      if (existingUser.phone === phone) {
        return res.status(400).json({
          success: false,
          message: "Phone number already registered"
        });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create customer with role 'customer'
    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'customer'
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      data: {
        _id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
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
      message: "Registration failed",
      error: error.message
    });
  }
};

// Login customer
const loginCustomer = async (req, res) => {
  try {
    let { emailOrPhone, password } = req.body;
    
    // Normalize input
    emailOrPhone = emailOrPhone?.toLowerCase().trim();

    // Find customer by email or phone with role 'customer'
    const user = await User.findOne({ 
      $or: [
        { email: emailOrPhone },
        { phone: emailOrPhone }
      ],
      role: 'customer'
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message
    });
  }
};

// Update customer
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, password } = req.body;
    
    // Check if the user exists and is a customer
    const existingCustomer = await User.findOne({ 
      _id: id, 
      role: 'customer' 
    });
    
    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }
    
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (phone) updateData.phone = phone.trim();
    
    // Check if email or phone already exists (exclude current customer)
    if (email || phone) {
      const existingUser = await User.findOne({
        _id: { $ne: id },
        $or: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : [])
        ]
      });
      
      if (existingUser) {
        if (existingUser.email === email) {
          return res.status(400).json({
            success: false,
            message: "Email already exists"
          });
        }
        if (existingUser.phone === phone) {
          return res.status(400).json({
            success: false,
            message: "Phone number already exists"
          });
        }
      }
    }

    // Hash new password if provided
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long"
        });
      }
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const customer = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: customer
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
    
    res.status(400).json({
      success: false,
      message: "Error updating customer",
      error: error.message
    });
  }
};

// Delete customer
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await User.findOneAndDelete({ 
      _id: id, 
      role: 'customer' 
    });
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
      data: {
        _id: customer._id,
        userId: customer.userId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        role: customer.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting customer",
      error: error.message
    });
  }
};

// Get customer profile (self)
const getCustomerProfile = async (req, res) => {
  try {
    const customerId = req.user.userId || req.user.id;
    
    let customer;
    
    // Handle different ID formats
    if (typeof customerId === 'string' && customerId.startsWith('USR-')) {
      // Find by userId string
      customer = await User.findOne({ 
        userId: customerId, 
        role: "customer" 
      }).select("-password");
    } else {
      // Find by MongoDB _id
      customer = await User.findOne({ 
        _id: customerId, 
        role: "customer" 
      }).select("-password");
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer profile not found"
      });
    }

    // Get customer statistics
    const Reservation = require('../models/Reservation');
    
    const [
      totalReservations,
      completedReservations,
      cancelledReservations,
      pendingReservations,
      totalSpent
    ] = await Promise.all([
      Reservation.countDocuments({ customer: customer._id }),
      Reservation.countDocuments({ customer: customer._id, status: 'completed' }),
      Reservation.countDocuments({ customer: customer._id, status: 'cancelled' }),
      Reservation.countDocuments({ customer: customer._id, status: 'pending' }),
      Reservation.aggregate([
        { $match: { customer: customer._id, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ])
    ]);

    // Calculate loyalty level
    const getLoyaltyLevel = (completedCount) => {
      if (completedCount >= 20) return { level: 'VIP', color: '#FFD700', benefits: 'Priority booking, 15% discount' };
      if (completedCount >= 10) return { level: 'Gold', color: '#FFA500', benefits: 'Priority booking, 10% discount' };
      if (completedCount >= 5) return { level: 'Silver', color: '#C0C0C0', benefits: '5% discount' };
      return { level: 'Bronze', color: '#CD7F32', benefits: 'Standard benefits' };
    };

    const loyaltyInfo = getLoyaltyLevel(completedReservations);

    res.status(200).json({
      success: true,
      message: "Customer profile retrieved successfully",
      data: {
        _id: customer._id,
        userId: customer.userId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        role: customer.role,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        profileType: "customer",
        statistics: {
          totalReservations,
          completedReservations,
          cancelledReservations,
          pendingReservations,
          totalSpent: totalSpent[0]?.total || 0,
          loyaltyLevel: loyaltyInfo
        }
      }
    });
  } catch (error) {
    console.error('Get customer profile error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving customer profile",
      error: error.message
    });
  }
};

// Update customer profile (self)
const updateCustomerProfile = async (req, res) => {
  try {
    const customerId = req.user.userId || req.user.id;
    const { name, email, phone, currentPassword, newPassword } = req.body;

    let customer;
    
    // Find customer
    if (typeof customerId === 'string' && customerId.startsWith('USR-')) {
      customer = await User.findOne({ userId: customerId, role: "customer" });
    } else {
      customer = await User.findOne({ _id: customerId, role: "customer" });
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email address"
        });
      }

      // Check if email already exists for other users
      const existingUser = await User.findOne({
        _id: { $ne: customer._id },
        email: email.toLowerCase()
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already exists"
        });
      }
    }

    // Validate phone if provided
    if (phone) {
      // Check if phone already exists for other users
      const existingUser = await User.findOne({
        _id: { $ne: customer._id },
        phone: phone.trim()
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Phone number already exists"
        });
      }
    }

    // Handle password update
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to set new password"
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, customer.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect"
        });
      }

      // Validate new password
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 6 characters long"
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      customer.password = await bcrypt.hash(newPassword, salt);
    }

    // Update other fields
    if (name) customer.name = name.trim();
    if (email) customer.email = email.toLowerCase().trim();
    if (phone) customer.phone = phone.trim();

    await customer.save();

    res.status(200).json({
      success: true,
      message: "Customer profile updated successfully",
      data: {
        _id: customer._id,
        userId: customer.userId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        role: customer.role,
        updatedAt: customer.updatedAt
      }
    });

  } catch (error) {
    console.error('Update customer profile error:', error);
    res.status(500).json({
      success: false,
      message: "Error updating customer profile",
      error: error.message
    });
  }
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  loginCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerProfile,
  updateCustomerProfile
};
