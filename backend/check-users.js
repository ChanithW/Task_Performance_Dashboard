require('dotenv').config();
const pool = require('./src/config/db');
async function run() {
  try {
    const r = await pool.query('SELECT userid, name, role FROM "USER" ORDER BY userid');
    console.log(JSON.stringify(r.rows, null, 2));
  } catch(e) {
    console.log('ERROR:', e.message);
  }
  await pool.end();
}
run();
