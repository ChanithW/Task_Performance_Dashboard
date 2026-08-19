require('dotenv').config();
const pool = require('./src/config/db');
async function run() {
  try {
    const tables = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `);
    console.log('Tables:', tables.rows.map(r => r.tablename).join(', '));

    const taskCount = await pool.query('SELECT COUNT(*) FROM TASK');
    console.log('Tasks in DB:', taskCount.rows[0].count);

    const userCount = await pool.query('SELECT COUNT(*) FROM "USER"');
    console.log('Users in DB:', userCount.rows[0].count);
  } catch(e) {
    console.log('ERROR:', e.message);
  }
  await pool.end();
}
run();
