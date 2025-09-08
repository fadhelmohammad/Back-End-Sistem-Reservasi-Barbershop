const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import model dan config yang sudah ada
const Schedule = require("../../app/models/Schedule");
const Barber = require("../../app/models/Barber");
const connectDB = require("../../app/config/db");

const seedSchedules = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ Connected to MongoDB successfully");

    // Check if schedules already exist
    const existingScheduleCount = await Schedule.countDocuments();
    if (existingScheduleCount > 0) {
      console.log(`⚠️  Schedules already exist in database (${existingScheduleCount} schedules)`);
      console.log("🔄 Skipping schedule seeding to prevent duplicates");
      console.log("💡 If you want to re-seed, clear the schedules collection first");
      await mongoose.connection.close();
      console.log("🔌 Database connection closed");
      return;
    }

    // Get all barbers
    const barbers = await Barber.find({ isActive: true });
    
    if (barbers.length === 0) {
      console.log("❌ No barbers found. Please run barber seeder first:");
      console.log("   npm run seed:barbers");
      process.exit(1);
    }

    console.log(`📋 Found ${barbers.length} active barbers`);

    const scheduleData = [];
    const today = new Date();
    
    // Create schedules for next 14 days
    console.log("📅 Creating schedules for next 14 days...");
    
    for (let day = 1; day <= 14; day++) {
      const scheduleDate = new Date(today);
      scheduleDate.setDate(today.getDate() + day);
      
      // Skip Sundays (day 0)
      if (scheduleDate.getDay() === 0) {
        console.log(`   ⏭️  Skipping Sunday: ${scheduleDate.toDateString()}`);
        continue;
      }
      
      // Create schedules for each barber
      for (const barber of barbers) {
        // Morning slots: 09:00, 10:00, 11:00
        for (let hour = 9; hour <= 11; hour++) {
          const scheduleTime = new Date(scheduleDate);
          scheduleTime.setHours(hour, 0, 0, 0);
          
          const scheduleId = `SCH-${scheduleDate.toISOString().slice(0, 10).replace(/-/g, '')}-${barber._id.toString().slice(-4)}-${hour.toString().padStart(2, '0')}00`;
          const schedule = {
            scheduleId: scheduleId,
            barber: barber._id,
            date: scheduleDate,
            scheduled_time: scheduleTime,
            isAvailable: true
          };
          
          scheduleData.push(schedule);
        }
        
        // Afternoon slots: 13:00, 14:00, 15:00, 16:00, 17:00
        for (let hour = 13; hour <= 17; hour++) {
          const scheduleTime = new Date(scheduleDate);
          scheduleTime.setHours(hour, 0, 0, 0);
          
          const scheduleId = `SCH-${scheduleDate.toISOString().slice(0, 10).replace(/-/g, '')}-${barber._id.toString().slice(-4)}-${hour.toString().padStart(2, '0')}00`;
          const schedule = {
            scheduleId: scheduleId,
            barber: barber._id,
            date: scheduleDate,
            scheduled_time: scheduleTime,
            isAvailable: true
          };
          
          scheduleData.push(schedule);
        }
      }
    }

    // Insert schedules in batches
    console.log(`🔄 Inserting ${scheduleData.length} schedules...`);
    const createdSchedules = await Schedule.insertMany(scheduleData);
    
    // Populate barber data
    await Schedule.populate(createdSchedules, { 
      path: 'barber', 
      select: 'name barberId email' 
    });
    
    console.log(`✅ Created ${createdSchedules.length} schedules successfully!`);
    
    // Group schedules by date for display
    const groupedSchedules = {};
    createdSchedules.forEach(schedule => {
      const date = schedule.scheduled_time.toISOString().split('T')[0];
      if (!groupedSchedules[date]) {
        groupedSchedules[date] = 0;
      }
      groupedSchedules[date]++;
    });

    console.log("\n📊 Schedule Summary by Date:");
    Object.keys(groupedSchedules).sort().forEach(date => {
      const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
      console.log(`   📆 ${date} (${dayName}): ${groupedSchedules[date]} slots`);
    });

    console.log(`\n💈 Schedules per Barber: ${scheduleData.length / barbers.length} slots each`);
    console.log("⏰ Time slots: 09:00, 10:00, 11:00, 13:00, 14:00, 15:00, 16:00, 17:00");
    console.log("\n💡 You can now create reservations using these schedule IDs");

    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding schedules:", error.message);
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Process interrupted');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

seedSchedules();