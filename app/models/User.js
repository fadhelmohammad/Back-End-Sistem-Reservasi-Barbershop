const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,   
  },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
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