const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,   
  },
  name: { 
    type: String, 
    required: true,
    set: function(value) {
      // Convert to title case (huruf kapital di awal setiap kata)
      return value
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true, // Otomatis convert ke lowercase
    trim: true // Hapus spasi di awal dan akhir
  },
  phone: {
    type: String,
    required: function() {
      // Phone hanya required untuk customer
      return this.role === 'customer';
    },
    unique: true,
    sparse: true, // Allow multiple null values
    validate: {
      validator: function(v) {
        // Skip validation if phone is not provided (for cashier/admin)
        if (!v) return true;
        // Validasi format nomor HP Indonesia
        return /^(\+62|62|0)8[1-9][0-9]{6,9}$/.test(v);
      },
      message: 'Phone number must be a valid Indonesian mobile number'
    },
    set: function(value) {
      // Skip transformation if no value
      if (!value) return value;
      // Normalize nomor HP ke format standar (08xxxxxxxxxx)
      if (value.startsWith('+62')) {
        return '0' + value.slice(3);
      } else if (value.startsWith('62')) {
        return '0' + value.slice(2);
      }
      return value;
    }
  },
  password: { type: String, required: true },
  role: { type: String, enum: ["customer", "admin", "cashier"], default: "customer" },
}, { timestamps: true });

// Pre-save middleware untuk generate userId
userSchema.pre('save', async function(next) {
  if (!this.userId) {
    const date = new Date(this.createdAt || Date.now());
    const dateStr = date.toISOString().slice(0,10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    this.userId = `USR-${dateStr}-${randomNum}`;
  }
  next();
});

// ✅ Export pattern
delete mongoose.models.User; // Clear cache
module.exports = mongoose.model("User", userSchema);