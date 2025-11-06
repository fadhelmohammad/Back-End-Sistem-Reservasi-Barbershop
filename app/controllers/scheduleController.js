const Schedule = require("../models/Schedule");
const Barber = require("../models/Barber");
const ScheduleService = require("../services/scheduleService");

// Create schedule
const createSchedule = async (req, res) => {
  try {
    const { barber, date, timeSlot, status = "available" } = req.body;

    // Validate required fields
    if (!barber || !date || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: "Barber ID, date, and time slot are required"
      });
    }

    // Check if barber exists and is active
    const barberExists = await Barber.findOne({ _id: barber, isActive: true });
    if (!barberExists) {
      return res.status(404).json({
        success: false,
        message: "Active barber not found"
      });
    }

    // Parse date and time slot to create scheduled_time
    const [hours, minutes] = timeSlot.split(':').map(Number);
    const scheduledDate = new Date(date);
    scheduledDate.setHours(hours, minutes || 0, 0, 0);
    
    const dayOfWeek = scheduledDate.getDay();

    // Create schedule
    const schedule = new Schedule({
      barber,
      date: new Date(date),
      timeSlot,
      scheduled_time: scheduledDate,
      status,
      dayOfWeek,
      isDefaultSlot: false // Manual creation
    });

    const savedSchedule = await schedule.save();
    await savedSchedule.populate('barber', 'name barberId');
    
    res.status(201).json({
      success: true,
      message: "Schedule created successfully",
      data: savedSchedule
    });

  } catch (error) {
    console.error("Create schedule error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Schedule already exists for this barber, date, and time slot"
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to create schedule",
      error: error.message
    });
  }
};

// Get all schedules dengan filter enhanced
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
      includeExpired = false,
      timeSlot,
      dayOfWeek
    } = req.query;

    let query = {};

    // Exclude expired schedules by default
    if (!includeExpired) {
      query.status = { $ne: "expired" };
    }

    if (barberId) query.barber = barberId;
    if (timeSlot) query.timeSlot = timeSlot;
    if (dayOfWeek !== undefined) query.dayOfWeek = parseInt(dayOfWeek);
    
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
      .populate('barber', 'name barberId phone')
      .populate('reservation', 'reservationId customerName customerPhone')
      .sort({ date: 1, timeSlot: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Schedule.countDocuments(query);

    res.json({
      success: true,
      message: "Schedules retrieved successfully",
      data: {
        schedules,
        filters: {
          barberId,
          date,
          status,
          timeSlot,
          dayOfWeek
        }
      },
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
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

// Get available schedules (Public)
const getAvailableSchedules = async (req, res) => {
  try {
    const { barberId, date } = req.query;
    const now = new Date();
    
    let query = { 
      status: "available",
      scheduled_time: { $gte: now }
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
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);
      query.scheduled_time.$lte = nextWeek;
    }

    const schedules = await Schedule.find(query)
      .populate('barber', 'name barberId')
      .sort({ scheduled_time: 1 })
      .limit(100);

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

// Get schedules for specific barber with detailed view
const getBarberSchedules = async (req, res) => {
  try {
    const { barberId } = req.params;
    const { 
      date,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 100
    } = req.query;

    // Validate barber exists
    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    let query = { barber: barberId };

    // Date filters
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
    } else {
      // Default: show next 7 days
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      query.date = {
        $gte: today,
        $lte: nextWeek
      };
    }

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const schedules = await Schedule.find(query)
      .populate('reservation', 'reservationId customerName customerPhone totalPrice')
      .sort({ date: 1, timeSlot: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Schedule.countDocuments(query);

    // Group by date for better display
    const schedulesByDate = {};
    schedules.forEach(schedule => {
      const dateKey = schedule.date.toISOString().split('T')[0];
      if (!schedulesByDate[dateKey]) {
        schedulesByDate[dateKey] = {
          date: schedule.date,
          dayName: schedule.date.toLocaleDateString('en-US', { weekday: 'long' }),
          slots: []
        };
      }
      schedulesByDate[dateKey].slots.push({
        _id: schedule._id,
        timeSlot: schedule.timeSlot,
        scheduled_time: schedule.scheduled_time,
        status: schedule.status,
        reservation: schedule.reservation,
        isModifiable: ['available', 'unavailable'].includes(schedule.status)
      });
    });

    res.json({
      success: true,
      message: "Barber schedules retrieved successfully",
      data: {
        barber: {
          _id: barber._id,
          name: barber.name,
          barberId: barber.barberId,
          isActive: barber.isActive
        },
        schedulesByDate
      },
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get barber schedules error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch barber schedules",
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

// Toggle specific schedule slot (Enable/Disable)
const toggleScheduleSlot = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { action, reason } = req.body; // action: 'enable' or 'disable'

    if (!['enable', 'disable'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'enable' or 'disable'"
      });
    }

    const schedule = await Schedule.findById(scheduleId)
      .populate('barber', 'name barberId')
      .populate('reservation', 'reservationId customerName');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found"
      });
    }

    // Check if schedule can be modified
    if (['booked', 'completed', 'expired'].includes(schedule.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot modify ${schedule.status} schedule`,
        data: {
          currentStatus: schedule.status,
          reservation: schedule.reservation
        }
      });
    }

    // Update status
    const newStatus = action === 'enable' ? 'available' : 'unavailable';
    schedule.status = newStatus;
    
    // Add tracking
    if (reason) {
      schedule.lastModificationReason = reason;
    }
    
    schedule.lastModifiedBy = req.user.userId || req.user.id;
    schedule.lastModifiedAt = new Date();

    await schedule.save();

    res.json({
      success: true,
      message: `Schedule slot ${action}d successfully`,
      data: {
        schedule: {
          _id: schedule._id,
          barber: schedule.barber,
          date: schedule.date,
          timeSlot: schedule.timeSlot,
          status: schedule.status,
          lastModifiedAt: schedule.lastModifiedAt
        },
        action: action,
        reason: reason || null
      }
    });

  } catch (error) {
    console.error('Toggle schedule slot error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle schedule slot",
      error: error.message
    });
  }
};

// Bulk toggle schedule slots for specific barber and time ranges
const bulkToggleScheduleSlots = async (req, res) => {
  try {
    const { barberId } = req.params;
    const { 
      action, // 'enable' or 'disable'
      timeSlots, // Array of time slots like ['09:00', '10:00']
      dates, // Array of dates or date range
      startDate,
      endDate,
      dayOfWeek, // Optional: specific days (0-6, Sunday-Saturday)
      reason
    } = req.body;

    if (!['enable', 'disable'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'enable' or 'disable'"
      });
    }

    // Validate barber exists
    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    // Build query
    let query = { 
      barber: barberId,
      status: { $nin: ['booked', 'completed', 'expired'] } // Only modifiable schedules
    };

    // Date filters
    if (dates && Array.isArray(dates)) {
      query.date = { $in: dates.map(d => new Date(d)) };
    } else if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Time slot filter
    if (timeSlots && Array.isArray(timeSlots)) {
      query.timeSlot = { $in: timeSlots };
    }

    // Day of week filter
    if (dayOfWeek !== undefined) {
      if (Array.isArray(dayOfWeek)) {
        query.dayOfWeek = { $in: dayOfWeek };
      } else {
        query.dayOfWeek = dayOfWeek;
      }
    }

    const newStatus = action === 'enable' ? 'available' : 'unavailable';
    
    // Update schedules
    const updateData = { 
      status: newStatus,
      lastModifiedBy: req.user.userId || req.user.id,
      lastModifiedAt: new Date()
    };

    if (reason) {
      updateData.lastModificationReason = reason;
    }

    const result = await Schedule.updateMany(query, updateData);

    res.json({
      success: true,
      message: `Successfully ${action}d ${result.modifiedCount} schedule slots`,
      data: {
        barber: {
          _id: barber._id,
          name: barber.name,
          barberId: barber.barberId
        },
        modified: result.modifiedCount,
        action: action,
        filters: {
          timeSlots,
          dates: dates || { startDate, endDate },
          dayOfWeek
        },
        reason: reason || null
      }
    });

  } catch (error) {
    console.error('Bulk toggle schedule slots error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk toggle schedule slots",
      error: error.message
    });
  }
};

// Get schedule slot availability overview
const getScheduleAvailabilityOverview = async (req, res) => {
  try {
    const { barberId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate barber exists
    const barber = await Barber.findById(barberId);
    if (!barber) {
      return res.status(404).json({
        success: false,
        message: "Barber not found"
      });
    }

    // Default date range: next 30 days
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const schedules = await Schedule.find({
      barber: barberId,
      date: { $gte: start, $lte: end }
    }).sort({ date: 1, timeSlot: 1 });

    // Group by date and create availability grid
    const availabilityGrid = {};
    const timeSlots = ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];

    schedules.forEach(schedule => {
      const dateKey = schedule.date.toISOString().split('T')[0];
      if (!availabilityGrid[dateKey]) {
        availabilityGrid[dateKey] = {
          date: schedule.date,
          dayName: schedule.date.toLocaleDateString('en-US', { weekday: 'long' }),
          dayOfWeek: schedule.dayOfWeek,
          slots: {}
        };
      }
      availabilityGrid[dateKey].slots[schedule.timeSlot] = {
        _id: schedule._id,
        status: schedule.status,
        isModifiable: ['available', 'unavailable'].includes(schedule.status)
      };
    });

    res.json({
      success: true,
      message: "Schedule availability overview retrieved successfully",
      data: {
        barber: {
          _id: barber._id,
          name: barber.name,
          barberId: barber.barberId,
          isActive: barber.isActive
        },
        dateRange: { start, end },
        availabilityGrid,
        timeSlots
      }
    });

  } catch (error) {
    console.error('Get schedule availability overview error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to get schedule availability overview",
      error: error.message
    });
  }
};

// Update schedule status (Legacy support)
const updateScheduleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const schedule = await Schedule.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate('barber', 'name barberId');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found"
      });
    }

    res.json({
      success: true,
      message: "Schedule status updated successfully",
      data: schedule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update schedule status",
      error: error.message
    });
  }
};

// Bulk update schedule status (Legacy support)
const bulkUpdateScheduleStatus = async (req, res) => {
  try {
    const { scheduleIds, status } = req.body;

    const result = await Schedule.updateMany(
      { _id: { $in: scheduleIds } },
      { status }
    );

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} schedules`,
      data: {
        modified: result.modifiedCount,
        status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to bulk update schedule status",
      error: error.message
    });
  }
};

// Perform schedule cleanup
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
      message: "Failed to perform schedule cleanup",
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
      message: "Expired schedules check completed",
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

module.exports = {
  createSchedule,
  getAllSchedules,
  getBarberSchedules,
  getAvailableSchedules,
  generateDefaultSchedules,
  generateSchedulesForBarber,
  getBarberScheduleStats,
  toggleScheduleSlot,
  bulkToggleScheduleSlots,
  getScheduleAvailabilityOverview,
  updateScheduleStatus,
  bulkUpdateScheduleStatus,
  performCleanup,
  checkExpired
};
