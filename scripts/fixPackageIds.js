const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import config
const connectDB = require("../app/config/db");

const fixPackageIds = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ Connected to MongoDB successfully");

    const Package = require("../app/models/Package");

    // Get all packages without sorting to see current state
    const allPackages = await Package.find({});
    console.log(`📦 Found ${allPackages.length} packages`);

    // Remove packageId temporarily to regenerate
    console.log("🔧 Fixing packageIds...");
    
    for (let i = 0; i < allPackages.length; i++) {
      const pkg = allPackages[i];
      console.log(`   Processing package ${i + 1}: ${pkg.name}`);
      
      // Remove current packageId and save (will trigger pre-save middleware)
      pkg.packageId = undefined;
      await pkg.save();
      
      console.log(`   ✅ Updated packageId to: ${pkg.packageId}`);
    }

    console.log("\n🎉 Package IDs fixed successfully!");

    // Show final state
    const updatedPackages = await Package.find({}).sort({ packageId: 1 });
    console.log("\n📋 Final package list:");
    updatedPackages.forEach(pkg => {
      console.log(`   ${pkg.packageId}: ${pkg.name}`);
    });

    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Error fixing package IDs:", error);
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

fixPackageIds();