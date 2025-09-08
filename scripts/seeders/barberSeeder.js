const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import model dan config yang sudah ada
const Barber = require("../../app/models/Barber");
const connectDB = require("../../app/config/db");

const barberData = [
  {
    name: "Mike Barberson",
    email: "mike@barbershop.com",
    phone: "081234567801"
  },
  {
    name: "Tony Scissors",
    email: "tony@barbershop.com",
    phone: "081234567802"
  },
  {
    name: "Alex Clipper",
    email: "alex@barbershop.com",
    phone: "081234567803"
  },
  {
    name: "Sam Razor",
    email: "sam@barbershop.com",
    phone: "081234567804"
  },
  {
    name: "David Trim",
    email: "david@barbershop.com",
    phone: "081234567805"
  }
];

const seedBarbers = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ Connected to MongoDB successfully");

    // Check if barbers already exist
    const existingBarberCount = await Barber.countDocuments();
    if (existingBarberCount > 0) {
      console.log(`⚠️  Barbers already exist in database (${existingBarberCount} barbers)`);
      console.log("🔄 Skipping barber seeding to prevent duplicates");
      console.log("💡 If you want to re-seed, clear the barbers collection first");
      await mongoose.connection.close();
      console.log("🔌 Database connection closed");
      return;
    }

    // Clear existing barbers
    const deleteResult = await Barber.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing barbers`);

    // Create barbers
    console.log("💈 Creating barbers...");
    
    const createdBarbers = [];
    
    for (const barber of barberData) {
      const newBarber = new Barber(barber);
      const savedBarber = await newBarber.save();
      createdBarbers.push(savedBarber);
      console.log(`   ✅ Created: ${savedBarber.name} (${savedBarber.email}) - BarberID: ${savedBarber.barberId}`);
    }

    console.log(`\n🎉 Successfully seeded ${createdBarbers.length} barbers!`);
    
    // Display barber info
    console.log("\n💈 Barber Information:");
    createdBarbers.forEach((barber, index) => {
      console.log(`   ${index + 1}. ${barber.name} - ${barber.email} - ID: ${barber._id}`);
    });

    console.log("\n💡 You can now use these barber IDs to create schedules");

    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding barbers:", error.message);
    
    if (error.code === 11000) {
      console.error("📧 Duplicate email found. Barbers might already exist.");
      console.log("💡 Try running the seeder again to clear and recreate barbers.");
    }
    
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

seedBarbers();