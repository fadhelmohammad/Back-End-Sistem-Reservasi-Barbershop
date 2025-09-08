const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import config
const connectDB = require("../app/config/db");

const resetData = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    
    // Connect using existing config
    await connectDB();
    console.log("✅ Connected to MongoDB successfully");

    // Get database instance
    const db = mongoose.connection.db;

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log("📋 Found collections:", collections.map(c => c.name));

    // Reset each collection
    const collectionsToReset = ['users', 'barbers', 'schedules', 'reservations'];
    
    console.log("\n🗑️  Resetting collections...");
    
    for (const collectionName of collectionsToReset) {
      try {
        const result = await db.collection(collectionName).deleteMany({});
        console.log(`   ✅ ${collectionName}: deleted ${result.deletedCount} documents`);
      } catch (error) {
        console.log(`   ⚠️  ${collectionName}: collection might not exist`);
      }
    }

    console.log("\n🎉 Data reset completed!");
    console.log("💡 You can now run seeders to create fresh test data:");
    console.log("   npm run seed:all");

    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting data:", error);
    
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

resetData();