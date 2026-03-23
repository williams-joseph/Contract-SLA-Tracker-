const db = require('../config/db');
const bcrypt = require('bcrypt');

const setup = async () => {
    console.log('--- Database Initialization ---');
    try {
        // 1. Create Tables
        console.log('Creating tables...');
        await db.query(`
            DROP TABLE IF EXISTS notification_log;
            DROP TABLE IF EXISTS audit_log;
            DROP TABLE IF EXISTS contracts;
            DROP TABLE IF EXISTS vendors;
            DROP TABLE IF EXISTS users;

            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'officer',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE vendors (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                external_id VARCHAR(50),
                contact_email VARCHAR(255),
                contact_phone VARCHAR(50),
                address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE contracts (
                id SERIAL PRIMARY KEY,
                vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                contract_type VARCHAR(100),
                category VARCHAR(50) DEFAULT 'Contract', -- 'Contract', 'Purchase'
                parent_id INTEGER REFERENCES contracts(id), -- for tracking renewals
                po_number VARCHAR(100),
                contract_value NUMERIC(15, 2),
                currency VARCHAR(10) DEFAULT 'NGN',
                start_date DATE,
                end_date DATE NOT NULL,
                duration VARCHAR(100),
                status VARCHAR(50) NOT NULL,
                service_quality VARCHAR(50),
                notes TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE audit_log (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                action VARCHAR(50) NOT NULL,
                table_name VARCHAR(100),
                record_id INTEGER,
                changes JSONB,
                performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE notification_log (
                id SERIAL PRIMARY KEY,
                contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
                sent_to TEXT NOT NULL,
                days_remaining INTEGER,
                message TEXT,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Insert Superadmin
        console.log('Inserting Superadmin...');
        const email = 'eamoakwa@courtecowas.org';
        const pass = 'password123#';
        const hash = await bcrypt.hash(pass, 10);
        
        await db.query(
            'INSERT INTO users (email, password, full_name, role) VALUES ($1, $2, $3, $4)',
            [email, hash, 'Ernest Amoakwa', 'admin']
        );

        console.log('✅ Database setup successfully.');
        console.log(`Admin Email: ${email}`);
        console.log(`Admin Pass: ${pass}`);
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during database setup:', err);
        process.exit(1);
    }
};

setup();
