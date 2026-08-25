const express = require('express');
const pool    = require('../config/db');
const router  = express.Router();

const ALLOWED_BADGES = ['star','trophy','medal','rocket','shield','fire','heart','crown'];

// GET /achievements?limit=30  — visible to all authenticated users
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  try {
    const { rows } = await pool.query(
      `SELECT a.achievementid, a.title, a.description, a.badge, a.createdat,
              u.userid, u.name AS username, u.designation, u.division,
              a.awardedby, s.name AS awardedbyname
       FROM achievement a
       JOIN "USER" u ON u.userid = a.userid
       JOIN "USER" s ON s.userid = a.awardedby
       ORDER BY a.createdat DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ achievements: rows });
  } catch (err) {
    console.error('GET /achievements:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /achievements  — supervisor / HOD / admin only
router.post('/', async (req, res) => {
  const { role, userId } = req.user;
  if (!['Supervisor','HOD','Admin'].includes(role)) {
    return res.status(403).json({ error: 'Only supervisors and HOD can award achievements' });
  }

  const { userid, title, description, badge = 'star' } = req.body;
  if (!userid || !title?.trim()) {
    return res.status(400).json({ error: 'userid and title are required' });
  }
  if (!ALLOWED_BADGES.includes(badge)) {
    return res.status(400).json({ error: 'Invalid badge type' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO achievement (userid, awardedby, title, description, badge)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING achievementid`,
      [userid, userId, title.trim(), description?.trim() || null, badge]
    );

    // Notify the recipient
    const awarderRow = await pool.query(`SELECT name FROM "USER" WHERE userid = $1`, [userId]);
    const awarderName = awarderRow.rows[0]?.name || 'Your supervisor';
    await pool.query(
      `INSERT INTO NOTIFICATION (userid, taskid, channel, message, scheduledat, sentat, status, isread)
       VALUES ($1, NULL, 'InApp', $2, NOW(), NOW(), 'Sent', FALSE)`,
      [userid, `🏆 ${awarderName} awarded you an achievement: "${title.trim()}"`]
    );

    res.status(201).json({ achievementid: rows[0].achievementid });
  } catch (err) {
    console.error('POST /achievements:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /achievements/:id  — only the awarder or admin
router.delete('/:id', async (req, res) => {
  const { role, userId } = req.user;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const { rows } = await pool.query(
      `DELETE FROM achievement WHERE achievementid = $1 AND ($2 = 'Admin' OR awardedby = $3) RETURNING achievementid`,
      [id, role, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found or not authorised' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('DELETE /achievements:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
