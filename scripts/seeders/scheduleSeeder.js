const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Schedule = require("../../app/models/Schedule");
const Barber = require("../../app/models/Barber");
const connectDB = require("../../app/config/db");

// Generate time slots based on day of week (UPDATED untuk interval 1 jam)
const getTimeSlots = (dayOfWeek) => {
  const timeSlots = [];
  
  if (dayOfWeek === 5) { // Friday
    // Jumat: 13:00 - 23:00 (1 jam interval)
    for (let hour = 13; hour <= 23; hour++) {
      timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
  } else {
    // Hari lain: 11:00 - 18:00, break, 19:00 - 23:00 (1 jam interval)
    // Morning session: 11:00 - 18:00
    for (let hour = 11; hour <= 18; hour++) {
      timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    
    // Evening session: 19:00 - 23:00 (menghilangkan 19:30, langsung 19:00)
    for (let hour = 19; hour <= 23; hour++) {
      timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
  }
  
  return timeSlots;
};

const seedSchedules = async (options = {}) => {
  try {
    const { reset = false, daysAhead = 14 } = options;

    console.log("🔄 Seeding schedules...");
    
    await connectDB();

    if (reset) {
      console.log("🗑️ Resetting schedules collection...");
      const deleteResult = await Schedule.deleteMany({});
      console.log(`✅ Schedules collection reset - ${deleteResult.deletedCount} schedules removed`);
    }

    // Get all active barbers
    const barbers = await Barber.find({ isActive: true });
    if (barbers.length === 0) {
      console.log("⚠️ No active barbers found. Please seed barbers first.");
      return { created: 0, errors: [] };
    }

    console.log(`📋 Found ${barbers.length} active barbers`);

    const schedulesToCreate = [];
    const today = new Date();
    
    // Generate schedules for next X days
    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
      const scheduleDate = new Date(today);
      scheduleDate.setDate(today.getDate() + dayOffset);
      scheduleDate.setHours(0, 0, 0, 0);
      
      const dayOfWeek = scheduleDate.getDay();
      
      // Skip Sundays
      if (dayOfWeek === 0) continue;

      const timeSlots = getTimeSlots(dayOfWeek);

      for (const barber of barbers) {
        for (const timeSlot of timeSlots) {
          try {
            // Check if schedule already exists
            const existingSchedule = await Schedule.findOne({
              barber: barber._id,
              date: scheduleDate,
              timeSlot: timeSlot
            });

            if (existingSchedule) {
              continue; // Skip if exists
            }

            // Parse time slot untuk create scheduled_time
            const [hours, minutes] = timeSlot.split(':').map(Number);
            const scheduledTime = new Date(scheduleDate);
            scheduledTime.setHours(hours, minutes, 0, 0);
            
            // Skip past times
            if (scheduledTime <= new Date()) {
              continue;
            }

            schedulesToCreate.push({
              barber: barber._id,
              date: scheduleDate,
              timeSlot: timeSlot,
              scheduled_time: scheduledTime,
              status: "available",
              isDefaultSlot: true,
              dayOfWeek: dayOfWeek
            });

          } catch (error) {
            console.error(`❌ Error preparing schedule for ${barber.name} at ${timeSlot}:`, error.message);
          }
        }
      }
    }

    if (schedulesToCreate.length === 0) {
      console.log("ℹ️ No new schedules to create");
      await mongoose.connection.close();
      return { created: 0, errors: [] };
    }

    console.log(`📝 Creating ${schedulesToCreate.length} schedules...`);

    // Insert with error handling
    let created = 0;
    const errors = [];

    try {
      const result = await Schedule.insertMany(schedulesToCreate, { 
        ordered: false,
        rawResult: true 
      });
      created = result.insertedCount || schedulesToCreate.length;
      console.log(`✅ Successfully created ${created} schedules`);
    } catch (error) {
      if (error.name === 'MongoBulkWriteError') {
        created = error.result.insertedCount || 0;
        const writeErrors = error.writeErrors || [];
        
        console.log(`✅ Created ${created} schedules`);
        console.log(`❌ Failed to create ${writeErrors.length} schedules (likely duplicates)`);
        
        writeErrors.forEach((err, index) => {
          errors.push({
            index,
            error: err.errmsg || err.message
          });
        });
      } else {
        throw error;
      }
    }

    console.log("\n📊 Schedule seeding summary:");
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ❌ Errors: ${errors.length}`);
    
    // Show statistics
    const totalSchedules = await Schedule.countDocuments();
    console.log(`\n📈 Total schedules in database: ${totalSchedules}`);

    await mongoose.connection.close();
    console.log("🔌 Database connection closed");

    return { created, errors };

  } catch (error) {
    console.error("❌ Error seeding schedules:", error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    throw error;
  }
};

// CLI execution
if (require.main === module) {
  (async () => {
    try {
      const args = process.argv.slice(2);
      const options = {
        reset: args.includes('--reset'),
        daysAhead: args.includes('--days') ? parseInt(args[args.indexOf('--days') + 1]) || 14 : 14
      };

      if (args.includes('--help')) {
        console.log("\n📖 Usage:");
        console.log("   node scheduleSeeder.js [options]");
        console.log("\n🔧 Options:");
        console.log("   --reset        Delete all existing schedules before seeding");
        console.log("   --days N       Generate schedules for N days ahead (default: 14)");
        console.log("   --help         Show this help message");
        process.exit(0);
      }

      const result = await seedSchedules(options);
      console.log("\n🎉 Schedule seeding completed!");
      
      process.exit(0);
    } catch (error) {
      console.error("❌ Schedule seeding failed:", error.message);
      process.exit(1);
    }
  })();
}

process.on('SIGINT', async () => {
  console.log('\n🛑 Process interrupted');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

module.exports = { seedSchedules };