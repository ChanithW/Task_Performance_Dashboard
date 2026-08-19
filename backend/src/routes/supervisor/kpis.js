const express = require('express');
const pool    = require('../../config/db');

const router = express.Router();

// GET /supervisor/kpis — all KPIs created by this supervisor with assignment summaries
router.get('/', async (req, res) => {
  const supervisorId = req.user.userId;
  try {
    const { rows } = await pool.query(
      `SELECT
         k.kpiid, k.title, k.description, k.metric, k.unit, k.period, k.createdat,
         json_agg(
           json_build_object(
             'assignmentid', a.assignmentid,
             'employeeid',   a.employeeid,
             'employeename', u.name,
             'targetvalue',  a.targetvalue,
             'startdate',    a.startdate,
             'enddate',      a.enddate,
             'currentvalue', COALESCE(p.latestvalue, 0),
             'progress_pct', CASE WHEN a.targetvalue > 0
                               THEN ROUND((COALESCE(p.latestvalue,0) / a.targetvalue) * 100, 1)
                               ELSE 0 END
           ) ORDER BY u.name
         ) FILTER (WHERE a.assignmentid IS NOT NULL) AS assignments
       FROM KPI k
       LEFT JOIN KPI_ASSIGNMENT a ON a.kpiid = k.kpiid
       LEFT JOIN "USER" u ON u.userid = a.employeeid
       LEFT JOIN LATERAL (
         SELECT SUM(value) AS latestvalue
         FROM KPI_PROGRESS
         WHERE assignmentid = a.assignmentid
       ) p ON TRUE
       WHERE k.createdby = $1
       GROUP BY k.kpiid
       ORDER BY k.createdat DESC`,
      [supervisorId]
    );
    res.json({ kpis: rows });
  } catch (err) {
    console.error('GET /supervisor/kpis:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /supervisor/kpis — create KPI and assign to employees
// Body: { title, description, metric, unit, period, targetvalue, startdate, enddate, assignees: [userId,...] }
router.post('/', async (req, res) => {
  const supervisorId = req.user.userId;
  const { title, description, metric, unit = 'count', period = 'monthly',
          targetvalue, startdate, enddate, assignees = [] } = req.body;

  if (!title || !targetvalue || !assignees.length) {
    return res.status(400).json({ error: 'title, targetvalue and at least one assignee are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO KPI (title, description, metric, unit, period, createdby)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, description || null, metric || null, unit, period, supervisorId]
    );
    const kpi = rows[0];

    for (const empId of assignees) {
      await client.query(
        `INSERT INTO KPI_ASSIGNMENT (kpiid, employeeid, supervisorid, targetvalue, startdate, enddate)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [kpi.kpiid, empId, supervisorId, targetvalue, startdate || null, enddate || null]
      );

      // Notify employee
      const supRow = await client.query(`SELECT name FROM "USER" WHERE userid = $1`, [supervisorId]);
      const supName = supRow.rows[0]?.name || 'Your supervisor';
      await client.query(
        `INSERT INTO NOTIFICATION (userid, taskid, channel, message, scheduledat, sentat, status, isread)
         VALUES ($1, NULL, 'InApp', $2, NOW(), NOW(), 'Sent', FALSE)`,
        [empId, `${supName} assigned you a new KPI: "${title}". Target: ${targetvalue} ${unit}.`]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ kpi });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /supervisor/kpis:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /supervisor/kpis/:id — KPI detail with full progress history per employee
router.get('/:id', async (req, res) => {
  const supervisorId = req.user.userId;
  const kpiId = parseInt(req.params.id);
  if (isNaN(kpiId)) return res.status(400).json({ error: 'Invalid KPI ID' });

  try {
    const kpiRow = await pool.query(
      `SELECT * FROM KPI WHERE kpiid = $1 AND createdby = $2`,
      [kpiId, supervisorId]
    );
    if (!kpiRow.rows.length) return res.status(404).json({ error: 'KPI not found' });

    const { rows: assignments } = await pool.query(
      `SELECT
         a.assignmentid, a.employeeid, a.targetvalue, a.startdate, a.enddate,
         u.name AS employeename,
         COALESCE(SUM(p.value), 0) AS currentvalue,
         json_agg(
           json_build_object(
             'progressid', p.progressid,
             'value',      p.value,
             'notes',      p.notes,
             'recordedat', p.recordedat,
             'recordedby', rb.name
           ) ORDER BY p.recordedat DESC
         ) FILTER (WHERE p.progressid IS NOT NULL) AS progress_log
       FROM KPI_ASSIGNMENT a
       JOIN "USER" u ON u.userid = a.employeeid
       LEFT JOIN KPI_PROGRESS p ON p.assignmentid = a.assignmentid
       LEFT JOIN "USER" rb ON rb.userid = p.recordedby
       WHERE a.kpiid = $1
       GROUP BY a.assignmentid, a.employeeid, a.targetvalue, a.startdate, a.enddate, u.name`,
      [kpiId]
    );

    res.json({ kpi: kpiRow.rows[0], assignments });
  } catch (err) {
    console.error('GET /supervisor/kpis/:id:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /supervisor/kpis/:id
router.delete('/:id', async (req, res) => {
  const supervisorId = req.user.userId;
  const kpiId = parseInt(req.params.id);
  if (isNaN(kpiId)) return res.status(400).json({ error: 'Invalid KPI ID' });

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM KPI WHERE kpiid = $1 AND createdby = $2`,
      [kpiId, supervisorId]
    );
    if (!rowCount) return res.status(404).json({ error: 'KPI not found' });
    res.json({ message: 'KPI deleted' });
  } catch (err) {
    console.error('DELETE /supervisor/kpis/:id:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
