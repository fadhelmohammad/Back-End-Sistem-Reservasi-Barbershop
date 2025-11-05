const Schedule = require("../models/Schedule");
const Barber = require("../models/Barber");
const ScheduleService = require("../services/scheduleService");

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

// Get all schedules dengan filter
const getAllSchedules = async (req, res) => {
  try {
    const { 
      barberId, 
      date, 
      status, 
      startDate, 
      endDate,
      page = 1,
      limit = 50,
      includeExpired = false
    } = req.query;

    let query = {};

    // Exclude expired schedules by default
    if (!includeExpired) {
      query.status = { $ne: "expired" };
    }

    if (barberId) query.barber = barberId;
    if (status) {
      if (includeExpired) {
        query.status = status;
      } else {
        query.status = { $in: [status], $ne: "expired" };
      }
    }
    
    if (date) {
      const searchDate = new Date(date);
      query.date = {
        $gte: new Date(searchDate.toDateString()),
        $lt: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000)
      };
    } else if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const skip = (page - 1) * limit;
    const schedules = await Schedule.find(query)
      .populate('barber', 'name email phone')
      .populate('reservation', 'reservationId customer')
      .sort({ date: 1, timeSlot: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Schedule.countDocuments(query);

    res.json({
      success: true,
      message: "Schedules retrieved successfully",
      data: schedules,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch schedules",
      error: error.message
    });
  }
};

// Get available schedules untuk customer (reservation flow)
const getAvailableSchedules = async (req, res) => {
  try {
    const { barberId, date } = req.query;
    const now = new Date();
    
    let query = { 
      status: "available",
      scheduled_time: { $gte: now } // Exclude past schedules
    };
    
    if (barberId) {
      query.barber = barberId;
    }
    
    if (date) {
      const searchDate = new Date(date);
      const endOfDay = new Date(searchDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      query.scheduled_time = {
        $gte: new Date(Math.max(now.getTime(), searchDate.getTime())),
        $lte: endOfDay
      };
    } else {
      // Default: show next 7 days
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);
      
      query.scheduled_time.$lte = nextWeek;
    }

    const schedules = await Schedule.find(query)
      .populate('barber', 'name specialization')
      .sort({ scheduled_time: 1 })
      .limit(100);

    // Group by date untuk tampilan yang lebih baik
    const groupedSchedules = {};
    schedules.forEach(schedule => {
      const dateKey = schedule.date.toISOString().split('T')[0];
      if (!groupedSchedules[dateKey]) {
        groupedSchedules[dateKey] = [];
      }
      groupedSchedules[dateKey].push(schedule);
    });

    res.json({
      success: true,
      message: "Available schedules retrieved successfully",
      data: groupedSchedules,
      totalSlots: schedules.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch available schedules",
      error: error.message
    });
  }
};

// Generate default schedules (Admin only)
const generateDefaultSchedules = async (req, res) => {
  try {
    const { startDate, endDate, barberId } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required"
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date"
      });
    }

    const generatedCount = await ScheduleService.generateDefaultSchedules(
      start, 
      end, 
      barberId
    );

    res.status(201).json({
      success: true,
      message: `Successfully generated ${generatedCount} default schedules with 1-hour intervals`,
      data: {
        startDate,
        endDate,
        barberId,
        generatedCount,
        schedulePattern: {
          mondayToThursday: "11:00-18:00, 19:00-23:00",
          friday: "13:00-23:00", 
          saturday: "11:00-18:00, 19:00-23:00",
          sunday: "CLOSED",
          interval: "1 hour"
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate default schedules",
      error: error.message
    });
  }
};

// Generate schedules untuk barber tertentu (Manual trigger)
const generateSchedulesForBarber = async (req, res) => {
  try {
    const { barberId } = req.params;
    const { days = 30 } = req.body;

    // Validate barber exists
    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    if (!barber.isActive) {
      return res.status(400).json({
        success: false,
        message: "Cannot generate schedules for inactive barber"
      });
    }

    // Generate schedules
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + parseInt(days));

    const generatedCount = await ScheduleService.generateDefaultSchedules(
      today,
      endDate,
      barberId
    );

    res.status(201).json({
      success: true,
      message: `Successfully generated ${generatedCount} schedules for ${barber.name}`,
      data: {
        barber: {
          _id: barber._id,
          name: barber.name,
          barberId: barber.barberId
        },
        schedules: {
          generated: generatedCount,
          period: `${days} days`,
          startDate: today.toDateString(),
          endDate: endDate.toDateString()
        }
      }
    });

  } catch (error) {
    console.error('Generate schedules for barber error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to generate schedules for barber",
      error: error.message
    });
  }
};

// Get schedule statistics untuk barber
const getBarberScheduleStats = async (req, res) => {
  try {
    const { barberId } = req.params;

    // Validate barber exists
    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    const nextMonth = new Date();
    nextMonth.setDate(now.getDate() + 30);

    const [
      totalSchedules,
      availableSchedules,
      bookedSchedules,
      weeklySchedules,
      monthlySchedules
    ] = await Promise.all([
      Schedule.countDocuments({ 
        barber: barberId,
        scheduled_time: { $gte: now }
      }),
      Schedule.countDocuments({ 
        barber: barberId,
        status: 'available',
        scheduled_time: { $gte: now }
      }),
      Schedule.countDocuments({ 
        barber: barberId,
        status: 'booked',
        scheduled_time: { $gte: now }
      }),
      Schedule.countDocuments({ 
        barber: barberId,
        scheduled_time: { $gte: now, $lte: nextWeek }
      }),
      Schedule.countDocuments({ 
        barber: barberId,
        scheduled_time: { $gte: now, $lte: nextMonth }
      })
    ]);

    res.status(200).json({
      success: true,
      message: "Barber schedule statistics retrieved successfully",
      data: {
        barber: {
          _id: barber._id,
          name: barber.name,
          barberId: barber.barberId,
          isActive: barber.isActive
        },
        statistics: {
          total: totalSchedules,
          available: availableSchedules,
          booked: bookedSchedules,
          unavailable: totalSchedules - availableSchedules - bookedSchedules,
          weekly: weeklySchedules,
          monthly: monthlySchedules,
          utilizationRate: totalSchedules > 0 ? ((bookedSchedules / totalSchedules) * 100).toFixed(2) : 0
        }
      }
    });

  } catch (error) {
    console.error('Get barber schedule stats error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get barber schedule statistics",
      error: error.message
    });
  }
};

// Update schedule status (Cashier function)
const updateScheduleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!['available', 'unavailable'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'available' or 'unavailable'"
      });
    }

    const schedule = await Schedule.findById(id);
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found"
      });
    }

    // Check if schedule is booked, completed, or expired
    if (['booked', 'completed', 'expired'].includes(schedule.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot modify ${schedule.status} schedule`
      });
    }

    const updatedSchedule = await Schedule.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate('barber', 'name');

    res.json({
      success: true,
      message: `Schedule ${status === 'available' ? 'enabled' : 'disabled'} successfully`,
      data: updatedSchedule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update schedule status",
      error: error.message
    });
  }
};

// Manual cleanup trigger (Admin only)
const performCleanup = async (req, res) => {
  try {
    const result = await ScheduleService.performScheduleCleanup();
    
    res.json({
      success: true,
      message: "Schedule cleanup completed successfully",
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to perform cleanup",
      error: error.message
    });
  }
};

// Check expired schedules
const checkExpired = async (req, res) => {
  try {
    const result = await ScheduleService.checkExpiredSchedules();
    
    res.json({
      success: true,
      message: "Expired schedules checked successfully",
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to check expired schedules",
      error: error.message
    });
  }
};

// Bulk update schedule status untuk multiple slots
const bulkUpdateScheduleStatus = async (req, res) => {
  try {
    const { scheduleIds, status } = req.body;

    if (!scheduleIds || !Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Schedule IDs array is required"
      });
    }

    if (!['available', 'unavailable'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'available' or 'unavailable'"
      });
    }

    // Update only schedules that can be modified
    const result = await Schedule.updateMany(
      { 
        _id: { $in: scheduleIds },
        status: { $nin: ['booked', 'completed', 'expired'] }
      },
      { status }
    );

    res.json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} schedules`,
      data: {
        modified: result.modifiedCount,
        total: scheduleIds.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to bulk update schedules",
      error: error.message
    });
  }
};

module.exports = {
  createSchedule,
  getAllSchedules,
  getAvailableSchedules,
  generateDefaultSchedules,
  generateSchedulesForBarber, // TAMBAHAN
  getBarberScheduleStats, // TAMBAHAN
  updateScheduleStatus,
  bulkUpdateScheduleStatus,
  performCleanup,
  checkExpired
};
