const express = require('express');
const pool    = require('../../config/db');

const router = express.Router();

// GET /supervisor/progress  — per-employee task breakdown for employees the supervisor manages
router.get('/', async (req, res) => {
  const userId = req.user.userId;

  try {
    const { rows } = await pool.query(
      `SELECT
         u.userid,
         u.name,
         u.designation,
         COUNT(t.taskid)                                              AS total,
         COUNT(t.taskid) FILTER (WHERE t.status = 'Completed')       AS completed,
         COUNT(t.taskid) FILTER (WHERE t.status = 'InProgress')      AS inprogress,
         COUNT(t.taskid) FILTER (WHERE t.status = 'Overdue')         AS overdue,
         COUNT(t.taskid) FILTER (WHERE t.status = 'Pending')         AS pending,
         COUNT(t.taskid) FILTER (
           WHERE t.status NOT IN ('Completed','Overdue')
           AND t.duedate < CURRENT_DATE
         )                                                            AS deadline_exceeded
       FROM "USER" u
       LEFT JOIN TASK_ASSIGNMENT a ON a.assignedto = u.userid
       LEFT JOIN TASK t ON t.taskid = a.taskid
       WHERE u.role = 'Employee' AND u.reportsto = $1
       GROUP BY u.userid, u.name, u.designation
       ORDER BY u.name`,
      [userId]
    );

    res.json({ employees: rows });
  } catch (err) {
    console.error('GET /supervisor/progress:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
