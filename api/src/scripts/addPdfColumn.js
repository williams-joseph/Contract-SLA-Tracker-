const db = require('../config/db');

const upgrade = async () => {
    try {
        console.log('Adding pdf_url column to contracts table...');
        await db.query(`
            ALTER TABLE contracts 
            ADD COLUMN IF NOT EXISTS pdf_url TEXT;
        `);
        console.log('✅ Column added successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error upgrading database:', err);
        process.exit(1);
    }
};

upgrade();
