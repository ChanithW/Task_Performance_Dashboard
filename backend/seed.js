require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('./src/config/db');

// Default password for all users (change after first login in production)
const DEFAULT_PASSWORD = 'qhse1234';

async function seed() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert users in order so ReportsTo foreign keys resolve correctly.
    // HOD first (no ReportsTo), then everyone else.
    const users = await client.query(
      `INSERT INTO "USER" (name, email, passwordhash, phone, designation, role, reportsto, division)
       VALUES
         ('Nisal Liyanage',          'nisal.liyanage@hayleys.com',       $1, NULL, 'Deputy General Manager', 'HOD',        NULL, 'QHSE'),
         ('Niroshan Weerasooriya',   'niroshan.weerasooriya@hayleys.com',$1, NULL, 'QHSE Officer',           'Supervisor', 1,    'QHSE'),
         ('Achini Sheronika',        'achini.sheronika@hayleys.com',     $1, NULL, 'QHSE Officer',           'Supervisor', 1,    'QHSE'),
         ('Jayathura Perera',        'jayathura.perera@hayleys.com',     $1, NULL, 'QHSE Officer',           'Supervisor', 1,    'QHSE'),
         ('Jayantha Jayasekara',     'jayantha.jayasekara@hayleys.com',  $1, NULL, 'QHSE Officer',           'Supervisor', 1,    'QHSE'),
         ('Tharushi Wanniarachchi',  'tharushi.wanniarachchi@hayleys.com',$1,NULL, 'QHSE Assistant',         'Employee',   1,    'QHSE'),
         ('Shehan Koonvinna',        'shehan.koonvinna@hayleys.com',     $1, NULL, 'QHSE Officer',           'Supervisor', 1,    'QHSE'),
         ('Hashini Yashintha',       'hashini.yashintha@hayleys.com',    $1, NULL, 'QHSE Officer',           'Supervisor', 1,    'QHSE'),
         ('Kaveesha Gayathri',       'kaveesha.gayathri@hayleys.com',    $1, NULL, 'QHSE Assistant',         'Employee',   1,    'QHSE'),
         ('Prabodha Samarasinghe',   'prabodha.samarasinghe@hayleys.com',$1, NULL, 'QHSE Assistant',         'Employee',   1,    'QHSE'),
         ('Ushan Pathum',            'ushan.pathum@hayleys.com',         $1, NULL, 'QHSE Assistant',         'Employee',   1,    'QHSE'),
         ('Heshan Wickramasingha',   'heshan.wickramasingha@hayleys.com',$1, NULL, 'QHSE Assistant',         'Employee',   1,    'QHSE'),
         ('Vishwa Tharanga',         'vishwa.tharanga@hayleys.com',      $1, NULL, 'QHSE Assistant',         'Employee',   1,    'QHSE'),
         ('Malika Kodithuwakkuge',   'malika.kodithuwakkuge@hayleys.com',$1, NULL, 'QHSE Assistant',         'Employee',   7,    'QHSE'),
         ('Vishwa Perera',           'vishwa.perera@hayleys.com',        $1, NULL, 'QHSE Assistant',         'Employee',   5,    'QHSE'),
         ('Resindu Heshan',          'resindu.heshan@hayleys.com',       $1, NULL, 'QHSE Assistant',         'Employee',   5,    'QHSE'),
         ('Udara Munasinghe',        'udara.munasinghe@hayleys.com',     $1, NULL, 'QHSE Assistant',         'Employee',   8,    'QHSE'),
         ('Amila Jayarathna',        'amila.jayarathna@hayleys.com',     $1, NULL, 'QHSE Assistant',         'Employee',   8,    'QHSE'),
         ('Salitha Mendis',          'salitha.mendis@hayleys.com',       $1, NULL, 'QHSE Assistant',         'Employee',   8,    'QHSE'),
         ('Keerthana Kiritharan',    'keerthana.kiritharan@hayleys.com', $1, NULL, 'QHSE Assistant',         'Employee',   8,    'QHSE')
       RETURNING userid, name, email, role`,
      [hash]
    );

    await client.query('COMMIT');

    console.log('\n✓ Seeded users:\n');
    console.log('  ID  | Role       | Name');
    console.log('  ----|------------|-----------------------------');
    users.rows.forEach(u =>
      console.log(`  ${String(u.userid).padEnd(3)} | ${u.role.padEnd(10)} | ${u.name}`)
    );
    console.log(`\n  Default password for all accounts: ${DEFAULT_PASSWORD}`);
    console.log('\n  Login endpoint: POST http://localhost:3000/auth/login');
    console.log('  Body: { "email": "tharushi.wanniarachchi@hayleys.com", "password": "qhse1234" }\n');

  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      console.error('✗ Seed already applied — users already exist in the database.');
    } else {
      console.error('✗ Seed failed:', err.message);
    }
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
