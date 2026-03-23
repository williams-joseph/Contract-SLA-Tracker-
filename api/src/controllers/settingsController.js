const db = require('../config/db');

const getSettings = async (req, res) => {
    try {
        const result = await db.query('SELECT key, value FROM system_settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching settings: ' + err.message });
    }
};

const updateSettings = async (req, res) => {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ message: 'Invalid settings object provided.' });
    }

    try {
        await db.query('BEGIN');
        for (const [key, value] of Object.entries(settings)) {
            await db.query(
                `INSERT INTO system_settings (key, value) 
                 VALUES ($1, $2) 
                 ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
                [key, value]
            );
        }
        await db.query('COMMIT');
        res.json({ message: 'Settings updated successfully.' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ message: 'Error updating settings: ' + err.message });
    }
};

module.exports = {
    getSettings,
    updateSettings
};
