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
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token."
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid token."
    });
  }
};

const checkRole = (requiredRole) => {
  return (req, res, next) => {
    if (req.user.role.toUpperCase() !== requiredRole.toUpperCase()) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${requiredRole}. Your role: ${req.user.role}`
      });
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  checkRole
};