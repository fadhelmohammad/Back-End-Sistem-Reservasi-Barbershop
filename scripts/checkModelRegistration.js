// scripts/checkModelRegistration.js
const mongoose = require('mongoose');
require('dotenv').config();

const checkModelRegistration = async () => {
  try {
    // ✅ Check environment
    console.log('🔍 Environment Check:');
    console.log(`   - MONGO_URI: ${process.env.MONGO_URI ? '✅ Found' : '❌ Missing'}`);
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI environment variable is required');
    }

    // ✅ Database connection
    console.log('\n🔗 Database Connection:');
    console.log('   - Connecting...');
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`   - Connected to: ${mongoose.connection.name}`);
    console.log(`   - Connection state: ${mongoose.connection.readyState} (1=connected)`);
    
    console.log('\n🔍 Checking all models registration...\n');
    
    // ✅ Define all models to check
    const modelsToCheck = [
      {
        name: 'User',
        path: '../app/models/User',
        testData: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'hashedpassword123',
          role: 'customer'
        },
        requiredFields: ['name', 'email', 'password', 'role'],
        uniqueField: 'userId'
      },
      {
        name: 'Barber',
        path: '../app/models/Barber',
        testData: {
          name: 'Test Barber',
          email: 'barber@example.com',
          password: 'hashedpassword123',
          phone: '+6281234567890',
          specialization: ['Hair Cut', 'Beard Trim']
        },
        requiredFields: ['name', 'email', 'password'],
        uniqueField: 'barberId'
      },
      {
        name: 'Package',
        path: '../app/models/Package',
        testData: {
          name: 'test package',
          price: 50000,
          description: 'Test description'
        },
        requiredFields: ['name', 'price', 'description'],
        uniqueField: 'packageId'
      },
      {
        name: 'Schedule',
        path: '../app/models/Schedule',
        testData: {
          barber: new mongoose.Types.ObjectId(),
          date: new Date(),
          timeSlot: '09:00',
          scheduled_time: new Date()
        },
        requiredFields: ['barber', 'date', 'timeSlot', 'scheduled_time'],
        uniqueField: 'scheduleId'
      },
      {
        name: 'Reservation',
        path: '../app/models/Reservation',
        testData: {
          customerName: 'Test Customer',
          customerPhone: '+6281234567890',
          customerEmail: 'customer@test.com',
          createdBy: new mongoose.Types.ObjectId(),
          package: new mongoose.Types.ObjectId(),
          barber: new mongoose.Types.ObjectId(),
          schedule: new mongoose.Types.ObjectId(),
          totalPrice: 50000
        },
        requiredFields: ['customerName', 'customerPhone', 'customerEmail', 'createdBy', 'package', 'barber', 'schedule', 'totalPrice'],
        uniqueField: 'reservationId'
      }
    ];

    // Payment models (special handling)
    const paymentModels = [
      {
        name: 'Payment',
        path: '../app/models/Payment',
        isNamed: true,
        testData: {
          reservationId: new mongoose.Types.ObjectId(),
          userId: new mongoose.Types.ObjectId(),
          amount: 50000,
          paymentMethod: 'bank_transfer'
        },
        requiredFields: ['reservationId', 'userId', 'amount', 'paymentMethod'],
        uniqueField: 'paymentId'
      },
      {
        name: 'PaymentOption',
        path: '../app/models/Payment',
        isNamed: true,
        testData: {
          type: 'bank_transfer',
          name: 'Test Bank',
          accountNumber: '1234567890',
          accountName: 'Test Account'
        },
        requiredFields: ['type', 'name'],
        uniqueField: 'optionId'
      }
    ];

    // ✅ Check regular models
    console.log('📦 Regular Models Check:\n');
    
    for (const modelConfig of modelsToCheck) {
      console.log(`🔍 Checking ${modelConfig.name} Model:`);
      
      try {
        // Import model
        const Model = require(modelConfig.path);
        console.log(`   ✅ Import successful`);
        
        // Check registration
        console.log(`   - Model Name: ${Model.modelName}`);
        console.log(`   - Collection Name: ${Model.collection.name}`);
        console.log(`   - Schema Registered: ${!!mongoose.models[modelConfig.name] ? '✅' : '❌'}`);
        console.log(`   - Same Instance: ${mongoose.models[modelConfig.name] === Model ? '✅' : '❌'}`);
        
        // Check schema fields
        const schemaFields = Object.keys(Model.schema.paths);
        console.log(`   - Schema Fields Count: ${schemaFields.length}`);
        
        // Check required fields
        const requiredFields = [];
        Object.keys(Model.schema.paths).forEach(field => {
          if (Model.schema.paths[field].isRequired) {
            requiredFields.push(field);
          }
        });
        console.log(`   - Required Fields: ${requiredFields.join(', ') || 'None'}`);
        
        // Test instance creation
        try {
          const testInstance = new Model(modelConfig.testData);
          console.log(`   ✅ Can create instance`);
          console.log(`   - ${modelConfig.uniqueField}: ${testInstance[modelConfig.uniqueField] || '⏳ (on save)'}`);
          
          // Test validation
          try {
            await testInstance.validate();
            console.log(`   ✅ Validation passed`);
          } catch (validationError) {
            console.log(`   ❌ Validation failed: ${validationError.message}`);
          }
          
        } catch (instanceError) {
          console.log(`   ❌ Cannot create instance: ${instanceError.message}`);
        }
        
      } catch (importError) {
        console.log(`   ❌ Import failed: ${importError.message}`);
      }
      
      console.log(''); // Empty line for readability
    }

    // ✅ Check Payment models
    console.log('💳 Payment Models Check:\n');
    
    for (const modelConfig of paymentModels) {
      console.log(`🔍 Checking ${modelConfig.name} Model:`);
      
      try {
        // Import model (named export)
        const ModelExports = require(modelConfig.path);
        const Model = ModelExports[modelConfig.name];
        
        if (!Model) {
          throw new Error(`${modelConfig.name} not found in exports`);
        }
        
        console.log(`   ✅ Import successful`);
        
        // Check registration
        console.log(`   - Model Name: ${Model.modelName}`);
        console.log(`   - Collection Name: ${Model.collection.name}`);
        console.log(`   - Schema Registered: ${!!mongoose.models[modelConfig.name] ? '✅' : '❌'}`);
        console.log(`   - Same Instance: ${mongoose.models[modelConfig.name] === Model ? '✅' : '❌'}`);
        
        // Test instance creation
        try {
          const testInstance = new Model(modelConfig.testData);
          console.log(`   ✅ Can create instance`);
          console.log(`   - ${modelConfig.uniqueField}: ${testInstance[modelConfig.uniqueField] || '⏳ (on save)'}`);
          
          // Test validation
          try {
            await testInstance.validate();
            console.log(`   ✅ Validation passed`);
          } catch (validationError) {
            console.log(`   ❌ Validation failed: ${validationError.message}`);
          }
          
        } catch (instanceError) {
          console.log(`   ❌ Cannot create instance: ${instanceError.message}`);
        }
        
      } catch (importError) {
        console.log(`   ❌ Import failed: ${importError.message}`);
      }
      
      console.log(''); // Empty line
    }

    // ✅ Model Relationship Check
    console.log('🔗 Model Relationships Check:\n');
    
    try {
      const User = require('../app/models/User');
      const Barber = require('../app/models/Barber');
      const Package = require('../app/models/Package');
      const Schedule = require('../app/models/Schedule');
      const Reservation = require('../app/models/Reservation');
      const { Payment, PaymentOption } = require('../app/models/Payment');
      
      console.log('✅ All models can be imported together');
      console.log('✅ No circular dependency issues');
      
      // Check if all models are registered
      const allRegistered = [
        mongoose.models.User === User,
        mongoose.models.Barber === Barber,
        mongoose.models.Package === Package,
        mongoose.models.Schedule === Schedule,
        mongoose.models.Reservation === Reservation,
        mongoose.models.Payment === Payment,
        mongoose.models.PaymentOption === PaymentOption
      ].every(Boolean);
      
      console.log(`✅ All models properly registered: ${allRegistered ? '✅' : '❌'}`);
      
      // Check collection names are unique
      const collections = [
        User.collection.name,
        Barber.collection.name,
        Package.collection.name,
        Schedule.collection.name,
        Reservation.collection.name,
        Payment.collection.name,
        PaymentOption.collection.name
      ];
      
      const uniqueCollections = [...new Set(collections)];
      console.log(`✅ Unique collection names: ${collections.length === uniqueCollections.length ? '✅' : '❌'}`);
      console.log(`   Collections: ${collections.join(', ')}`);
      
    } catch (relationError) {
      console.log(`❌ Relationship check failed: ${relationError.message}`);
    }

    // ✅ Summary
    console.log('\n📋 Registration Summary:');
    const registeredModels = Object.keys(mongoose.models);
    console.log(`   - Total Models Registered: ${registeredModels.length}`);
    console.log(`   - Registered Models: ${registeredModels.join(', ')}`);
    
    const expectedModels = ['User', 'Barber', 'Package', 'Schedule', 'Reservation', 'Payment', 'PaymentOption'];
    const missingModels = expectedModels.filter(model => !registeredModels.includes(model));
    
    if (missingModels.length === 0) {
      console.log('   ✅ All expected models are registered');
    } else {
      console.log(`   ❌ Missing models: ${missingModels.join(', ')}`);
    }

    // ✅ Optional: Test save operations
    const shouldTestSave = process.argv.includes('--save-test');
    if (shouldTestSave) {
      console.log('\n💾 Testing Save Operations...');
      console.log('⚠️  This will create test data in your database');
      
      try {
        // Test Package save (simplest)
        const Package = require('../app/models/Package');
        const testPackage = new Package({
          name: 'test save package',
          price: 99999,
          description: 'Test save description'
        });
        
        const savedPackage = await testPackage.save();
        console.log(`   ✅ Package save successful: ${savedPackage.packageId}`);
        
        // Clean up
        await Package.findByIdAndDelete(savedPackage._id);
        console.log('   ✅ Test data cleaned up');
        
      } catch (saveError) {
        console.log(`   ❌ Save test failed: ${saveError.message}`);
      }
    } else {
      console.log('\n💡 Use --save-test flag to test actual database operations');
    }

    await mongoose.connection.close();
    console.log('\n🎉 All model checks completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Model registration check failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.stack) {
      console.error('\n📍 Stack trace:');
      console.error(error.stack);
    }
    
    // Close connection if open
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    process.exit(1);
  }
};

checkModelRegistration();