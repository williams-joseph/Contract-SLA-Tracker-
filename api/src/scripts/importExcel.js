const XLSX = require('xlsx');
const path = require('path');
const db = require('../config/db');

const excelFilePath = path.join('c:', 'Users', 'dodey', 'Documents', 'src', 'Contract_sla_tracker', 'Copy of CCJ - VENDOR CONTRACTS REGISTER AS OF OCTOBER 2025.xlsx');

const excelToDate = (serial) => {
    if (!serial && serial !== 0) return null;
    // If it's already a string date (ISO or similar)
    if (typeof serial === 'string') {
        if (serial.match(/^\d{4}-\d{2}-\d{2}/)) return serial.slice(0, 10);
        if (!isNaN(serial)) serial = Number(serial);
        else return null;
    }
    if (isNaN(serial)) return null;
    // Year-only integer (e.g. 2023) — Excel date serials for 2024 are ~45000+
    // A raw year like 2023 would only be in the range 1900-2200 and well below 40000
    if (serial >= 1900 && serial <= 2200) {
        return `${serial}-01-01`;
    }
    // Standard Excel serial → date conversion
    if (serial < 1) return null;
    const date = new Date((serial - 25569) * 86400 * 1000);
    if (isNaN(date.getTime()) || date.getFullYear() < 1990) return null;
    return date.toISOString().split('T')[0];
};

const importData = async () => {
    console.log('--- Importing Excel Data ---');
    try {
        const adminRes = await db.query('SELECT id FROM users WHERE role = \'admin\' LIMIT 1');
        if (adminRes.rows.length === 0) {
            console.error('No admin user found. Please run initDb.js first.');
            process.exit(1);
        }
        const adminId = adminRes.rows[0].id;

        const workbook = XLSX.readFile(excelFilePath);
        
        // 1. IMPORT ALL VENDORS FIRST
        console.log('Populating Vendors list...');
        if (workbook.SheetNames.includes('CCJ VENDOR LIST')) {
            const vSheet = workbook.Sheets['CCJ VENDOR LIST'];
            const vRows = XLSX.utils.sheet_to_json(vSheet, { header: 1 });
            const vData = vRows.slice(1); // Skip header row
            for (const vRow of vData) {
                const [sn, vId, vName1, vName2] = vRow;
                const names = [vName1, vName2].filter(Boolean).map(n => String(n).trim());
                if (names.length === 0) continue;
                const externalId = String(vId || '').trim();

                // Find existing vendor by any name variant (case-insensitive)
                let existingId = null;
                for (const n of names) {
                    const res = await db.query('SELECT id FROM vendors WHERE LOWER(name) = LOWER($1)', [n]);
                    if (res.rows.length > 0) { existingId = res.rows[0].id; break; }
                }

                if (existingId) {
                    await db.query('UPDATE vendors SET external_id = $1 WHERE id = $2', [externalId, existingId]);
                } else {
                    await db.query(
                        'INSERT INTO vendors (name, external_id) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET external_id = $2',
                        [names[0], externalId]
                    );
                }
            }
            console.log(`Processed ${vData.length} vendor rows.`);
        }

        // 2. IMPORT CONTRACTS
        const sheetName = 'ONGOING 2024-2025';
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Skip header rows (looks like there are 2-3 headers)
        const dataRows = rows.slice(2); 

        for (const row of dataRows) {
            const [
                sn, vendorName, coreService, description, file,
                val, duration, start, end, expiry, status, quality
            ] = row;

            if (!vendorName || (!description && !coreService)) continue;

            // 1. Find Vendor
            let vendorId;
            const vCheck = await db.query('SELECT id FROM vendors WHERE name = $1', [String(vendorName).trim()]);
            if (vCheck.rows.length > 0) {
                vendorId = vCheck.rows[0].id;
            } else {
                // If not found in the list, still create it
                const vNew = await db.query(
                    'INSERT INTO vendors (name) VALUES ($1) RETURNING id',
                    [String(vendorName).trim()]
                );
                vendorId = vNew.rows[0].id;
            }

            // 2. Insert Contract
            const startDate = excelToDate(start);
            const endDate = excelToDate(end) || excelToDate(expiry);
            
            if (!endDate) continue;

            // Normalize status
            let finalStatus = 'Active';
            const s = String(status || '').toLowerCase();
            if (s.includes('expired')) finalStatus = 'Expired';
            else if (s.includes('completed')) finalStatus = 'Completed';
            else if (s.includes('progress')) finalStatus = 'Active';

            // Check if it should be "Expiring Soon" (within 90 days as per cron)
            const diff = (new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24);
            if (diff < 0) finalStatus = 'Expired';
            else if (diff <= 30) finalStatus = 'Expiring Soon';

            const contractValue = isNaN(parseFloat(val)) ? null : parseFloat(val);

            // Per User: Documentation available in sheets. We'll put the file path in 'notes' for now
            const documentation = file ? `Documentation: ${file}` : '';

            await db.query(
                `INSERT INTO contracts (
                    vendor_id, title, description, contract_type, category, contract_value, 
                    duration, start_date, end_date, status, service_quality, notes, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [
                    vendorId, String(description || coreService).trim(), String(coreService || description).trim(), 
                    'Service', 'Contract', contractValue, 
                    String(duration || '').trim() || null,
                    startDate, endDate, finalStatus, String(quality || '').trim() || null, 
                    documentation, adminId
                ]
            );
            
            console.log(`Added: ${description || coreService} (${vendorName})`);
        }

        console.log('✅ Import completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during import:', err);
        process.exit(1);
    }
};

importData();
