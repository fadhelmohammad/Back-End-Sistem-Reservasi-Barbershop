const { execSync } = require('child_process');
const path = require('path');

const runSeeder = (seederName, seederPath) => {
  try {
    console.log(`\n🚀 Running ${seederName}...`);
    console.log(`📍 Path: ${seederPath}`);
    console.log('=' .repeat(50));
    
    execSync(`node "${seederPath}"`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log('=' .repeat(50));
    console.log(`✅ ${seederName} completed successfully!`);
  } catch (error) {
    console.error(`❌ ${seederName} failed:`);
    console.error(error.message);
    process.exit(1);
  }
};

const runAllSeeders = () => {
  console.log("🌱 Starting database seeding process...");
  console.log("📋 This will create sample data for testing");
  console.log("🔄 Each seeder will check for existing data first");
  console.log('=' .repeat(60));
  
  // Run seeders in order (dependencies matter)
  runSeeder("User Seeder", path.join(__dirname, "userSeeder.js"));
  runSeeder("Barber Seeder", path.join(__dirname, "barberSeeder.js"));
  runSeeder("Schedule Seeder", path.join(__dirname, "scheduleSeeder.js"));
  
  console.log("\n" + "🎉".repeat(20));
  console.log("🎉 ALL SEEDERS COMPLETED SUCCESSFULLY! 🎉");
  console.log("🎉".repeat(20));
  
  console.log("\n📋 Database Seeding Summary:");
  console.log("   👥 Users: Sample users (customers, admin, cashier)");
  console.log("   💈 Barbers: Multiple barbers available");
  console.log("   📅 Schedules: Multiple schedules for next 14 days");
  
  console.log("\n🔑 Test Login Credentials:");
  console.log("   👤 Customer: john@customer.com / password123");
  console.log("   👤 Customer: jane@customer.com / password123");
  console.log("   👨‍💼 Admin: admin@barbershop.com / admin123");
  console.log("   💰 Cashier: cashier@barbershop.com / cashier123");
  
  console.log("\n🚀 Next Steps:");
  console.log("   1. Start your server: npm start");
  console.log("   2. Test login in Postman");
  console.log("   3. Get available schedules: GET /api/schedules/available");
  console.log("   4. Create reservations: POST /api/reservations");
  
  console.log("\n💡 Happy Testing! 🧪");
};

runAllSeeders();