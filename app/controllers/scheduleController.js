const Schedule = require("../models/Schedule");
const Barber = require("../models/Barber");

// Create schedule
const createSchedule = async (req, res) => {
  try {
    const { barber, scheduled_time, status = "available" } = req.body;

    // Validate required fields
    if (!barber || !scheduled_time) {
      return res.status(400).json({
        success: false,
        message: "Barber ID and scheduled time are required"
      });
    }

    // Check if barber exists
    const barberExists = await Barber.findById(barber);
    if (!barberExists) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    // Create schedule
    const schedule = new Schedule({
      barber,
      scheduled_time: new Date(scheduled_time),
      status
    });

    const savedSchedule = await schedule.save();
    await savedSchedule.populate('barber');
    
    res.status(201).json({
      success: true,
      message: "Schedule created successfully",
      data: savedSchedule
    });

  } catch (error) {
    console.error("Create schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create schedule",
      error: error.message
    });
  }
};

// Get all schedules
const getAllSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .populate('barber')
      .sort({ scheduled_time: 1 });

    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch schedules",
      error: error.message
    });
  }
};

// Get available schedules
const getAvailableSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find({ status: "available" })
      .populate('barber')
      .sort({ scheduled_time: 1 });

    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch available schedules",
      error: error.message
    });
  }
};

// Get schedule by ID
const getScheduleById = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id).populate('barber');
    
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found"
      });
    }

    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch schedule",
      error: error.message
    });
  }
};

module.exports = {
  createSchedule,
  getAllSchedules,
  getAvailableSchedules,
  getScheduleById
};
