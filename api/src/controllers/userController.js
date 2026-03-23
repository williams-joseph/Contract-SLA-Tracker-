const bcrypt = require('bcrypt');
const db = require('../config/db');

// GET /users  (admin only)
const getAllUsers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, full_name, email, role, is_active, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getAllUsers error:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
};

// GET /users/:id  (admin only)
const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'SELECT id, full_name, email, role, is_active, created_at FROM users WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getUserById error:', err);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
};

// POST /users  (admin only — creates a new officer account)
const createUser = async (req, res) => {
  const { full_name, email, password, role } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    
    // RESTRICTION: Only the superadmin (Ernest) can create other admins
    let finalRole = role || 'officer';
    if (finalRole === 'admin' && req.user.email !== 'eamoakwa@courtecowas.org') {
        return res.status(403).json({ error: 'Only the Superadmin (Ernest Amoakwa) can create other admins.' });
    }

    const result = await db.query(
      `INSERT INTO users (full_name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role, is_active, created_at`,
      [full_name, email.toLowerCase(), password_hash, finalRole]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createUser error:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
};

// PUT /users/:id  (admin only)
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { full_name, email, password, role, is_active } = req.body;

  try {
    let password_hash;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }

    // RESTRICTION: Only the superadmin (Ernest) can promote/demote admins
    let finalRole = role;
    if (finalRole === 'admin' && req.user.email !== 'eamoakwa@courtecowas.org') {
        return res.status(403).json({ error: 'Only the Superadmin (Ernest Amoakwa) can manage admin roles.' });
    }

    const result = await db.query(
      `UPDATE users SET
        full_name = COALESCE($1, full_name),
        email = COALESCE($2, email),
        password = COALESCE($3, password),
        role = COALESCE($4, role),
        is_active = COALESCE($5, is_active)
       WHERE id = $6
       RETURNING id, full_name, email, role, is_active, created_at`,
      [full_name, email?.toLowerCase(), password_hash, finalRole || null, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateUser error:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
};

// DELETE /users/:id  (admin only — soft deactivate)
const deactivateUser = async (req, res) => {
  const { id } = req.params;

  // Prevent self-deactivation
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  }

  try {
    const result = await db.query(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id, full_name, email',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ message: 'User deactivated.', user: result.rows[0] });
  } catch (err) {
    console.error('deactivateUser error:', err);
    res.status(500).json({ error: 'Failed to deactivate user.' });
  }
};

module.exports = { getAllUsers, getUserById, createUser, updateUser, deactivateUser };
