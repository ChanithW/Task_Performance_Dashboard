const express = require('express');
const pool    = require('../../config/db');

const router = express.Router();

// GET /employee/profile
router.get('/', async (req, res) => {
  const userId = req.user.userId;
  try {
    const { rows } = await pool.query(
      `SELECT u.userid, u.name, u.email, u.phone, u.designation, u.role, u.division,
              sup.name AS reportstomame
       FROM "USER" u
       LEFT JOIN "USER" sup ON sup.userid = u.reportsto
       WHERE u.userid = $1`,
      [userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error('GET /employee/profile:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
