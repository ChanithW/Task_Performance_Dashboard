const express = require('express');
const pool    = require('../config/db');
const router  = express.Router();

// GET /reports/summary
// HOD/Admin → all tasks; Supervisor → tasks they created; Employee → tasks assigned to them
router.get('/summary', async (req, res) => {
  const { userId, role } = req.user;

  let scopeWhere, params;
  if (role === 'HOD' || role === 'Admin') {
    scopeWhere = '';
    params     = [];
  } else if (role === 'Supervisor') {
    scopeWhere = 'AND t.createdby = $1';
    params     = [userId];
  } else {
    scopeWhere = `AND EXISTS (
      SELECT 1 FROM TASK_ASSIGNMENT _a
      WHERE _a.taskid = t.taskid AND _a.assignedto = $1 AND _a.acceptancestatus != 'Rejected'
    )`;
    params = [userId];
  }

  const w = `WHERE 1=1 ${scopeWhere}`;   // reusable WHERE fragment

  try {
    const [statsRes, durRes, trendRes, catRes] = await Promise.all([

      // Counts: this month vs last month, overdue
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE t.createdat >= DATE_TRUNC('month', NOW()))
            AS total_this_month,
          COUNT(*) FILTER (WHERE t.createdat >= DATE_TRUNC('month', NOW())
                             AND t.status = 'Completed')
            AS completed_this_month,
          COUNT(*) FILTER (WHERE t.createdat >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
                             AND t.createdat <  DATE_TRUNC('month', NOW()))
            AS total_last_month,
          COUNT(*) FILTER (WHERE t.createdat >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
                             AND t.createdat <  DATE_TRUNC('month', NOW())
                             AND t.status = 'Completed')
            AS completed_last_month,
          COUNT(*) FILTER (WHERE t.status = 'Overdue')
            AS overdue_total,
          COUNT(*) FILTER (WHERE t.createdat >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
                             AND t.createdat <  DATE_TRUNC('month', NOW())
                             AND t.status = 'Overdue')
            AS overdue_last_month
        FROM TASK t ${w}
      `, params),

      // Avg hours expended on completed tasks (this month vs last month)
      pool.query(`
        SELECT
          ROUND(AVG(t.totalhrsexpended)::numeric, 1) AS avg_duration,
          ROUND(AVG(
            CASE WHEN t.createdat >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
                  AND t.createdat <  DATE_TRUNC('month', NOW())
                 THEN t.totalhrsexpended END
          )::numeric, 1) AS avg_duration_last_month
        FROM TASK t ${w}
        AND t.status = 'Completed'
        AND t.totalhrsexpended IS NOT NULL
        AND t.totalhrsexpended > 0
      `, params),

      // Completion trend — last 8 weeks by ACTUAL completion date
      // Uses generate_series for a full week spine (no missing weeks)
      pool.query(`
        WITH weeks AS (
          SELECT generate_series(
            DATE_TRUNC('week', NOW() - INTERVAL '7 weeks'),
            DATE_TRUNC('week', NOW()),
            INTERVAL '1 week'
          ) AS week_start
        ),
        completed AS (
          SELECT DATE_TRUNC('week', t.actualdate::timestamp) AS week_start,
                 COUNT(*) AS cnt
          FROM TASK t
          WHERE t.status = 'Completed'
            AND t.actualdate IS NOT NULL
            AND t.actualdate >= NOW() - INTERVAL '8 weeks'
            ${scopeWhere}
          GROUP BY DATE_TRUNC('week', t.actualdate::timestamp)
        ),
        overdue AS (
          SELECT DATE_TRUNC('week', t.duedate::timestamp) AS week_start,
                 COUNT(*) AS cnt
          FROM TASK t
          WHERE t.status = 'Overdue'
            AND t.duedate IS NOT NULL
            AND t.duedate >= NOW() - INTERVAL '8 weeks'
            ${scopeWhere}
          GROUP BY DATE_TRUNC('week', t.duedate::timestamp)
        )
        SELECT
          TO_CHAR(w.week_start, 'Mon DD') AS week_label,
          w.week_start,
          COALESCE(c.cnt, 0) AS completed,
          COALESCE(o.cnt, 0) AS overdue
        FROM weeks w
        LEFT JOIN completed c ON c.week_start = w.week_start
        LEFT JOIN overdue   o ON o.week_start = w.week_start
        ORDER BY w.week_start ASC
      `, params),

      // By category
      pool.query(`
        SELECT c.name, c.slug, c.color,
               COUNT(*)                                        AS total,
               COUNT(*) FILTER (WHERE t.status = 'Completed') AS completed
        FROM TASK t
        JOIN categories c ON c.categoryid = t.categoryid
        ${w}
        GROUP BY c.categoryid, c.name, c.slug, c.color
        ORDER BY total DESC
      `, params),
    ]);

    const s = statsRes.rows[0];

    const totalThisMonth      = parseInt(s.total_this_month)      || 0;
    const completedThisMonth  = parseInt(s.completed_this_month)  || 0;
    const totalLastMonth      = parseInt(s.total_last_month)      || 0;
    const completedLastMonth  = parseInt(s.completed_last_month)  || 0;
    const overdueTotal        = parseInt(s.overdue_total)         || 0;
    const overdueLastMonth    = parseInt(s.overdue_last_month)    || 0;

    const completionRate          = totalThisMonth  > 0 ? Math.round((completedThisMonth  / totalThisMonth)  * 100) : 0;
    const completionRateLastMonth = totalLastMonth  > 0 ? Math.round((completedLastMonth  / totalLastMonth)  * 100) : 0;

    const avgDuration          = parseFloat(durRes.rows[0].avg_duration)           || 0;
    const avgDurationLastMonth = parseFloat(durRes.rows[0].avg_duration_last_month) || 0;

    res.json({
      stats: {
        totalThisMonth,
        totalDelta:           totalThisMonth - totalLastMonth,
        completionRate,
        completionRateDelta:  completionRate - completionRateLastMonth,
        avgDuration,
        avgDurationDelta:     parseFloat((avgDuration - avgDurationLastMonth).toFixed(1)),
        overdueTotal,
        overdueDelta:         overdueTotal - overdueLastMonth,
      },
      trend: trendRes.rows.map(r => ({
        label:     r.week_label,
        completed: parseInt(r.completed) || 0,
        overdue:   parseInt(r.overdue)   || 0,
      })),
      byCategory: catRes.rows.map(r => ({
        name:      r.name,
        slug:      r.slug,
        color:     r.color,
        total:     parseInt(r.total)     || 0,
        completed: parseInt(r.completed) || 0,
      })),
    });
  } catch (err) {
    console.error('GET /reports/summary:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reports/operational — HOD/Admin only
router.get('/operational', async (req, res) => {
  const { role } = req.user;
  if (role !== 'HOD' && role !== 'Admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const [categoryRes, trendsRes, recentRes] = await Promise.all([

      // Summary counts per category
      pool.query(`
        SELECT c.name, c.slug, c.color,
               COUNT(t.taskid)                                        AS total,
               COUNT(t.taskid) FILTER (WHERE t.status = 'Completed') AS completed,
               COUNT(t.taskid) FILTER (WHERE t.status = 'InProgress') AS inprogress,
               COUNT(t.taskid) FILTER (WHERE t.status = 'Pending') AS pending
        FROM categories c
        LEFT JOIN TASK t ON t.categoryid = c.categoryid
        GROUP BY c.categoryid, c.name, c.slug, c.color
        ORDER BY c.name
      `),

      // Activity trends — tasks created per week per category (last 8 weeks)
      pool.query(`
        WITH weeks AS (
          SELECT generate_series(
            DATE_TRUNC('week', NOW() - INTERVAL '7 weeks'),
            DATE_TRUNC('week', NOW()),
            INTERVAL '1 week'
          ) AS week_start
        )
        SELECT
          TO_CHAR(w.week_start, 'Mon DD') AS label,
          w.week_start,
          c.slug,
          c.name AS cat_name,
          c.color,
          COUNT(t.taskid) AS cnt
        FROM weeks w
        CROSS JOIN categories c
        LEFT JOIN TASK t ON t.categoryid = c.categoryid
          AND DATE_TRUNC('week', t.createdat) = w.week_start
        GROUP BY w.week_start, c.categoryid, c.slug, c.name, c.color
        ORDER BY w.week_start ASC, c.name ASC
      `),

      // Recent task records (last 50)
      pool.query(`
        SELECT t.taskid, t.title, t.status, t.priority, t.createdat,
               c.name AS categoryname, c.slug AS categoryslug, c.color AS categorycolor,
               u.name AS createdbyname
        FROM TASK t
        JOIN categories c ON c.categoryid = t.categoryid
        JOIN "USER" u ON u.userid = t.createdby
        ORDER BY t.createdat DESC
        LIMIT 50
      `),
    ]);

    // Build activity trends as {label, week_start, categories: {slug: cnt}}
    const weekMap = {};
    for (const r of trendsRes.rows) {
      const key = r.week_start.toISOString();
      if (!weekMap[key]) weekMap[key] = { label: r.label };
      weekMap[key][r.slug] = parseInt(r.cnt) || 0;
    }
    const activityTrend = Object.values(weekMap);

    res.json({
      categories: categoryRes.rows.map(r => ({
        name:       r.name,
        slug:       r.slug,
        color:      r.color,
        total:      parseInt(r.total)      || 0,
        completed:  parseInt(r.completed)  || 0,
        inprogress: parseInt(r.inprogress) || 0,
        pending:    parseInt(r.pending)    || 0,
      })),
      activityTrend,
      records: recentRes.rows,
    });
  } catch (err) {
    console.error('GET /reports/operational:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reports/trend?period=7d|14d|1m|3m|6m|1y&offset=N
// offset=0 → current window, offset=1 → one period back, etc.
router.get('/trend', async (req, res) => {
  const { userId, role } = req.user;
  const period = req.query.period || '1m';
  const offset = Math.max(0, parseInt(req.query.offset) || 0);

  let scopeWhere, params;
  if (role === 'HOD' || role === 'Admin') {
    scopeWhere = '';
    params     = [];
  } else if (role === 'Supervisor') {
    scopeWhere = 'AND t.createdby = $1';
    params     = [userId];
  } else {
    scopeWhere = `AND EXISTS (
      SELECT 1 FROM TASK_ASSIGNMENT _a
      WHERE _a.taskid = t.taskid AND _a.assignedto = $1 AND _a.acceptancestatus != 'Rejected'
    )`;
    params = [userId];
  }

  // Map period code → { interval, trunc, labelFmt, seriesInterval }
  const cfg = {
    '7d':  { interval: '7 days',   trunc: 'day',   label: "Mon DD",    step: '1 day'   },
    '14d': { interval: '14 days',  trunc: 'day',   label: "Mon DD",    step: '1 day'   },
    '1m':  { interval: '4 weeks',  trunc: 'week',  label: "Mon DD",    step: '1 week'  },
    '3m':  { interval: '12 weeks', trunc: 'week',  label: "Mon DD",    step: '1 week'  },
    '6m':  { interval: '6 months', trunc: 'month', label: "Mon ''YY",  step: '1 month' },
    '1y':  { interval: '1 year',   trunc: 'month', label: "Mon ''YY",  step: '1 month' },
  };
  const c = cfg[period] || cfg['1m'];
  const unit = c.trunc === 'day' ? 'day_start' : c.trunc === 'week' ? 'week_start' : 'month_start';

  // window_end   = NOW() - offset * interval
  // window_start = NOW() - (offset+1) * interval
  const offsetParam = params.length + 1;
  params = [...params, offset];

  const query = `
    WITH
    window_end   AS (SELECT DATE_TRUNC('${c.trunc}', NOW() - ($${offsetParam}::int       * INTERVAL '${c.interval}')) AS ts),
    window_start AS (SELECT DATE_TRUNC('${c.trunc}', NOW() - (($${offsetParam}::int + 1) * INTERVAL '${c.interval}')) AS ts),
    spine AS (
      SELECT generate_series(
        (SELECT ts FROM window_start),
        (SELECT ts FROM window_end),
        INTERVAL '${c.step}'
      ) AS ${unit}
    ),
    completed AS (
      SELECT DATE_TRUNC('${c.trunc}', t.actualdate::timestamp) AS ${unit}, COUNT(*) AS cnt
      FROM TASK t
      WHERE t.status = 'Completed' AND t.actualdate IS NOT NULL
        AND t.actualdate >= (SELECT ts FROM window_start)
        AND t.actualdate <  (SELECT ts FROM window_end) + INTERVAL '${c.interval}'
        ${scopeWhere}
      GROUP BY 1
    ),
    overdue AS (
      SELECT DATE_TRUNC('${c.trunc}', t.duedate::timestamp) AS ${unit}, COUNT(*) AS cnt
      FROM TASK t
      WHERE t.status = 'Overdue' AND t.duedate IS NOT NULL
        AND t.duedate >= (SELECT ts FROM window_start)
        AND t.duedate <  (SELECT ts FROM window_end) + INTERVAL '${c.interval}'
        ${scopeWhere}
      GROUP BY 1
    )
    SELECT TO_CHAR(s.${unit}, '${c.label}') AS label,
           COALESCE(comp.cnt, 0) AS completed,
           COALESCE(ov.cnt,   0) AS overdue
    FROM spine s
    LEFT JOIN completed comp ON comp.${unit} = s.${unit}
    LEFT JOIN overdue   ov   ON ov.${unit}   = s.${unit}
    ORDER BY s.${unit} ASC
  `;

  try {
    const { rows } = await pool.query(query, params);
    res.json({
      period,
      offset,
      trend: rows.map(r => ({
        label:     r.label,
        completed: parseInt(r.completed) || 0,
        overdue:   parseInt(r.overdue)   || 0,
      })),
    });
  } catch (err) {
    console.error('GET /reports/trend:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reports/employee-performance
// HOD/Admin → all employees; Supervisor → their direct reports only
router.get('/employee-performance', async (req, res) => {
  const { userId, role } = req.user;

  let userWhere, params;
  if (role === 'HOD' || role === 'Admin') {
    userWhere = `u.role = 'Employee'`;
    params    = [];
  } else {
    userWhere = `u.role = 'Employee' AND u.reportsto = $1`;
    params    = [userId];
  }

  try {
    const { rows } = await pool.query(`
      SELECT
        u.userid,
        u.name,
        u.designation,
        u.division,
        sup.name                                                              AS supervisor,
        COUNT(t.taskid)                                                       AS total,
        COUNT(t.taskid) FILTER (WHERE t.status = 'Completed')                AS completed,
        COUNT(t.taskid) FILTER (WHERE t.status = 'InProgress')               AS inprogress,
        COUNT(t.taskid) FILTER (WHERE t.status = 'Overdue')                  AS overdue,
        COUNT(t.taskid) FILTER (WHERE t.status = 'Pending')                  AS pending,
        COUNT(t.taskid) FILTER (WHERE t.status = 'Submitted')                AS submitted,
        -- on-time: completed before or on due date
        COUNT(t.taskid) FILTER (
          WHERE t.status = 'Completed'
            AND t.duedate IS NOT NULL
            AND t.actualdate IS NOT NULL
            AND t.actualdate <= t.duedate
        )                                                                     AS on_time,
        ROUND(COALESCE(AVG(t.totalhrsexpended) FILTER (WHERE t.status = 'Completed'), 0)::numeric, 1)
                                                                              AS avg_hrs
      FROM "USER" u
      LEFT JOIN "USER" sup ON sup.userid = u.reportsto
      LEFT JOIN TASK_ASSIGNMENT a ON a.assignedto = u.userid AND a.acceptancestatus != 'Rejected'
      LEFT JOIN TASK t ON t.taskid = a.taskid
      WHERE ${userWhere}
      GROUP BY u.userid, u.name, u.designation, u.division, sup.name
      ORDER BY u.name
    `, params);

    res.json({
      employees: rows.map(r => ({
        userid:         r.userid,
        name:           r.name,
        designation:    r.designation || '—',
        division:       r.division    || '—',
        supervisor:     r.supervisor  || '—',
        total:          parseInt(r.total)      || 0,
        completed:      parseInt(r.completed)  || 0,
        inprogress:     parseInt(r.inprogress) || 0,
        overdue:        parseInt(r.overdue)    || 0,
        pending:        parseInt(r.pending)    || 0,
        submitted:      parseInt(r.submitted)  || 0,
        onTime:         parseInt(r.on_time)    || 0,
        avgHrs:         parseFloat(r.avg_hrs)  || 0,
        completionRate: parseInt(r.total) > 0
          ? Math.round((parseInt(r.completed) / parseInt(r.total)) * 100)
          : 0,
        onTimeRate: parseInt(r.completed) > 0
          ? Math.round((parseInt(r.on_time) / parseInt(r.completed)) * 100)
          : null,
      })),
    });
  } catch (err) {
    console.error('GET /reports/employee-performance:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
