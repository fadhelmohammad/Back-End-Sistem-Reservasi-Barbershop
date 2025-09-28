const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import model dan config yang sudah ada
const Package = require("../../app/models/Package");
const connectDB = require("../../app/config/db");

const seedPackages = async () => {
  try {
    console.log("🔄 Connecting to MongoDB Atlas...");
    await connectDB();
    console.log("✅ Connected to MongoDB Atlas successfully");

    // Check if packages already exist
    const existingPackageCount = await Package.countDocuments();
    if (existingPackageCount > 0) {
      console.log(`⚠️  Packages already exist in database (${existingPackageCount} packages)`);
      console.log("🔄 Clearing existing packages and re-seeding...");
      await Package.deleteMany({});
      console.log("✅ Existing packages cleared");
    }

    console.log("📦 Creating service packages...");

    const packageData = [
      {
        name: "Paket Basic",
        price: 25000,
        description: "Potong rambut standar dengan styling sederhana. Cocok untuk tampilan sehari-hari yang rapi dan fresh.",
        isActive: true
      },
      {
        name: "Paket Premium",
        price: 50000,
        description: "Potong rambut + keramas + styling premium. Termasuk konsultasi gaya rambut dan perawatan dasar.",
        isActive: true
      },
      {
        name: "Paket Deluxe",
        price: 75000,
        description: "Paket lengkap dengan potong rambut, keramas, styling, creambath ringan, dan facial cleansing.",
        isActive: true
      },
      {
        name: "Paket Executive",
        price: 100000,
        description: "Paket premium dengan potong rambut, keramas, styling, creambath, facial treatment, dan head massage.",
        isActive: true
      },
      {
        name: "Paket Beard Grooming",
        price: 35000,
        description: "Perawatan khusus jenggot dan kumis. Termasuk trimming, shaping, dan styling beard profesional.",
        isActive: true
      },
      {
        name: "Paket Wedding",
        price: 150000,
        description: "Paket spesial untuk pengantin pria. Potong rambut, styling, facial treatment, dan grooming lengkap.",
        isActive: true
      },
      {
        name: "Paket Kids",
        price: 20000,
        description: "Paket khusus anak-anak dengan pendekatan ramah anak dan potongan rambut yang trendy.",
        isActive: true
      },
      {
        name: "Paket Student",
        price: 15000,
        description: "Paket hemat untuk pelajar dan mahasiswa. Potong rambut rapi dengan harga terjangkau.",
        isActive: true
      }
    ];

    console.log(`🔄 Inserting ${packageData.length} packages...`);
    
    // Insert satu per satu untuk avoid duplicate key error
    const createdPackages = [];
    for (let i = 0; i < packageData.length; i++) {
      const pkg = new Package(packageData[i]);
      const savedPkg = await pkg.save();
      createdPackages.push(savedPkg);
      console.log(`   ✅ Created: ${savedPkg.name} (${savedPkg.packageId})`);
    }

    console.log(`\n✅ Created ${createdPackages.length} packages successfully!`);
    
    console.log("\n📊 Package Summary:");
    console.log("┌─────────────────────────────────────────────────────────────────────────────┐");
    console.log("│                           BARBERSHOP SERVICE PACKAGES                          │");
    console.log("├─────────────────────────────────────────────────────────────────────────────┤");
    
    createdPackages.forEach((pkg, index) => {
      const paddedName = pkg.name.padEnd(20);
      const formattedPrice = `Rp ${pkg.price.toLocaleString('id-ID')}`.padStart(12);
      const paddedId = pkg.packageId.padEnd(8);
      
      console.log(`│ ${(index + 1).toString().padStart(2)}. ${paddedName} │ ${formattedPrice} │ ${paddedId} │`);
    });
    
    console.log("└─────────────────────────────────────────────────────────────────────────────┘");

    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding packages:", error.message);
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

console.log("🚀 Starting Package Seeder...");
seedPackages();