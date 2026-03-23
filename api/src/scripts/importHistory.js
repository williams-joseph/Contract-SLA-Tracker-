/**
 * importHistory.js
 * Imports historical purchase transactions from the 2022, 2023, and 2024 Excel sheets
 * into the contracts table with category='Purchase' and status='Completed'
 */
const XLSX = require('xlsx');
const path = require('path');
const db = require('../config/db');

const excelFilePath = path.join(__dirname, '../../../Copy of CCJ - VENDOR CONTRACTS REGISTER AS OF OCTOBER 2025.xlsx');

// Convert Excel serial or date string to ISO date
const parseDate = (val) => {
    if (!val) return null;
    if (typeof val === 'number') {
        if (val >= 1900 && val <= 2200) return `${val}-01-01`; // year-only
        // Excel serial
        const date = new Date((val - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 1990) return date.toISOString().split('T')[0];
        return null;
    }
    if (typeof val === 'string') {
        // Handle formats: "18/03/24", "16/11/2023", "2024-01-01"
        val = val.trim();
        if (val.match(/^\d{4}-\d{2}-\d{2}/)) return val.slice(0, 10);
        // DD/MM/YY or DD/MM/YYYY
        const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (m) {
            const year = m[3].length === 2 ? '20' + m[3] : m[3];
            return `${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
        }
    }
    return null;
};

// Parse currency value (handles "₦37,850,000.00" and plain numbers)
const parseValue = (val) => {
    if (!val) return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const cleaned = val.replace(/[₦$€,\s]/g, '').trim();
        const n = parseFloat(cleaned);
        return isNaN(n) ? null : n;
    }
    return null;
};

// Sheets to import — prefer the ones WITH PO numbers where both exist
const HISTORICAL_SHEETS = [
    { name: '2022',   hasPO: true,  year: 2022 },
    { name: '2023',   hasPO: true,  year: 2023 },
    { name: '2024',   hasPO: true,  year: 2024 },
];

const importHistory = async () => {
    console.log('--- Importing Historical Transaction Data ---');
    try {
        const adminRes = await db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        if (adminRes.rows.length === 0) { console.error('No admin found.'); process.exit(1); }
        const adminId = adminRes.rows[0].id;

        const workbook = XLSX.readFile(excelFilePath);
        let totalImported = 0;

        for (const sheetInfo of HISTORICAL_SHEETS) {
            const ws = workbook.Sheets[sheetInfo.name];
            if (!ws) { console.log(`Sheet "${sheetInfo.name}" not found, skipping.`); continue; }

            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
            // Skip the title row + header row (first 2 rows)
            const dataRows = rows.slice(2).filter(r => r.some(c => c !== null && c !== undefined && c !== ''));

            console.log(`\nProcessing sheet "${sheetInfo.name}" — ${dataRows.length} rows...`);
            let imported = 0;

            for (const row of dataRows) {
                let sn, description, orgName, poNumber, value, awardDate, status;

                if (sheetInfo.hasPO) {
                    // Columns: SN | TRANSACTION DESCRIPTION | ORGANIZATION | P.O NUMBER | TOTAL PRICE | AWARD DATE | STATUS
                    [sn, description, orgName, poNumber, value, awardDate, status] = row;
                } else {
                    // Columns: SN | TRANSACTION DESCRIPTION | ORGANIZATION | TOTAL PRICE | AWARD DATE | STATUS
                    [sn, description, orgName, value, awardDate, status] = row;
                }

                if (!orgName || !description) continue;

                const vendorName = String(orgName).trim();
                const txDescription = String(description).trim();
                const contractValue = parseValue(value);
                const date = parseDate(awardDate);
                const poStr = poNumber ? String(poNumber).trim() : null;

                // Normalize status
                let finalStatus = 'Completed';
                if (typeof status === 'string') {
                    const s = status.toLowerCase().replace(/\s+/g, '');
                    if (s.includes('progress')) finalStatus = 'Completed'; // treat old 'in progress' as completed now
                    if (s.includes('cancel')) finalStatus = 'Completed';
                }

                // Find or create vendor
                let vendorId;
                const vRes = await db.query(
                    'SELECT id FROM vendors WHERE LOWER(name) = LOWER($1)', [vendorName]
                );
                if (vRes.rows.length > 0) {
                    vendorId = vRes.rows[0].id;
                } else {
                    const vNew = await db.query(
                        'INSERT INTO vendors (name) VALUES ($1) RETURNING id', [vendorName]
                    );
                    vendorId = vNew.rows[0].id;
                    console.log(`  Created new vendor: ${vendorName}`);
                }

                // end_date = award date (or Jan 1 of year if no date)
                const endDate = date || `${sheetInfo.year}-12-31`;
                // start_date = 1 year before end_date or Jan 1 of year
                const startDate = date
                    ? (() => { const d = new Date(date); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split('T')[0]; })()
                    : `${sheetInfo.year}-01-01`;

                // Check if already imported (avoid duplicates by matching vendor+description+year)
                const existing = await db.query(
                    `SELECT id FROM contracts WHERE vendor_id = $1 AND title = $2 AND EXTRACT(YEAR FROM end_date) = $3`,
                    [vendorId, txDescription, sheetInfo.year]
                );
                if (existing.rows.length > 0) continue; // skip duplicate

                await db.query(
                    `INSERT INTO contracts (
                        vendor_id, title, description, contract_type, category, contract_value,
                        po_number, start_date, end_date, status, created_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [
                        vendorId, txDescription, txDescription,
                        'Purchase', 'Purchase', contractValue,
                        poStr, startDate, endDate, finalStatus, adminId
                    ]
                );
                imported++;
            }

            console.log(`  ✅ Imported ${imported} records from "${sheetInfo.name}"`);
            totalImported += imported;
        }

        console.log(`\n✅ Done. Total historical records imported: ${totalImported}`);
        process.exit(0);
    } catch (err) {
        console.error('Import error:', err.message);
        process.exit(1);
    }
};

importHistory();
