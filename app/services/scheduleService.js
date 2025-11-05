const Schedule = require('../models/Schedule');
const Barber = require('../models/Barber');

class ScheduleService {
  // Generate time slots untuk setiap hari (UPDATED untuk 1 jam interval)
  static getTimeSlots(dayOfWeek) {
    const timeSlots = [];
    
    if (dayOfWeek === 5) { // Friday
      // Jumat: 13:00 - 23:00 (1 jam interval)
      for (let hour = 13; hour <= 23; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    } else if (dayOfWeek === 0) { // Sunday - TUTUP
      return [];
    } else {
      // Senin-Kamis & Sabtu: 11:00 - 18:00, break, 19:00 - 23:00
      // Morning session: 11:00 - 18:00
      for (let hour = 11; hour <= 18; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
      
      // Evening session: 19:00 - 23:00
      for (let hour = 19; hour <= 23; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    }
    
    return timeSlots;
  }

  // Generate default schedules untuk range tanggal tertentu
  static async generateDefaultSchedules(startDate, endDate, barberId = null) {
    try {
      const barbers = barberId 
        ? await Barber.find({ _id: barberId, isActive: true })
        : await Barber.find({ isActive: true });

      if (barbers.length === 0) {
        if (barberId) {
          throw new Error('Barber not found or inactive');
        } else {
          throw new Error('No active barbers found');
        }
      }

      console.log(`Generating schedules for ${barbers.length} barber(s) from ${startDate.toDateString()} to ${endDate.toDateString()}`);

      const schedulesToCreate = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        
        // Skip Sundays (dayOfWeek === 0)
        if (dayOfWeek === 0) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        const timeSlots = this.getTimeSlots(dayOfWeek);

        for (const barber of barbers) {
          for (const timeSlot of timeSlots) {
            try {
              // Check if schedule already exists
              const existingSchedule = await Schedule.findOne({
                barber: barber._id,
                date: new Date(currentDate.toDateString()),
                timeSlot: timeSlot
              });

              if (existingSchedule) {
                continue; // Skip if exists
              }

              // Parse time slot untuk create scheduled_time
              const [hours, minutes] = timeSlot.split(':').map(Number);
              const scheduledTime = new Date(currentDate);
              scheduledTime.setHours(hours, minutes || 0, 0, 0);
              
              // Skip past times untuk hari ini
              if (scheduledTime <= new Date()) {
                continue;
              }

              schedulesToCreate.push({
                barber: barber._id,
                date: new Date(currentDate.toDateString()),
                timeSlot: timeSlot,
                scheduled_time: scheduledTime,
                status: "available",
                isDefaultSlot: true,
                dayOfWeek: dayOfWeek
              });

            } catch (error) {
              console.error(`Error preparing schedule for ${barber.name} at ${timeSlot}:`, error.message);
            }
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (schedulesToCreate.length === 0) {
        console.log("No new schedules to create (all slots already exist or are in the past)");
        return 0;
      }

      console.log(`Preparing to create ${schedulesToCreate.length} schedule slots`);

      // Insert schedules in batches untuk better performance
      let created = 0;
      const batchSize = 100;
      
      for (let i = 0; i < schedulesToCreate.length; i += batchSize) {
        const batch = schedulesToCreate.slice(i, i + batchSize);
        
        try {
          const result = await Schedule.insertMany(batch, { 
            ordered: false 
          });
          created += result.length;
        } catch (error) {
          if (error.name === 'MongoBulkWriteError') {
            created += error.result.insertedCount || 0;
            console.log(`Batch insert: ${error.result.insertedCount} created, ${error.writeErrors?.length || 0} duplicates skipped`);
          } else {
            console.error('Batch insert error:', error);
            throw error;
          }
        }
      }

      console.log(`Successfully generated ${created} schedules`);
      return created;

    } catch (error) {
      console.error('Error generating default schedules:', error);
      throw error;
    }
  }

  // Auto generate schedules untuk bulan berikutnya
  static async autoGenerateMonthlySchedules() {
    try {
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);

      console.log(`Auto-generating schedules for ${nextMonth.toDateString()} to ${endOfNextMonth.toDateString()}`);

      const generated = await this.generateDefaultSchedules(nextMonth, endOfNextMonth);
      
      console.log(`Auto-generated ${generated} schedules for next month`);
      return generated;

    } catch (error) {
      console.error('Error in auto-generating monthly schedules:', error);
      throw error;
    }
  }

  // Check dan mark expired schedules
  static async checkExpiredSchedules() {
    try {
      const now = new Date();
      
      const result = await Schedule.updateMany(
        {
          scheduled_time: { $lt: now },
          status: { $in: ['available', 'unavailable'] }
        },
        {
          status: 'expired'
        }
      );

      return {
        expired: result.modifiedCount,
        checkedAt: now
      };

    } catch (error) {
      console.error('Error checking expired schedules:', error);
      throw error;
    }
  }

  // Cleanup old schedules
  static async performScheduleCleanup() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Mark expired schedules
      const expiredResult = await this.checkExpiredSchedules();

      // Delete very old schedules (older than 30 days)
      const deleteResult = await Schedule.deleteMany({
        date: { $lt: thirtyDaysAgo },
        status: { $in: ['expired', 'completed'] }
      });

      return {
        expired: expiredResult.expired,
        deleted: deleteResult.deletedCount,
        cleanupAt: new Date()
      };

    } catch (error) {
      console.error('Error performing schedule cleanup:', error);
      throw error;
    }
  }
}

module.exports = ScheduleService;