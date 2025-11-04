const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import config
const connectDB = require("../app/config/db");

class DataResetter {
  constructor() {
    this.defaultCollections = ['users', 'barbers', 'schedules', 'reservations'];
  }

  async connect() {
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ Connected to MongoDB successfully");
  }

  async disconnect() {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("🔌 Database connection closed");
    }
  }

  async listCollections() {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    return collections.map(c => c.name);
  }

  async resetCollection(collectionName) {
    try {
      const db = mongoose.connection.db;
      const result = await db.collection(collectionName).deleteMany({});
      console.log(`   ✅ ${collectionName}: deleted ${result.deletedCount} documents`);
      return { success: true, deletedCount: result.deletedCount };
    } catch (error) {
      console.log(`   ⚠️  ${collectionName}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async resetCollections(collections = null) {
    const collectionsToReset = collections || this.defaultCollections;
    
    console.log("\n🗑️  Resetting collections...");
    
    const results = {};
    for (const collectionName of collectionsToReset) {
      results[collectionName] = await this.resetCollection(collectionName);
    }
    
    return results;
  }

  async resetAllCollections() {
    try {
      const allCollections = await this.listCollections();
      console.log("📋 Found collections:", allCollections);
      
      // Filter out system collections
      const userCollections = allCollections.filter(name => 
        !name.startsWith('system.') && 
        !name.includes('__schema__')
      );
      
      return await this.resetCollections(userCollections);
    } catch (error) {
      throw new Error(`Failed to reset all collections: ${error.message}`);
    }
  }

  async execute(options = {}) {
    try {
      await this.connect();
      
      let results;
      if (options.all) {
        results = await this.resetAllCollections();
      } else if (options.collections) {
        results = await this.resetCollections(options.collections);
      } else {
        results = await this.resetCollections();
      }

      console.log("\n🎉 Data reset completed!");
      console.log("💡 You can now run seeders to create fresh test data:");
      console.log("   npm run seed:all");

      await this.disconnect();
      return results;
    } catch (error) {
      console.error("❌ Error resetting data:", error);
      await this.disconnect();
      throw error;
    }
  }
}

const resetData = async (options = {}) => {
  const resetter = new DataResetter();
  return await resetter.execute(options);
};

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  if (args.includes('--all')) {
    options.all = true;
  }
  
  if (args.includes('--collections')) {
    const collectionsIndex = args.indexOf('--collections');
    if (collectionsIndex !== -1 && args[collectionsIndex + 1]) {
      options.collections = args[collectionsIndex + 1].split(',');
    }
  }

  // Handle process termination
  process.on('SIGINT', async () => {
    console.log('\n🛑 Process interrupted');
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(0);
  });

  resetData(options)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { DataResetter, resetData };