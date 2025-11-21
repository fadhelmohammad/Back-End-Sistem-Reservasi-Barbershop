const cron = require('node-cron');
const Reservation = require('../models/Reservation');
const Schedule = require('../models/Schedule');
const { Payment } = require('../models/Payment');

// ✅ CHECK EXPIRED RESERVATIONS EVERY 1 MINUTE
const startPaymentTimeoutChecker = () => {
  console.log('🕐 Payment timeout checker started - checking every minute');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago

      console.log(`\n🔍 [${now.toISOString()}] Checking for expired reservations...`);
      console.log(`   Looking for pending reservations created before ${tenMinutesAgo.toISOString()}`);

      // Find pending reservations older than 10 minutes WITHOUT payment
      const expiredReservations = await Reservation.find({
        status: 'pending',
        createdAt: { $lte: tenMinutesAgo },
        paymentId: { $exists: false } // No payment uploaded
      })
      .populate('schedule', 'timeSlot date')
      .populate('barber', 'name');

      if (expiredReservations.length > 0) {
        console.log(`⚠️  Found ${expiredReservations.length} expired reservations`);

        for (const reservation of expiredReservations) {
          console.log(`\n🚫 Cancelling expired reservation: ${reservation.reservationId}`);
          console.log(`   Created at: ${reservation.createdAt.toISOString()}`);
          console.log(`   Customer: ${reservation.customerName}`);
          console.log(`   Barber: ${reservation.barber?.name}`);
          console.log(`   Schedule: ${reservation.schedule?.timeSlot}`);

          // ✅ FIX: Use updateOne to avoid validation errors
          await Reservation.updateOne(
            { _id: reservation._id },
            {
              $set: {
                status: 'cancelled',
                cancelledAt: now,
                cancelReason: 'Payment timeout - No payment uploaded within 10 minutes'
              }
            }
          );

          console.log(`   ✅ Reservation ${reservation.reservationId} cancelled`);

          // Free up the schedule
          if (reservation.schedule) {
            await Schedule.findByIdAndUpdate(reservation.schedule._id, {
              status: 'available',
              reservation: null
            });
            console.log(`   ✅ Schedule ${reservation.schedule.timeSlot} freed`);
          }
        }

        console.log(`\n✅ Successfully cancelled ${expiredReservations.length} expired reservations\n`);
      } else {
        console.log('   ✅ No expired reservations found');
      }

    } catch (error) {
      console.error('❌ Error in payment timeout checker:', error);
      console.error('   Error details:', {
        message: error.message,
        name: error.name,
        timestamp: new Date().toISOString()
      });
    }
  });
};

module.exports = { startPaymentTimeoutChecker };