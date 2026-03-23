const db = require('../config/db');

// Helper: compute status based on end_date
const computeStatus = (end_date) => {
  const today = new Date();
  const end = new Date(end_date);
  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Expired';
  if (diffDays <= 30) return 'Expiring Soon';
  return 'Active';
};

// GET /contracts
const getAllContracts = async (req, res) => {
  try {
    const { status, vendor_id, search } = req.query;

    let query = `
      SELECT 
        c.*,
        v.name AS vendor_name,
        v.category AS vendor_category,
        v.external_id AS vendor_external_id,
        v.contact_email AS vendor_email,
        u.full_name AS created_by_name,
        c.end_date - CURRENT_DATE AS days_remaining,
        GREATEST(0, LEAST(100, ROUND(
          CASE 
            WHEN c.end_date = c.start_date THEN 100
            WHEN c.start_date IS NULL THEN 0
            ELSE (CURRENT_DATE - c.start_date)::numeric / NULLIF((c.end_date - c.start_date), 0) * 100
          END
        , 1))) AS progress_percent
      FROM contracts c
      LEFT JOIN vendors v ON c.vendor_id = v.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND c.status = $${paramIndex++}`;
      params.push(status);
    }

    if (vendor_id) {
      query += ` AND c.vendor_id = $${paramIndex++}`;
      params.push(vendor_id);
    }

    if (search) {
      query += ` AND (c.title ILIKE $${paramIndex} OR v.name ILIKE $${paramIndex} OR c.po_number ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ' ORDER BY c.end_date ASC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('getAllContracts error:', err);
    res.status(500).json({ error: 'Failed to fetch contracts.' });
  }
};

// GET /contracts/expiring
const getExpiringContracts = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const result = await db.query(
      `SELECT 
        c.*,
        v.name AS vendor_name,
        c.end_date - CURRENT_DATE AS days_remaining
      FROM contracts c
      LEFT JOIN vendors v ON c.vendor_id = v.id
      WHERE c.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1
        AND c.status NOT IN ('Expired', 'Completed')
      ORDER BY c.end_date ASC`,
      [days]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getExpiringContracts error:', err);
    res.status(500).json({ error: 'Failed to fetch expiring contracts.' });
  }
};

// GET /contracts/stats
const getContractStats = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('Expired', 'Completed')) AS active,
        COUNT(*) FILTER (WHERE status = 'Expired') AS expired,
        COUNT(*) FILTER (WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 AND status NOT IN ('Expired', 'Completed')) AS expiring_soon,
        COUNT(*) FILTER (WHERE status = 'Completed') AS completed,
        COUNT(*) AS total
      FROM contracts
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getContractStats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
};

// GET /contracts/:id
const getContractById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT 
        c.*,
        v.name AS vendor_name,
        v.contact_email AS vendor_email,
        v.contact_phone AS vendor_phone,
        u.full_name AS created_by_name,
        c.end_date - CURRENT_DATE AS days_remaining,
        ROUND(
          CASE 
            WHEN c.end_date = c.start_date THEN 100
            ELSE (CURRENT_DATE - c.start_date)::numeric / NULLIF((c.end_date - c.start_date), 0) * 100
          END
        , 1) AS progress_percent
      FROM contracts c
      LEFT JOIN vendors v ON c.vendor_id = v.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getContractById error:', err);
    res.status(500).json({ error: 'Failed to fetch contract.' });
  }
};

// POST /contracts
const createContract = async (req, res) => {
  const {
    vendor_id, title, description, category, contract_type, po_number,
    contract_value, currency, start_date, end_date, duration,
    status, service_quality, notes, parent_id
  } = req.body;

  if (!title || !end_date) {
    return res.status(400).json({ error: 'Title and end date are required.' });
  }

  const pdf_url = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const autoStatus = status || computeStatus(end_date);

    const result = await db.query(
      `INSERT INTO contracts 
        (vendor_id, title, description, category, contract_type, po_number, contract_value, currency,
         start_date, end_date, duration, status, service_quality, notes, parent_id, created_by, pdf_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        vendor_id || null, title, description || null, category || 'Contract', contract_type || null,
        po_number || null, contract_value || null, currency || 'NGN',
        start_date || null, end_date, duration || null,
        autoStatus, service_quality || null, notes || null, parent_id || null, req.user.id, pdf_url
      ]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, changes)
       VALUES ($1, 'CREATE', 'contracts', $2, $3)`,
      [req.user.id, result.rows[0].id, JSON.stringify(result.rows[0])]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createContract error:', err);
    res.status(500).json({ error: 'Failed to create contract.' });
  }
};

// PUT /contracts/:id
const updateContract = async (req, res) => {
  const { id } = req.params;
  const {
    vendor_id, title, description, category, contract_type, po_number,
    contract_value, currency, start_date, end_date, duration,
    status, service_quality, notes, parent_id
  } = req.body;

  try {
    // Fetch old record for audit
    const old = await db.query('SELECT * FROM contracts WHERE id = $1', [id]);
    if (old.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found.' });
    }

    const autoStatus = status || (end_date ? computeStatus(end_date) : old.rows[0].status);

    const pdf_url = req.file ? `/uploads/${req.file.filename}` : old.rows[0].pdf_url;

    const result = await db.query(
      `UPDATE contracts SET
        vendor_id = COALESCE($1, vendor_id),
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        category = COALESCE($4, category),
        contract_type = COALESCE($5, contract_type),
        po_number = COALESCE($6, po_number),
        contract_value = COALESCE($7, contract_value),
        currency = COALESCE($8, currency),
        start_date = COALESCE($9, start_date),
        end_date = COALESCE($10, end_date),
        duration = COALESCE($11, duration),
        status = $12,
        service_quality = COALESCE($13, service_quality),
        notes = COALESCE($14, notes),
        parent_id = COALESCE($15, parent_id),
        pdf_url = $16
      WHERE id = $17
      RETURNING *`,
      [
        vendor_id, title, description, category, contract_type, po_number,
        contract_value, currency, start_date, end_date, duration,
        autoStatus, service_quality, notes, parent_id, pdf_url, id
      ]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, changes)
       VALUES ($1, 'UPDATE', 'contracts', $2, $3)`,
      [req.user.id, id, JSON.stringify({ before: old.rows[0], after: result.rows[0] })]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateContract error:', err);
    res.status(500).json({ error: 'Failed to update contract.' });
  }
};

// DELETE /contracts/:id
const deleteContract = async (req, res) => {
  const { id } = req.params;
  try {
    const old = await db.query('SELECT * FROM contracts WHERE id = $1', [id]);
    if (old.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found.' });
    }

    await db.query('DELETE FROM contracts WHERE id = $1', [id]);

    // Audit log
    await db.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, changes)
       VALUES ($1, 'DELETE', 'contracts', $2, $3)`,
      [req.user.id, id, JSON.stringify(old.rows[0])]
    );

    res.json({ message: 'Contract deleted successfully.' });
  } catch (err) {
    console.error('deleteContract error:', err);
    res.status(500).json({ error: 'Failed to delete contract.' });
  }
};

// POST /contracts/:id/renew
const renewContract = async (req, res) => {
  const { id } = req.params;
  const { start_date, end_date, duration, contract_value, currency } = req.body;

  try {
    const old = await db.query('SELECT * FROM contracts WHERE id = $1', [id]);
    if (old.rows.length === 0) return res.status(404).json({ error: 'Contract not found.' });

    // 1. Mark old as 'Renewed' (archived)
    await db.query(`UPDATE contracts SET status = 'Completed', notes = COALESCE(notes, '') || ' (Renewed into new contract)' WHERE id = $1`, [id]);

    // 2. Create new contract
    const result = await db.query(
      `INSERT INTO contracts 
        (vendor_id, title, description, category, contract_type, po_number, contract_value, currency,
         start_date, end_date, duration, status, created_by, parent_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        old.rows[0].vendor_id, old.rows[0].title, old.rows[0].description, old.rows[0].category, 
        old.rows[0].contract_type, null, // reset PO for new term
        contract_value || old.rows[0].contract_value, currency || old.rows[0].currency,
        start_date || new Date(), end_date, duration || old.rows[0].duration,
        'Active', req.user.id, id
      ]
    );

    await db.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, changes)
       VALUES ($1, 'RENEW', 'contracts', $2, $3)`,
      [req.user.id, result.rows[0].id, JSON.stringify({ renewed_from: id, new_contract: result.rows[0].id })]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('renewContract error:', err);
    res.status(500).json({ error: 'Failed to renew contract.' });
  }
};

module.exports = {
  getAllContracts,
  getExpiringContracts,
  getContractStats,
  getContractById,
  createContract,
  updateContract,
  deleteContract,
  renewContract,
};
