const db = require('../config/db');

// GET /vendors
const getAllVendors = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        v.*,
        COUNT(c.id) FILTER (WHERE c.status IN ('Active', 'Expiring Soon')) AS contract_count
      FROM vendors v
      LEFT JOIN contracts c ON c.vendor_id = v.id
      GROUP BY v.id
      ORDER BY v.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('getAllVendors error:', err);
    res.status(500).json({ error: 'Failed to fetch vendors.' });
  }
};

// GET /vendors/:id
const getVendorById = async (req, res) => {
  const { id } = req.params;
  try {
    const vendor = await db.query('SELECT * FROM vendors WHERE id = $1', [id]);
    if (vendor.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    const contracts = await db.query(
      'SELECT id, title, status, end_date, contract_value FROM contracts WHERE vendor_id = $1 ORDER BY end_date DESC',
      [id]
    );

    res.json({ ...vendor.rows[0], contracts: contracts.rows });
  } catch (err) {
    console.error('getVendorById error:', err);
    res.status(500).json({ error: 'Failed to fetch vendor.' });
  }
};

// POST /vendors
const createVendor = async (req, res) => {
  const { name, contact_email, contact_phone, category } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Vendor name is required.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO vendors (name, contact_email, contact_phone, category)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, contact_email || null, contact_phone || null, category || 'Miscellaneous']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Vendor with this name already exists.' });
    }
    console.error('createVendor error:', err);
    res.status(500).json({ error: 'Failed to create vendor.' });
  }
};

// PUT /vendors/:id
const updateVendor = async (req, res) => {
  const { id } = req.params;
  const { name, contact_email, contact_phone, category } = req.body;

  try {
    const result = await db.query(
      `UPDATE vendors SET
        name = COALESCE($1, name),
        contact_email = COALESCE($2, contact_email),
        contact_phone = COALESCE($3, contact_phone),
        category = COALESCE($4, category)
       WHERE id = $5 RETURNING *`,
      [name, contact_email, contact_phone, category, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateVendor error:', err);
    res.status(500).json({ error: 'Failed to update vendor.' });
  }
};

// DELETE /vendors/:id
const deleteVendor = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM vendors WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }
    res.json({ message: 'Vendor deleted successfully.' });
  } catch (err) {
    console.error('deleteVendor error:', err);
    res.status(500).json({ error: 'Failed to delete vendor.' });
  }
};

module.exports = { getAllVendors, getVendorById, createVendor, updateVendor, deleteVendor };
