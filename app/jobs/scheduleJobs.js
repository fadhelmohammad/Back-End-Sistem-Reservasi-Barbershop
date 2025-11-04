const cron = require('node-cron');
const ScheduleService = require('../services/scheduleService');

class ScheduleJobs {
  static init() {
    // Cleanup setiap hari jam 1 pagi
    cron.schedule('0 1 * * *', async () => {
      try {
        console.log('🕐 Starting daily schedule cleanup...');
        const result = await ScheduleService.performScheduleCleanup();
        console.log('✅ Daily cleanup completed:', result);
      } catch (error) {
        console.error('❌ Daily cleanup failed:', error);
      }
    });

    // Generate new schedules setiap hari jam 2 pagi
    cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🕐 Auto-generating monthly schedules...');
        await ScheduleService.autoGenerateMonthlySchedules();
        console.log('✅ Auto-generation completed');
      } catch (error) {
        console.error('❌ Auto-generation failed:', error);
      }
    });

    // Check expired schedules setiap 6 jam
    cron.schedule('0 */6 * * *', async () => {
      try {
        console.log('🕐 Checking expired schedules...');
        const result = await ScheduleService.checkExpiredSchedules();
        if (result.expired > 0) {
          console.log(`✅ Marked ${result.expired} schedules as expired`);
        }
      } catch (error) {
        console.error('❌ Expired check failed:', error);
      }
    });

    console.log('⏰ Schedule cron jobs initialized');
  }
}

module.exports = ScheduleJobs;