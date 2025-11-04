const mongoose = require("mongoose");
const dotenv = require("dotenv");
const connectDB = require("../app/config/db");
const ScheduleService = require("../app/services/scheduleService");

dotenv.config();

const generateInitialSchedules = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ Connected to MongoDB successfully");

    // Generate schedules untuk 30 hari ke depan
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 30);

    console.log(`📅 Generating schedules from ${today.toDateString()} to ${endDate.toDateString()}`);

    const generatedCount = await ScheduleService.generateDefaultSchedules(today, endDate);

    console.log(`🎉 Successfully generated ${generatedCount} default schedules!`);
    console.log("\n📋 Schedule pattern:");
    console.log("   Monday-Thursday & Saturday-Sunday: 11:00-18:00, 19:30-23:00");
    console.log("   Friday: 13:00-23:00");
    console.log("   Interval: 30 minutes");

    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error generating initial schedules:", error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

generateInitialSchedules();