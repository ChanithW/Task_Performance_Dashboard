const express = require('express');
const pool    = require('../../config/db');

const router = express.Router();

// GET /supervisor/tasks — all tasks created by this supervisor
router.get('/', async (req, res) => {
  const userId = req.user.userId;
  try {
    const { rows } = await pool.query(
      `SELECT t.taskid, t.title, t.description, t.priority, t.status,
              t.publishmode, c.slug AS taskcategory, c.name AS categoryname, c.color AS categorycolor,
              t.estimatedtime, t.estimatedtimeunit,
              t.duedate, t.startdate, t.starttime, t.endtime, t.createdat, t.totalhrsexpended,
              t.division, t.sitename,
              COALESCE(
                json_agg(
                  json_build_object('userid', u.userid, 'name', u.name)
                  ORDER BY u.name
                ) FILTER (WHERE u.userid IS NOT NULL),
                '[]'
              ) AS assignees
       FROM TASK t
       JOIN categories c ON c.categoryid = t.categoryid
       LEFT JOIN TASK_ASSIGNMENT a ON a.taskid = t.taskid AND a.acceptancestatus != 'Rejected'
       LEFT JOIN "USER" u ON u.userid = a.assignedto
       WHERE t.createdby = $1
       GROUP BY t.taskid, c.slug, c.name, c.color
       ORDER BY t.createdat DESC`,
      [userId]
    );
    res.json({ tasks: rows });
  } catch (err) {
    console.error('GET /supervisor/tasks:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /supervisor/tasks — create and assign a task
router.post('/', async (req, res) => {
  const userId = req.user.userId;
  const {
    title, description, priority = 'Medium', dueDate, startDate, startTime, endTime,
    taskCategory, estimatedTime, estimatedTimeUnit = 'h',
    publishMode = 'Direct', assignees = [], deadlineReminder, notifScheduledAt,
    // Work Tracking
    siteName, division, monitoringType, inspectedBy, siteInCharge, contactNo,
    inspectionHrs, reportingHrs, travellingHrs, ncRaised, ncClosed, reportStatus,
    // Support Service
    natureOfService, serviceRequestDivision, serviceRequesterName,
    totalTimeByEmployee, reviewedBy, totalTimeForReview,
    // Training & Project
    activityName, activityCategory, tpMode, scope, conductedBy, durationHours,
    plannedParticipants, actualParticipants,
  } = req.body;

  if (!title || !taskCategory) {
    return res.status(400).json({ error: 'title and taskCategory are required' });
  }

  const catRow = await pool.query('SELECT categoryid FROM categories WHERE slug = $1', [taskCategory]);
  if (!catRow.rows.length) {
    return res.status(400).json({ error: `Unknown taskCategory: ${taskCategory}` });
  }
  const categoryId = catRow.rows[0].categoryid;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cols = ['title', 'description', 'priority', 'status', 'publishmode', 'categoryid',
                  'estimatedtime', 'estimatedtimeunit', 'duedate', 'startdate',
                  'starttime', 'endtime', 'createdby', 'deadlinereminder'];
    const vals = [title, description || null, priority, 'Pending', publishMode, categoryId,
                  estimatedTime || null, estimatedTimeUnit,
                  dueDate || null, startDate || null,
                  startTime || null, endTime || null, userId,
                  deadlineReminder ? parseInt(deadlineReminder) : null];

    const optional = [
      ['sitename',               siteName               || null],
      ['division',               division               || null],
      ['monitoringtype',         monitoringType         || null],
      ['inspectedby',            inspectedBy            || null],
      ['siteincharge',           siteInCharge           || null],
      ['contactno',              contactNo              || null],
      ['inspectionhrs',          inspectionHrs          || null],
      ['reportinghrs',           reportingHrs           || null],
      ['travellinghrs',          travellingHrs          || null],
      ['ncraised',               ncRaised               || null],
      ['ncclosed',               ncClosed               || null],
      ['reportstatus',           reportStatus           || null],
      ['natureofservice',        natureOfService        || null],
      ['servicerequestdivision', serviceRequestDivision || null],
      ['servicerequestername',   serviceRequesterName   || null],
      ['totaltimebyemployee',    totalTimeByEmployee    || null],
      ['reviewedby',             reviewedBy             || null],
      ['totaltimeforreview',     totalTimeForReview     || null],
      ['activityname',           activityName           || null],
      ['activitycategory',       activityCategory       || null],
      ['mode',                   tpMode                 || null],
      ['scope',                  scope                  || null],
      ['conductedby',            conductedBy            || null],
      ['durationhours',          durationHours          || null],
      ['plannedparticipants',    plannedParticipants    || null],
      ['actualparticipants',     actualParticipants     || null],
    ];
    for (const [col, val] of optional) {
      if (val !== null && val !== undefined) { cols.push(col); vals.push(val); }
    }

    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await client.query(
      `INSERT INTO TASK (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`, vals
    );
    const task = rows[0];

    // Get supervisor name for notification message
    const supRow = await client.query(`SELECT name FROM "USER" WHERE userid = $1`, [userId]);
    const supName = supRow.rows[0]?.name || 'Your supervisor';

    // Create assignment records and in-app notifications for each assignee
    for (const assigneeId of assignees) {
      const isSelf = assigneeId === userId;
      await client.query(
        `INSERT INTO TASK_ASSIGNMENT (taskid, assignedby, assignedto, acceptancestatus)
         VALUES ($1, $2, $3, $4)`,
        [task.taskid, userId, assigneeId, isSelf ? 'Accepted' : 'Pending']
      );
      if (isSelf) {
        // Self-logged task — move straight to InProgress, no notification needed
        await client.query(`UPDATE TASK SET status = 'InProgress' WHERE taskid = $1`, [task.taskid]);
      } else {
        const isScheduled = notifScheduledAt && new Date(notifScheduledAt) > new Date();
        const schedAt = isScheduled ? new Date(notifScheduledAt).toISOString() : new Date().toISOString();
        await client.query(
          `INSERT INTO NOTIFICATION (userid, taskid, channel, message, scheduledat, sentat, status, isread)
           VALUES ($1, $2, 'InApp', $3, $4, $5, $6, FALSE)`,
          [
            assigneeId,
            task.taskid,
            `"${task.title}" has been assigned to you by ${supName}. Please review and accept the task.`,
            schedAt,
            isScheduled ? null : schedAt,
            isScheduled ? 'Scheduled' : 'Sent',
          ]
        );
      }
    }

    // For floating tasks no assignees needed
    await client.query('COMMIT');
    res.status(201).json({ task });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /supervisor/tasks:', err.message, err.detail || '');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /supervisor/tasks/:taskId/submissions — latest submission for a task
router.get('/:taskId/submissions', async (req, res) => {
  const supervisorId = req.user.userId;
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  try {
    const { rows } = await pool.query(
      `SELECT s.submissionid, s.status, s.remarks, s.unablereason,
              s.actualcompletiontime, s.submittedat,
              u.name AS submittedbyname,
              a.decision AS approvaldecision, a.reason AS approvalreason, a.decidedat
       FROM TASK_SUBMISSION s
       JOIN "USER" u ON u.userid = s.submittedby
       LEFT JOIN TASK_APPROVAL a ON a.submissionid = s.submissionid
       WHERE s.taskid = $1
         AND EXISTS (SELECT 1 FROM TASK t WHERE t.taskid = $1 AND t.createdby = $2)
       ORDER BY s.submittedat DESC`,
      [taskId, supervisorId]
    );
    res.json({ submissions: rows });
  } catch (err) {
    console.error('GET /supervisor/tasks/:taskId/submissions:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /supervisor/tasks/:taskId/review — approve or request revision
// Body: { submissionId, decision: 'Approved'|'Revision', reason? }
router.post('/:taskId/review', async (req, res) => {
  const supervisorId = req.user.userId;
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  const { submissionId, decision, reason } = req.body;
  if (!submissionId || !['Approved', 'Revision'].includes(decision)) {
    return res.status(400).json({ error: 'submissionId and decision (Approved|Revision) are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify task belongs to this supervisor and submission is pending review
    const taskRow = await client.query(
      `SELECT t.taskid, t.title, s.submittedby
       FROM TASK t
       JOIN TASK_SUBMISSION s ON s.submissionid = $1 AND s.taskid = t.taskid
       LEFT JOIN TASK_APPROVAL a ON a.submissionid = s.submissionid
       WHERE t.taskid = $2 AND t.createdby = $3 AND a.submissionid IS NULL`,
      [submissionId, taskId, supervisorId]
    );
    if (!taskRow.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Submission not found or already reviewed' });
    }
    const { title, submittedby } = taskRow.rows[0];

    // Insert approval record
    await client.query(
      `INSERT INTO TASK_APPROVAL (submissionid, supervisorid, decision, reason, decidedat)
       VALUES ($1, $2, $3, $4, NOW())`,
      [submissionId, supervisorId, decision, reason || null]
    );

    // Update task status
    const newStatus = decision === 'Approved' ? 'Completed' : 'InProgress';
    await client.query(`UPDATE TASK SET status = $1 WHERE taskid = $2`, [newStatus, taskId]);

    // Notify the employee
    const supRow = await client.query(`SELECT name FROM "USER" WHERE userid = $1`, [supervisorId]);
    const supName = supRow.rows[0]?.name || 'Your supervisor';
    const message = decision === 'Approved'
      ? `Your submission for "${title}" was approved by ${supName}. Well done!`
      : `${supName} requested a revision on "${title}". ${reason ? 'Reason: ' + reason : 'Please review and resubmit.'}`;

    await client.query(
      `INSERT INTO NOTIFICATION (userid, taskid, channel, message, scheduledat, sentat, status, isread)
       VALUES ($1, $2, 'InApp', $3, NOW(), NOW(), 'Sent', FALSE)`,
      [submittedby, taskId, message]
    );

    await client.query('COMMIT');
    res.json({ message: `Submission ${decision === 'Approved' ? 'approved' : 'sent for revision'}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /supervisor/tasks/:taskId/review:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
