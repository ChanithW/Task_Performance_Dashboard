const express = require('express');
const pool    = require('../../config/db');

const router = express.Router();

// Shared column list for task SELECT queries
const TASK_COLUMNS = `
  t.taskid, t.title, t.description, t.priority, t.duedate, t.duetime,
  t.starttime, t.endtime,
  t.estimatedtime, t.estimatedtimeunit, t.categoryid, c.slug AS taskcategory, c.name AS categoryname, c.color AS categorycolor, t.publishmode, t.status,
  t.createdat, t.scheduledat, t.createdby,
  -- Work Tracking
  t.sitename, t.division, t.monitoringtype, t.inspectedby, t.siteincharge,
  t.contactno, t.actualdate, t.inspectionhrs, t.reportinghrs, t.travellinghrs,
  t.totalhrsexpended, t.ncraised, t.ncclosed, t.meetingdatewithsupervisor, t.reportstatus,
  -- Support Service
  t.date, t.employeename, t.natureofservice, t.servicerequestdivision,
  t.servicerequestername, t.totaltimebyemployee, t.reviewedby, t.totaltimeforreview,
  -- Training & Project
  t.activityname, t.activitycategory, t.mode, t.scope, t.conductedby,
  t.durationhours, t.startdate, t.enddate, t.actualparticipants,
  t.plannedparticipants, t.remarks
`;

// GET /employee/tasks
// Query params: ?status=Pending|InProgress|Completed|Overdue|UnableToComplete&category=WorkTracking|SupportService|TrainingProject
router.get('/', async (req, res) => {
  const userId = req.user.userId;
  const { status, category } = req.query;

  const params = [userId];
  const clauses = [];

  if (status) {
    params.push(status);
    clauses.push(`t.status = $${params.length}`);
  }
  if (category) {
    params.push(category);
    clauses.push(`t.categoryid = (SELECT categoryid FROM categories WHERE slug = $${params.length})`);
  }
  const where = clauses.length ? 'AND ' + clauses.join(' AND ') : '';

  try {
    const { rows } = await pool.query(
      `SELECT ${TASK_COLUMNS},
              u.name AS createdbyname,
              a.assignmentid, a.acceptancestatus, a.plannedstartdate, a.notifyat, a.assignedat,
              COALESCE(
                (SELECT json_agg(json_build_object('userid', au.userid, 'name', au.name) ORDER BY au.name)
                 FROM TASK_ASSIGNMENT aa JOIN "USER" au ON au.userid = aa.assignedto
                 WHERE aa.taskid = t.taskid AND aa.acceptancestatus != 'Rejected'),
                '[]'
              ) AS assignees
       FROM TASK t
       JOIN TASK_ASSIGNMENT a ON a.taskid = t.taskid AND a.assignedto = $1 AND a.acceptancestatus != 'Rejected'
       JOIN "USER" u           ON u.userid = t.createdby
       JOIN categories c       ON c.categoryid = t.categoryid
       WHERE 1=1 ${where}
       ORDER BY t.duedate ASC NULLS LAST, t.createdat DESC`,
      params
    );
    res.json({ tasks: rows });
  } catch (err) {
    console.error('GET /employee/tasks:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /employee/tasks/:taskId
router.get('/:taskId', async (req, res) => {
  const userId = req.user.userId;
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  try {
    const { rows } = await pool.query(
      `SELECT ${TASK_COLUMNS},
              u.name AS createdbyname,
              a.assignmentid, a.acceptancestatus, a.plannedstartdate, a.notifyat, a.assignedat,
              COALESCE(
                (SELECT json_agg(json_build_object('userid', au.userid, 'name', au.name) ORDER BY au.name)
                 FROM TASK_ASSIGNMENT aa JOIN "USER" au ON au.userid = aa.assignedto
                 WHERE aa.taskid = t.taskid AND aa.acceptancestatus != 'Rejected'),
                '[]'
              ) AS assignees
       FROM TASK t
       JOIN TASK_ASSIGNMENT a ON a.taskid = t.taskid AND a.assignedto = $1
       JOIN "USER" u           ON u.userid = t.createdby
       JOIN categories c       ON c.categoryid = t.categoryid
       WHERE t.taskid = $2`,
      [userId, taskId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json({ task: rows[0] });
  } catch (err) {
    console.error('GET /employee/tasks/:taskId:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /employee/tasks  — log own work (self-assigned task)
router.post('/', async (req, res) => {
  const userId = req.user.userId;
  const {
    title, description, priority = 'Medium', dueDate, dueTime, estimatedTime, taskCategory,
    // Work Tracking
    siteName, division, monitoringType, inspectedBy, siteIncharge, contactNo,
    actualDate, inspectionHrs, reportingHrs, travellingHrs, totalHrsExpended,
    ncRaised, ncClosed, meetingDateWithSupervisor, reportStatus,
    // Support Service
    date, employeeName, natureOfService, serviceRequestDivision, serviceRequesterName,
    totalTimeByEmployee, reviewedBy, totalTimeForReview,
    // Training & Project
    activityName, activityCategory, mode, scope, conductedBy, durationHours,
    startDate, endDate, actualParticipants, plannedParticipants, remarks,
  } = req.body;

  if (!title || !taskCategory) {
    return res.status(400).json({ error: 'title and taskCategory are required' });
  }

  // Resolve category slug → categoryid
  const catRow = await pool.query('SELECT categoryid FROM categories WHERE slug = $1', [taskCategory]);
  if (!catRow.rows.length) {
    return res.status(400).json({ error: `Unknown taskCategory: ${taskCategory}` });
  }
  const categoryId = catRow.rows[0].categoryid;

  // Build INSERT dynamically — only include columns that have a value.
  const cols   = ['title', 'categoryid', 'publishmode', 'status', 'createdby'];
  const vals   = [title,   categoryId,   'Direct',      'InProgress', userId];

  const optional = [
    ['description',             description             || null],
    ['priority',                priority                || 'Medium'],
    ['duedate',                 dueDate                 || null],
    ['duetime',                 dueTime                 || null],
    ['estimatedtime',           estimatedTime != null ? estimatedTime : null],
    ['estimatedtimeunit',       req.body.estimatedTimeUnit || 'h'],
    // Work Tracking
    ['sitename',                siteName                || null],
    ['division',                division                || null],
    ['monitoringtype',          monitoringType          || null],
    ['inspectedby',             inspectedBy             || null],
    ['siteincharge',            siteIncharge            || null],
    ['contactno',               contactNo               || null],
    ['actualdate',              actualDate              || null],
    ['inspectionhrs',           inspectionHrs           || null],
    ['reportinghrs',            reportingHrs            || null],
    ['travellinghrs',           travellingHrs           || null],
    ['totalhrsexpended',        totalHrsExpended        || null],
    ['ncraised',                ncRaised                || null],
    ['ncclosed',                ncClosed                || null],
    ['meetingdatewithsupervisor', meetingDateWithSupervisor || null],
    ['reportstatus',            reportStatus            || null],
    // Support Service
    ['date',                    date                    || null],
    ['employeename',            employeeName            || null],
    ['natureofservice',         natureOfService         || null],
    ['servicerequestdivision',  serviceRequestDivision  || null],
    ['servicerequestername',    serviceRequesterName    || null],
    ['totaltimebyemployee',     totalTimeByEmployee     || null],
    ['reviewedby',              reviewedBy              || null],
    ['totaltimeforreview',      totalTimeForReview      || null],
    // Training & Project
    ['activityname',            activityName            || null],
    ['activitycategory',        activityCategory        || null],
    ['mode',                    mode                    || null],
    ['scope',                   scope                   || null],
    ['conductedby',             conductedBy             || null],
    ['durationhours',           durationHours           || null],
    ['startdate',               startDate               || null],
    ['enddate',                 endDate                 || null],
    ['actualparticipants',      actualParticipants      || null],
    ['plannedparticipants',     plannedParticipants     || null],
    ['remarks',                 remarks                 || null],
  ];

  // Only add columns whose value is not null/undefined
  for (const [col, val] of optional) {
    if (val !== null && val !== undefined) {
      cols.push(col);
      vals.push(val);
    }
  }

  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO TASK (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      vals
    );
    const task = rows[0];

    await client.query(
      `INSERT INTO TASK_ASSIGNMENT (taskid, assignedby, assignedto, acceptancestatus)
       VALUES ($1, $2, $2, 'Accepted')`,
      [task.taskid, userId]
    );

    await client.query(
      `INSERT INTO NOTIFICATION (userid, taskid, channel, message, scheduledat, sentat, status, isread)
       VALUES ($1, $2, 'InApp', $3, NOW(), NOW(), 'Sent', FALSE)`,
      [userId, task.taskid, `Your task "${task.title}" has been logged and is now in progress.`]
    );

    await client.query('COMMIT');
    res.status(201).json({ task });
  } catch (err) {
    await client.query('ROLLBACK');
    // Log full detail so we can diagnose DB errors easily
    console.error('POST /employee/tasks error:', err.message, err.detail || '', err.code || '');
    res.status(500).json({ error: err.message }); // expose real error during development
  } finally {
    client.release();
  }
});

// PATCH /employee/tasks/:taskId  — update own self-logged task
router.patch('/:taskId', async (req, res) => {
  const userId = req.user.userId;
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  // Allow editing if: employee created the task, OR employee is assigned to it and it's InProgress
  const { rows: check } = await pool.query(
    `SELECT t.taskid FROM TASK t
     WHERE t.taskid = $1
       AND (
         t.createdby = $2
         OR (
           t.status = 'InProgress'
           AND EXISTS (
             SELECT 1 FROM TASK_ASSIGNMENT a
             WHERE a.taskid = t.taskid AND a.assignedto = $2 AND a.acceptancestatus != 'Rejected'
           )
         )
       )`,
    [taskId, userId]
  );
  if (!check.length) return res.status(403).json({ error: 'Task not found or not editable' });

  const allowed = [
    'title','description','priority','duedate','duetime','estimatedtime',
    'sitename','division','monitoringtype','inspectedby','siteincharge','contactno',
    'actualdate','inspectionhrs','reportinghrs','travellinghrs','totalhrsexpended',
    'ncraised','ncclosed','meetingdatewithsupervisor','reportstatus',
    'date','employeename','natureofservice','servicerequestdivision','servicerequestername',
    'totaltimebyemployee','reviewedby','totaltimeforreview',
    'activityname','activitycategory','mode','scope','conductedby','durationhours',
    'startdate','enddate','actualparticipants','plannedparticipants','remarks',
  ];

  const updates = [];
  const params  = [];
  for (const [key, val] of Object.entries(req.body)) {
    const col = key.toLowerCase();
    if (allowed.includes(col)) {
      params.push(val);
      updates.push(`${col} = $${params.length}`);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

  params.push(taskId);
  try {
    const { rows } = await pool.query(
      `UPDATE TASK SET ${updates.join(', ')} WHERE taskid = $${params.length} RETURNING *`,
      params
    );
    res.json({ task: rows[0] });
  } catch (err) {
    console.error('PATCH /employee/tasks/:taskId:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
