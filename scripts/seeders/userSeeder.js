const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import model dan config yang sudah ada
const User = require("../../app/models/User"); // Sesuai dengan nama file user.js (huruf kecil)
const connectDB = require("../../app/config/db");

const userData = [
  {
    name: "Padel Customer",
    email: "padel@test.com",
    password: "password123",
    role: "customer"
  },
  {
    name: "Jane Smith",
    email: "jane@customer.com",
    password: "password123",
    role: "customer"
  },
  {
    name: "Bob Wilson",
    email: "bob@customer.com",
    password: "password123",
    role: "customer"
  },
  {
    name: "Alice Johnson",
    email: "alice@customer.com",
    password: "password123",
    role: "customer"
  },
  {
    name: "Admin User",
    email: "admin@barbershop.com",
    password: "admin123",
    role: "admin"
  },
  {
    name: "Cashier User",
    email: "cashier@barbershop.com",
    password: "cashier123",
    role: "cashier"
  }
];

const seedUsers = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ Connected to MongoDB successfully");

    // Check if users already exist
    const existingUserCount = await User.countDocuments();
    if (existingUserCount > 0) {
      console.log(`⚠️  Users already exist in database (${existingUserCount} users)`);
      console.log("🔄 Skipping user seeding to prevent duplicates");
      console.log("💡 If you want to re-seed, clear the users collection first");
      await mongoose.connection.close();
      console.log("🔌 Database connection closed");
      return;
    }

    // Clear existing users
    const deleteResult = await User.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing users`);

    // Hash passwords and create users
    console.log("🔐 Creating users with hashed passwords...");
    
    const createdUsers = [];
    
    for (const user of userData) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);
      
      // Create user dengan User model yang sudah ada
      const newUser = new User({
        name: user.name,
        email: user.email,
        password: hashedPassword,
        role: user.role
      });
      
      const savedUser = await newUser.save();
      createdUsers.push(savedUser);
      console.log(`   ✅ Created: ${savedUser.name} (${savedUser.email}) - Role: ${savedUser.role} - UserID: ${savedUser.userId}`);
    }

    console.log(`\n🎉 Successfully seeded ${createdUsers.length} users!`);
    
    // Display login credentials
    console.log("\n🔑 Login Credentials for Testing:");
    userData.forEach((user, index) => {
      console.log(`   ${index + 1}. Email: ${user.email} | Password: ${user.password} | Role: ${user.role}`);
    });

    console.log("\n💡 You can now test login in Postman with these credentials");
    console.log("📝 Note: Each user has auto-generated userId starting with USR-");

    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding users:", error.message);
    
    if (error.code === 11000) {
      console.error("📧 Duplicate email found. Users might already exist.");
      console.log("💡 Try running the seeder again to clear and recreate users.");
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

seedUsers();