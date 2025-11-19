const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import model dan config yang sudah ada
const User = require("../../app/models/User");
const connectDB = require("../../app/config/db");

const defaultUsers = [
  {
    name: "Super Admin",
    email: "admin@barbershop.com",
    role: "admin",
    password: "admin123"
  },
  {
    name: "Admin Manager",
    email: "manager@brocode.com",
    role: "admin",
    password: "admin123"
  },
  {
    name: "Cashier One",
    email: "cashier1@barbershop.com",
    role: "cashier",
    password: "cashier123"
  },
  {
    name: "Cashier Two",
    email: "cashier2@barbershop.com",
    role: "cashier",
    password: "cashier123"
  },
  {
    name: "John Doe",
    email: "john@customer.com",
    phone: "+6281234567890",
    role: "customer",
    password: "customer123"
  },
  {
    name: "Jane Smith",
    email: "jane@customer.com",
    phone: "+6281234567891",
    role: "customer",
    password: "customer123"
  },
  {
    name: "Mike Johnson",
    email: "mike@customer.com",
    phone: "+6281234567892",
    role: "customer",
    password: "customer123"
  },
  {
    name: "Sarah Wilson",
    email: "sarah@customer.com",
    phone: "+6281234567893",
    role: "customer",
    password: "customer123"
  },
  {
    name: "David Brown",
    email: "david@customer.com",
    phone: "+6281234567894",
    role: "customer",
    password: "customer123"
  }
];

const VALID_ROLES = ["admin", "cashier", "customer"];

const validateUserData = (userData) => {
  const { name, email, role, password, phone } = userData;

  if (!name || !email || !role || !password) {
    throw new Error(`Missing required fields for user ${email || "unknown"}`);
  }

  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Invalid role "${role}". Valid roles: ${VALID_ROLES.join(", ")}`);
  }

  // Email basic format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(`Invalid email format: ${email}`);
  }

  if (password.length < 6) {
    throw new Error(`Password must be at least 6 characters for user ${email}`);
  }

  // phone required for customer
  if (role === "customer") {
    if (!phone) throw new Error(`Phone number is required for customer ${email}`);
    // simple Indonesian phone validation (08..., +628..., 628...)
    const cleaned = phone.replace(/\s+/g, "");
    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,10}$/;
    if (!phoneRegex.test(cleaned)) {
      throw new Error(`Invalid phone format for ${email}: ${phone}`);
    }
  } else {
    // warn if phone provided for admin/cashier (controllers ignore)
    if (phone) {
      console.warn(`⚠️ Phone provided for role "${role}" will be ignored for ${email}`);
    }
  }

  return true;
};

const prepareUserData = (userData) => {
  const { name, email, role, password, phone } = userData;

  const prepared = {
    name: name.trim(),
    email: email.toLowerCase().trim(),
    role,
    password
  };

  if (role === "customer" && phone) {
    prepared.phone = phone.replace(/\s+/g, "").trim();
  }

  return prepared;
};

const seedUsers = async (options = {}) => {
  try {
    const { reset = false, additionalUsers = [], skipExisting = true } = options;

    console.log("🔄 Seeding users...");

    await connectDB();

    if (reset) {
      console.log("🗑️ Resetting users collection...");
      const res = await User.deleteMany({});
      console.log(`✅ Users collection reset (${res.deletedCount} removed)`);
    }

    const usersToSeed = [...defaultUsers, ...additionalUsers];
    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    for (const raw of usersToSeed) {
      try {
        validateUserData(raw);
        const u = prepareUserData(raw);

        // build search criteria: customers by phone OR email, others by email
        const search = u.phone
          ? { $or: [{ email: u.email }, { phone: u.phone }] }
          : { email: u.email };

        const existing = await User.findOne(search);

        if (existing) {
          if (skipExisting) {
            console.log(`⚠️ Skipped existing user: ${u.email}`);
            skipped++;
            continue;
          } else {
            const hashed = await bcrypt.hash(u.password, 10);
            const updateDoc = {
              name: u.name,
              email: u.email,
              role: u.role,
              password: hashed,
              updatedAt: new Date()
            };

            if (u.phone) updateDoc.phone = u.phone;
            else updateDoc.$unset = { phone: 1 };

            await User.findByIdAndUpdate(existing._id, updateDoc, { runValidators: true });
            console.log(`🔄 Updated user: ${u.email}`);
            updated++;
            continue;
          }
        }

        // create new user
        const hashed = await bcrypt.hash(u.password, 10);
        const createDoc = {
          name: u.name,
          email: u.email,
          role: u.role,
          password: hashed
        };
        if (u.phone) createDoc.phone = u.phone;

        const createdUser = await User.create(createDoc);
        console.log(`✅ Created user: ${createdUser.email} (${createdUser.role})`);
        created++;
      } catch (err) {
        console.error(`❌ Error processing ${raw.email || "unknown"}: ${err.message}`);
        errors.push({ user: raw.email || "unknown", error: err.message });
      }
    }

    console.log("\n📊 User seeding finished:");
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    if (errors.length) {
      console.log(`   Errors: ${errors.length}`);
      errors.forEach(e => console.log(`     - ${e.user}: ${e.error}`));
    }

    // close connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("🔌 DB connection closed");
    }

    return { created, updated, skipped, errors };
  } catch (error) {
    console.error("❌ Seeding failed:", error.message || error);
    if (mongoose.connection.readyState === 1) await mongoose.connection.close();
    throw error;
  }
};

// CLI execution
if (require.main === module) {
  (async () => {
    try {
      const args = process.argv.slice(2);
      const options = {
        reset: args.includes("--reset"),
        skipExisting: !args.includes("--update")
      };

      const result = await seedUsers(options);
      console.log("\n🎉 User seeding completed");
      process.exit(0);
    } catch (err) {
      console.error("❌ Seeder exited with error");
      process.exit(1);
    }
  })();
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Process interrupted');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

module.exports = { seedUsers, defaultUsers, validateUserData, prepareUserData };