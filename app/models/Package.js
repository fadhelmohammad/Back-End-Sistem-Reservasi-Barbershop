const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema({
  packageId: {
    type: String,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    set: function(value) {
      return value
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  },
  price: {
    type: Number,
    required: true,
    min: [1, 'Price must be greater than 0']
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true 
});

// pre-save tetap sama
packageSchema.pre('save', async function(next) {
  if (!this.packageId) {
    let maxRetries = 10;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        const lastPackage = await this.constructor
          .findOne({}, {}, { sort: { 'packageId': -1 } });
        
        let nextNumber = 1;
        if (lastPackage && lastPackage.packageId) {
          const lastNumber = parseInt(lastPackage.packageId.replace('PKG', ''));
          nextNumber = lastNumber + 1;
        }
        
        const newPackageId = `PKG${String(nextNumber).padStart(3, '0')}`;
        
        const existingPackage = await this.constructor.findOne({ packageId: newPackageId });
        
        if (!existingPackage) {
          this.packageId = newPackageId;
          break;
        }
        
        attempt++;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          return next(error);
        }
        attempt++;
      }
    }
    
    if (attempt === maxRetries) {
      return next(new Error('Unable to generate unique packageId after multiple attempts'));
    }
  }
  next();
});

// FIX
module.exports = mongoose.models.Package ||
mongoose.model("Package", packageSchema);
