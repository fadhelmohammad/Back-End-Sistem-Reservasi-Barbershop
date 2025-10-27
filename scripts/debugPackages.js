const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();
const connectDB = require("../app/config/db");

const debugPackages = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ Connected to MongoDB successfully");

    // Check if packages collection exists
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const packageCollection = collections.find(c => c.name === 'packages');
    
    console.log("📋 Available collections:", collections.map(c => c.name));
    console.log("📦 Packages collection exists:", !!packageCollection);

    if (packageCollection) {
      // Count documents directly
      const directCount = await db.collection('packages').countDocuments();
      console.log("📊 Direct count from packages collection:", directCount);
      
      const activeCount = await db.collection('packages').countDocuments({ isActive: true });
      console.log("📊 Active packages count:", activeCount);
      
      // List all packages
      const allPackages = await db.collection('packages').find({}).toArray();
      console.log("📋 All packages:");
      allPackages.forEach(pkg => {
        console.log(`   - ${pkg.packageId}: ${pkg.name} (Active: ${pkg.isActive})`);
      });
    }

    // Test with model
    try {
      const Package = require("../app/models/Package");
      const modelCount = await Package.countDocuments();
      const modelActiveCount = await Package.countDocuments({ isActive: true });
      
      console.log("📊 Model count (total):", modelCount);
      console.log("📊 Model count (active):", modelActiveCount);
      
    } catch (error) {
      console.error("❌ Error with Package model:", error.message);
    }

    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Error:", error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

debugPackages();