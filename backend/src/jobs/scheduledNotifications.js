const pool = require('../config/db');

/**
 * Picks up any NOTIFICATION rows with status='Scheduled' whose scheduledat
 * has passed, marks them Sent, and makes them visible to the recipient.
 */
async function runScheduledNotifications() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE NOTIFICATION
       SET sentat = NOW(), status = 'Sent'
       WHERE status = 'Scheduled'
         AND scheduledat <= NOW()
       RETURNING notificationid, userid, taskid, message`
    );

    await client.query('COMMIT');

    if (rows.length > 0) {
      console.log(`[ScheduledNotif] Dispatched ${rows.length} scheduled notification(s)`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ScheduledNotif] Error:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { runScheduledNotifications };
