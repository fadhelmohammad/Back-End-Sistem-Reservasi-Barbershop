const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const User = require("../app/models/User");
const Barber = require("../app/models/Barber");
const Schedule = require("../app/models/Schedule");
const connectDB = require("../app/config/db");
//
const viewAllData = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ Connected to MongoDB successfully\n");

    // Count documents
    const userCount = await User.countDocuments();
    const barberCount = await Barber.countDocuments();
    const scheduleCount = await Schedule.countDocuments();

    console.log("📊 DATABASE OVERVIEW:");
    console.log(`   👥 Users: ${userCount}`);
    console.log(`   💈 Barbers: ${barberCount}`);
    console.log(`   📅 Schedules: ${scheduleCount}\n`);

    // Show Users
    console.log("👥 USERS:");
    console.log("=" .repeat(50));
    const users = await User.find().select('userId name email role');
    users.forEach(user => {
      console.log(`   📋 ${user.name} | ${user.email} | ${user.role} | ID: ${user.userId}`);
    });

    // Show Barbers
    console.log("\n💈 BARBERS:");
    console.log("=" .repeat(50));
    const barbers = await Barber.find().select('barberId name email isActive');
    barbers.forEach(barber => {
      console.log(`   ✂️  ${barber.name} | ${barber.email} | Active: ${barber.isActive} | ID: ${barber.barberId}`);
    });

    // Show Schedules (sample)
    console.log("\n📅 SCHEDULES (First 10):");
    console.log("=" .repeat(50));
    const schedules = await Schedule.find()
      .populate('barber', 'name')
      .limit(10)
      .select('scheduleId date scheduled_time isAvailable barber');
    
    schedules.forEach(schedule => {
      const date = schedule.scheduled_time.toLocaleDateString();
      const time = schedule.scheduled_time.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      console.log(`   📆 ${date} ${time} | ${schedule.barber.name} | Available: ${schedule.isAvailable} | ID: ${schedule.scheduleId}`);
    });

    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  } catch (error) {
    console.error("❌ Error viewing data:", error.message);
    process.exit(1);
  }
};

viewAllData();