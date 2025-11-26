// // // backend/scheduler.js
// // const cron = require('node-cron');
// // const { processEndedAuctions } = require('./services/auction.service');

// // // Schedule the job to run every minute
// // // The cron expression '* * * * *' means "at every minute"
// // cron.schedule('* * * * *', () => {
// //   console.log('Triggering the auction processing job...');
// //   processEndedAuctions();
// // });

// // console.log('Auction processing scheduler started.');

// // in backend/scheduler.js

// const { processUpcomingAuctions, processEndedAuctions } = require('./services/auction.service');

// const JOB_INTERVAL_MS = 30000; // 30 seconds

// const updateAuctionStatuses = async () => {
//   console.log('[Scheduler] Running job to update auction statuses...');
//   const now = new Date();
  
//   try {
//     // A. Find 'Upcoming' auctions that should now be 'Live'
//     await Auction.updateMany(
//       { status: 'Upcoming', startTime: { $lte: now }, endTime: { $gt: now } },
//       { $set: { status: 'Live' } }
//     );
    
//     // B. Find 'Live' auctions that have now ended
//     await Auction.updateMany(
//       { status: 'Live', endTime: { $lte: now } },
//       { $set: { status: 'Ended' } }
//     );
//   } catch (error) {
//     console.error('[Scheduler] Error updating auction statuses:', error);
//   }
// };

// // Run auction jobs immediately on server start
// updateAuctionStatuses();

// // Then, run them on a recurring interval
// setInterval(updateAuctionStatuses, AUCTION_JOB_INTERVAL_MS);

// console.log(`[Scheduler] Auction status update job scheduled to run every ${JOB_INTERVAL_MS / 1000} seconds.`);

// // Run the jobs immediately on server start
// processUpcomingAuctions();
// processEndedAuctions();

// // Then, run them on a recurring interval
// setInterval(() => {
//   console.log('[Scheduler] Triggering periodic auction status updates...');
//   processUpcomingAuctions();
//   processEndedAuctions();
// }, JOB_INTERVAL_MS);


// backend/scheduler.js

const cron = require('node-cron');
const Auction = require('./models/Auction.model'); // Use the new Auction model
const VisitRequest = require('./models/VisitRequests.model');
const sendEmail = require('./utils/sendEmail');

// --- 1. AUCTION STATUS UPDATES ---
const AUCTION_JOB_INTERVAL_MS = 30000; // Run every 30 seconds

const updateAuctionStatuses = async () => {
  const now = new Date();
  console.log(`[Scheduler] Running job to update auction statuses at server time (UTC): ${now.toISOString()}`);
  
  try {
    const upcomingQuery = { status: 'Upcoming', startTime: { $lte: now }, endTime: { $gt: now } };
    const upcomingResult = await Auction.updateMany(upcomingQuery, { $set: { status: 'Live' } });
    
    const endedQuery = { status: 'Live', endTime: { $lte: now } };
    const endedResult = await Auction.updateMany(endedQuery, { $set: { status: 'Ended' } });

    if (upcomingResult.modifiedCount > 0 || endedResult.modifiedCount > 0) {
        console.log(`[Scheduler] SUCCESS: Statuses updated. Became Live: ${upcomingResult.modifiedCount}, Became Ended: ${endedResult.modifiedCount}`);
    }

  } catch (error) {
    console.error('[Scheduler] FATAL ERROR during auction status update:', error);
  }
};

// Run the auction update job immediately on server start
updateAuctionStatuses();

// Then, run it on a recurring interval
setInterval(updateAuctionStatuses, AUCTION_JOB_INTERVAL_MS);

console.log(`[Scheduler] Auction status update job initialized. Runs every ${AUCTION_JOB_INTERVAL_MS / 1000} seconds.`);

// --- 2. DAILY VISIT REMINDER EMAILS ---
const sendVisitReminders = async () => {
  console.log('Scheduler: Running daily check for visit reminders...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  try {
    const upcomingVisits = await VisitRequest.find({
      status: 'confirmed',
      preferredDate: {
        $gte: tomorrow,
        $lt: dayAfterTomorrow,
      },
    }).populate('propertyId', 'title address');

    if (upcomingVisits.length === 0) {
      console.log('Scheduler: No upcoming visits for tomorrow. Task complete.');
      return;
    }

    console.log(`Scheduler: Found ${upcomingVisits.length} upcoming visit(s) for tomorrow. Sending emails...`);
    const adminEmail = process.env.ADMIN_REMINDER_EMAIL;

    for (const visit of upcomingVisits) {
      const propertyTitle = visit.propertyId?.title || 'the specified property';
      const visitTime = visit.preferredTime;
      
      // Email to the User
      const userMessage = `Hello ${visit.userName},\n\nThis is a friendly reminder about your confirmed property visit tomorrow.\n\nProperty: ${propertyTitle}\nScheduled Time: ${visitTime}\n\nWe look forward to seeing you!`;
      await sendEmail({
        email: visit.userEmail,
        subject: `Reminder: Your Property Visit for "${propertyTitle}"`,
        message: userMessage,
      });
      console.log(`  - Sent visit reminder email to user: ${visit.userEmail}`);

      // Email to the Admin
      if (adminEmail) {
        const adminMessage = `Hello Admin,\n\nThis is a reminder for an upcoming property visit scheduled for tomorrow.\n\nProperty: ${propertyTitle}\nClient: ${visit.userName}\nContact: ${visit.contactNumber}\nTime: ${visitTime}\n\nPlease be prepared.`;
        await sendEmail({
          email: adminEmail,
          subject: `Visit Reminder: ${visit.userName} at ${propertyTitle}`,
          message: adminMessage,
        });
        console.log(`  - Sent visit reminder email to admin: ${adminEmail}`);
      }
    }
    console.log('Scheduler: All visit reminder emails sent successfully.');

  } catch (error) {
    console.error('Scheduler: Error sending visit reminders:', error);
  }
};

// Use node-cron to schedule the visit reminder task to run once every day at 9:00 AM.
cron.schedule('0 9 * * *', sendVisitReminders, {
  scheduled: true,
  timezone: "Asia/Colombo" // IMPORTANT: Set to your local timezone
});

console.log('Automated visit reminder scheduler has been initialized and will run daily at 9:00 AM.');