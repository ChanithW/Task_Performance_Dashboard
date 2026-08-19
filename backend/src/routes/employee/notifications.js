const express = require('express');
const pool    = require('../../config/db');

const router = express.Router();

// GET /employee/notifications
// Returns notifications for the employee. Query: ?unread=true
router.get('/', async (req, res) => {
  const userId = req.user.userId;
  const unreadOnly = req.query.unread === 'true';

  const params = [userId];
  let unreadClause = '';
  if (unreadOnly) {
    unreadClause = 'AND isread = FALSE';
  }

  try {
    const { rows } = await pool.query(
      `SELECT n.notificationid, n.taskid, n.channel, n.message,
              n.scheduledat, n.sentat, n.status, n.isread,
              t.title AS tasktitle
       FROM NOTIFICATION n
       LEFT JOIN TASK t ON t.taskid = n.taskid
       WHERE n.userid = $1 AND n.status = 'Sent' ${unreadClause}
       ORDER BY n.sentat DESC
       LIMIT 50`,
      params
    );
    res.json({ notifications: rows });
  } catch (err) {
    console.error('GET notifications error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /employee/notifications/:notificationId/read
// Mark a single notification as read
router.patch('/:notificationId/read', async (req, res) => {
  const userId         = req.user.userId;
  const notificationId = parseInt(req.params.notificationId);

  try {
    const { rowCount } = await pool.query(
      `UPDATE NOTIFICATION SET isread = TRUE
       WHERE notificationid = $1 AND userid = $2`,
      [notificationId, userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('PATCH notification read error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /employee/notifications/read-all
// Mark all notifications as read
router.patch('/read-all', async (req, res) => {
  const userId = req.user.userId;
  try {
    await pool.query(
      `UPDATE NOTIFICATION SET isread = TRUE WHERE userid = $1 AND isread = FALSE`,
      [userId]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('PATCH read-all error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
