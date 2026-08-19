const express = require('express');
const pool    = require('../../config/db');

const router = express.Router();

// POST /employee/tasks/:taskId/submit
// Body: { status, unableReason?, remarks?, actualCompletionTime? }
router.post('/:taskId/submit', async (req, res) => {
  const userId = req.user.userId;
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  const { status, unableReason, remarks, actualCompletionTime, startTime, endTime, completionDate } = req.body;

  const validStatuses = ['Completed', 'InProgress', 'UnableToComplete'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }
  if (status === 'UnableToComplete' && !unableReason) {
    return res.status(400).json({ error: 'unableReason is required when status is UnableToComplete' });
  }

  // Verify task is assigned to this employee and accepted
  const { rows: check } = await pool.query(
    `SELECT assignmentid FROM TASK_ASSIGNMENT
     WHERE taskid = $1 AND assignedto = $2 AND acceptancestatus = 'Accepted'`,
    [taskId, userId]
  );
  if (!check.length) {
    return res.status(403).json({ error: 'Task not assigned to you or not yet accepted' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO TASK_SUBMISSION (taskid, submittedby, status, unablereason, remarks, actualcompletiontime, starttime, endtime, completiondate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [taskId, userId, status, unableReason || null, remarks || null,
       actualCompletionTime ? parseFloat(actualCompletionTime) : null,
       startTime || null, endTime || null, completionDate || null]
    );

    // Update TASK with total hours expended
    if (actualCompletionTime) {
      await client.query(
        `UPDATE TASK SET totalhrsexpended = COALESCE(totalhrsexpended, 0) + $1 WHERE taskid = $2`,
        [actualCompletionTime, taskId]
      );
    }

    // Completed submission → awaiting supervisor review (Submitted)
    // UnableToComplete → stays as-is for supervisor to review
    // InProgress → partial update, stays InProgress
    const newTaskStatus = {
      Completed:        'Submitted',
      UnableToComplete: 'Submitted',
      InProgress:       'InProgress',
    }[status];

    await client.query(`UPDATE TASK SET status = $1 WHERE taskid = $2`, [newTaskStatus, taskId]);

    // Notify the supervisor who assigned this task
    const taskRow = await client.query(
      `SELECT t.title, t.createdby, u.name AS empname
       FROM TASK t
       JOIN "USER" u ON u.userid = $2
       WHERE t.taskid = $1`,
      [taskId, userId]
    );
    if (taskRow.rows.length) {
      const { title, createdby, empname } = taskRow.rows[0];
      const statusLabel = { Completed: 'completed', InProgress: 'submitted for review', UnableToComplete: 'marked as unable to complete' }[status] || status;
      await client.query(
        `INSERT INTO NOTIFICATION (userid, taskid, channel, message, scheduledat, sentat, status, isread)
         VALUES ($1, $2, 'InApp', $3, NOW(), NOW(), 'Sent', FALSE)`,
        [createdby, taskId, `${empname} has ${statusLabel} the task "${title}".`]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ submission: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST submit:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /employee/tasks/:taskId/submissions
// Submission history with approval decisions
router.get('/:taskId/submissions', async (req, res) => {
  const userId = req.user.userId;
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  try {
    const { rows } = await pool.query(
      `SELECT
         s.submissionid, s.status, s.unablereason, s.remarks,
         s.actualcompletiontime, s.submittedat,
         a.decision AS approvaldecision, a.reason AS approvalreason,
         a.decidedat, sup.name AS approvedbyname
       FROM TASK_SUBMISSION s
       LEFT JOIN TASK_APPROVAL a ON a.submissionid = s.submissionid
       LEFT JOIN "USER" sup      ON sup.userid = a.supervisorid
       WHERE s.taskid = $1 AND s.submittedby = $2
       ORDER BY s.submittedat DESC`,
      [taskId, userId]
    );
    res.json({ submissions: rows });
  } catch (err) {
    console.error('GET submissions:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
