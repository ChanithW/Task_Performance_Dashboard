require('dotenv').config();
const pool = require('./src/config/db');
async function run() {
  try {
    await pool.query(`ALTER TABLE "USER" ADD COLUMN IF NOT EXISTS PasswordHash VARCHAR(255) NOT NULL DEFAULT ''`);
    console.log('✓ PasswordHash column added (or already existed)');
  } catch(e) {
    console.log('ERROR:', e.message);
  }
  await pool.end();
}
run();
