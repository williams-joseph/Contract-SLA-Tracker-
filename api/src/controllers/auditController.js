const db = require('../config/db');

// GET /audit-log  (admin only)
const getAuditLog = async (req, res) => {
  try {
    const { limit = 100, offset = 0, user_id, action } = req.query;

    let query = `
      SELECT 
        al.*,
        u.full_name AS performed_by
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (user_id) {
      query += ` AND al.user_id = $${paramIndex++}`;
      params.push(user_id);
    }
    if (action) {
      query += ` AND al.action = $${paramIndex++}`;
      params.push(action);
    }

    query += ` ORDER BY al.performed_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('getAuditLog error:', err);
    res.status(500).json({ error: 'Failed to fetch audit log.' });
  }
};

module.exports = { getAuditLog };
