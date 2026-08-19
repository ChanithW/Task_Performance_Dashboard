const pool = require('../config/db');

/**
 * Sends an in-app notification and records it in TASK_REMINDER_LOG.
 * The UNIQUE constraint on (taskid, userid, remindertype) silently skips duplicates.
 */
async function sendReminder(client, { taskId, userId, reminderType, message }) {
  // Skip if already sent
  const { rows } = await client.query(
    `INSERT INTO TASK_REMINDER_LOG (taskid, userid, remindertype)
     VALUES ($1, $2, $3)
     ON CONFLICT (taskid, userid, remindertype) DO NOTHING
     RETURNING id`,
    [taskId, userId, reminderType]
  );
  if (!rows.length) return; // already sent

  await client.query(
    `INSERT INTO NOTIFICATION (userid, taskid, channel, message, scheduledat, sentat, status, isread)
     VALUES ($1, $2, 'InApp', $3, NOW(), NOW(), 'Sent', FALSE)`,
    [userId, taskId, message]
  );
}

/**
 * Due-date reminders:
 *   due_24h  →  duedate = CURRENT_DATE + 1  (due tomorrow)
 *   due_2h   →  duedate = CURRENT_DATE      (due today)
 */
async function runDueDateReminders(client) {
  const { rows: tasks } = await client.query(
    `SELECT
       t.taskid, t.title,
       t.duedate,
       a.assignedto AS userid,
       u.name AS username
     FROM TASK t
     JOIN TASK_ASSIGNMENT a ON a.taskid = t.taskid AND a.acceptancestatus = 'Accepted'
     JOIN "USER" u ON u.userid = a.assignedto
     WHERE t.status NOT IN ('Completed')
       AND t.duedate IS NOT NULL
       AND t.duedate IN (CURRENT_DATE + 1, CURRENT_DATE)`
  );

  for (const task of tasks) {
    const dueDate    = new Date(task.duedate);
    const today      = new Date();
    today.setHours(0, 0, 0, 0);
    const isTomorrow = dueDate.getTime() === today.getTime() + 86400000;

    if (isTomorrow) {
      await sendReminder(client, {
        taskId:       task.taskid,
        userId:       task.userid,
        reminderType: 'due_24h',
        message:      `⏰ Reminder: "${task.title}" is due tomorrow. Make sure to complete it on time.`,
      });
    } else {
      await sendReminder(client, {
        taskId:       task.taskid,
        userId:       task.userid,
        reminderType: 'due_2h',
        message:      `🚨 Urgent: "${task.title}" is due today! Please wrap up and submit your work.`,
      });
    }
  }

  return tasks.length;
}

/**
 * Allocated-time reminders:
 *   alloc_24h  →  startdate + estimatedtime hours ≈ 24h from now  (within ±1h window)
 *   alloc_2h   →  startdate + estimatedtime hours ≈  2h from now  (within ±1h window)
 *
 * Only fires when estimatedtimeunit = 'h' (hours) and startdate is set.
 * For days unit: estimatedtime * 8 hours (one working day).
 */
async function runAllocatedTimeReminders(client) {
  const { rows: tasks } = await client.query(
    `SELECT
       t.taskid, t.title,
       t.startdate, t.estimatedtime, t.estimatedtimeunit,
       a.assignedto AS userid,
       u.name AS username,
       (
         t.startdate::timestamp +
         CASE t.estimatedtimeunit
           WHEN 'h' THEN (t.estimatedtime || ' hours')::interval
           WHEN 'd' THEN (t.estimatedtime * 8 || ' hours')::interval
           ELSE           (t.estimatedtime || ' hours')::interval
         END
       ) AS allocend
     FROM TASK t
     JOIN TASK_ASSIGNMENT a ON a.taskid = t.taskid AND a.acceptancestatus = 'Accepted'
     JOIN "USER" u ON u.userid = a.assignedto
     WHERE t.status NOT IN ('Completed','Submitted')
       AND t.startdate IS NOT NULL
       AND t.estimatedtime IS NOT NULL
       AND t.estimatedtime > 0`
  );

  const now = new Date();
  let count = 0;

  for (const task of tasks) {
    const allocEnd      = new Date(task.allocend);
    const diffMs        = allocEnd - now;
    const diffH         = diffMs / 3600000;

    // 24h window: between 23h and 25h remaining
    if (diffH >= 23 && diffH < 25) {
      await sendReminder(client, {
        taskId:       task.taskid,
        userId:       task.userid,
        reminderType: 'alloc_24h',
        message:      `⏳ Heads-up: You have ~24 hours of allocated time left for "${task.title}". Keep it up!`,
      });
      count++;
    }

    // 2h window: between 1h and 3h remaining
    if (diffH >= 1 && diffH < 3) {
      await sendReminder(client, {
        taskId:       task.taskid,
        userId:       task.userid,
        reminderType: 'alloc_2h',
        message:      `⚠️ Only ~2 hours of allocated time remaining for "${task.title}". Please complete or update your supervisor.`,
      });
      count++;
    }
  }

  return count;
}

async function runDeadlineReminders() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dueCount   = await runDueDateReminders(client);
    const allocCount = await runAllocatedTimeReminders(client);
    await client.query('COMMIT');
    if (dueCount + allocCount > 0) {
      console.log(`[Reminders] Sent ${dueCount} due-date + ${allocCount} allocated-time reminders`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Reminders] Error:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { runDeadlineReminders };
