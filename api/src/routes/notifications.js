const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { runNotificationCheck } = require('../cron/notificationCron');
const { authenticate, adminOnly } = require('../middleware/auth');

// GET /notifications — fetch notification log
router.get('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const result = await db.query(
      `SELECT 
        nl.*,
        c.title AS contract_title,
        c.end_date
       FROM notification_log nl
       LEFT JOIN contracts c ON nl.contract_id = c.id
       ORDER BY nl.sent_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// POST /notifications/run — manually trigger the check (admin only)
router.post('/run', authenticate, adminOnly, async (req, res) => {
  try {
    await runNotificationCheck();
    res.json({ message: 'Notification check triggered successfully.' });
  } catch (err) {
    console.error('Manual notification trigger error:', err);
    res.status(500).json({ error: 'Failed to run notification check.' });
  }
});

module.exports = router;
