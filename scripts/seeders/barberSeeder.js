const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const Barber = require("../../app/models/Barber");
const connectDB = require("../../app/config/db");

const seedBarbers = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ Connected to MongoDB successfully");

    const existingBarberCount = await Barber.countDocuments();
    if (existingBarberCount > 0) {
      console.log(`⚠️  Barbers already exist (${existingBarberCount} barbers)`);
      await Barber.deleteMany({});
      console.log("✅ Existing barbers cleared");
    }

    const barberData = [
      {
        name: "Ahmad Wijaya",
        photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face"
      },
      {
        name: "Budi Santoso",
        photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face"
      },
      {
        name: "Doni Pratama",
        photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=face"
      },
      {
        name: "Eko Susilo",
        photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop&crop=face"
      },
      {
        name: "Fajar Ramadan",
        photo: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=300&h=300&fit=crop&crop=face"
      }
    ];

    console.log(`🔄 Inserting ${barberData.length} barbers...`);
    
    const createdBarbers = [];
    for (let i = 0; i < barberData.length; i++) {
      const barber = new Barber(barberData[i]);
      const savedBarber = await barber.save();
      createdBarbers.push(savedBarber);
      console.log(`   ✅ Created: ${savedBarber.name} (${savedBarber.barberId})`);
    }

    console.log(`\n✅ Created ${createdBarbers.length} barbers successfully!`);

    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding barbers:", error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

console.log("🚀 Starting Barber Seeder...");
seedBarbers();