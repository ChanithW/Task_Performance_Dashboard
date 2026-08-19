const express = require('express');
const pool    = require('../../config/db');

const router = express.Router();

// Check employee has access to a task's chat (assignee OR explicit participant)
async function hasAccess(taskId, userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM TASK_ASSIGNMENT     WHERE taskid = $1 AND assignedto = $2
     UNION
     SELECT 1 FROM TASK_CHAT_PARTICIPANT WHERE taskid = $1 AND userid   = $2
     LIMIT 1`,
    [taskId, userId]
  );
  return rows.length > 0;
}

// GET /employee/tasks/:taskId/messages
router.get('/:taskId/messages', async (req, res) => {
  const userId = req.user.userId;
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  if (!(await hasAccess(taskId, userId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT m.messageid, m.content, m.sentat,
              u.userid AS senderid, u.name AS sendername
       FROM MESSAGE m
       JOIN "USER" u ON u.userid = m.senderid
       WHERE m.taskid = $1
       ORDER BY m.sentat ASC`,
      [taskId]
    );
    res.json({ messages: rows });
  } catch (err) {
    console.error('GET messages:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /employee/tasks/:taskId/messages
// Body: { content }
router.post('/:taskId/messages', async (req, res) => {
  const userId  = req.user.userId;
  const taskId  = parseInt(req.params.taskId);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  const content = (req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'content is required' });

  if (!(await hasAccess(taskId, userId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO MESSAGE (taskid, senderid, content) VALUES ($1, $2, $3)
       RETURNING messageid, taskid, content, sentat`,
      [taskId, userId, content]
    );
    res.status(201).json({ message: rows[0] });
  } catch (err) {
    console.error('POST message:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
