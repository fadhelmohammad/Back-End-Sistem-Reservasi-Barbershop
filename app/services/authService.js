const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Utility function untuk exclude password
const excludePassword = (user) => {
  const userObject = user.toObject ? user.toObject() : user;
  const { password, ...userWithoutPassword } = userObject;
  return userWithoutPassword;
};

// Verify token function
const verifyToken = async (token) => {
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
    
    // Find user by ID from token
    const user = await User.findById(decoded.userId).select("-password");
    
    if (!user) {
      return {
        status: false,
        message: "User not found!",
        data: null
      };
    }

    return {
      status: true,
      message: "Token verified successfully",
      data: user
    };
  } catch (error) {
    console.error("AuthService.verifyToken:", error.message);
    
    // Handle different JWT errors
    if (error.name === 'TokenExpiredError') {
      return {
        status: false,
        message: "Token has expired!",
        data: null
      };
    }
    
    if (error.name === 'JsonWebTokenError') {
      return {
        status: false,
        message: "Invalid token!",
        data: null
      };
    }
    
    return {
      status: false,
      message: "Token verification failed!",
      data: null,
      error: error.message
    };
  }
};

module.exports = {
  verifyToken,
  excludePassword
};