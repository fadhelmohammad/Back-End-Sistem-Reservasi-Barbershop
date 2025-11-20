const Schedule = require('../models/Schedule');
const Barber = require('../models/Barber');

class ScheduleService {
  // ✅ UPDATED: Generate time slots untuk setiap hari (7 HARI FULL)
  static getTimeSlots(dayOfWeek) {
    const timeSlots = [];
    
    // ✅ MINGGU (0): Jam operasional khusus
    if (dayOfWeek === 0) { // Sunday
      // Minggu: 12:00 - 20:00 (jam santai weekend)
      for (let hour = 12; hour <= 20; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    }
    // ✅ JUMAT (5): Jam operasional khusus  
    else if (dayOfWeek === 5) { // Friday
      // Jumat: 13:00 - 23:00 (setelah sholat Jumat)
      for (let hour = 13; hour <= 23; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    }
    // ✅ SABTU (6): Jam weekend
    else if (dayOfWeek === 6) { // Saturday  
      // Sabtu: 10:00 - 22:00 (hari libur)
      for (let hour = 10; hour <= 22; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    }
    // ✅ SENIN-KAMIS (1-4): Jam kerja reguler
    else {
      // Senin-Kamis: 11:00 - 18:00, break, 19:00 - 23:00
      
      // Morning/Afternoon session: 11:00 - 18:00
      for (let hour = 11; hour <= 18; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
      
      // Evening session: 19:00 - 23:00 (setelah istirahat)
      for (let hour = 19; hour <= 23; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    }
    
    return timeSlots;
  }

  // ✅ UPDATED: Generate default schedules untuk range tanggal tertentu (7 HARI FULL)
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

      console.log(`📅 Generating 7-day schedules for ${barbers.length} barber(s) from ${startDate.toDateString()} to ${endDate.toDateString()}`);

      const schedulesToCreate = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        
        // ✅ TIDAK ADA SKIP - SEMUA HARI DIKERJAKAN (0-6)
        console.log(`📅 Processing ${this.getDayName(dayOfWeek)} - ${currentDate.toDateString()}`);
        
        const timeSlots = this.getTimeSlots(dayOfWeek);
        console.log(`⏰ ${this.getDayName(dayOfWeek)} has ${timeSlots.length} time slots:`, timeSlots);

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
              
              // ✅ Skip past times untuk hari ini saja
              if (currentDate.toDateString() === new Date().toDateString() && scheduledTime <= new Date()) {
                continue;
              }

              schedulesToCreate.push({
                barber: barber._id,
                date: new Date(currentDate.toDateString()),
                timeSlot: timeSlot,
                scheduled_time: scheduledTime,
                status: "available",
                isDefaultSlot: true,
                dayOfWeek: dayOfWeek,
                // ✅ Additional metadata untuk 7-day schedule
                dayName: this.getDayName(dayOfWeek),
                operationalType: this.getOperationalType(dayOfWeek)
              });

            } catch (error) {
              console.error(`❌ Error preparing schedule for ${barber.name} at ${timeSlot}:`, error.message);
            }
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (schedulesToCreate.length === 0) {
        console.log("ℹ️ No new schedules to create (all slots already exist or are in the past)");
        return 0;
      }

      console.log(`📊 Preparing to create ${schedulesToCreate.length} schedule slots across 7 days`);

      // ✅ Group by day untuk logging
      const schedulesByDay = schedulesToCreate.reduce((acc, schedule) => {
        acc[schedule.dayName] = (acc[schedule.dayName] || 0) + 1;
        return acc;
      }, {});

      console.log('📈 Schedule distribution by day:', schedulesByDay);

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
            console.log(`📝 Batch insert: ${error.result.insertedCount} created, ${error.writeErrors?.length || 0} duplicates skipped`);
          } else {
            console.error('❌ Batch insert error:', error);
            throw error;
          }
        }
      }

      console.log(`✅ Successfully generated ${created} schedules across 7 days`);
      return created;

    } catch (error) {
      console.error('❌ Error generating 7-day schedules:', error);
      throw error;
    }
  }

  // ✅ Helper functions untuk 7-day schedule
  static getDayName(dayOfWeek) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  }

  static getOperationalType(dayOfWeek) {
    switch (dayOfWeek) {
      case 0: return 'weekend_sunday';        // Minggu
      case 1: case 2: case 3: case 4: return 'weekday_regular'; // Senin-Kamis
      case 5: return 'friday_special';        // Jumat
      case 6: return 'weekend_saturday';      // Sabtu
      default: return 'unknown';
    }
  }

  // ✅ Get operating hours info untuk reference
  static getOperatingHours() {
    return {
      sunday: {
        dayName: 'Sunday',
        hours: '11:00 - 18:00, 19:00 - 23:00',
        description: 'Weekend hours - relaxed schedule',
        totalSlots: 9
      },
      monday: {
        dayName: 'Monday',
        hours: '11:00 - 18:00, 19:00 - 23:00',
        description: 'Regular weekday with lunch break',
        totalSlots: 13
      },
      tuesday: {
        dayName: 'Tuesday', 
        hours: '11:00 - 18:00, 19:00 - 23:00',
        description: 'Regular weekday with lunch break',
        totalSlots: 13
      },
      wednesday: {
        dayName: 'Wednesday',
        hours: '11:00 - 18:00, 19:00 - 23:00', 
        description: 'Regular weekday with lunch break',
        totalSlots: 13
      },
      thursday: {
        dayName: 'Thursday',
        hours: '11:00 - 18:00, 19:00 - 23:00',
        description: 'Regular weekday with lunch break', 
        totalSlots: 13
      },
      friday: {
        dayName: 'Friday',
        hours: '13:00 - 23:00',
        description: 'Friday schedule - starts after Jumah prayer',
        totalSlots: 11
      },
      saturday: {
        dayName: 'Saturday',
        hours: '10:00 - 22:00',
        description: 'Weekend hours - extended schedule',
        totalSlots: 13
      }
    };
  }

  // Auto generate schedules untuk bulan berikutnya (UPDATED untuk 7 hari)
  static async autoGenerateMonthlySchedules() {
    try {
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);

      console.log(`🗓️ Auto-generating 7-day schedules for ${nextMonth.toDateString()} to ${endOfNextMonth.toDateString()}`);

      const generated = await this.generateDefaultSchedules(nextMonth, endOfNextMonth);
      
      console.log(`✅ Auto-generated ${generated} schedules for next month (7 days a week)`);
      return generated;

    } catch (error) {
      console.error('❌ Error in auto-generating monthly schedules:', error);
      throw error;
    }
  }

  // Check dan mark expired schedules (tidak berubah)
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
      console.error('❌ Error checking expired schedules:', error);
      throw error;
    }
  }

  // Cleanup old schedules (tidak berubah)
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
      console.error('❌ Error performing schedule cleanup:', error);
      throw error;
    }
  }
}

module.exports = ScheduleService;