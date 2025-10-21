const { verifyToken } = require("../services/authService");

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided."
      });
    }

    const verificationResult = await verifyToken(token);
    
    if (!verificationResult.status) {
      return res.status(401).json({
        success: false,
        message: verificationResult.message
      });
    }

    req.user = verificationResult.data;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid token",
      error: error.message
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