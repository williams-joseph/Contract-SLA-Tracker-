const nodemailer = require('nodemailer');
const db = require('../config/db');
require('dotenv').config();

const getSystemSettings = async () => {
  const result = await db.query('SELECT key, value FROM system_settings');
  const settings = {};
  result.rows.forEach(row => {
    settings[row.key] = row.value;
  });
  return settings;
};

const sendExpiryAlert = async ({ contract, daysRemaining }) => {
  const settings = await getSystemSettings();
  
  if (settings.enable_notifications === 'false') {
    console.log('ℹ️ Notifications are globally disabled in settings.');
    return;
  }

  const recipients = (settings.notify_emails || process.env.NOTIFY_EMAILS || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  if (!recipients.length) {
    console.log('⚠️ No notification recipients configured.');
    return;
  }

  // Dynamic transporter based on latest DB settings
  const transporter = nodemailer.createTransport({
    host: settings.smtp_host || process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(settings.smtp_port || process.env.SMTP_PORT) || 587,
    secure: (settings.smtp_port === '465'),
    auth: {
      user: settings.smtp_user || process.env.SMTP_USER,
      pass: settings.smtp_pass || process.env.SMTP_PASS,
    },
  });

  const urgency = daysRemaining <= 2 ? '🚨 URGENT' : daysRemaining <= 30 ? '⚠️ WARNING' : 'ℹ️ NOTICE';
  const subject = `${urgency}: Contract "${contract.title}" expires in ${daysRemaining} day(s)`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <div style="background: ${daysRemaining <= 2 ? '#dc2626' : daysRemaining <= 30 ? '#d97706' : '#2563eb'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">${urgency}: Contract Expiry Alert</h2>
      </div>
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #374151;">Contract Title</td>
            <td style="padding: 8px; color: #111827;">${contract.title}</td>
          </tr>
          <tr style="background: #f3f4f6;">
            <td style="padding: 8px; font-weight: bold; color: #374151;">Vendor</td>
            <td style="padding: 8px; color: #111827;">${contract.vendor_name || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #374151;">PO Number</td>
            <td style="padding: 8px; color: #111827;">${contract.po_number || 'N/A'}</td>
          </tr>
          <tr style="background: #f3f4f6;">
            <td style="padding: 8px; font-weight: bold; color: #374151;">Contract Value</td>
            <td style="padding: 8px; color: #111827;">${contract.currency || 'NGN'} ${Number(contract.contract_value || 0).toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #374151;">End Date</td>
            <td style="padding: 8px; color: #111827;">${new Date(contract.end_date).toDateString()}</td>
          </tr>
          <tr style="background: #fef3c7;">
            <td style="padding: 8px; font-weight: bold; color: #374151;">Days Remaining</td>
            <td style="padding: 8px; font-weight: bold; color: ${daysRemaining <= 2 ? '#dc2626' : '#d97706'};">${daysRemaining} day(s)</td>
          </tr>
        </table>
        <p style="color: #6b7280; margin-top: 20px; font-size: 14px;">
          Please log in to the CCJ Contract Management System to take action.
        </p>
        <p style="color: #9ca3af; font-size: 12px;">
          This is an automated notification from the CCJ Vendor Contract SLA Tracker.
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: settings.email_from || process.env.EMAIL_FROM || 'CCJ Contracts <noreply@ccj.org>',
      to: recipients.join(', '),
      subject,
      html,
    });
    console.log(`✅ Notification sent for contract "${contract.title}" (${daysRemaining} days remaining)`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send notification for contract "${contract.title}":`, err.message);
    return false;
  }
};

module.exports = { sendExpiryAlert };
