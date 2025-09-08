const express = require("express");
const router = express.Router();
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');
const { registerUser, loginUser, getUsers, getUserById, updateUser, deleteUser } = require("../controllers/userController");

router.post("/register", registerUser);
router.post("/login", loginUser);

router.get("/", authMiddleware, checkRole('ADMIN','customer'), getUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

module.exports = router;