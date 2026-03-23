const db = require('../config/db');
require('dotenv').config();

const setupSettings = async () => {
    console.log('--- Setting Up System Configuration ---');
    try {
        // 1. Create Settings Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key VARCHAR(255) PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Initial Settings from .env
        const initialSettings = [
            { key: 'notify_emails', value: process.env.NOTIFY_EMAILS || '' },
            { key: 'alert_milestones', value: '90,60,30,15,7,3,1' },
            { key: 'smtp_host', value: process.env.SMTP_HOST || 'smtp.gmail.com' },
            { key: 'smtp_port', value: process.env.SMTP_PORT || '587' },
            { key: 'smtp_user', value: process.env.SMTP_USER || '' },
            { key: 'smtp_pass', value: process.env.SMTP_PASS || '' },
            { key: 'email_from', value: process.env.EMAIL_FROM || 'CCJ Contracts <noreply@ccj.org>' },
            { key: 'enable_notifications', value: 'true' }
        ];

        for (const setting of initialSettings) {
            await db.query(
                'INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
                [setting.key, setting.value]
            );
        }

        console.log('✅ System settings initialized.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during settings setup:', err);
        process.exit(1);
    }
};

setupSettings();
