require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const authRoutes         = require('./routes/auth');
const adminUserRoutes       = require('./routes/admin/users');
const adminCategoryRoutes   = require('./routes/admin/categories');
const dashboardRoutes    = require('./routes/employee/dashboard');
const profileRoutes      = require('./routes/employee/profile');
const taskRoutes         = require('./routes/employee/tasks');
const assignmentRoutes   = require('./routes/employee/assignments');
const submissionRoutes   = require('./routes/employee/submissions');
const todoRoutes         = require('./routes/employee/todos');
const messageRoutes      = require('./routes/employee/messages');
const notificationRoutes = require('./routes/employee/notifications');

const supervisorTaskRoutes      = require('./routes/supervisor/tasks');
const supervisorProgressRoutes  = require('./routes/supervisor/progress');
const supervisorDashboardRoutes = require('./routes/supervisor/dashboard');
const supervisorKpiRoutes       = require('./routes/supervisor/kpis');
const employeeKpiRoutes         = require('./routes/employee/kpis');
const reportsRoutes             = require('./routes/reports');

const { authenticate, requireEmployee, requireAdmin } = require('./middleware/auth');
const { runDeadlineReminders } = require('./jobs/deadlineReminder');
const { runScheduledNotifications } = require('./jobs/scheduledNotifications');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Public ───────────────────────────────────────────────────
app.use('/auth', authRoutes);

// ── Employee (all routes require valid JWT with role=Employee) ─
app.use('/employee', authenticate, requireEmployee);

app.use('/employee/dashboard',     dashboardRoutes);
app.use('/employee/profile',       profileRoutes);
app.use('/employee/tasks',         taskRoutes);         // GET /, GET /:id, POST /, PATCH /:id
app.use('/employee/tasks',         submissionRoutes);   // POST /:id/submit, GET /:id/submissions
app.use('/employee/tasks',         messageRoutes);      // GET /:id/messages, POST /:id/messages
app.use('/employee/assignments',   assignmentRoutes);   // GET /, PATCH /:id/accept, PATCH /:id/reject
// Todos — accessible to any authenticated user (any role can keep personal todos)
app.use('/todos', authenticate, todoRoutes);

// Notifications — accessible to any authenticated user (employees AND supervisors)
app.use('/notifications', authenticate, notificationRoutes);

// POST /employee/floating-tasks/:taskId/claim — employee picks up a floating task
app.post('/employee/floating-tasks/:taskId/claim', authenticate, requireEmployee, async (req, res) => {
  const userId = req.user.userId;
  const taskId = parseInt(req.params.taskId);
  if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  const client = await require('./config/db').connect();
  try {
    await client.query('BEGIN');

    // Verify task is floating and still unclaimed
    const { rows } = await client.query(
      `SELECT taskid, title, createdby FROM TASK WHERE taskid = $1 AND publishmode = 'Floating' AND status = 'Pending'`,
      [taskId]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Task is no longer available' });
    }
    const task = rows[0];

    // Check no assignment exists yet
    const existing = await client.query(`SELECT 1 FROM TASK_ASSIGNMENT WHERE taskid = $1`, [taskId]);
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Task already claimed by someone else' });
    }

    // Create assignment (auto-accepted) and move task to InProgress
    await client.query(
      `INSERT INTO TASK_ASSIGNMENT (taskid, assignedby, assignedto, acceptancestatus) VALUES ($1, $2, $2, 'Accepted')`,
      [taskId, userId]
    );
    await client.query(`UPDATE TASK SET status = 'InProgress' WHERE taskid = $1`, [taskId]);

    // Notify the supervisor who created the floating task
    const empRow = await client.query(`SELECT name FROM "USER" WHERE userid = $1`, [userId]);
    const empName = empRow.rows[0]?.name || 'An employee';
    await client.query(
      `INSERT INTO NOTIFICATION (userid, taskid, channel, message, scheduledat, sentat, status, isread)
       VALUES ($1, $2, 'InApp', $3, NOW(), NOW(), 'Sent', FALSE)`,
      [task.createdby, taskId, `${empName} has picked up the floating task "${task.title}".`]
    );

    await client.query('COMMIT');
    res.json({ message: 'Task claimed successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /employee/floating-tasks/claim:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── Supervisor ───────────────────────────────────────────────
app.use('/supervisor/dashboard', authenticate, supervisorDashboardRoutes);
app.use('/supervisor/kpis',     authenticate, supervisorKpiRoutes);
app.use('/employee/kpis',       authenticate, employeeKpiRoutes);
app.use('/supervisor/tasks',     authenticate, supervisorTaskRoutes);
app.use('/supervisor/progress',  authenticate, supervisorProgressRoutes);

// ── Shared (any authenticated user) ──────────────────────────
// GET /team — users available for task assignment
// HOD/Admin: all supervisors + employees; Supervisor: only their direct employees
app.get('/team', authenticate, async (req, res) => {
  try {
    const db = require('./config/db');
    const { userId, role } = req.user;
    let rows;
    if (role === 'HOD' || role === 'Admin') {
      ({ rows } = await db.query(
        `SELECT userid, name, designation, division, role
         FROM "USER"
         WHERE role IN ('Supervisor', 'Employee')
         ORDER BY role, name`,
      ));
    } else {
      ({ rows } = await db.query(
        `SELECT userid, name, designation, division, role
         FROM "USER"
         WHERE reportsto = $1 AND role = 'Employee'
         ORDER BY name`,
        [userId]
      ));
    }
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /categories — read-only list for populating dropdowns
app.get('/categories', authenticate, async (req, res) => {
  try {
    const { rows } = await require('./config/db').query(
      'SELECT categoryid, name, slug, color FROM categories ORDER BY createdat ASC'
    );
    res.json({ categories: rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/stats — summary counts for admin dashboard
app.get('/admin/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = require('./config/db');
    const [tasks, users, cats] = await Promise.all([
      db.query('SELECT COUNT(*) FROM TASK'),
      db.query('SELECT COUNT(*) FROM "USER"'),
      db.query('SELECT COUNT(*) FROM categories'),
    ]);
    res.json({
      totalTasks:      parseInt(tasks.rows[0].count),
      totalUsers:      parseInt(users.rows[0].count),
      totalCategories: parseInt(cats.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Admin (requires Admin role JWT) ──────────────────────────
app.use('/reports',           authenticate, reportsRoutes);
app.use('/admin/users',       authenticate, requireAdmin, adminUserRoutes);
app.use('/admin/categories',  authenticate, requireAdmin, adminCategoryRoutes);

// ── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

app.listen(PORT, () => {
  console.log(`Task Dashboard API  →  http://localhost:${PORT}`);
  if (process.env.DEV_USER_ID) {
    console.log(`DEV MODE: all requests run as user ID ${process.env.DEV_USER_ID} (${process.env.DEV_USER_ROLE || 'Employee'})`);
  }

  // Run deadline reminder job once on start, then every hour
  runDeadlineReminders();
  setInterval(runDeadlineReminders, 60 * 60 * 1000);

  // Dispatch scheduled assignment notifications every minute
  runScheduledNotifications();
  setInterval(runScheduledNotifications, 60 * 1000);
});

module.exports = app;
