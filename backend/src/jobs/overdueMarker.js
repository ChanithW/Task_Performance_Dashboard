const pool = require('../config/db');

async function runOverdueMarker() {
  try {
    const { rowCount } = await pool.query(
      `UPDATE TASK
       SET status = 'Overdue'
       WHERE status IN ('Pending', 'InProgress')
         AND duedate IS NOT NULL
         AND duedate < CURRENT_DATE`
    );
    if (rowCount > 0) {
      console.log(`[overdueMarker] Marked ${rowCount} task(s) as Overdue`);
    }
  } catch (err) {
    console.error('[overdueMarker] Error:', err.message);
  }
}

module.exports = { runOverdueMarker };
