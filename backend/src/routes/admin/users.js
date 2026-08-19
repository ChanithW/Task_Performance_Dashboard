const express  = require('express');
const bcrypt   = require('bcryptjs');
const pool     = require('../../config/db');

const router = express.Router();

// GET /admin/users
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.userid AS userid, u.name AS name, u.email AS email,
              u.phone AS phone, u.designation AS designation,
              u.role AS role, u.division AS division,
              u.reportsto AS reportsto_id,
              r.name AS reportsto_name
       FROM "USER" u
       LEFT JOIN "USER" r ON r.userid = u.reportsto
       ORDER BY u.role, u.name`
    );
    res.json({ users: rows });
  } catch (err) {
    console.error('GET /admin/users:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/users — create a new user
router.post('/', async (req, res) => {
  const { name, email, password, role, designation, division, phone, reportsTo } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role are required' });
  }
  const validRoles = ['HOD', 'Supervisor', 'Employee', 'Admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
  }

  try {
    const passwordhash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO "USER" (name, email, passwordhash, role, designation, division, phone, reportsto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING userid, name, email, role, designation, division, phone`,
      [name, email, passwordhash, role, designation || null, division || null, phone || null, reportsTo || null]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A user with that email already exists' });
    }
    console.error('POST /admin/users:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /admin/users/:userId — update a user
router.patch('/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

  const { name, email, password, role, designation, division, phone, reportsTo } = req.body;
  const updates = [];
  const params  = [];

  if (name)        { params.push(name);        updates.push(`name = $${params.length}`); }
  if (email)       { params.push(email);       updates.push(`email = $${params.length}`); }
  if (role)        { params.push(role);        updates.push(`role = $${params.length}`); }
  if (designation !== undefined) { params.push(designation); updates.push(`designation = $${params.length}`); }
  if (division    !== undefined) { params.push(division);    updates.push(`division = $${params.length}`); }
  if (phone       !== undefined) { params.push(phone);       updates.push(`phone = $${params.length}`); }
  if (reportsTo   !== undefined) { params.push(reportsTo || null); updates.push(`reportsto = $${params.length}`); }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    params.push(hash);
    updates.push(`passwordhash = $${params.length}`);
  }

  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  params.push(userId);
  try {
    const { rows } = await pool.query(
      `UPDATE "USER" SET ${updates.join(', ')} WHERE userid = $${params.length}
       RETURNING userid, name, email, role, designation, division, phone`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    console.error('PATCH /admin/users:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /admin/users/:userId
router.delete('/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

  try {
    const { rowCount } = await pool.query('DELETE FROM "USER" WHERE userid = $1', [userId]);
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /admin/users:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
