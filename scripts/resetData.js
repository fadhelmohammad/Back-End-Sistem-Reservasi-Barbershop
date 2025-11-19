const mongoose = require('mongoose');
const readline = require('readline');

// Import models
const User = require('../app/models/User');
const Barber = require('../app/models/Barber');
const Package = require('../app/models/Package');
const Schedule = require('../app/models/Schedule');
const Reservation = require('../app/models/Reservation');
const { Payment, PaymentOption } = require('../app/models/Payment');

// Load environment variables
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected for reset');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const askConfirmation = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
};

const resetDatabase = async () => {
  try {
    console.log('🔥 DATABASE RESET UTILITY');
    console.log('⚠️  WARNING: This will permanently delete ALL data from your database!');
    console.log('\nThis will delete:');
    console.log('   - All Users (admins, cashiers, customers)');
    console.log('   - All Barbers');
    console.log('   - All Packages');
    console.log('   - All Schedules');
    console.log('   - All Reservations');
    console.log('   - All Payments');
    console.log('   - All Payment Options');

    const confirmed = await askConfirmation('\nAre you sure you want to continue? (yes/no): ');
    
    if (!confirmed) {
      console.log('❌ Reset cancelled by user');
      rl.close();
      process.exit(0);
    }

    const doubleConfirmed = await askConfirmation('\nThis action cannot be undone! Type "yes" to confirm: ');
    
    if (!doubleConfirmed) {
      console.log('❌ Reset cancelled by user');
      rl.close();
      process.exit(0);
    }

    console.log('\n🔄 Starting database reset...\n');

    await connectDB();

    // Get counts before deletion
    const counts = {
      users: await User.countDocuments(),
      barbers: await Barber.countDocuments(),
      packages: await Package.countDocuments(),
      schedules: await Schedule.countDocuments(),
      reservations: await Reservation.countDocuments(),
      payments: await Payment.countDocuments(),
      paymentOptions: await PaymentOption.countDocuments()
    };

    console.log('📊 Current database state:');
    Object.entries(counts).forEach(([collection, count]) => {
      console.log(`   - ${collection}: ${count} documents`);
    });

    // Delete all collections
    console.log('\n🗑️  Deleting collections...');

    // Order matters due to references
    await Payment.deleteMany({});
    console.log('   ✅ Payments deleted');

    await Reservation.deleteMany({});
    console.log('   ✅ Reservations deleted');

    await Schedule.deleteMany({});
    console.log('   ✅ Schedules deleted');

    await PaymentOption.deleteMany({});
    console.log('   ✅ Payment Options deleted');

    await Package.deleteMany({});
    console.log('   ✅ Packages deleted');

    await Barber.deleteMany({});
    console.log('   ✅ Barbers deleted');

    await User.deleteMany({});
    console.log('   ✅ Users deleted');

    // Verify deletion
    const finalCounts = {
      users: await User.countDocuments(),
      barbers: await Barber.countDocuments(),
      packages: await Package.countDocuments(),
      schedules: await Schedule.countDocuments(),
      reservations: await Reservation.countDocuments(),
      payments: await Payment.countDocuments(),
      paymentOptions: await PaymentOption.countDocuments()
    };

    console.log('\n📊 Final database state:');
    Object.entries(finalCounts).forEach(([collection, count]) => {
      console.log(`   - ${collection}: ${count} documents`);
    });

    const allEmpty = Object.values(finalCounts).every(count => count === 0);

    if (allEmpty) {
      console.log('\n🎉 Database reset completed successfully!');
      console.log('✅ All collections are now empty');
      
      const runSeeder = await askConfirmation('\nWould you like to run the seeder to populate with fresh data? (yes/no): ');
      
      if (runSeeder) {
        console.log('\n🌱 Running seeder...');
        const { runSeeders } = require('./seeders/index');
        await runSeeders();
        return;
      }
    } else {
      console.log('\n⚠️  Warning: Some documents might still exist');
      console.log('   Please check your database manually');
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Reset failed:', error.message);
    await mongoose.connection.close();
    rl.close();
    process.exit(1);
  }
};

// Handle Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n\n❌ Reset cancelled by user');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  rl.close();
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  resetDatabase();
}

module.exports = { resetDatabase };