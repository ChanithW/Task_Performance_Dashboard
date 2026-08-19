const express = require('express');
const pool    = require('../../config/db');

const router = express.Router();

// GET /employee/dashboard
// Summary stats + recent tasks + pending assignments + unread notifications
router.get('/', async (req, res) => {
  const userId = req.user.userId;

  try {
    const [statsRes, recentRes, pendingRes, notifRes, timeRes, taskTimeRes, floatingRes, floatingDoneRes] = await Promise.all([

      // Task counts by status
      pool.query(
        `SELECT
           COUNT(*)                                                              AS total,
           COUNT(*) FILTER (WHERE t.status IN ('InProgress','Submitted'))       AS inprogress,
           COUNT(*) FILTER (WHERE t.status = 'Submitted')                       AS underreview,
           COUNT(*) FILTER (WHERE t.status = 'Completed')                       AS completed,
           COUNT(*) FILTER (WHERE t.status = 'Overdue')                         AS overdue,
           COUNT(*) FILTER (WHERE t.status = 'Pending')                         AS pending,
           COUNT(*) FILTER (WHERE t.status = 'UnableToComplete')                AS unabletocomplete
         FROM TASK t
         JOIN TASK_ASSIGNMENT a ON a.taskid = t.taskid AND a.assignedto = $1 AND a.acceptancestatus != 'Rejected'`,
        [userId]
      ),

      // 5 most recent tasks
      pool.query(
        `SELECT t.taskid, t.title, t.priority, t.status, t.duedate, t.actualdate,
                c.slug AS taskcategory, c.name AS categoryname, c.color AS categorycolor,
                t.publishmode, t.estimatedtime, t.estimatedtimeunit, t.totalhrsexpended,
                t.createdat, t.startdate, t.createdby,
                u.name AS createdbyname,
                a.assignmentid, a.acceptancestatus
         FROM TASK t
         JOIN TASK_ASSIGNMENT a ON a.taskid = t.taskid AND a.assignedto = $1 AND a.acceptancestatus != 'Rejected'
         JOIN "USER" u ON u.userid = t.createdby
         JOIN categories c ON c.categoryid = t.categoryid
         ORDER BY t.createdat DESC
         LIMIT 5`,
        [userId]
      ),

      // Pending assignment requests
      pool.query(
        `SELECT a.assignmentid, a.assignedat, t.title, t.priority, t.duedate,
                u.name AS assignedbyname
         FROM TASK_ASSIGNMENT a
         JOIN TASK   t ON t.taskid  = a.taskid
         JOIN "USER" u ON u.userid  = a.assignedby
         WHERE a.assignedto = $1 AND a.acceptancestatus = 'Pending'
         ORDER BY a.assignedat DESC`,
        [userId]
      ),

      // Unread notification count
      pool.query(
        `SELECT COUNT(*) AS unread FROM NOTIFICATION WHERE userid = $1 AND isread = FALSE`,
        [userId]
      ),

      // Time utilization aggregate (hours only, for apples-to-apples comparison)
      pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN t.estimatedtimeunit = 'h' THEN t.estimatedtime
                             WHEN t.estimatedtimeunit = 'd' THEN t.estimatedtime * 8
                             ELSE t.estimatedtime END), 0) AS totalestimated,
           COALESCE(SUM(t.totalhrsexpended), 0)            AS totalspent
         FROM TASK t
         JOIN TASK_ASSIGNMENT a ON a.taskid = t.taskid AND a.assignedto = $1 AND a.acceptancestatus != 'Rejected'`,
        [userId]
      ),

      // Per-task hours breakdown (top 8 tasks with estimated time set)
      pool.query(
        `SELECT t.taskid, t.title,
                CASE WHEN t.estimatedtimeunit = 'h' THEN t.estimatedtime
                     WHEN t.estimatedtimeunit = 'd' THEN t.estimatedtime * 8
                     ELSE t.estimatedtime END AS estimatedhours,
                COALESCE(t.totalhrsexpended, 0) AS spenthours,
                c.slug AS taskcategory
         FROM TASK t
         JOIN TASK_ASSIGNMENT a ON a.taskid = t.taskid AND a.assignedto = $1 AND a.acceptancestatus != 'Rejected'
         JOIN categories c ON c.categoryid = t.categoryid
         WHERE t.estimatedtime IS NOT NULL AND t.estimatedtime > 0
         ORDER BY t.estimatedtime DESC
         LIMIT 8`,
        [userId]
      ),

      // Floating tasks — available for any employee to pick up
      pool.query(
        `SELECT t.taskid, t.title, t.priority, t.duedate,
                t.estimatedtime, t.estimatedtimeunit,
                c.slug AS taskcategory, c.name AS categoryname, c.color AS categorycolor,
                u.name AS createdbyname
         FROM TASK t
         JOIN categories c ON c.categoryid = t.categoryid
         JOIN "USER" u ON u.userid = t.createdby
         WHERE t.publishmode = 'Floating'
           AND t.status = 'Pending'
           AND NOT EXISTS (
             SELECT 1 FROM TASK_ASSIGNMENT a WHERE a.taskid = t.taskid
           )
         ORDER BY t.createdat DESC`
      ),

      // Floating tasks this employee has claimed and completed
      pool.query(
        `SELECT COUNT(*) AS count
         FROM TASK t
         JOIN TASK_ASSIGNMENT a ON a.taskid = t.taskid AND a.assignedto = $1
         WHERE t.publishmode = 'Floating' AND t.status = 'Completed'`,
        [userId]
      ),
    ]);

    res.json({
      stats: {
        total:            parseInt(statsRes.rows[0].total),
        inProgress:       parseInt(statsRes.rows[0].inprogress),
        underReview:      parseInt(statsRes.rows[0].underreview),
        completed:        parseInt(statsRes.rows[0].completed),
        overdue:          parseInt(statsRes.rows[0].overdue),
        pending:          parseInt(statsRes.rows[0].pending),
        unableToComplete: parseInt(statsRes.rows[0].unabletocomplete),
      },
      recentTasks:        recentRes.rows,
      pendingAssignments: pendingRes.rows,
      unreadNotifications: parseInt(notifRes.rows[0].unread),
      timeUtilization: {
        totalEstimated: parseFloat(timeRes.rows[0].totalestimated) || 0,
        totalSpent:     parseFloat(timeRes.rows[0].totalspent)     || 0,
      },
      taskHoursBreakdown: taskTimeRes.rows.map(r => ({
        taskId:         r.taskid,
        title:          r.title,
        estimatedHours: parseFloat(r.estimatedhours) || 0,
        spentHours:     parseFloat(r.spenthours)     || 0,
        category:       r.taskcategory,
      })),
      floatingTasks:        floatingRes.rows,
      floatingCompleted:    parseInt(floatingDoneRes.rows[0].count) || 0,
    });
  } catch (err) {
    console.error('GET /employee/dashboard:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
