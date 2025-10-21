const express = require("express");
const router = express.Router();
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');
const { registerUser, loginUser, getUsers, getUserById, updateUser, deleteUser,verifyUserToken   } = require("../controllers/userController");

router.post("/register", registerUser);
router.post("/login", loginUser);
// verify token endpoint
router.post("/verify-token", verifyUserToken); // New endpoint


router.get("/users", authMiddleware, checkRole('admin','customer'), getUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

module.exports = router;