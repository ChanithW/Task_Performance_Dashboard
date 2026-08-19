const express = require('express');
const pool    = require('../../config/db');

const router = express.Router();

// GET /employee/kpis — all KPIs assigned to this employee
router.get('/', async (req, res) => {
  const userId = req.user.userId;
  try {
    const { rows } = await pool.query(
      `SELECT
         k.kpiid, k.title, k.description, k.metric, k.unit, k.period,
         a.assignmentid, a.targetvalue, a.startdate, a.enddate,
         u.name AS supervisorname,
         COALESCE(SUM(p.value), 0) AS currentvalue,
         CASE WHEN a.targetvalue > 0
           THEN ROUND((COALESCE(SUM(p.value),0) / a.targetvalue) * 100, 1)
           ELSE 0 END AS progress_pct
       FROM KPI_ASSIGNMENT a
       JOIN KPI k ON k.kpiid = a.kpiid
       JOIN "USER" u ON u.userid = a.supervisorid
       LEFT JOIN KPI_PROGRESS p ON p.assignmentid = a.assignmentid
       WHERE a.employeeid = $1
       GROUP BY k.kpiid, k.title, k.description, k.metric, k.unit, k.period,
                a.assignmentid, a.targetvalue, a.startdate, a.enddate, u.name
       ORDER BY k.createdat DESC`,
      [userId]
    );
    res.json({ kpis: rows });
  } catch (err) {
    console.error('GET /employee/kpis:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /employee/kpis/:assignmentId/progress — log a progress entry
// Body: { value, notes? }
router.post('/:assignmentId/progress', async (req, res) => {
  const userId       = req.user.userId;
  const assignmentId = parseInt(req.params.assignmentId);
  if (isNaN(assignmentId)) return res.status(400).json({ error: 'Invalid assignment ID' });

  const { value, notes } = req.body;
  if (value === undefined || value === null) return res.status(400).json({ error: 'value is required' });

  // Verify assignment belongs to this employee
  const { rows: check } = await pool.query(
    `SELECT a.assignmentid, a.supervisorid, k.title
     FROM KPI_ASSIGNMENT a JOIN KPI k ON k.kpiid = a.kpiid
     WHERE a.assignmentid = $1 AND a.employeeid = $2`,
    [assignmentId, userId]
  );
  if (!check.length) return res.status(403).json({ error: 'KPI assignment not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO KPI_PROGRESS (assignmentid, value, notes, recordedby)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [assignmentId, value, notes || null, userId]
    );

    // Notify supervisor
    const empRow = await client.query(`SELECT name FROM "USER" WHERE userid = $1`, [userId]);
    const empName = empRow.rows[0]?.name || 'An employee';
    const { title, supervisorid } = check[0];
    await client.query(
      `INSERT INTO NOTIFICATION (userid, taskid, channel, message, scheduledat, sentat, status, isread)
       VALUES ($1, NULL, 'InApp', $2, NOW(), NOW(), 'Sent', FALSE)`,
      [supervisorid, `${empName} logged a KPI progress update for "${title}": +${value}.`]
    );

    await client.query('COMMIT');
    res.status(201).json({ progress: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /employee/kpis/:id/progress:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
