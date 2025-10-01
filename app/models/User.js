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

module.exports = mongoose.model("User", userSchema);