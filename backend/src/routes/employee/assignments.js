const express = require('express');
const pool    = require('../../config/db');

const router = express.Router();

// GET /employee/assignments
// Pending assignments awaiting employee's response
router.get('/', async (req, res) => {
  const userId = req.user.userId;
  try {
    const { rows } = await pool.query(
      `SELECT
         a.assignmentid, a.taskid, a.assignedat, a.notifyat, a.plannedstartdate,
         a.acceptancestatus,
         t.title, t.description, t.priority, t.duedate,
         c.slug AS taskcategory, c.name AS categoryname, c.color AS categorycolor,
         u.name AS assignedbyname
       FROM TASK_ASSIGNMENT a
       JOIN TASK   t ON t.taskid  = a.taskid
       JOIN "USER" u ON u.userid  = a.assignedby
       JOIN categories c ON c.categoryid = t.categoryid
       WHERE a.assignedto = $1 AND a.acceptancestatus = 'Pending'
       ORDER BY a.assignedat DESC`,
      [userId]
    );
    res.json({ assignments: rows });
  } catch (err) {
    console.error('GET /employee/assignments:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /employee/assignments/:assignmentId/accept
router.patch('/:assignmentId/accept', async (req, res) => {
  const userId       = req.user.userId;
  const assignmentId = parseInt(req.params.assignmentId);
  if (isNaN(assignmentId)) return res.status(400).json({ error: 'Invalid assignment ID' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rowCount } = await client.query(
      `UPDATE TASK_ASSIGNMENT
       SET acceptancestatus = 'Accepted'
       WHERE assignmentid = $1 AND assignedto = $2 AND acceptancestatus = 'Pending'`,
      [assignmentId, userId]
    );
    if (!rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Assignment not found or already responded to' });
    }

    // Move task to InProgress if it was still Pending
    const taskRow = await client.query(
      `UPDATE TASK SET status = 'InProgress'
       WHERE taskid = (SELECT taskid FROM TASK_ASSIGNMENT WHERE assignmentid = $1)
         AND status = 'Pending'
       RETURNING taskid, title, createdby`,
      [assignmentId]
    );

    // Notify the supervisor that the employee accepted
    if (taskRow.rows.length) {
      const { taskid, title, createdby } = taskRow.rows[0];
      const empRow = await client.query(`SELECT name FROM "USER" WHERE userid = $1`, [userId]);
      const empName = empRow.rows[0]?.name || 'An employee';
      await client.query(
        `INSERT INTO NOTIFICATION (userid, taskid, channel, message, scheduledat, sentat, status, isread)
         VALUES ($1, $2, 'InApp', $3, NOW(), NOW(), 'Sent', FALSE)`,
        [createdby, taskid, `${empName} accepted the task "${title}" and has started working on it.`]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Assignment accepted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PATCH accept:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PATCH /employee/assignments/:assignmentId/reject
// Body (optional): { reason, replacementRequest }
router.patch('/:assignmentId/reject', async (req, res) => {
  const userId       = req.user.userId;
  const assignmentId = parseInt(req.params.assignmentId);
  if (isNaN(assignmentId)) return res.status(400).json({ error: 'Invalid assignment ID' });

  const { reason, replacementRequest } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rowCount, rows: assignRows } = await client.query(
      `UPDATE TASK_ASSIGNMENT
       SET acceptancestatus = 'Rejected',
           rejectionreason    = $3,
           replacementrequest = $4
       WHERE assignmentid = $1 AND assignedto = $2 AND acceptancestatus = 'Pending'
       RETURNING taskid`,
      [assignmentId, userId, reason || null, replacementRequest || null]
    );
    if (!rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Assignment not found or already responded to' });
    }

    const taskId = assignRows[0].taskid;
    const taskRow = await client.query(
      `SELECT t.title, t.createdby, u.name AS empname
       FROM TASK t JOIN "USER" u ON u.userid = $2
       WHERE t.taskid = $1`,
      [taskId, userId]
    );
    if (taskRow.rows.length) {
      const { title, createdby, empname } = taskRow.rows[0];
      const msg = reason
        ? `${empname} rejected the task "${title}". Reason: ${reason}`
        : `${empname} rejected the task "${title}".`;
      await client.query(
        `INSERT INTO NOTIFICATION (userid, taskid, channel, message, scheduledat, sentat, status, isread)
         VALUES ($1, $2, 'InApp', $3, NOW(), NOW(), 'Sent', FALSE)`,
        [createdby, taskId, msg]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Assignment rejected' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PATCH reject:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
