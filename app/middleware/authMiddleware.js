const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided."
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
    
    // Verify user exists and get user data including role
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found."
      });
    }

    // Set user data including role in req.user
    req.user = { 
      userId: decoded.userId,
      role: user.role // Make sure to include the role
    };
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid token."
    });
  }
};

const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // Check if user exists in request (usually set by auth middleware)
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. User not authenticated.'
        });
      }

      // Check if user has role property
      if (!req.user.role) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. User role not found.'
        });
      }

      // Check if user's role is in the allowed roles
      const hasPermission = allowedRoles.includes(req.user.role);
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`
        });
      }

      // User has permission, proceed to next middleware
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Internal server error during role check.',
        error: error.message
      });
    }
  };
};

// Export both functions
module.exports = {
  authMiddleware,
  checkRole
};