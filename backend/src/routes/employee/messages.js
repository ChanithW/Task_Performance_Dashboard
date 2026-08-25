const express = require('express');
const pool    = require('../../config/db');

const router = express.Router();

// HODs have universal chat access; others need to be task creator, assignee, or explicit participant
async function hasAccess(taskId, userId, role) {
  if (role === 'HOD') return true;
  const { rows } = await pool.query(
    `SELECT 1 FROM TASK WHERE taskid = $1 AND createdby = $2
     UNION
     SELECT 1 FROM TASK_ASSIGNMENT WHERE taskid = $1 AND assignedto = $2
     UNION
     SELECT 1 FROM TASK_CHAT_PARTICIPANT WHERE taskid = $1 AND userid = $2
     LIMIT 1`,
    [taskId, userId]
  );
  return rows.length > 0;
}

// GET /tasks/:taskId/chat-participants  (any role with access)
router.get('/:taskId/chat-participants', async (req, res) => {
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  try {
    const { rows } = await pool.query(
      `SELECT u.userid, u.name, u.designation, 'assignee' AS source
       FROM TASK_ASSIGNMENT a JOIN "USER" u ON u.userid = a.assignedto
       WHERE a.taskid = $1 AND a.acceptancestatus != 'Rejected'
       UNION
       SELECT u.userid, u.name, u.designation, 'participant' AS source
       FROM TASK_CHAT_PARTICIPANT p JOIN "USER" u ON u.userid = p.userid
       WHERE p.taskid = $1
       ORDER BY name`,
      [taskId]
    );
    res.json({ participants: rows });
  } catch (err) {
    console.error('GET chat-participants:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /tasks/:taskId/chat-participants  (HOD only — add anyone from org)
router.post('/:taskId/chat-participants', async (req, res) => {
  const { userId: hodId, role } = req.user;
  if (role !== 'HOD') return res.status(403).json({ error: 'Only HOD can add participants' });

  const taskId   = parseInt(req.params.taskId);
  const addUserId = parseInt(req.body.userId);
  if (isNaN(taskId) || isNaN(addUserId)) return res.status(400).json({ error: 'Invalid IDs' });

  try {
    await pool.query(
      `INSERT INTO TASK_CHAT_PARTICIPANT (taskid, userid, addedby)
       VALUES ($1, $2, $3) ON CONFLICT (taskid, userid) DO NOTHING`,
      [taskId, addUserId, hodId]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST chat-participants:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /tasks/:taskId/chat-participants/:userId  (HOD only)
router.delete('/:taskId/chat-participants/:uid', async (req, res) => {
  if (req.user.role !== 'HOD') return res.status(403).json({ error: 'Only HOD can remove participants' });

  const taskId  = parseInt(req.params.taskId);
  const uid     = parseInt(req.params.uid);
  if (isNaN(taskId) || isNaN(uid)) return res.status(400).json({ error: 'Invalid IDs' });

  try {
    await pool.query(
      `DELETE FROM TASK_CHAT_PARTICIPANT WHERE taskid = $1 AND userid = $2`,
      [taskId, uid]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE chat-participant:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /employee/tasks/:taskId/messages  or  /tasks/:taskId/messages
router.get('/:taskId/messages', async (req, res) => {
  const userId = req.user.userId;
  const role   = req.user.role;
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  if (!(await hasAccess(taskId, userId, role))) {
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

// POST /employee/tasks/:taskId/messages  or  /tasks/:taskId/messages
// Body: { content }
router.post('/:taskId/messages', async (req, res) => {
  const userId  = req.user.userId;
  const role    = req.user.role;
  const taskId  = parseInt(req.params.taskId);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  const content = (req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'content is required' });

  if (!(await hasAccess(taskId, userId, role))) {
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
