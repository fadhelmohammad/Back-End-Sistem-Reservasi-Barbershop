const mongoose = require("mongoose");

const barberSchema = new mongoose.Schema({
  barberId: {
    type: String,
    unique: true,   
  },
  name: { 
    type: String, 
    required: true,
    set: function(value) {
      return value
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        return /^(\+62|62|0)8[1-9][0-9]{6,9}$/.test(v);
      },
      message: 'Phone number must be a valid Indonesian mobile number'
    },
    set: function(value) {
      if (value.startsWith('+62')) {
        return '0' + value.slice(3);
      } else if (value.startsWith('62')) {
        return '0' + value.slice(2);
      }
      return value;
    }
  },
  photo: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

barberSchema.pre('save', async function(next) {
  if (!this.barberId) {
    const date = new Date(this.createdAt || Date.now());
    const dateStr = date.toISOString().slice(0,10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    this.barberId = `BARBER-${dateStr}-${randomNum}`;
  }
  next();
});

// ✅ Export pattern
delete mongoose.models.Barber;
module.exports = mongoose.model("Barber", barberSchema);
