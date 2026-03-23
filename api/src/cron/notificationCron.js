const cron = require('node-cron');
const db = require('../config/db');
const { sendExpiryAlert } = require('../services/emailService');

// Check if we already sent a notification today for this contract + days threshold
const alreadyNotifiedToday = async (contractId, daysRemaining) => {
  const result = await db.query(
    `SELECT id FROM notification_log
     WHERE contract_id = $1
       AND days_remaining = $2
       AND sent_at::date = CURRENT_DATE`,
    [contractId, daysRemaining]
  );
  return result.rows.length > 0;
};

const logNotification = async (contractId, daysRemaining, recipients, message) => {
  for (const email of recipients) {
    await db.query(
      `INSERT INTO notification_log (contract_id, sent_to, days_remaining, message)
       VALUES ($1, $2, $3, $4)`,
      [contractId, email, daysRemaining, message]
    );
  }
};

const runNotificationCheck = async () => {
  console.log('🕐 Running contract expiry notification check...');

  try {
    // Fetch settings
    const settingsRes = await db.query('SELECT key, value FROM system_settings');
    const settings = {};
    settingsRes.rows.forEach(r => settings[r.key] = r.value);

    const ALERT_THRESHOLDS = (settings.alert_milestones || '90,60,30,15,7')
      .split(',')
      .map(n => parseInt(n.trim()))
      .filter(n => !isNaN(n));

    // Get all active contracts expiring within MAX threshold
    const maxThreshold = Math.max(...ALERT_THRESHOLDS, 90);

    const result = await db.query(`
      SELECT 
        c.*,
        v.name AS vendor_name,
        (c.end_date - CURRENT_DATE) AS days_remaining
      FROM contracts c
      LEFT JOIN vendors v ON c.vendor_id = v.id
      WHERE c.end_date >= CURRENT_DATE
        AND c.status NOT IN ('Expired', 'Completed')
        AND (c.end_date - CURRENT_DATE) <= $1
      ORDER BY c.end_date ASC
    `, [maxThreshold]);

    const contracts = result.rows;
    console.log(`📋 Found ${contracts.length} contract(s) to check against thresholds [${ALERT_THRESHOLDS.join(', ')}].`);

    for (const contract of contracts) {
      const days = parseInt(contract.days_remaining);
      let alertType = null;

      // 1. Daily alerts for final 2 days
      if (days <= 2) {
        alertType = `Urgent final alert: ${days} day(s) remaining`;
      } 
      // 2. Custom milestones from settings
      else if (ALERT_THRESHOLDS.includes(days)) {
        alertType = `${days}-day milestone alert`;
      }

      if (alertType) {
        const alreadySent = await alreadyNotifiedToday(contract.id, days);
        if (!alreadySent) {
          console.log(`✉️ Sending alert for [${contract.id}] - ${alertType}`);
          const sent = await sendExpiryAlert({ contract, daysRemaining: days });
          if (sent) {
            const recipients = (settings.notify_emails || process.env.NOTIFY_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
            await logNotification(contract.id, days, recipients, alertType);
          }
        }
      }
    }

    console.log('✅ Notification check complete.');
  } catch (err) {
    console.error('❌ Notification cron job error:', err);
  }
};

// Also auto-update statuses to 'Expired' where end_date has passed
const updateExpiredStatuses = async () => {
  try {
    const result = await db.query(`
      UPDATE contracts
      SET status = 'Expired'
      WHERE end_date < CURRENT_DATE
        AND status NOT IN ('Expired', 'Completed')
      RETURNING id, title
    `);
    if (result.rows.length > 0) {
      console.log(`🔄 Updated ${result.rows.length} contract(s) to Expired status.`);
    }
  } catch (err) {
    console.error('❌ Status update cron error:', err);
  }
};

const startCronJobs = () => {
  // Run every day at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    await updateExpiredStatuses();
    await runNotificationCheck();
  }, {
    timezone: 'Africa/Lagos', // WAT (Nigeria)
  });

  console.log('⏰ Cron jobs scheduled (daily at 8:00 AM WAT)');

  // Run once on startup too (after a short delay)
  setTimeout(async () => {
    await updateExpiredStatuses();
  }, 5000);
};

module.exports = { startCronJobs, runNotificationCheck };
