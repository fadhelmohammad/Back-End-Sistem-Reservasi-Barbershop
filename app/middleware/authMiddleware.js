const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization");

    if (!token || !token.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No valid token provided."
      });
    }

    const tokenValue = token.split(" ")[1];
    const decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);
    
    // DEBUG: Log decoded token
    console.log("=== AUTH MIDDLEWARE DEBUG ===");
    console.log("Decoded token:", decoded);
    console.log("Token role:", decoded.role);
    console.log("Token userId:", decoded.userId);
    console.log("Token id:", decoded.id);
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid token",
      error: error.message
    });
  }
};

const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      console.log("=== CHECK ROLE DEBUG ===");
      console.log("req.user:", req.user);
      console.log("req.user.role:", req.user?.role);
      console.log("allowedRoles:", allowedRoles);
      
      const userRole = req.user?.role;
      
      if (!userRole) {
        return res.status(403).json({
          success: false,
          message: "Access denied. User role not found in token.",
          debug: {
            tokenPayload: req.user,
            expectedRoles: allowedRoles
          }
        });
      }
      
      const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      
      const hasAccess = rolesArray.some(role => 
        role.toLowerCase() === userRole.toLowerCase()
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role: ${rolesArray.join(' or ')}. Your role: ${userRole}`
        });
      }

      console.log("✅ Role check passed");
      next();
    } catch (error) {
      console.error("Error in checkRole:", error);
      res.status(500).json({
        success: false,
        message: "Error checking user role",
        error: error.message
      });
    }
  };
};

module.exports = { authMiddleware, checkRole };