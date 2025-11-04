const mongoose = require("mongoose");
const dotenv = require("dotenv");
const connectDB = require("../app/config/db");
const ScheduleService = require("../app/services/scheduleService");

dotenv.config();

const manualCleanup = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ Connected to MongoDB successfully");

    const result = await ScheduleService.performScheduleCleanup();
    
    console.log("\n📊 Cleanup Results:");
    console.log(`   Expired: ${result.expired}`);
    console.log(`   Completed: ${result.completed}`);
    console.log(`   Deleted: ${result.deleted}`);

    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error in manual cleanup:", error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

manualCleanup();