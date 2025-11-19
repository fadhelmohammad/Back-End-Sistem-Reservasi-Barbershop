const { PaymentOption } = require('../../app/models/Payment');

const seedPaymentOptions = async () => {
  try {
    console.log('🔄 Seeding payment options...');
    
    // Clear existing payment options
    await PaymentOption.deleteMany({});
    console.log('✅ Cleared existing payment options');

    const paymentOptions = [
      // ✅ BANK TRANSFER OPTIONS
      {
        type: 'bank_transfer',
        name: 'Bank BCA',
        accountNumber: '1234567890',
        accountName: 'Brocode Barbershop',
        isActive: true,
        sortOrder: 1
      },
      {
        type: 'bank_transfer',
        name: 'Bank Mandiri',
        accountNumber: '0987654321',
        accountName: 'Brocode Barbershop',
        isActive: true,
        sortOrder: 2
      },
      {
        type: 'bank_transfer',
        name: 'Bank BRI',
        accountNumber: '1122334455',
        accountName: 'Brocode Barbershop',
        isActive: true,
        sortOrder: 3
      },

      // ✅ E-WALLET OPTIONS
      {
        type: 'e_wallet',
        name: 'OVO',
        phoneNumber: '081234567890',
        walletName: 'Brocode Shop',
        isActive: true,
        sortOrder: 4
      },
      {
        type: 'e_wallet',
        name: 'GoPay',
        phoneNumber: '081234567890',
        walletName: 'Brocode Shop',
        isActive: true,
        sortOrder: 5
      },
      {
        type: 'e_wallet',
        name: 'Dana',
        phoneNumber: '081234567890',
        walletName: 'Brocode Shop',
        isActive: true,
        sortOrder: 6
      },
      {
        type: 'e_wallet',
        name: 'ShopeePay',
        phoneNumber: '081234567890',
        walletName: 'Brocode Shop',
        isActive: false, // Inactive example
        sortOrder: 7
      }
    ];

    // Insert payment options
    const createdOptions = await PaymentOption.insertMany(paymentOptions);
    
    console.log(`✅ Created ${createdOptions.length} payment options:`);
    createdOptions.forEach(option => {
      const details = option.type === 'bank_transfer' 
        ? `${option.accountNumber} (${option.accountName})`
        : `${option.phoneNumber} (${option.walletName})`;
      console.log(`   - ${option.name} (${option.type}) - ${option.optionId} - ${details} ${option.isActive ? '✅' : '❌'}`);
    });

    return createdOptions;

  } catch (error) {
    console.error('❌ Error seeding payment options:', error.message);
    throw error;
  }
};

module.exports = { seedPaymentOptions };