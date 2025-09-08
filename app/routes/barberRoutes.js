const express = require("express");
const router = express.Router();
const {
  createBarber,
  getAllBarbers,
  getBarberById,
  updateBarber,
  deleteBarber
} = require("../controllers/barberController");

router.post("/", createBarber);
router.get("/", getAllBarbers);
router.get("/:id", getBarberById);
router.put("/:id", updateBarber);
router.delete("/:id", deleteBarber);

module.exports = router;
