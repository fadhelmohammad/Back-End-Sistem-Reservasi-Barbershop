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

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  loginCustomer,
  updateCustomer,
  deleteCustomer
};
