/* ============================================================
   Task Dashboard — API Service Layer (Employee)
   All calls go to the backend. No token needed while
   DEV_USER_ID is set in backend/.env
   ============================================================ */

const API_BASE = 'http://localhost:3000';

// ── Core fetch helper ────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('authToken');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Date formatter ───────────────────────────────────────────
// Converts a PostgreSQL date/timestamp to YYYY-MM-DD in local timezone.
// Cannot use substring(0,10) because UTC midnight shifts the date in +5:30.
function formatApiDate(raw) {
  if (!raw) return '';
  // Already a plain date string with no time component — return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d)) return raw.substring(0, 10);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ── Shape normalizer: API task → frontend task ───────────────
// The backend returns PostgreSQL column names (lowercase).
// The frontend mock data uses camelCase and lowercase status/priority.
function normalizeTask(t) {
  const statusMap  = { Pending:'pending', InProgress:'inprogress', Completed:'completed', Overdue:'overdue', UnableToComplete:'unabletocomplete', Submitted:'review' };
  const priMap     = { High:'high', Medium:'medium', Low:'low' };
  const catMap     = { WorkTracking:'work', SupportService:'support', TrainingProject:'training' };

  return {
    // Use 'api-N' prefix so IDs never collide with mock 't1','t2'...
    id:           'api-' + t.taskid,
    _apiId:       t.taskid,
    _assignmentId: t.assignmentid,
    title:        t.title        || '(untitled)',
    description:  t.description  || '',
    status:       statusMap[t.status]       || t.status?.toLowerCase()  || 'pending',
    priority:     priMap[t.priority]        || t.priority?.toLowerCase() || 'medium',
    category:     catMap[t.taskcategory]    || t.taskcategory || 'work',
    dueDate:      formatApiDate(t.duedate),
    startDate:    formatApiDate(t.startdate || t.actualdate),
    startTime:    t.starttime  ? t.starttime.slice(0, 5)  : null,
    endTime:      t.endtime    ? t.endtime.slice(0, 5)    : null,
    estimatedHours: t.estimatedtime || 0,
    estimatedUnit:  t.estimatedtimeunit || 'h',
    assignees:    Array.isArray(t.assignees) && t.assignees.length
                    ? t.assignees.map(a => a.userid ?? a)
                    : [],
    _assigneeNames: Array.isArray(t.assignees) && t.assignees.length
                    ? Object.fromEntries(t.assignees.map(a => [a.userid ?? a, a.name ?? '']))
                    : {},
    tags:         t.tags || [],
    chat:         [],
    files:        [],
    submissions:  [],
    hasInspection: false,
    scheduledNotif: null,
    actualHours:  t.totalhrsexpended || null,
    createdAt:    formatApiDate(t.createdat) || '',
    dataLogType:  catMap[t.taskcategory] || 'work',
    mode:         t.publishmode === 'Floating' ? 'floating'
                : t.publishmode === 'Self' ? 'self'
                : 'assigned',
    division:     t.division || '',
    createdByName: t.createdbyname || '',
    acceptanceStatus: t.acceptancestatus || '',
    // Work Tracking fields
    siteName:          t.sitename          || null,
    monitoringType:    t.monitoringtype    || null,
    inspectedBy:       t.inspectedby       || null,
    siteInCharge:      t.siteincharge      || null,
    contactNo:         t.contactno         || null,
    inspectionHrs:     t.inspectionhrs     || null,
    reportingHrs:      t.reportinghrs      || null,
    travellingHrs:     t.travellinghrs     || null,
    ncRaised:          t.ncraised          || null,
    ncClosed:          t.ncclosed          || null,
    reportStatus:      t.reportstatus      || null,
    // Support Service fields
    natureOfService:        t.natureofservice        || null,
    serviceRequestDivision: t.servicerequestdivision || null,
    serviceRequesterName:   t.servicerequestername   || null,
    totalTimeByEmployee:    t.totaltimebyemployee    || null,
    reviewedBy:             t.reviewedby             || null,
    totalTimeForReview:     t.totaltimeforreview     || null,
    // Training & Project fields
    activityName:        t.activityname        || null,
    activityCategory:    t.activitycategory    || null,
    tpMode:              t.mode                || null,
    scope:               t.scope               || null,
    conductedBy:         t.conductedby         || null,
    durationHours:       t.durationhours       || null,
    plannedParticipants: t.plannedparticipants || null,
    actualParticipants:  t.actualparticipants  || null,
    // Preserve raw fields for the detail / submit modals
    _raw: t,
  };
}

// ── Notification normalizer ──────────────────────────────────
function normalizeNotification(n) {
  return {
    id:     n.notificationid,
    title:  n.tasktitle ? `Task: ${n.tasktitle}` : 'Notification',
    body:   n.message,
    unread: !n.isread,
    time:   n.sentat ? new Date(n.sentat).toLocaleString() : (n.scheduledat ? new Date(n.scheduledat).toLocaleString() : ''),
    icon:   'task-assigned',
    bg:     '#EAF0F8',
    color:  '#1A3057',
    _apiId: n.notificationid,
  };
}

// ── Employee API calls ───────────────────────────────────────
const employeeApi = {

  getDashboard() {
    return apiFetch('/employee/dashboard');
  },

  getTasks(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/employee/tasks${qs ? '?' + qs : ''}`);
  },

  getTask(taskId) {
    return apiFetch(`/employee/tasks/${taskId}`);
  },

  createTask(body) {
    return apiFetch('/employee/tasks', { method: 'POST', body: JSON.stringify(body) });
  },

  acceptAssignment(assignmentId) {
    return apiFetch(`/employee/assignments/${assignmentId}/accept`, { method: 'PATCH' });
  },

  rejectAssignment(assignmentId, reason = '') {
    return apiFetch(`/employee/assignments/${assignmentId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  },

  submitTask(taskId, body) {
    return apiFetch(`/employee/tasks/${taskId}/submit`, { method: 'POST', body: JSON.stringify(body) });
  },

  getMessages(taskId) {
    return apiFetch(`/employee/tasks/${taskId}/messages`);
  },

  sendMessage(taskId, content) {
    return apiFetch(`/employee/tasks/${taskId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  getNotifications(unreadOnly = false) {
    return apiFetch(`/notifications${unreadOnly ? '?unread=true' : ''}`);
  },

  markNotificationRead(notifId) {
    return apiFetch(`/notifications/${notifId}/read`, { method: 'PATCH' });
  },

  markAllNotificationsRead() {
    return apiFetch('/notifications/read-all', { method: 'PATCH' });
  },
};

// ── Cache ────────────────────────────────────────────────────
// Populated by loadEmployeePageData(); consumed by render functions.
const apiCache = {
  dashboard:        null,   // raw /employee/dashboard response
  tasks:            [],     // normalized tasks (own / assigned)
  orgTasks:         [],     // HOD only: all org tasks for chat access
  notifications:    [],     // normalized notifications
  employeeProgress: [],     // from /supervisor/progress
  achievements:     [],     // from /achievements
};

// ── Page data loader ─────────────────────────────────────────
// Called by navigate() before rendering when role === 'employee'.
async function loadEmployeePageData(page) {
  try {
    if (page === 'dashboard') {
      const data = await employeeApi.getDashboard();
      apiCache.dashboard = data;
      if (data.recentTasks && !apiCache.tasks.length) {
        apiCache.tasks = data.recentTasks.map(normalizeTask);
      }
      if (typeof updateNotifBadge === 'function') {
        updateNotifBadge(data.unreadNotifications || 0);
      }
    }

    if (page === 'tasks') {
      const data = await employeeApi.getTasks();
      apiCache.tasks = data.tasks.map(normalizeTask);
    }

    if (page === 'notifications') {
      const data = await employeeApi.getNotifications();
      apiCache.notifications = data.notifications.map(normalizeNotification);
      const unread = apiCache.notifications.filter(n => n.unread).length;
      if (typeof updateNotifBadge === 'function') updateNotifBadge(unread);
    }

    // progress section is loaded non-blocking via loadProgressSection() after render
  } catch (err) {
    console.warn('API fetch failed, falling back to mock data:', err.message);
  }
}

// Fetch progress data and patch the section div — called AFTER renderDashboard()
async function loadProgressSection() {
  let errorMsg = null;
  try {
    const prog = await apiFetch('/supervisor/progress');
    console.log('Progress response:', JSON.stringify(prog));
    apiCache.employeeProgress = prog.employees || [];
  } catch (err) {
    errorMsg = err.message;
    console.error('Progress fetch failed:', err.message);
  }
  const el = document.getElementById('emp-progress-section');
  if (!el) return;
  if (errorMsg) {
    el.innerHTML = `<div class="card mt-16"><div class="card-header"><div class="card-title">Employee Work Progress Summary</div></div><p class="text-muted text-sm" style="padding:16px;color:var(--c-red-500)">Error: ${errorMsg}</p></div>`;
    return;
  }
  try {
    if (typeof renderEmployeeProgressSection === 'function') {
      // Employees see only their own row; supervisors/HOD see all
      const filterById = (state.role === 'employee') ? state.userId : null;
      el.innerHTML = renderEmployeeProgressSection(filterById);
    }
  } catch (e) {
    el.innerHTML = `<div class="card" style="padding:16px"><p style="color:var(--c-red-500)">Render error: ${e.message}</p></div>`;
    console.error('renderEmployeeProgressSection failed:', e);
  }
}

async function loadSupervisorPageData(page) {
  try {
    if (page === 'dashboard') {
      const data = await apiFetch('/supervisor/dashboard');
      apiCache.dashboard = data;
    }
    if (page === 'tasks') {
      const data = await apiFetch('/supervisor/tasks');
      apiCache.tasks = data.tasks.map(normalizeTask);
    }
    // progress section is loaded non-blocking via loadProgressSection() after render
  } catch (err) {
    console.warn('Supervisor API fetch failed:', err.message);
  }
}
