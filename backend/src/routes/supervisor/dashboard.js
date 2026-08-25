const express = require('express');
const pool    = require('../../config/db');
const router  = express.Router();

// GET /supervisor/dashboard
router.get('/', async (req, res) => {
  const userId   = req.user.userId;
  const roleFilter = req.user.role === 'HOD' ? `AND u.role = 'Supervisor'` : `AND u.role = 'Employee'`;
  try {
    const [statsRes, teamRes, ageingRes, trendsRes, pendingApprovalRes] = await Promise.all([

      // Task counts for tasks created by this supervisor (split team vs self-logged)
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE t.publishmode != 'Self')                                           AS total,
           COUNT(*) FILTER (WHERE t.publishmode != 'Self' AND t.status IN ('InProgress','Overdue'))   AS inprogress,
           COUNT(*) FILTER (WHERE t.publishmode != 'Self' AND t.status = 'Completed')                AS completed,
           COUNT(*) FILTER (WHERE t.publishmode != 'Self' AND t.status = 'Pending')                  AS pending,
           COUNT(*) FILTER (WHERE t.publishmode = 'Self')                                            AS self_total,
           COUNT(*) FILTER (WHERE t.publishmode = 'Self' AND t.status = 'InProgress')                AS self_inprogress,
           COUNT(*) FILTER (WHERE t.publishmode = 'Self' AND t.status = 'Completed')                 AS self_completed
         FROM TASK t
         WHERE t.createdby = $1`,
        [userId]
      ),

      // Direct reports with their task counts + hours
      pool.query(
        `SELECT u.userid, u.name, u.designation,
                COUNT(t.taskid)                                                     AS total,
                COUNT(t.taskid) FILTER (WHERE t.status IN ('InProgress','Pending','Overdue')) AS active,
                COUNT(t.taskid) FILTER (WHERE t.status = 'Completed')               AS completed,
                COALESCE(SUM(t.totalhrsexpended), 0)                                AS hours_spent
         FROM "USER" u
         LEFT JOIN TASK_ASSIGNMENT a ON a.assignedto = u.userid AND a.acceptancestatus != 'Rejected'
         LEFT JOIN TASK t ON t.taskid = a.taskid
         WHERE u.reportsto = $1 ${roleFilter}
         GROUP BY u.userid, u.name, u.designation
         ORDER BY u.name`,
        [userId]
      ),

      // Task ageing — open tasks grouped by age bucket
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE CURRENT_DATE - t.createdat::date <= 7)   AS "0_7",
           COUNT(*) FILTER (WHERE CURRENT_DATE - t.createdat::date BETWEEN 8  AND 14) AS "8_14",
           COUNT(*) FILTER (WHERE CURRENT_DATE - t.createdat::date BETWEEN 15 AND 30) AS "15_30",
           COUNT(*) FILTER (WHERE CURRENT_DATE - t.createdat::date > 30)   AS "over30"
         FROM TASK t
         WHERE t.createdby = $1
           AND t.status NOT IN ('Completed','Submitted')`,
        [userId]
      ),

      // Completion trend — tasks completed per week (last 8 weeks)
      pool.query(
        `SELECT
           TO_CHAR(DATE_TRUNC('week', t.createdat), 'Mon DD') AS week_label,
           DATE_TRUNC('week', t.createdat)                    AS week_start,
           COUNT(*)                                           AS total,
           COUNT(*) FILTER (WHERE t.status = 'Completed')    AS completed
         FROM TASK t
         WHERE t.createdby = $1
           AND t.createdat >= NOW() - INTERVAL '8 weeks'
         GROUP BY DATE_TRUNC('week', t.createdat)
         ORDER BY week_start ASC`,
        [userId]
      ),

      // Tasks pending approval (submitted by employees)
      pool.query(
        `SELECT t.taskid, t.title, t.priority,
                c.slug AS taskcategory, c.name AS categoryname, c.color AS categorycolor,
                u.name AS employeename, s.submittedat
         FROM TASK_SUBMISSION s
         JOIN TASK t ON t.taskid = s.taskid AND t.createdby = $1
         JOIN "USER" u ON u.userid = s.submittedby
         JOIN categories c ON c.categoryid = t.categoryid
         LEFT JOIN TASK_APPROVAL a ON a.submissionid = s.submissionid
         WHERE s.status IN ('Completed','UnableToComplete') AND a.submissionid IS NULL
         ORDER BY s.submittedat DESC`,
        [userId]
      ),
    ]);

    const stats = statsRes.rows[0];
    res.json({
      stats: {
        total:          parseInt(stats.total),
        inProgress:     parseInt(stats.inprogress),
        completed:      parseInt(stats.completed),
        pending:        parseInt(stats.pending),
        selfTotal:      parseInt(stats.self_total),
        selfInProgress: parseInt(stats.self_inprogress),
        selfCompleted:  parseInt(stats.self_completed),
      },
      team: teamRes.rows.map(r => ({
        userid:      r.userid,
        name:        r.name,
        designation: r.designation,
        total:       parseInt(r.total)       || 0,
        active:      parseInt(r.active)      || 0,
        completed:   parseInt(r.completed)   || 0,
        hoursSpent:  parseFloat(r.hours_spent) || 0,
        productivity: parseInt(r.total) > 0
          ? Math.round((parseInt(r.completed) / parseInt(r.total)) * 100)
          : 0,
      })),
      pendingApproval: pendingApprovalRes.rows,
      taskAgeing: {
        '0_7':   parseInt(ageingRes.rows[0]['0_7'])   || 0,
        '8_14':  parseInt(ageingRes.rows[0]['8_14'])  || 0,
        '15_30': parseInt(ageingRes.rows[0]['15_30']) || 0,
        'over30':parseInt(ageingRes.rows[0]['over30'])|| 0,
      },
      completionTrend: trendsRes.rows.map(r => ({
        label:     r.week_label,
        total:     parseInt(r.total)     || 0,
        completed: parseInt(r.completed) || 0,
      })),
    });
  } catch (err) {
    console.error('GET /supervisor/dashboard:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
