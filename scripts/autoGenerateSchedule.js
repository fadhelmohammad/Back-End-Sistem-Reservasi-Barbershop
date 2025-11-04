const cron = require('node-cron');
const ScheduleService = require('./app/services/scheduleService');

// Auto generate schedules setiap hari jam 2 pagi
cron.schedule('0 2 * * *', async () => {
  try {
    console.log('🔄 Auto-generating monthly schedules...');
    await ScheduleService.autoGenerateMonthlySchedules();
    console.log('✅ Auto-generation completed');
  } catch (error) {
    console.error('❌ Auto-generation failed:', error);
  }
});