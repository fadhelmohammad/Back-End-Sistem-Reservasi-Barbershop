const Schedule = require("../models/Schedule");
const Barber = require("../models/Barber");

class ScheduleService {
  // Define time slots untuk setiap hari
  static getTimeSlots(dayOfWeek) {
    const timeSlots = [];
    
    if (dayOfWeek === 5) { // Friday
      // Jumat: 13:00 - 23:00 (30 menit interval)
      for (let hour = 13; hour <= 22; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
        timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      timeSlots.push("23:00");
    } else {
      // Hari lain: 11:00 - 18:00, break, 19:30 - 23:00
      // Morning session: 11:00 - 18:00
      for (let hour = 11; hour <= 17; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
        timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      timeSlots.push("18:00");
      
      // Evening session: 19:30 - 23:00
      timeSlots.push("19:30");
      for (let hour = 20; hour <= 22; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
        timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      timeSlots.push("23:00");
    }
    
    return timeSlots;
  }

  // Generate schedules untuk range tanggal tertentu
  static async generateDefaultSchedules(startDate, endDate, barberId = null) {
    try {
      console.log(`🔄 Generating schedules from ${startDate} to ${endDate}`);
      
      // Get all active barbers or specific barber
      const barbers = barberId 
        ? await Barber.find({ _id: barberId, isActive: true })
        : await Barber.find({ isActive: true });
      
      if (barbers.length === 0) {
        throw new Error('No active barbers found');
      }

      const schedules = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        const timeSlots = this.getTimeSlots(dayOfWeek);
        
        for (const barber of barbers) {
          for (const timeSlot of timeSlots) {
            // Parse time slot
            const [hours, minutes] = timeSlot.split(':').map(Number);
            const scheduledTime = new Date(currentDate);
            scheduledTime.setHours(hours, minutes, 0, 0);
            
            // Skip past times
            if (scheduledTime <= new Date()) {
              continue;
            }
            
            // Check if schedule already exists
            const existingSchedule = await Schedule.findOne({
              barber: barber._id,
              date: new Date(currentDate.toDateString()),
              timeSlot: timeSlot
            });
            
            if (!existingSchedule) {
              schedules.push({
                barber: barber._id,
                date: new Date(currentDate.toDateString()),
                timeSlot: timeSlot,
                scheduled_time: scheduledTime,
                status: "available",
                isDefaultSlot: true,
                dayOfWeek: dayOfWeek
              });
            }
          }
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (schedules.length > 0) {
        await Schedule.insertMany(schedules);
        console.log(`✅ Generated ${schedules.length} default schedules`);
      }
      
      return schedules.length;
    } catch (error) {
      console.error('❌ Error generating schedules:', error);
      throw error;
    }
  }

  // Comprehensive cleanup method
  static async performScheduleCleanup() {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      console.log('🧹 Starting schedule cleanup...');

      // Step 1: Mark expired available schedules
      const expiredResult = await Schedule.updateMany(
        {
          scheduled_time: { $lt: now },
          status: "available"
        },
        {
          status: "expired"
        }
      );
      console.log(`✅ Marked ${expiredResult.modifiedCount} schedules as expired`);

      // Step 2: Mark completed booked schedules
      const completedResult = await Schedule.updateMany(
        {
          scheduled_time: { $lt: now },
          status: "booked",
          completedAt: null
        },
        {
          status: "completed",
          completedAt: now
        }
      );
      console.log(`✅ Marked ${completedResult.modifiedCount} booked schedules as completed`);

      // Step 3: Delete old expired schedules (30+ days old)
      const deleteResult = await Schedule.deleteMany({
        status: "expired",
        scheduled_time: { $lt: thirtyDaysAgo }
      });
      console.log(`✅ Deleted ${deleteResult.deletedCount} old expired schedules`);

      return {
        expired: expiredResult.modifiedCount,
        completed: completedResult.modifiedCount,
        deleted: deleteResult.deletedCount
      };
    } catch (error) {
      console.error('❌ Error in schedule cleanup:', error);
      throw error;
    }
  }

  // Get only current and future available schedules
  static async getAvailableSchedules(barberId = null, startDate = null) {
    try {
      const now = new Date();
      let query = {
        status: "available",
        scheduled_time: { $gte: now } // Hanya yang belum expired
      };

      if (barberId) {
        query.barber = barberId;
      }

      if (startDate) {
        query.scheduled_time.$gte = new Date(startDate);
      }

      const schedules = await Schedule.find(query)
        .populate('barber', 'name specialization')
        .sort({ scheduled_time: 1 })
        .limit(100);

      return schedules;
    } catch (error) {
      console.error('❌ Error getting available schedules:', error);
      throw error;
    }
  }

  // Auto generate untuk 30 hari ke depan
  static async autoGenerateMonthlySchedules() {
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 30);
    
    return await this.generateDefaultSchedules(today, endDate);
  }

  // Check and cleanup expired schedules on demand
  static async checkExpiredSchedules() {
    try {
      const now = new Date();
      
      const expiredCount = await Schedule.countDocuments({
        scheduled_time: { $lt: now },
        status: "available"
      });

      if (expiredCount > 0) {
        console.log(`⚠️ Found ${expiredCount} expired schedules`);
        return await this.performScheduleCleanup();
      }

      return { expired: 0, completed: 0, deleted: 0 };
    } catch (error) {
      console.error('❌ Error checking expired schedules:', error);
      throw error;
    }
  }
}

module.exports = ScheduleService;