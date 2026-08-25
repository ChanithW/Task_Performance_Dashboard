/* ============================================================
   TaskFlow Pro — Application Logic
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  role: 'hod',
  currentPage: 'dashboard',
  currentTask: null,
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  taskView: 'list',
  selectedEmployees: [],
  createStep: 1,
  selectedPriority: 'medium',
  selectedMode: 'assigned',
  notifTiming: 'now',
};

// ── Data ────────────────────────────────────────────────────
const USERS = {
  hod:        { id: 'u1',  name: 'Mr. Nisal Liyanage',          initials: 'NL', role: 'HOD',        dept: 'QHSE',   color: '#2563eb' },
  supervisor: { id: 'e1',  name: 'Ms. Hashini Yashintha',       initials: 'HY', role: 'Supervisor',  dept: 'QHSE',   color: '#7c3aed' },
  employee:   { id: 'e4',  name: 'Ms. Tharushi Wanniarachchi',  initials: 'TW', role: 'Employee',    dept: 'QHSE',   color: '#d97706' },
  admin:      { id: 'u9',  name: 'Robert Singh',                initials: 'RS', role: 'Admin',       dept: 'System', color: '#d97706' },
};

// Real QHSE org hierarchy — keys are person IDs, values are their direct reports
const ORG_REPORTS = {
  'u1':  ['e9','e7','e2','e12','e4','e3','e1','e10','e11'], // Nisal → 9 direct reports
  'e12': ['e14','e15'],             // Jayantha → Vishwa Perera, Resindu Heshan
  'e3':  ['e13'],                   // Shehan → Malika
  'e1':  ['e16','e17','e18','e19'], // Hashini → Udara, Amila, Salitha, Keerthana
};

// True if this person has anyone reporting to them
function isSupervisor(id) { return !!(ORG_REPORTS[id] && ORG_REPORTS[id].length > 0); }

// All IDs below a person in the tree (every level, not including themselves)
function getSubtree(id) {
  const direct = ORG_REPORTS[id] || [];
  return direct.reduce((acc, cid) => acc.concat(cid, getSubtree(cid)), []);
}

// Tasks visible to a given user based on their position
function getVisibleTasks(userId) {
  if (userId === 'u1') return TASKS;
  const subtree = getSubtree(userId);
  if (subtree.length > 0) return TASKS.filter(t => t.assignees.some(a => a === userId || subtree.includes(a)));
  return TASKS.filter(t => t.assignees.includes(userId));
}

// IDs this person may assign tasks to (self + downward)
function getAssignableIds(userId) {
  if (userId === 'u1') return EMPLOYEES.map(e => e.id);
  const subtree = getSubtree(userId);
  return subtree.length > 0 ? [userId, ...subtree] : [userId];
}

const EMPLOYEES = [
  // From Excel task data (e1–e11)
  { id: 'e1',  name: 'Hashini Yashintha',       initials: 'HY', color: '#7c3aed' },
  { id: 'e2',  name: 'Jayathura Perera',         initials: 'JP', color: '#059669' },
  { id: 'e3',  name: 'Shehan Koonvinna',         initials: 'SK', color: '#2563eb' },
  { id: 'e4',  name: 'Tharushi Wanniarachchi',   initials: 'TW', color: '#d97706' },
  { id: 'e5',  name: 'Ushan Pathum',             initials: 'UP', color: '#0891b2' },
  { id: 'e6',  name: 'Heshan Wickramasingha',    initials: 'HW', color: '#dc2626' },
  { id: 'e7',  name: 'Achini Sheronika',         initials: 'AS', color: '#ea580c' },
  { id: 'e8',  name: 'Vishwa Tharanga',          initials: 'VT', color: '#0891b2' },
  { id: 'e9',  name: 'Niroshan Weerasooriya',    initials: 'NW', color: '#059669' },
  { id: 'e10', name: 'Kaveesha Gayathri',        initials: 'KG', color: '#7c3aed' },
  { id: 'e11', name: 'Prabodha Samarasinghe',    initials: 'PS', color: '#2563eb' },
  // Additional from org chart (e12–e19)
  { id: 'e12', name: 'Jayantha Jayasekara',      initials: 'JJ', color: '#ea580c' },
  { id: 'e13', name: 'Malika Kodithuwakkuge',    initials: 'MK', color: '#0891b2' },
  { id: 'e14', name: 'Vishwa Perera',            initials: 'VP', color: '#0891b2' },
  { id: 'e15', name: 'Resindu Heshan',           initials: 'RH', color: '#dc2626' },
  { id: 'e16', name: 'Udara Munasinghe',         initials: 'UM', color: '#059669' },
  { id: 'e17', name: 'Amila Jayarathna',         initials: 'AJ', color: '#d97706' },
  { id: 'e18', name: 'Salitha Mendis',           initials: 'SM', color: '#7c3aed' },
  { id: 'e19', name: 'Keerthana Kiritharan',     initials: 'KK', color: '#94a3b8' },
];

const TASKS = [];

const NOTIFICATIONS = [];

// ── Navigation sidebar config ───────────────────────────────
const SIDEBAR_NAV = {
  hod: [
    { section: 'Main' },
    { id: 'dashboard',     label: 'Dashboard',      icon: 'grid' },
    { id: 'tasks',         label: 'All Tasks',       icon: 'tasks' },
    { id: 'calendar',      label: 'Calendar',        icon: 'calendar' },
    { id: 'reports',       label: 'Reports',         icon: 'report' },
    { id: 'operational',   label: 'Operational View',     icon: 'kpi' },
    { section: 'People' },
    { id: 'notifications', label: 'Notifications',   icon: 'bell' },
  ],
  supervisor: [
    { section: 'Main' },
    { id: 'dashboard',     label: 'Dashboard',        icon: 'grid' },
    { id: 'tasks',         label: 'Tasks',             icon: 'tasks' },
    { id: 'task-create',   label: 'Create Task',       icon: 'plus' },
    { id: 'calendar',      label: 'Calendar',          icon: 'calendar' },
    { id: 'kpis',          label: 'KPI Management',    icon: 'kpi' },
    { section: 'Inbox' },
    { id: 'notifications', label: 'Notifications',     icon: 'bell' },
  ],
  employee: [
    { section: 'Main' },
    { id: 'dashboard',     label: 'Dashboard',        icon: 'grid' },
    { id: 'tasks',         label: 'My Tasks',          icon: 'tasks' },
    { id: 'task-create',   label: 'Log My Work',       icon: 'plus' },
    { id: 'todo',          label: 'To-do List',        icon: 'check' },
    { id: 'calendar',      label: 'My Calendar',       icon: 'calendar' },
    { id: 'kpis',          label: 'My KPIs',           icon: 'kpi' },
    { section: 'Inbox' },
    { id: 'notifications', label: 'Notifications',     icon: 'bell' },
  ],
  admin: [
    { section: 'Organisation' },
    { id: 'dashboard',     label: 'Dashboard',      icon: 'grid' },
    { id: 'org-chart',     label: 'Org Chart',       icon: 'org' },
    { id: 'admin-users',   label: 'Manage Users',    icon: 'users' },
    { section: 'System' },
    { id: 'notifications', label: 'Notifications',   icon: 'bell', badge: 0 },
  ],
};

// ── SVG Icons ──────────────────────────────────────────────
function icon(name, size = 16) {
  const s = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  const paths = {
    grid:     `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>`,
    tasks:    `<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12l2 2 4-4"/>`,
    calendar: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
    bell:     `<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>`,
    report:   `<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
    settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>`,
    plus:     `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
    org:      `<rect x="3" y="3" width="6" height="5" rx="1"/><rect x="15" y="3" width="6" height="5" rx="1"/><rect x="9" y="16" width="6" height="5" rx="1"/><path d="M6 8v4h12V8M12 12v4"/>`,
    check:    `<polyline points="20 6 9 17 4 12"/>`,
    'chevron-down': `<polyline points="6 9 12 15 18 9"/>`,
    x:        `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
    file:     `<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
    msg:      `<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>`,
    send:     `<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`,
    clip:     `<path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>`,
    user:     `<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>`,
    clock:    `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
    arrow_r:  `<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>`,
    info:     `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
    star:     `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
    eye:      `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
    log:      `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`,
    inspect:  `<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
    submit:   `<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>`,
    kpi:      `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><polyline points="1 20 23 20"/>`,
    edit:     `<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>`,
  };
  return `<svg ${s}>${paths[name] || ''}</svg>`;
}

// ── Avatar helper ──────────────────────────────────────────
function avatar(initials, color, size = '') {
  return `<div class="avatar ${size}" style="background:${color}">${initials}</div>`;
}
function avatarForUser(uid, size = '', task = null) {
  const u = EMPLOYEES.find(e => e.id === uid) || Object.values(USERS).find(u => u.id === uid);
  if (u) return avatar(u.initials, u.color, size);
  // For real API users: derive initials + a stable colour from the numeric ID
  const name = (task?._assigneeNames?.[uid]) || '';
  if (!name) return '';
  const initials = name.split(' ').filter(Boolean).map(p => p[0].toUpperCase()).slice(0, 2).join('');
  const palette = ['#2563eb','#059669','#7c3aed','#d97706','#dc2626','#0891b2','#65a30d'];
  const color = palette[(uid || 0) % palette.length];
  return avatar(initials, color, size);
}

// ── Badge helpers ──────────────────────────────────────────
const STATUS_MAP = {
  pending:    { cls: 'status-pending',    label: 'Pending' },
  inprogress: { cls: 'status-inprogress', label: 'In Progress' },
  review:     { cls: 'status-review',     label: 'Under Review' },
  completed:  { cls: 'status-completed',  label: 'Completed' },
  overdue:    { cls: 'status-overdue',    label: 'Overdue' },
  floating:   { cls: 'status-floating',   label: 'Floating' },
  scheduled:  { cls: 'status-scheduled',  label: 'Scheduled' },
};
const CAT_MAP = {
  work:     { cls: 'cat-work',     label: 'Work Tracking' },
  support:  { cls: 'cat-support',  label: 'Support Service' },
  training: { cls: 'cat-training', label: 'Training & Project' },
};
const PRI_MAP = {
  high:   { cls: 'priority-high',   label: 'High' },
  medium: { cls: 'priority-medium', label: 'Medium' },
  low:    { cls: 'priority-low',    label: 'Low' },
};

function statusBadge(s) { const m = STATUS_MAP[s]; return m ? `<span class="badge ${m.cls}">${m.label}</span>` : ''; }
function catBadge(c)    { const m = CAT_MAP[c];    return m ? `<span class="badge ${m.cls}">${m.label}</span>` : ''; }
function priBadge(p)    { const m = PRI_MAP[p];    return m ? `<span class="badge ${m.cls}"><span class="priority-dot ${p}"></span>${m.label}</span>` : ''; }
function fmtTime(h, unit) { if (!h) return '—'; return h + (unit === 'd' ? 'd' : 'h'); }
function fmtTimeFull(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function devLogin(email, password) {
  document.getElementById('login-email').value    = email;
  document.getElementById('login-password').value = password;
  doLogin();
}

// ── Login ──────────────────────────────────────────────────
async function doLogin() {
  const email    = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  if (!email || !password) {
    errEl.textContent = 'Please enter your email and password.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in…';
  errEl.style.display = 'none';

  try {
    const result = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    sessionStorage.setItem('authToken', result.token);

    const u = result.user;
    const roleKey = u.role.toLowerCase(); // 'Employee' → 'employee', 'HOD' → 'hod'

    state.role     = roleKey;
    state.userId   = u.id;
    state.userName = u.name || '';

    // Derive initials from real name
    const nameParts = (u.name || '').trim().split(/\s+/);
    const initials  = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : (u.name || '??').substring(0, 2).toUpperCase();

    const colorMap = { hod: '#2563eb', supervisor: '#7c3aed', employee: '#d97706', admin: '#16a34a' };

    USERS[roleKey] = {
      id:       'u-' + u.id,
      name:     u.name,
      initials,
      role:     u.role,
      dept:     u.division || u.designation || '',
      color:    colorMap[roleKey] || '#6b7280',
    };

    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('view-app').classList.remove('hidden');
    initApp();

  } catch (err) {
    errEl.textContent = err.message || 'Invalid email or password.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

// ── App init ───────────────────────────────────────────────
function initApp() {
  renderSidebar();
  renderTopbarUser();
  loadCategoryOptions();
  navigate('dashboard');
  // Show create task button for all roles except admin
  const btn = document.getElementById('create-task-btn');
  if (btn && state.role !== 'admin') {
    btn.style.display = '';
    if (state.role === 'employee') btn.innerHTML = `${icon('plus',14)} Log My Work`;
  }
  // Poll for new notifications every 30 seconds (all roles)
  setInterval(refreshNotifCount, 30000);
}

// ── Sidebar ────────────────────────────────────────────────
function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  const items = SIDEBAR_NAV[state.role] || [];
  nav.innerHTML = items.map(item => {
    if (item.section) return `<div class="sb-section-label">${item.section}</div>`;
    const badge = item.badge ? `<span class="sb-badge">${item.badge}</span>` : '';
    return `<div class="sb-item" data-page="${item.id}" onclick="navigate('${item.id}')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconPath(item.icon)}</svg>
      <span>${item.label}</span>${badge}
    </div>`;
  }).join('');

  const u = USERS[state.role];
  document.getElementById('sb-user-card').innerHTML = `
    <div class="d-flex items-center gap-10">
      ${avatar(u.initials, u.color, 'sm')}
      <div style="min-width:0">
        <div class="sb-role-name truncate">${u.name}</div>
        <div class="sb-role-label truncate">${u.dept}</div>
        <div class="sb-role-badge">${u.role}</div>
      </div>
    </div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--sb-border)">
      <button onclick="logout()" style="width:100%;text-align:left;font-size:0.75rem;color:var(--sb-text);cursor:pointer;background:none;border:none;padding:2px 0;font-family:var(--font-body)">Sign out</button>
    </div>`;
}

function iconPath(name) {
  const p = {
    grid:     `<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>`,
    tasks:    `<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12l2 2 4-4"/>`,
    calendar: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
    bell:     `<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>`,
    report:   `<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>`,
    settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>`,
    plus:     `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
    org:      `<rect x="3" y="3" width="6" height="5" rx="1"/><rect x="15" y="3" width="6" height="5" rx="1"/><rect x="9" y="16" width="6" height="5" rx="1"/><path d="M6 8v4h12V8M12 12v4"/>`,
    users:    `<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>`,
    kpi:          `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><polyline points="1 20 23 20"/>`,
    check:        `<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>`,
    star:         `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
  };
  return p[name] || '';
}

function renderTopbarUser() {
  const u = USERS[state.role];
  document.getElementById('topbar-user').innerHTML = `${avatar(u.initials, u.color, 'sm')}<span style="font-size:0.8125rem;font-weight:600;color:var(--clr-text)">${u.name.split(' ')[0]}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--clr-text-3)" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;
}

// ── Navigate ───────────────────────────────────────────────
async function navigate(page) {
  state.currentPage = page;

  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const pg = document.getElementById(`page-${page}`);
  if (pg) pg.classList.remove('hidden');

  document.querySelectorAll('.sb-item').forEach(i => {
    i.classList.toggle('active', i.dataset.page === page);
  });

  const titles = {
    dashboard:     { t: 'Dashboard',           s: 'Overview of your tasks and team' },
    tasks:         { t: 'Tasks',                s: 'All tasks across the organisation' },
    'task-create': { t: 'Create Task',          s: 'Step 1 of 3 — Task details' },
    'task-detail': { t: 'Task Detail',          s: '' },
    calendar:      { t: 'Calendar',             s: 'Personal task calendar' },
    notifications: { t: 'Notifications',        s: 'Your alerts and reminders' },
    'org-chart':   { t: 'Organisation',         s: 'Department structure & settings' },
    'admin-users': { t: 'Manage Users',         s: 'Add, edit, or remove system users' },
    reports:       { t: 'Reports',              s: 'Performance & completion analytics' },
    kpis:          { t: 'KPI Management',       s: 'Set and monitor individual KPIs for your team' },
  };
  const meta = titles[page] || { t: page, s: '' };
  document.getElementById('topbar-title').textContent = meta.t;
  document.getElementById('topbar-sub').textContent = meta.s;

  // Fetch live data from API before rendering
  if (state.role === 'employee' && ['dashboard','tasks','notifications'].includes(page)) {
    showPageLoading(page);
    await loadEmployeePageData(page);
  }
  if ((state.role === 'supervisor' || state.role === 'hod') && page === 'tasks') {
    apiCache.tasks = [];
    await loadSupervisorPageData(page);
  }
  if ((state.role === 'supervisor' || state.role === 'hod') && page === 'dashboard') {
    await loadSupervisorPageData(page);
  }
  if ((state.role === 'supervisor' || state.role === 'hod') && page === 'notifications') {
    try {
      const data = await apiFetch('/notifications');
      apiCache.notifications = data.notifications.map(normalizeNotification);
      const unread = apiCache.notifications.filter(n => n.unread).length;
      updateNotifBadge(unread);
    } catch (err) {
      console.warn('Supervisor notifications fetch failed:', err.message);
    }
  }

  if (page === 'dashboard') {
    renderDashboard();
    loadProgressSection();   // non-blocking: patches #emp-progress-section after render
    loadAchievementFeed();   // non-blocking: patches #achievement-feed-section after render
  }
  if (page === 'tasks') {
    _hodTaskScope = 'mine'; // always start on My Tasks tab
    renderTasksPage();
  }
  if (page === 'task-create')   initTaskCreate();
  if (page === 'calendar') {
    if (state.role === 'employee' && !_todoCache.length) {
      apiFetch('/todos').then(d => { _todoCache = d.todos || []; renderCalendar(); }).catch(() => {});
    }
    renderCalendar();
  }
  if (page === 'notifications') renderNotifications();
  if (page === 'org-chart')     renderOrgChart();
  if (page === 'admin-users')  renderAdminUsers();
  if (page === 'reports')       renderReportsPage();
  if (page === 'kpis')          renderKpiPage();
  if (page === 'todo')          renderTodoPage();
  if (page === 'operational')   renderOperationalPage();
}

// Show a brief loading skeleton while API data is being fetched
function showPageLoading(page) {
  const targets = { dashboard: 'dash-content', tasks: 'tasks-tbody', notifications: 'notif-list' };
  const el = document.getElementById(targets[page]);
  if (el) el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--clr-text-3);gap:10px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0"/></svg>Loading…</div>`;
}

function logout() {
  sessionStorage.removeItem('authToken');
  state.role = null;
  const emailEl = document.getElementById('login-email');
  const passEl  = document.getElementById('login-password');
  const errEl   = document.getElementById('login-error');
  if (emailEl) emailEl.value = '';
  if (passEl)  passEl.value  = '';
  if (errEl)   errEl.style.display = 'none';
  document.getElementById('view-app').classList.add('hidden');
  document.getElementById('view-login').classList.remove('hidden');
}

// ── Dashboard ──────────────────────────────────────────────
function renderDashboard() {
  const el = document.getElementById('dash-content');
  const role = state.role;

  if (role === 'hod')        el.innerHTML = renderHODDash();
  else if (role === 'supervisor') el.innerHTML = renderSupervisorDash();
  else if (role === 'employee')   el.innerHTML = renderEmployeeDash();
  else                            renderAdminDash();

  // Draw charts after render
  setTimeout(() => {
    if (role === 'hod')        drawHODCharts();
    else if (role === 'supervisor') drawSupervisorCharts();
    else if (role === 'employee')   drawEmployeeCharts();
    // Admin chart is drawn inside renderAdminDash() after async data loads
  }, 50);
}

// ── HOD Dashboard ──────────────────────────────────────────
function renderHODDash() {
  const dash = apiCache.dashboard;
  const stats = dash?.stats || { total: 0, inProgress: 0, completed: 0, pending: 0 };
  const team  = dash?.team  || [];
  const pendingApproval = dash?.pendingApproval || [];

  const hodName = state.userName || 'Nisal';
  const firstName = hodName.replace(/^(Mr\.|Ms\.|Dr\.)\s+/i, '').split(' ')[0];

  return `
  <div class="d-flex items-center justify-between mb-20">
    <div>
      <h2 style="font-family:var(--font-display);font-size:1.25rem;font-weight:800;color:var(--clr-text)">Good morning, ${firstName} 👋</h2>
      <p class="text-muted text-xs mt-4">Here's the QHSE department overview for today</p>
    </div>
    <div class="d-flex gap-8">
      <button class="btn btn-secondary btn-sm" onclick="openAwardAchievementModal()">${icon('star',14)} Award Achievement</button>
      <button class="btn btn-primary btn-sm" onclick="navigate('task-create')">${icon('plus', 14)} Create Task</button>
    </div>
  </div>

  <!-- KPI Row -->
  <div class="d-grid mb-20" style="grid-template-columns:repeat(5,1fr);gap:14px">
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-blue-50);color:var(--c-blue-600)">${icon('tasks',20)}</div><div><div class="stat-value tabular-nums">${stats.total}</div><div class="stat-label">Team Tasks</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-violet-50);color:var(--c-violet-600)">${icon('edit',20)}</div><div><div class="stat-value tabular-nums">${stats.selfTotal || 0}</div><div class="stat-label">Self Logged</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-amber-50);color:var(--c-amber-600)">${icon('eye',20)}</div><div><div class="stat-value tabular-nums">${pendingApproval.length}</div><div class="stat-label">Pending Approval</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-cyan-50);color:var(--c-cyan-600)">${icon('clock',20)}</div><div><div class="stat-value tabular-nums">${stats.inProgress}</div><div class="stat-label">In Progress</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-green-50);color:var(--c-green-600)">${icon('check',20)}</div><div><div class="stat-value tabular-nums">${stats.completed}</div><div class="stat-label">Completed</div></div></div>
  </div>

  <!-- Task Ageing + Completion Trend -->
  <div class="d-flex gap-16 mb-20" style="flex-wrap:wrap">
    ${renderTaskAgeingWidget(dash)}
    ${renderCompletionTrendWidget(dash)}
  </div>

  <!-- Task Distribution + Productivity -->
  <div class="d-flex gap-16 mb-20" style="flex-wrap:wrap">
    <div class="card" style="flex:1;min-width:280px">
      <div class="card-header"><div class="card-title">Task Distribution</div><span class="text-xs text-muted">Tasks per supervisor</span></div>
      ${team.length ? `<canvas id="sup-bar-chart" height="140"></canvas>` : `<p class="text-muted text-xs" style="padding:16px">No team data.</p>`}
    </div>
    <div class="card" style="flex:1;min-width:280px">
      <div class="card-header"><div class="card-title">Productivity</div><span class="text-xs text-muted">Completion rate &amp; hours</span></div>
      ${renderProductivityTable(team)}
    </div>
  </div>

  <!-- Pending Approval -->
  ${pendingApproval.length ? `
  <div class="card mb-16" style="border:2px solid var(--c-amber-400);background:linear-gradient(135deg,var(--c-amber-50) 0%,var(--clr-surface) 60%);box-shadow:0 4px 20px rgba(245,158,11,0.15)">
    <div class="section-header mb-12">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:var(--c-amber-400);border-radius:50%;animation:pulse-amber 2s infinite">${icon('eye',14)}</span>
        <div class="section-title" style="color:var(--c-amber-700)">Pending Approval</div>
      </div>
      <span class="badge" style="background:var(--c-amber-400);color:#fff;font-weight:700">${pendingApproval.length} awaiting review</span>
    </div>
    ${pendingApproval.map(t => `
      <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--clr-surface);border:1px solid var(--c-amber-300);border-left:4px solid var(--c-amber-400);border-radius:var(--r-md);margin-bottom:8px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        ${priBadge((t.priority||'medium').toLowerCase())}
        <div style="flex:1;min-width:0">
          <div class="text-sm font-semibold truncate">${t.title}</div>
          <div class="text-xs text-muted mt-2">Submitted by <strong>${t.employeename}</strong> · ${t.categoryname || t.taskcategory}</div>
        </div>
        <button class="btn btn-primary btn-sm" style="background:var(--c-amber-500);border-color:var(--c-amber-500);font-weight:600" onclick="openReviewModal(${t.taskid}, '${(t.title||'').replace(/'/g,'')}')">Review</button>
      </div>`).join('')}
  </div>` : ''}

  <!-- Team -->
  <div class="card" style="padding:0;overflow:hidden">
    <div class="section-header" style="padding:16px 20px 0"><div class="section-title">Team Overview</div><button class="btn btn-ghost btn-sm" onclick="navigate('tasks')">View All Tasks →</button></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Member</th><th>Active Tasks</th><th>Completed</th></tr></thead>
        <tbody>
          ${team.length ? team.map(e => {
            const ini = e.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
            return `<tr>
              <td><div class="d-flex items-center gap-8">${avatar(ini,'var(--clr-primary)','sm')}<span>${e.name}</span></div></td>
              <td class="tabular-nums">${e.active}</td>
              <td class="tabular-nums">${e.completed}</td>
            </tr>`;
          }).join('') : `<tr><td colspan="3" class="text-muted text-xs" style="padding:24px;text-align:center">No team members found.</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>

  <div id="achievement-feed-section" style="margin-top:16px"></div>`;
}

// ── Supervisor Dashboard ───────────────────────────────────
// ── Task Ageing widget ──────────────────────────────────────
function renderTaskAgeingWidget(dash) {
  const ag = dash?.taskAgeing || { '0_7': 0, '8_14': 0, '15_30': 0, over30: 0 };
  const buckets = [
    { label: '0–7 days',  value: ag['0_7'],   color: 'var(--c-green-500)' },
    { label: '8–14 days', value: ag['8_14'],  color: 'var(--c-amber-500)' },
    { label: '15–30 days',value: ag['15_30'], color: 'var(--c-orange-500, #f97316)' },
    { label: '30+ days',  value: ag['over30'],color: 'var(--c-red-500)' },
  ];
  const max = Math.max(...buckets.map(b => b.value), 1);
  const bars = buckets.map(b => {
    const w = Math.round((b.value / max) * 100);
    return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div class="text-xs text-muted" style="width:72px;text-align:right;flex-shrink:0">${b.label}</div>
      <div style="flex:1;height:20px;background:var(--clr-border);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${w}%;background:${b.color};border-radius:4px;transition:width .4s;display:flex;align-items:center;padding-left:6px">
          ${b.value > 0 ? `<span class="text-xs font-semibold" style="color:#fff">${b.value}</span>` : ''}
        </div>
      </div>
      ${b.value === 0 ? `<span class="text-xs text-muted tabular-nums">0</span>` : ''}
    </div>`;
  }).join('');

  return `
  <div class="card" style="flex:1;min-width:240px">
    <div class="section-header mb-12">
      <div class="section-title">Task Ageing</div>
      <span class="text-xs text-muted">Open tasks by age</span>
    </div>
    ${bars}
  </div>`;
}

// ── Completion Trend widget ─────────────────────────────────
function renderCompletionTrendWidget(dash) {
  const rows = dash?.completionTrend || [];

  if (!rows.length) {
    return `
    <div class="card" style="flex:2;min-width:280px">
      <div class="section-header mb-12"><div class="section-title">Completion Trend</div><span class="text-xs text-muted">Last 8 weeks</span></div>
      <p class="text-muted text-xs" style="padding:8px 0">No data yet.</p>
    </div>`;
  }

  const chartH = 100;
  const maxTotal = Math.max(...rows.map(r => r.total), 1);

  const bars = rows.map(r => {
    const tH = Math.round((r.total     / maxTotal) * chartH);
    const cH = Math.round((r.completed / maxTotal) * chartH);
    const pct = r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;
    return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:0"
         title="${r.label} — ${r.completed}/${r.total} completed (${pct}%)">
      <div style="display:flex;align-items:flex-end;gap:1px;height:${chartH}px">
        <div style="width:12px;background:var(--c-blue-200);border-radius:3px 3px 0 0;height:${tH}px"></div>
        <div style="width:12px;background:var(--c-green-500);border-radius:3px 3px 0 0;height:${cH}px"></div>
      </div>
      <div class="text-xs text-muted" style="font-size:10px;text-align:center;writing-mode:vertical-rl;transform:rotate(180deg);max-height:48px;overflow:hidden;white-space:nowrap">${r.label}</div>
    </div>`;
  }).join('');

  return `
  <div class="card" style="flex:2;min-width:280px">
    <div class="section-header mb-8">
      <div class="section-title">Completion Trend</div>
      <div style="display:flex;gap:10px;align-items:center">
        <span class="text-xs d-flex items-center gap-4"><span style="width:10px;height:10px;background:var(--c-blue-200);border-radius:2px;display:inline-block"></span>Created</span>
        <span class="text-xs d-flex items-center gap-4"><span style="width:10px;height:10px;background:var(--c-green-500);border-radius:2px;display:inline-block"></span>Completed</span>
      </div>
    </div>
    <div style="display:flex;gap:4px;align-items:flex-end;padding-bottom:4px;overflow-x:auto">
      ${bars}
    </div>
  </div>`;
}

function renderSupervisorDash() {
  const dash = apiCache.dashboard;
  const stats = dash?.stats || { total: 0, inProgress: 0, completed: 0, pending: 0 };
  const team  = dash?.team  || [];
  const pendingApproval = dash?.pendingApproval || [];

  const supName = state.userName || 'Supervisor';
  const firstName = supName.replace(/^(Mr\.|Ms\.|Dr\.)\s+/i, '').split(' ')[0];

  return `
  <div class="d-flex items-center justify-between mb-20">
    <div>
      <h2 style="font-family:var(--font-display);font-size:1.25rem;font-weight:800;color:var(--clr-text)">Good morning, ${firstName} 👋</h2>
      <p class="text-muted text-xs mt-4">You have ${pendingApproval.length} submission${pendingApproval.length !== 1 ? 's' : ''} awaiting your review · ${team.length} people in your team</p>
    </div>
    <div class="d-flex gap-8">
      <button class="btn btn-secondary btn-sm" onclick="openAwardAchievementModal()">${icon('star',14)} Award Achievement</button>
      <button class="btn btn-primary" onclick="navigate('task-create')">${icon('plus',14)} Create Task</button>
    </div>
  </div>

  <!-- KPIs -->
  <div class="d-grid mb-20" style="grid-template-columns:repeat(5,1fr);gap:14px">
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-blue-50);color:var(--c-blue-600)">${icon('tasks',20)}</div><div><div class="stat-value tabular-nums">${stats.total}</div><div class="stat-label">Team Tasks</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-violet-50);color:var(--c-violet-600)">${icon('edit',20)}</div><div><div class="stat-value tabular-nums">${stats.selfTotal || 0}</div><div class="stat-label">Self Logged</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-amber-50);color:var(--c-amber-600)">${icon('eye',20)}</div><div><div class="stat-value tabular-nums">${pendingApproval.length}</div><div class="stat-label">Pending Approval</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-cyan-50);color:var(--c-cyan-600)">${icon('clock',20)}</div><div><div class="stat-value tabular-nums">${stats.inProgress}</div><div class="stat-label">In Progress</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-green-50);color:var(--c-green-600)">${icon('check',20)}</div><div><div class="stat-value tabular-nums">${stats.completed}</div><div class="stat-label">Completed</div></div></div>
  </div>

  ${pendingApproval.length ? `
  <div class="card mb-20" style="border:2px solid var(--c-amber-400);background:linear-gradient(135deg,var(--c-amber-50) 0%,var(--clr-surface) 60%);box-shadow:0 4px 20px rgba(245,158,11,0.15)">
    <div class="section-header mb-12">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:var(--c-amber-400);border-radius:50%;animation:pulse-amber 2s infinite">${icon('eye',14)}</span>
        <div class="section-title" style="color:var(--c-amber-700)">Pending Approval</div>
      </div>
      <span class="badge" style="background:var(--c-amber-400);color:#fff;font-weight:700">${pendingApproval.length} awaiting review</span>
    </div>
    ${pendingApproval.map(t => `
      <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--clr-surface);border:1px solid var(--c-amber-300);border-left:4px solid var(--c-amber-400);border-radius:var(--r-md);margin-bottom:8px;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        ${priBadge((t.priority||'medium').toLowerCase())}
        <div style="flex:1;min-width:0">
          <div class="text-sm font-semibold truncate">${t.title}</div>
          <div class="text-xs text-muted mt-2">Submitted by <strong>${t.employeename}</strong> · ${t.categoryname || t.taskcategory}</div>
        </div>
        <button class="btn btn-primary btn-sm" style="background:var(--c-amber-500);border-color:var(--c-amber-500);font-weight:600" onclick="openReviewModal(${t.taskid}, '${(t.title||'').replace(/'/g,'')}')">Review</button>
      </div>`).join('')}
  </div>` : ''}

  <div class="d-flex gap-16 mb-20" style="flex-wrap:wrap">
    <div class="card" style="flex:2;min-width:280px">
      <div class="card-header"><div class="card-title">Team Workload</div></div>
      ${team.length ? `<canvas id="sup-bar-chart" height="160"></canvas>` : `<p class="text-muted text-xs" style="padding:16px">No team data yet.</p>`}
    </div>
    <div class="card" style="flex:1;min-width:220px">
      <div class="card-header"><div class="card-title">My Direct Reports</div></div>
      ${team.length ? team.map(e => {
        const initials = e.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--clr-border)">
          ${avatar(initials,'var(--clr-primary)','sm')}
          <div style="flex:1;min-width:0">
            <div class="text-sm font-semibold truncate">${e.name}</div>
            <div class="text-xs text-muted">${e.active} active task${e.active!=1?'s':''}</div>
          </div>
        </div>`;
      }).join('') : `<p class="text-muted text-xs">No direct reports configured.</p>`}
    </div>
  </div>

  <div class="d-flex gap-16 mb-16" style="flex-wrap:wrap">
    ${renderTaskAgeingWidget(dash)}
    ${renderCompletionTrendWidget(dash)}
  </div>

  <!-- Task Distribution + Productivity -->
  <div class="d-flex gap-16 mb-16" style="flex-wrap:wrap">
    <div class="card" style="flex:1;min-width:280px">
      <div class="card-header"><div class="card-title">Task Distribution</div><span class="text-xs text-muted">Tasks per member</span></div>
      ${team.length ? `<canvas id="sup-dist-chart" height="140"></canvas>` : `<p class="text-muted text-xs" style="padding:16px">No team data yet.</p>`}
    </div>
    <div class="card" style="flex:1;min-width:280px">
      <div class="card-header"><div class="card-title">Productivity</div><span class="text-xs text-muted">Completion rate &amp; hours</span></div>
      ${renderProductivityTable(team)}
    </div>
  </div>

  <div id="emp-progress-section" style="margin-top:16px"></div>

  <div id="achievement-feed-section" style="margin-top:16px"></div>`;

}

// ── Employee Dashboard ─────────────────────────────────────

// ── Time Utilization widget ─────────────────────────────────
function renderTimeUtilizationWidget(dash) {
  const tu = dash?.timeUtilization || { totalEstimated: 0, totalSpent: 0 };
  const est  = tu.totalEstimated || 0;
  const spent = tu.totalSpent    || 0;
  const pct   = est > 0 ? Math.min(Math.round((spent / est) * 100), 999) : 0;
  const barPct = Math.min(pct, 100);
  const color = pct > 100 ? 'var(--c-red-500)' : pct > 80 ? 'var(--c-amber-500)' : 'var(--c-green-500)';
  const label = pct > 100 ? 'Over budget' : pct > 80 ? 'Nearing limit' : 'On track';

  return `
  <div class="card">
    <div class="section-header mb-12">
      <div class="section-title">Time Utilization</div>
      <span class="text-xs font-semibold" style="color:${color}">${label}</span>
    </div>
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:6px">
      <span class="text-xs text-muted">Spent: <strong class="tabular-nums">${spent.toFixed(1)}h</strong></span>
      <span class="text-xs text-muted">Allocated: <strong class="tabular-nums">${est.toFixed(1)}h</strong></span>
    </div>
    <div style="background:var(--clr-border);border-radius:999px;height:10px;overflow:hidden">
      <div style="width:${barPct}%;height:100%;background:${color};border-radius:999px;transition:width .4s ease"></div>
    </div>
    <div class="text-xs text-muted mt-6 text-right tabular-nums">${pct}% utilized</div>
  </div>`;
}

// ── Assigned Hours vs Spent Hours widget ────────────────────
function renderHoursBreakdownWidget(dash) {
  const rows = dash?.taskHoursBreakdown || [];
  if (!rows.length) return '';

  const maxVal = Math.max(...rows.map(r => Math.max(r.estimatedHours, r.spentHours)), 1);

  const rowsHtml = rows.map(r => {
    const over      = r.spentHours > r.estimatedHours;
    const estPct    = Math.round((r.estimatedHours / maxVal) * 100);
    const spentPct  = Math.round((r.spentHours     / maxVal) * 100);
    const spentColor = over ? 'var(--c-red-500)' : 'var(--c-green-500)';
    const shortTitle = r.title.length > 28 ? r.title.slice(0, 27) + '…' : r.title;

    return `
    <div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
        <span class="text-sm font-semibold" style="max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.title}">${shortTitle}</span>
        <span class="text-xs text-muted tabular-nums">${r.estimatedHours}h allocated · <span style="color:${spentColor};font-weight:600">${r.spentHours}h spent</span>${over ? ' <span style="color:var(--c-red-500);font-size:10px">▲ over</span>' : ''}</span>
      </div>
      <div style="position:relative;height:8px;background:var(--clr-border);border-radius:4px;overflow:hidden">
        <div style="position:absolute;left:0;top:0;height:100%;width:${estPct}%;background:var(--c-blue-200);border-radius:4px"></div>
        <div style="position:absolute;left:0;top:0;height:100%;width:${spentPct}%;background:${spentColor};border-radius:4px;opacity:0.85"></div>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="card mt-0" style="margin-top:14px">
    <div class="section-header mb-16">
      <div class="section-title">Assigned vs Spent Hours</div>
      <div style="display:flex;gap:14px;align-items:center">
        <span class="text-xs d-flex items-center gap-4"><span style="width:10px;height:6px;background:var(--c-blue-200);border-radius:2px;display:inline-block"></span>Allocated</span>
        <span class="text-xs d-flex items-center gap-4"><span style="width:10px;height:6px;background:var(--c-green-500);border-radius:2px;display:inline-block"></span>Spent</span>
        <span class="text-xs d-flex items-center gap-4"><span style="width:10px;height:6px;background:var(--c-red-500);border-radius:2px;display:inline-block"></span>Over budget</span>
      </div>
    </div>
    ${rowsHtml}
  </div>`;
}

function renderEmployeeDash() {
  const empUser = USERS.employee;
  const empFirstName = empUser.name.replace(/^(Mr\.|Ms\.|Dr\.)\s+/,'').split(' ')[0];

  // Use live API data if available, fall back to mock
  const dash = apiCache.dashboard;
  const stats = dash?.stats || (() => {
    const t = getVisibleTasks(empUser.id);
    return { total: t.length, inProgress: t.filter(x=>x.status==='inprogress').length, pending: t.filter(x=>x.status==='pending').length, completed: t.filter(x=>x.status==='completed').length, overdue: t.filter(x=>x.status==='overdue').length };
  })();
  const myTasks   = apiCache.tasks.length ? apiCache.tasks : getVisibleTasks(empUser.id);
  const pending   = dash?.pendingAssignments || [];
  const floating  = (dash?.floatingTasks || []).map(t => ({
    _apiId: t.taskid,
    id: 'float-' + t.taskid,
    title: t.title,
    priority: (t.priority || 'medium').toLowerCase(),
    dueDate: t.duedate ? t.duedate.substring(0, 10) : '',
    estimatedHours: t.estimatedtime,
    estimatedUnit: t.estimatedtimeunit || 'h',
    category: t.taskcategory,
    mode: 'floating',
  }));
  const selfLogged = myTasks.filter(t => t.mode === 'self').length;
  const assignedCount = myTasks.filter(t => t.mode !== 'self').length;
  const floatingCompleted = dash?.floatingCompleted || 0;

  return `
  <div class="d-flex items-center justify-between mb-20">
    <div>
      <h2 style="font-family:var(--font-display);font-size:1.25rem;font-weight:800;color:var(--clr-text)">Good morning, ${empFirstName} 👋</h2>
      <p class="text-muted text-xs mt-4">You have ${stats.inProgress} tasks active · ${stats.underReview || 0} under review · ${stats.pending} awaiting acceptance</p>
    </div>
    <div class="d-flex gap-8">
      <button class="btn btn-secondary btn-sm" onclick="navigate('calendar')">${icon('calendar',14)} My Calendar</button>
      <button class="btn btn-primary btn-sm" onclick="navigate('task-create')">${icon('plus',14)} Log My Work</button>
    </div>
  </div>

  <div class="d-grid mb-20" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px">
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-blue-50);color:var(--c-blue-600)">${icon('tasks',20)}</div><div><div class="stat-value tabular-nums">${assignedCount}</div><div class="stat-label">Assigned to Me</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-violet-50);color:var(--c-violet-600)">${icon('edit',20)}</div><div><div class="stat-value tabular-nums">${selfLogged}</div><div class="stat-label">Self Logged</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-cyan-50);color:var(--c-cyan-600)">${icon('clock',20)}</div><div><div class="stat-value tabular-nums">${stats.inProgress - (stats.underReview||0)}</div><div class="stat-label">In Progress</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-amber-50);color:var(--c-amber-600)">${icon('eye',20)}</div><div><div class="stat-value tabular-nums">${stats.underReview||0}</div><div class="stat-label">Under Review</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-green-50);color:var(--c-green-600)">${icon('check',20)}</div><div><div class="stat-value tabular-nums">${stats.completed}</div><div class="stat-label">Completed</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-orange-50);color:var(--c-orange-600)">${icon('submit',20)}</div><div><div class="stat-value tabular-nums">${floatingCompleted}</div><div class="stat-label">Floating Done</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-red-50);color:var(--c-red-600)">${icon('x',20)}</div><div><div class="stat-value tabular-nums">${stats.overdue}</div><div class="stat-label">Overdue</div></div></div>
  </div>

  <div class="d-flex gap-16" style="flex-wrap:wrap">
    <div style="flex:2;min-width:280px;display:flex;flex-direction:column;gap:14px">
      ${pending.length ? `
      <div class="card" style="border:1px solid var(--c-amber-200);background:var(--c-amber-50)">
        <div class="section-header mb-10"><div class="section-title" style="color:var(--c-amber-700)">Pending Acceptance (${pending.length})</div></div>
        ${pending.map(a => `
          <div style="display:flex;align-items:center;gap:12px;padding:10px;background:var(--clr-surface);border-radius:var(--r-md);margin-bottom:6px">
            ${priBadge(a.priority?.toLowerCase())}
            <div style="flex:1;min-width:0"><div class="text-sm font-semibold truncate">${a.title}</div><div class="text-xs text-muted">From ${a.assignedbyname} · Due ${fmtDate(a.duedate)}</div></div>
            <button class="btn btn-success btn-sm" onclick="apiAcceptAssignment(${a.assignmentid})">Accept</button>
            <button class="btn btn-danger btn-sm" onclick="apiRejectAssignment(${a.assignmentid})">Reject</button>
          </div>`).join('')}
      </div>` : ''}

      <div class="card" style="padding:0;overflow:hidden">
        <div class="section-header" style="padding:16px 20px 0"><div class="section-title">My Tasks</div><button class="btn btn-ghost btn-sm" onclick="navigate('tasks')">View all →</button></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Task</th><th>Due</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${myTasks.map(t => `
              <tr onclick="openTaskDetail('${t.id}')">
                <td><div class="truncate" style="max-width:200px">${t.title}</div><div class="text-xs text-muted">${catBadge(t.category)}</div></td>
                <td class="tabular-nums text-xs">${t.dueDate ? fmtDate(t.dueDate) : 'No due date'}</td>
                <td>${statusBadge(t.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${renderHoursBreakdownWidget(dash)}
      ${renderTimeUtilizationWidget(dash)}
    </div>

    <div style="flex:1;min-width:240px;display:flex;flex-direction:column;gap:14px">
      <div class="card">
        <div class="section-header mb-12"><div class="section-title">Floating Tasks</div><span class="badge status-floating">${floating.filter(t=>t.title).length} open</span></div>
        ${floating.length ? floating.filter(t => t.title).map(t => `
          <div style="padding:10px;background:var(--c-violet-50);border:1px solid var(--c-violet-100);border-radius:var(--r-md);margin-bottom:8px">
            <div class="d-flex items-center justify-between mb-4">${priBadge(t.priority)}<span class="text-xs text-muted">${fmtTime(t.estimatedHours, t.estimatedUnit)}</span></div>
            <div class="text-sm font-semibold">${t.title}</div>
            <div class="text-xs text-muted mt-4">${t.dueDate ? 'Due ' + fmtDate(t.dueDate) : 'No due date'}</div>
            <button class="btn btn-sm" style="width:100%;background:var(--c-violet-600);color:#fff;margin-top:8px" onclick="claimFloatingTask(${t._apiId}, this)">Pick Up Task</button>
          </div>`).join('') : '<p class="text-muted text-xs">No floating tasks available.</p>'}
      </div>
      <div id="achievement-feed-section"></div>
      <div class="card">
        <div class="section-header mb-12"><div class="section-title">My Progress</div></div>
        <canvas id="emp-progress-chart" height="160"></canvas>
      </div>
    </div>
  </div>`;
}

// ── Employee Work Progress Summary ─────────────────────────
function renderEmployeeProgressSection(selfUserId) {
  // For employees: show only their own row. For supervisors: show all employees.
  const rows = apiCache.employeeProgress;
  if (!rows || rows.length === 0) return `
  <div class="card mt-16">
    <div class="card-header"><div class="card-title">Employee Work Progress Summary</div></div>
    <p class="text-muted text-sm" style="padding:16px">Loading employee progress data…</p>
  </div>`;

  const displayRows = selfUserId
    ? rows.filter(r => String(r.userid) === String(selfUserId))
    : rows;

  if (displayRows.length === 0) return '';

  const rowsHtml = displayRows.map(emp => {
    const total     = parseInt(emp.total)     || 0;
    const completed = parseInt(emp.completed) || 0;
    const inprog    = parseInt(emp.inprogress)|| 0;
    const overdue   = parseInt(emp.overdue)   || 0;
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
    const barColor  = pct >= 75 ? 'var(--c-green-500)' : pct >= 40 ? 'var(--c-amber-500)' : 'var(--c-red-500)';

    return `<tr>
      <td><div class="text-sm font-semibold">${emp.name}</div><div class="text-xs text-muted">${emp.designation || 'QHSE Officer'}</div></td>
      <td class="tabular-nums text-sm text-center">${total}</td>
      <td class="tabular-nums text-sm text-center" style="color:var(--c-green-600);font-weight:600">${completed}</td>
      <td class="tabular-nums text-sm text-center" style="color:var(--c-cyan-600)">${inprog}</td>
      <td class="tabular-nums text-sm text-center" style="color:var(--c-red-600)">${overdue}</td>
      <td style="min-width:120px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:6px;background:var(--clr-border);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width .4s"></div>
          </div>
          <span class="text-xs tabular-nums" style="min-width:32px;text-align:right;font-weight:600">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');

  const isOwnView = selfUserId != null;
  return `
  <div class="card mt-16">
    <div class="card-header mb-12">
      <div class="card-title">${isOwnView ? 'My Work Progress Summary' : 'Employee Work Progress Summary'}</div>
      ${!isOwnView ? `<span class="badge" style="background:var(--c-blue-50);color:var(--c-blue-600)">${displayRows.length} employee${displayRows.length!==1?'s':''}</span>` : ''}
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Employee</th>
            <th class="text-center">Total</th>
            <th class="text-center">Completed</th>
            <th class="text-center">In Progress</th>
            <th class="text-center">Overdue</th>
            <th style="min-width:140px">Overall Progress</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </div>`;
}

// ── Admin Dashboard ────────────────────────────────────────
async function renderAdminDash() {
  const el = document.getElementById('dash-content');
  if (!el) return;

  // Skeleton while loading
  el.innerHTML = `
  <div class="mb-20">
    <h2 style="font-family:var(--font-display);font-size:1.25rem;font-weight:800;color:var(--clr-text)">System Overview</h2>
    <p class="text-muted text-xs mt-4">QHSE Department · TaskFlow Pro v2.1</p>
  </div>
  <div style="color:var(--clr-text-3);font-size:0.85rem;display:flex;align-items:center;gap:8px">${icon('loader',16)} Loading live data…</div>`;

  // Fetch real data in parallel
  let users = [], categories = [], stats = {};
  try {
    const [usersData, catsData, statsData] = await Promise.all([
      apiFetch('/admin/users'),
      apiFetch('/admin/categories'),
      apiFetch('/admin/stats'),
    ]);
    users      = usersData.users;
    categories = catsData.categories;
    stats      = statsData;
  } catch (err) {
    console.error('Admin dashboard fetch failed:', err.message);
  }

  const totalUsers   = stats.totalUsers  ?? users.length;
  const totalCats    = stats.totalCategories ?? categories.length;
  const totalTasks   = stats.totalTasks  ?? '—';
  const divisions    = [...new Set(users.map(u => u.division).filter(Boolean))].length;
  const byRole = {
    Employee:   users.filter(u => u.role === 'Employee').length,
    Supervisor: users.filter(u => u.role === 'Supervisor').length,
    HOD:        users.filter(u => u.role === 'HOD').length,
    Admin:      users.filter(u => u.role === 'Admin').length,
  };

  el.innerHTML = `
  <div class="mb-20">
    <h2 style="font-family:var(--font-display);font-size:1.25rem;font-weight:800;color:var(--clr-text)">System Overview</h2>
    <p class="text-muted text-xs mt-4">QHSE Department · TaskFlow Pro v2.1</p>
  </div>

  <div class="d-grid mb-20" style="grid-template-columns:repeat(4,1fr);gap:14px">
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-blue-50);color:var(--c-blue-600)">${icon('user',20)}</div><div><div class="stat-value tabular-nums">${totalUsers}</div><div class="stat-label">Total Users</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-violet-50);color:var(--c-violet-600)">${icon('org',20)}</div><div><div class="stat-value tabular-nums">${divisions}</div><div class="stat-label">Divisions</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-green-50);color:var(--c-green-600)">${icon('tasks',20)}</div><div><div class="stat-value tabular-nums">${totalTasks}</div><div class="stat-label">Total Tasks</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:var(--c-amber-50);color:var(--c-amber-600)">${icon('bell',20)}</div><div><div class="stat-value tabular-nums">${totalCats}</div><div class="stat-label">Task Categories</div></div></div>
  </div>

  <div class="d-flex gap-16" style="flex-wrap:wrap">
    <div class="card" style="flex:1;min-width:240px">
      <div class="card-header"><div class="card-title">Users by Role</div></div>
      <canvas id="admin-role-chart" height="180"></canvas>
    </div>
    <div class="card" style="flex:2;min-width:280px">
      <div class="card-header"><div class="card-title">Team Breakdown</div></div>
      ${[
        { label: 'Employees',   value: byRole.Employee,   color: 'var(--c-green-600)',  bg: 'var(--c-green-50)'  },
        { label: 'Supervisors', value: byRole.Supervisor, color: 'var(--c-violet-600)', bg: 'var(--c-violet-50)' },
        { label: 'HOD',         value: byRole.HOD,        color: 'var(--c-blue-600)',   bg: 'var(--c-blue-50)'   },
        { label: 'Admins',      value: byRole.Admin,      color: 'var(--c-amber-600)',  bg: 'var(--c-amber-50)'  },
      ].map(r => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--clr-border)">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:30px;height:30px;border-radius:var(--r-md);background:${r.bg};display:grid;place-items:center;flex-shrink:0">${icon('user',14)}</div>
            <span class="text-sm font-semibold">${r.label}</span>
          </div>
          <span style="font-size:1.1rem;font-weight:700;color:${r.color};font-variant-numeric:tabular-nums">${r.value}</span>
        </div>`).join('')}
      <button class="btn btn-ghost btn-sm mt-8" style="width:100%;color:var(--clr-primary)" onclick="navigate('org-chart')">Manage Organisation →</button>
    </div>
  </div>`;

  // Draw chart with real role counts
  setTimeout(() => {
    drawDonutChart('admin-role-chart', [
      { label: `Employees (${byRole.Employee})`,   value: byRole.Employee,   color: '#059669' },
      { label: `Supervisors (${byRole.Supervisor})`,value: byRole.Supervisor, color: '#7c3aed' },
      { label: `HODs (${byRole.HOD})`,             value: byRole.HOD,        color: '#2563eb' },
      { label: `Admins (${byRole.Admin})`,          value: byRole.Admin,      color: '#d97706' },
    ]);
  }, 50);
}

function statusDot(status) {
  const colors = { inprogress:'var(--c-blue-600)', completed:'var(--c-green-600)', review:'var(--c-amber-500)', overdue:'var(--c-red-600)', pending:'var(--c-slate-400)', floating:'var(--c-violet-600)' };
  return `<div style="width:8px;height:8px;border-radius:50%;background:${colors[status]||'var(--c-slate-400)'};margin-top:5px;flex-shrink:0"></div>`;
}

function taskActionBtn(task, role) {
  if (role === 'employee') {
    if (task.status === 'inprogress') {
      return `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openModal('modal-submit')">Submit</button>`;
    }
    return '';
  }
  if (role === 'supervisor' || role === 'hod') {
    if (task.status === 'review') return `<button class="btn btn-success btn-sm" onclick="event.stopPropagation();openReviewModal(${task._apiId || task.id}, '${(task.title||'').replace(/'/g,'')}')">Review</button>`;
  }
  return '';
}

// ── Tasks Page ─────────────────────────────────────────────
function getRoleUserId() {
  const r = state.role;
  if (r === 'hod') return 'u1';
  if (r === 'supervisor') return USERS.supervisor.id;
  if (r === 'employee') return USERS.employee.id;
  return 'u1';
}

let _hodTaskScope = 'mine'; // 'mine' | 'org'

function renderTasksPage() {
  // Show HOD scope tabs if role is HOD
  const scopeBar = document.getElementById('hod-task-scope-bar');
  if (scopeBar) scopeBar.style.display = state.role === 'hod' ? '' : 'none';

  // Sync tab button active state to current scope
  document.querySelectorAll('.hod-scope-tab').forEach(b => b.classList.remove('active'));
  const activeTab = document.getElementById(_hodTaskScope === 'org' ? 'hod-scope-org' : 'hod-scope-mine');
  if (activeTab) activeTab.classList.add('active');

  const tasks = _hodTaskScopeTasks();
  const countEl = document.getElementById('tasks-count');
  if (countEl) countEl.textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;
  renderTasksList(tasks);
  renderKanban(tasks);
}

function _hodTaskScopeTasks() {
  if (state.role === 'hod' && _hodTaskScope === 'org') {
    return apiCache.orgTasks.length ? apiCache.orgTasks : [];
  }
  return apiCache.tasks.length ? apiCache.tasks : getVisibleTasks(getRoleUserId());
}

async function setHodTaskScope(scope, btn) {
  _hodTaskScope = scope;
  document.querySelectorAll('.hod-scope-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  if (scope === 'org' && !apiCache.orgTasks.length) {
    const countEl = document.getElementById('tasks-count');
    if (countEl) countEl.textContent = 'Loading…';
    try {
      const data = await apiFetch('/supervisor/tasks/org');
      apiCache.orgTasks = data.tasks.map(normalizeTask);
    } catch (err) {
      showToast('Could not load org tasks: ' + err.message, 'error');
      return;
    }
  }
  renderTasksPage();
}

async function applyTaskFilters() {
  const status   = document.getElementById('filter-status')?.value   || '';
  const category = document.getElementById('filter-category')?.value || '';
  const priority = document.getElementById('filter-priority')?.value || '';

  if (state.role === 'employee') {
    const params = {};
    const statusApiMap = { pending:'Pending', inprogress:'InProgress', completed:'Completed', overdue:'Overdue', unabletocomplete:'UnableToComplete' };
    if (status)   params.status   = statusApiMap[status] || capitalize(status);
    if (category) params.category = category;
    try {
      const data = await employeeApi.getTasks(params);
      apiCache.tasks = data.tasks.map(normalizeTask);
    } catch {}
  }

  let tasks = (state.role === 'employee' && apiCache.tasks.length)
    ? apiCache.tasks
    : getVisibleTasks(getRoleUserId());

  if (status)   tasks = tasks.filter(t => t.status === status);
  if (category) tasks = tasks.filter(t => t.category === category);
  if (priority) tasks = tasks.filter(t => t.priority === priority);

  renderTasksList(tasks);
  renderKanban(tasks);
  const countEl = document.getElementById('tasks-count');
  if (countEl) countEl.textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;
}

function filterTasks(status) { applyTaskFilters(); }

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function renderTasksList(tasks) {
  const tbody = document.getElementById('tasks-tbody');
  if (!tbody) return;

  const isEmp = state.role === 'employee';
  // For employees, show due date column only if at least one task has a due date
  const empHasDue = isEmp && tasks.some(t => t.dueDate);
  const thPriority = document.getElementById('th-priority');
  const thAssignee = document.getElementById('th-assignee');
  const thDuedate  = document.getElementById('th-duedate');
  const thEstTime  = document.getElementById('th-est-time');
  if (thPriority) thPriority.style.display = isEmp ? 'none' : '';
  if (thAssignee) thAssignee.style.display = isEmp ? 'none' : '';
  if (thDuedate)  thDuedate.style.display  = isEmp && !empHasDue ? 'none' : '';
  if (thEstTime)  thEstTime.textContent    = 'Est. Time';

  const colspan = isEmp ? (empHasDue ? 6 : 5) : 8;
  if (!tasks.length) { tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;padding:40px;color:var(--clr-text-3)">No tasks found</td></tr>`; return; }
  tbody.innerHTML = tasks.map(t => {
    const assigneeHtml = t.assignees.length
      ? `<div class="avatar-stack">${t.assignees.slice(0,3).map(id => avatarForUser(id,'xs',t)).join('')}${t.assignees.length>3?`<div class="avatar-more">+${t.assignees.length-3}</div>`:''}</div>`
      : `<span class="badge status-floating">Floating</span>`;
    return `<tr onclick="openTaskDetail('${t.id}')">
      <td>
        <div style="font-weight:600;color:var(--clr-text);max-width:240px" class="truncate">${t.title}</div>
        <div class="d-flex gap-4 mt-4">${t.tags.slice(0,2).map(tag=>`<span class="badge badge-slate">#${tag}</span>`).join('')}</div>
      </td>
      <td>${catBadge(t.category)}</td>
      ${isEmp ? '' : `<td>${priBadge(t.priority)}</td>`}
      ${isEmp ? '' : `<td>${assigneeHtml}</td>`}
      ${!isEmp ? `<td class="tabular-nums text-xs">${t.dueDate ? fmtDate(t.dueDate) : '—'}</td>` : empHasDue ? `<td class="tabular-nums text-xs">${t.dueDate ? fmtDate(t.dueDate) : 'No due date'}</td>` : ''}
      <td class="tabular-nums text-xs">${fmtTime(t.estimatedHours, t.estimatedUnit)}</td>
      <td>${statusBadge(t.status)}</td>
      <td>${taskActionBtn(t, state.role)}</td>
    </tr>`;
  }).join('');
}

function setTaskView(v) {
  state.taskView = v;
  document.getElementById('tasks-list-view').classList.toggle('hidden', v !== 'list');
  document.getElementById('tasks-kanban-view').classList.toggle('hidden', v !== 'kanban');
  const lb = document.getElementById('view-list-btn');
  const kb = document.getElementById('view-kanban-btn');
  if (lb) { lb.style.background = v==='list'?'var(--clr-surface)':'transparent'; lb.style.boxShadow = v==='list'?'var(--shadow-xs)':'none'; }
  if (kb) { kb.style.background = v==='kanban'?'var(--clr-surface)':'transparent'; kb.style.boxShadow = v==='kanban'?'var(--shadow-xs)':'none'; }
}

function renderKanban(tasks) {
  const board = document.getElementById('kanban-board');
  if (!board) return;
  const cols = [
    { id: 'pending',    label: 'Pending Acceptance', color: 'var(--c-slate-400)' },
    { id: 'inprogress', label: 'In Progress',         color: 'var(--c-blue-600)' },
    { id: 'review',     label: 'Under Review',        color: 'var(--c-amber-500)' },
    { id: 'completed',  label: 'Completed',           color: 'var(--c-green-600)' },
    { id: 'overdue',    label: 'Overdue',             color: 'var(--c-red-600)' },
    { id: 'floating',   label: 'Floating',            color: 'var(--c-violet-600)' },
  ];
  board.innerHTML = cols.map(col => {
    const colTasks = tasks.filter(t => t.status === col.id);
    if (!colTasks.length && col.id !== 'pending' && col.id !== 'inprogress') return '';
    return `<div class="kanban-col">
      <div class="kanban-col-header">
        <div class="kanban-col-title"><span style="width:8px;height:8px;border-radius:50%;background:${col.color};flex-shrink:0;display:inline-block"></span>${col.label}<span class="kcol-count">${colTasks.length}</span></div>
      </div>
      ${colTasks.map(t => `
        <div class="kanban-card" onclick="openTaskDetail('${t.id}')">
          <div class="d-flex gap-6 mb-8">${catBadge(t.category)}${priBadge(t.priority)}</div>
          <h5>${t.title}</h5>
          <p style="font-size:0.75rem;color:var(--clr-text-3);line-height:1.5;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${t.description}</p>
          ${t.status === 'inprogress' || t.status === 'review' ? `<div class="progress-bar mb-8"><div class="progress-fill" style="width:${t.status==='review'?'100':'55'}%"></div></div>` : ''}
          <div class="kanban-card-footer">
            <div class="avatar-stack">${t.assignees.slice(0,3).map(id=>avatarForUser(id,'xs',t)).join('')}${t.assignees.length===0?`<span class="badge status-floating" style="font-size:0.6rem">Open</span>`:''}</div>
            <span style="font-size:0.6875rem;color:var(--clr-text-3)">${fmtDate(t.dueDate)}</span>
          </div>
        </div>`).join('')}
      <button class="add-col-btn">${icon('plus',12)} Add task</button>
    </div>`;
  }).filter(Boolean).join('');
}

// ── Task Detail ────────────────────────────────────────────
async function openTaskDetail(id) {
  const sid = String(id);
  if (sid.startsWith('api-')) {
    // Try cache first; if missing, fetch directly from API
    state.currentTask = apiCache.tasks.find(t => t.id === sid)
      || apiCache.orgTasks.find(t => t.id === sid)
      || (apiCache.dashboard?.recentTasks || []).map(normalizeTask).find(t => t.id === sid)
      || null;

    if (!state.currentTask) {
      try {
        const apiId = sid.replace('api-', '');
        const endpoint = (state.role === 'employee') ? `/employee/tasks/${apiId}` : `/supervisor/tasks/${apiId}`;
        const res = await apiFetch(endpoint);
        state.currentTask = res.task ? normalizeTask(res.task) : null;
      } catch (e) {
        showToast('Could not load task details', 'error');
        return;
      }
    }
  } else {
    state.currentTask = TASKS.find(t => t.id === sid);
  }
  if (!state.currentTask) { showToast('Task not found', 'error'); return; }
  await navigate('task-detail');
  try {
    renderTaskDetail();
    refreshDetailReminders(state.currentTask.id);
    refreshDetailFilesTab(state.currentTask.id);
  } catch(err) {
    console.error('renderTaskDetail error:', err);
    showToast('Could not render task details: ' + err.message, 'error');
  }
}

function renderTaskDetail() {
  const t = state.currentTask;
  if (!t) return;

  document.getElementById('detail-breadcrumb').textContent = t.title;
  document.getElementById('topbar-sub').textContent = `${CAT_MAP[t.category]?.label} · ${t.dueDate ? 'Due ' + fmtDate(t.dueDate) : 'No due date'}`;

  // Role-based actions
  const hodOrgView = state.role === 'hod' && _hodTaskScope === 'org';
  let actions = '';
  if (!hodOrgView) {
    if (state.role === 'employee') {
      if (t.status === 'pending' && t._assignmentId) actions = `<button class="btn btn-primary" onclick="apiAcceptAssignmentFromTasks(${t._assignmentId})">Accept Task</button><button class="btn btn-danger" onclick="apiRejectAssignment(${t._assignmentId})">Reject Task</button>`;
      else if (t.status === 'inprogress' || t.status === 'overdue') actions = `<button class="btn btn-primary" onclick="openModal('modal-submit')">${icon('submit',14)} Submit Work</button>`;
    } else if (state.role === 'supervisor' || state.role === 'hod') {
      if (t.mode === 'self' && (t.status === 'inprogress' || t.status === 'overdue')) {
        actions = `<button class="btn btn-primary" onclick="openModal('modal-submit')">${icon('submit',14)} Submit Work</button>`;
      } else if (t.status === 'review') {
        actions = `<button class="btn btn-success" onclick="openReviewModal(${t._apiId || t.id}, '${(t.title||'').replace(/'/g,'')}')">Review Submission</button>`;
      }
      actions += `<button class="btn btn-secondary" onclick="showToast('Task edited','success')">Edit Task</button>`;
    }
  }

  const assigneeHtml = t.assignees.length
    ? `<div class="avatar-stack">${t.assignees.map(id=>avatarForUser(id,'sm',t)).join('')}</div><div class="text-xs text-muted">${t.assignees.map(id=>{const e=EMPLOYEES.find(e=>e.id===id);return e?.name || t._assigneeNames?.[id] || '';}).filter(Boolean).join(', ')}</div>`
    : (t.mode === 'floating' && t.status === 'pending'
        ? `<span class="badge status-floating">Open for pickup</span>`
        : `<span class="text-muted text-xs">—</span>`);

  const scheduledNotifHtml = t.scheduledNotif
    ? `<div style="display:flex;align-items:center;gap:6px;padding:8px;background:var(--c-amber-50);border:1px solid var(--c-amber-100);border-radius:var(--r-md);margin-bottom:12px;font-size:0.75rem;color:var(--c-amber-600)">${icon('clock',12)}<span>Notification scheduled: ${t.scheduledNotif}</span></div>`
    : '';

  document.getElementById('task-detail-layout').innerHTML = `
    <!-- Main content -->
    <div>
      <div class="card mb-16">
        <div class="task-detail-header">
          <div>
            <div class="d-flex gap-8 mb-8">${statusBadge(t.status)}${catBadge(t.category)}${t.mode !== 'self' ? priBadge(t.priority) : ''}</div>
            <div class="task-detail-title">${t.title}</div>
          </div>
          <div class="task-actions">${actions}</div>
        </div>
        ${scheduledNotifHtml}
        <div class="tab-bar" id="detail-tab-bar">
          <button class="tab-btn active" onclick="switchDetailTab('overview',this)">Overview</button>
          <button class="tab-btn" onclick="switchDetailTab('chat',this)">${icon('msg',13)} Chat</button>
          <button class="tab-btn" onclick="switchDetailTab('files',this)">Files <span class="tab-count">${t.files.length}</span></button>
          ${!hodOrgView ? `<button class="tab-btn" onclick="switchDetailTab('log',this)">Data Log</button>` : ''}
          ${!hodOrgView && t.hasInspection ? `<button class="tab-btn" onclick="switchDetailTab('inspect',this)">Inspection</button>` : ''}
          <button class="tab-btn" onclick="switchDetailTab('submissions',this)">Submissions <span class="tab-count">${t.submissions.length}</span></button>
        </div>

        <!-- Overview Tab -->
        <div class="tab-panel active" id="dtab-overview">
          <p style="font-size:0.875rem;color:var(--clr-text-2);line-height:1.7;margin-bottom:20px">${t.description}</p>
          <div class="d-flex gap-8 mb-16" style="flex-wrap:wrap">${t.tags.map(tag=>`<span class="badge badge-slate">#${tag}</span>`).join('')}</div>
          <div class="section-title text-xs mb-12">TASK LIFECYCLE</div>
          <div class="timeline">
            <div class="timeline-item"><div class="timeline-dot done">${icon('check',10)}</div><div class="timeline-content"><div class="timeline-label">Created</div><div class="timeline-date">${t.createdAt}${t.createdByName ? ' · by ' + t.createdByName : ''}</div></div></div>
            ${t.mode !== 'self' ? `
            <div class="timeline-item"><div class="timeline-dot done">${icon('check',10)}</div><div class="timeline-content"><div class="timeline-label">Assigned</div><div class="timeline-date">${t.createdAt} · ${t.mode === 'floating' ? 'Published as floating task' : 'Directly assigned'}</div></div></div>
            <div class="timeline-item"><div class="timeline-dot ${['inprogress','review','completed'].includes(t.status)?'done':''}">${['inprogress','review','completed'].includes(t.status)?icon('check',10):''}</div><div class="timeline-content"><div class="timeline-label">Accepted</div><div class="timeline-date">${['inprogress','review','completed'].includes(t.status)?(t.startDate||t.createdAt||'—'):'Awaiting acceptance'}</div></div></div>
            <div class="timeline-item"><div class="timeline-dot ${['review','completed'].includes(t.status)?'done':''}">${['review','completed'].includes(t.status)?icon('check',10):''}</div><div class="timeline-content"><div class="timeline-label">Submitted for Review</div><div class="timeline-date">${['review','completed'].includes(t.status)?'Submitted':'Pending'}</div></div></div>
            <div class="timeline-item"><div class="timeline-dot ${t.status==='completed'?'done':''}">${t.status==='completed'?icon('check',10):''}</div><div class="timeline-content"><div class="timeline-label">Approved &amp; Completed</div><div class="timeline-date">${t.status==='completed'?fmtDate(t.dueDate):'Pending'}</div></div></div>
            ` : `
            <div class="timeline-item"><div class="timeline-dot ${['inprogress','review','completed'].includes(t.status)?'done':''}">${['inprogress','review','completed'].includes(t.status)?icon('check',10):''}</div><div class="timeline-content"><div class="timeline-label">In Progress</div><div class="timeline-date">${['inprogress','review','completed'].includes(t.status)?(t.startDate||t.createdAt||'—'):'Pending'}</div></div></div>
            <div class="timeline-item"><div class="timeline-dot ${['review','completed'].includes(t.status)?'done':''}">${['review','completed'].includes(t.status)?icon('check',10):''}</div><div class="timeline-content"><div class="timeline-label">Submitted for Review</div><div class="timeline-date">${['review','completed'].includes(t.status)?(t.submissions?.[0]?.submittedAt||'Submitted'):'Pending'}</div></div></div>
            <div class="timeline-item"><div class="timeline-dot ${t.status==='completed'?'done':''}">${t.status==='completed'?icon('check',10):''}</div><div class="timeline-content"><div class="timeline-label">Approved &amp; Completed</div><div class="timeline-date">${t.status==='completed'?'Completed':'Pending'}</div></div></div>
            `}
          </div>
        </div>

        <!-- Chat Tab -->
        <div class="tab-panel" id="dtab-chat">
          ${t.status === 'floating' && !t.assignees.length ? `<div class="empty-state">${icon('msg',40)}<h3>Chat opens when task starts</h3><p>Once an employee accepts and starts this task, a scoped chat thread will open automatically.</p></div>` : `
          <div id="chat-participants-bar" style="margin-bottom:10px;padding:8px 12px;background:var(--clr-primary-surface);border-radius:var(--r-md);font-size:0.75rem;color:var(--clr-primary)">
            ${icon('info',12)} Loading participants…
          </div>
          <div class="chat-area">
            <div class="chat-messages" id="chat-messages-box">
              <p class="text-muted text-xs" style="padding:12px 0">Loading messages…</p>
            </div>
            <div class="chat-input-area">
              <textarea class="chat-input" placeholder="Type a message…" rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChatMsg();}"></textarea>
              <button class="btn btn-primary btn-icon btn-sm" onclick="sendChatMsg()">${icon('send',14)}</button>
            </div>
          </div>`}
        </div>

        <!-- Files Tab -->
        <div class="tab-panel" id="dtab-files">
          <input type="file" id="dtab-file-input" multiple style="display:none" onchange="handleDetailFileAttach('${t.id}', this)" />
          <div id="dtab-files-content"></div>
        </div>

        <!-- Data Log Tab -->
        <div class="tab-panel" id="dtab-log">
          ${(state.role === 'employee' && t.status === 'inprogress' && t.submissions?.length > 0) ? `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:var(--c-amber-50);border:1px solid var(--c-amber-200);border-radius:var(--r-md);margin-bottom:16px;font-size:0.8125rem;color:var(--c-amber-700)">
            ${icon('bell',14)} <span><strong>Revision requested.</strong> Update your log entry below, then submit again.</span>
          </div>` : ''}
          <div class="section-title text-xs mb-16">STRUCTURED DATA ENTRY — ${(CAT_MAP[t.dataLogType]||CAT_MAP[t.category])?.label?.toUpperCase()}</div>
          ${renderDataLog(t.dataLogType, t)}
        </div>

        ${t.hasInspection ? `<!-- Inspection Tab -->
        <div class="tab-panel" id="dtab-inspect">
          <div class="section-title text-xs mb-16">INSPECTION RECORD</div>
          <div class="d-flex flex-col gap-14">
            <div class="form-row"><div class="form-group"><label class="form-label">Inspector Name</label><input class="form-input" value="${EMPLOYEES.find(e=>t.assignees.includes(e.id))?.name||''}" /></div><div class="form-group"><label class="form-label">Inspector ID</label><input class="form-input" value="${t.assignees[0]||''}" /></div></div>
            <div class="form-row"><div class="form-group"><label class="form-label">Inspection Date</label><input class="form-input" type="date" value="2026-08-05" /></div><div class="form-group"><label class="form-label">Hours Spent</label><input class="form-input" type="number" placeholder="0" /></div></div>
            <div class="form-group"><label class="form-label">Site Location</label><input class="form-input" placeholder="e.g. Zone 4, Building C, Level 2" /></div>
            <div class="form-group"><label class="form-label">Findings</label><textarea class="form-input" rows="4" placeholder="Describe all findings, observations, and non-conformances…"></textarea></div>
            <div class="form-group">
              <label class="form-label">Inspection Result</label>
              <div class="pill-select">
                <div class="pill-option" style="border-color:var(--c-green-600);color:var(--c-green-600)" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">✓ Pass</div>
                <div class="pill-option" style="border-color:var(--c-red-600);color:var(--c-red-600)" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">✕ Fail</div>
                <div class="pill-option" style="border-color:var(--c-amber-600);color:var(--c-amber-600)" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">△ Conditional</div>
              </div>
            </div>
            <button class="btn btn-primary" style="align-self:flex-end">Save Inspection Record</button>
          </div>
        </div>` : ''}

        <!-- Submissions Tab -->
        <div class="tab-panel" id="dtab-submissions">
          ${t.submissions.length === 0 ? `
            <div class="empty-state">${icon('submit',40)}<h3>No submissions yet</h3><p>Once the employee submits their work, it will appear here for review.</p>${state.role==='employee'&&t.status==='inprogress'?`<button class="btn btn-primary mt-8" onclick="openModal('modal-submit')">Submit Work Now</button>`:''}</div>`
          : t.submissions.map(s => `
            <div class="submission-round">
              <div class="submission-round-header">
                <span class="round-label">Round ${s.round}</span>
                ${s.status==='approved'?`<span class="badge status-completed">Approved</span>`:s.status==='rejected'?`<span class="badge status-rejected">Rejected</span>`:`<span class="badge status-review">Pending Review</span>`}
              </div>
              <div class="d-flex gap-10 items-start mb-10">
                ${avatar('LP','#7c3aed','sm')}
                <div style="flex:1">
                  <div class="font-semibold text-sm">${s.submittedBy}</div>
                  <div class="text-xs text-muted">${s.submittedAt} · ${s.actualHours}h actual</div>
                  <div style="background:var(--clr-surface);border:1px solid var(--clr-border);border-radius:var(--r-md);padding:10px;margin-top:8px;font-size:0.8125rem;color:var(--clr-text-2)">${s.remarks}</div>
                </div>
              </div>
              ${s.supervisorFeedback ? `
                <div style="margin-left:42px;padding:10px;background:${s.status==='approved'?'var(--c-green-50)':'var(--c-red-50)'};border:1px solid ${s.status==='approved'?'var(--c-green-100)':'var(--c-red-100)'};border-radius:var(--r-md)">
                  <div class="text-xs font-semibold mb-4" style="color:${s.status==='approved'?'var(--c-green-700)':'var(--c-red-600)'}">${s.status==='approved'?'✓ Approved':'✕ Rejected'} — Mr. Nisal Liyanage</div>
                  <div class="text-sm">${s.supervisorFeedback}</div>
                </div>` : (state.role==='supervisor'||state.role==='hod') ? `<div style="margin-left:42px"><button class="btn btn-success btn-sm" onclick="openReviewModal(${t._apiId||t.id}, '${(t.title||'').replace(/'/g,'')}')">Review this Submission</button></div>` : ''}
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Sidebar info -->
    <div class="task-info-card">
      <div class="section-title text-xs mb-12">TASK DETAILS</div>
      <div class="task-info-row"><div class="task-info-key">Status</div><div>${statusBadge(t.status)}</div></div>
      <div class="task-info-row"><div class="task-info-key">Category</div><div>${catBadge(t.category)}</div></div>
      ${t.mode !== 'self' ? `<div class="task-info-row"><div class="task-info-key">Priority</div><div>${priBadge(t.priority)}</div></div>` : ''}
      <div class="task-info-row"><div class="task-info-key">Mode</div><div class="task-info-val">${t.mode === 'floating' ? '⊙ Floating' : t.mode === 'self' ? '✎ Self-logged' : '→ Assigned'}</div></div>
      ${t.startDate ? `<div class="task-info-row"><div class="task-info-key">Start Date</div><div class="task-info-val tabular-nums">${fmtDate(t.startDate)}${t.startTime ? ' <span style="color:var(--clr-text-3)">@ ' + fmtTimeFull(t.startTime) + '</span>' : ''}</div></div>` : ''}
      <div class="task-info-row"><div class="task-info-key">Due Date</div><div class="task-info-val tabular-nums" style="color:${t.status==='overdue'?'var(--c-red-600)':''}">${t.dueDate ? fmtDate(t.dueDate) : '<span style="color:var(--clr-text-3);font-style:italic">No due date</span>'}${t.endTime ? ' <span style="color:var(--clr-text-3)">@ ' + fmtTimeFull(t.endTime) + '</span>' : ''}${t.status==='overdue'?' ⚠':''}
      </div></div>
      ${t.mode !== 'self' ? `<div class="task-info-row"><div class="task-info-key">Est. Time</div><div class="task-info-val tabular-nums">${fmtTime(t.estimatedHours, t.estimatedUnit)}</div></div>` : ''}
      ${t.actualHours ? `<div class="task-info-row"><div class="task-info-key">Actual Time</div><div class="task-info-val tabular-nums" style="color:var(--c-green-600)">${t.actualHours}h</div></div>` : ''}
      <div class="task-info-row" style="border-bottom:none"><div class="task-info-key">Assignees</div><div class="d-flex flex-col gap-4">${assigneeHtml}</div></div>

      ${(t.createdByName && t.createdByName !== USERS.employee.name && t.mode !== 'self') ? `<div class="divider"></div>
      <div class="section-title text-xs mb-12">SUPERVISOR</div>
      <div class="d-flex items-center gap-8">
        ${avatar(t.createdByName.split(' ').map(function(w){return w[0];}).join('').substring(0,2),'#7c3aed','sm')}
        <div><div class="text-sm font-semibold">${t.createdByName}</div><div class="text-xs text-muted">Supervisor</div></div>
      </div>` : ''}

      ${t.scheduledNotif ? `<div class="divider"></div><div class="section-title text-xs mb-8">SCHEDULED NOTIFICATION</div><div style="font-size:0.75rem;color:var(--c-amber-600);background:var(--c-amber-50);padding:8px;border-radius:var(--r-md)">${icon('clock',12)} Sends at ${t.scheduledNotif}</div>` : ''}
      <div id="detail-reminders-block"></div>

      <div class="divider"></div>
      <div id="detail-reminder-section">
        <button class="btn btn-ghost btn-sm w-full" style="justify-content:flex-start;color:var(--clr-text-2)" onclick="toggleDetailReminderForm('${t.id}')">${icon('bell',13)} Set Reminder</button>
        <div id="detail-reminder-form" class="hidden" style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;gap:6px">
            <input type="date" id="dr-date" class="form-input" style="flex:1;font-size:0.8125rem;padding:5px 8px" />
            <input type="time" id="dr-time" class="form-input" style="width:95px;font-size:0.8125rem;padding:5px 8px" value="09:00" />
          </div>
          <button class="btn btn-primary btn-sm w-full" onclick="addDetailReminder('${t.id}')">Add Reminder</button>
        </div>
      </div>
      <input type="file" id="detail-file-input" multiple style="display:none" onchange="handleDetailFileAttach('${t.id}', this)" />
      <button class="btn btn-ghost btn-sm w-full" style="justify-content:flex-start;color:var(--clr-text-2)" onclick="document.getElementById('detail-file-input').click()">${icon('clip',13)} Attach File</button>
    </div>`;
}

function renderDataLog(type, t = {}) {
  const v  = val => val ? `value="${val}"` : '';
  const ro = (label, val) => `<div class="form-group"><label class="form-label">${label}</label><input class="form-input" readonly style="background:var(--clr-surface-2);color:var(--clr-text-2)" value="${val || '—'}" /></div>`;
  if (type === 'work') return `
    <div class="d-flex flex-col gap-14">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Site Name</label><input class="form-input" placeholder="e.g. Solar Ground Mount Site, Veyangoda" ${v(t.siteName)} /></div>
        <div class="form-group"><label class="form-label">Actual Date</label><input class="form-input" type="date" ${v(t.startDate)} /></div>
      </div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" rows="2" placeholder="e.g. Supply and Installation of Solar PV system"></textarea></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Division</label><input class="form-input" placeholder="e.g. Solar, MEP, Compliance and ESG" /></div>
        <div class="form-group"><label class="form-label">Monitoring Type</label><input class="form-input" placeholder="e.g. Quality, Security, EIA, Energy" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Inspected By</label><input class="form-input" placeholder="Employee name" /></div>
        <div class="form-group"><label class="form-label">Site Incharge</label><input class="form-input" placeholder="Site incharge name" /></div>
        <div class="form-group"><label class="form-label">Contact No</label><input class="form-input" type="tel" placeholder="Contact number" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Time for Inspection (hrs)</label><input class="form-input" type="number" min="0" step="0.1" placeholder="0.0" /></div>
        <div class="form-group"><label class="form-label">Time for Reporting (hrs)</label><input class="form-input" type="number" min="0" step="0.1" placeholder="0.0" /></div>
        <div class="form-group"><label class="form-label">Travelling Time (hrs)</label><input class="form-input" type="number" min="0" step="0.1" placeholder="0.0" /></div>
        <div class="form-group"><label class="form-label">Total Hours Expended</label><input class="form-input" type="number" min="0" step="0.1" placeholder="Auto-calculated" readonly style="background:var(--clr-surface-2);color:var(--clr-text-3)" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">No. of N/C Raised</label><input class="form-input" type="number" min="0" placeholder="0" /></div>
        <div class="form-group"><label class="form-label">N/C Closed</label><input class="form-input" type="number" min="0" placeholder="0" /></div>
        <div class="form-group"><label class="form-label">Meeting Date with Supervisor</label><input class="form-input" type="date" /></div>
      </div>
      <div class="form-group">
        <label class="form-label">Report Status</label>
        <div class="pill-select">
          <div class="pill-option" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">Completed</div>
          <div class="pill-option" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">In Progress</div>
          <div class="pill-option" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">No</div>
        </div>
      </div>
      <button class="btn btn-primary" style="align-self:flex-end" onclick="saveDataLog(this)">Save Log Entry</button>
    </div>`;

  if (type === 'support') return `
    <div class="d-flex flex-col gap-14">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" /></div>
        <div class="form-group"><label class="form-label">Name of the Employee</label><input class="form-input" placeholder="Employee name" /></div>
      </div>
      <div class="form-group"><label class="form-label">Nature of the Service Provided</label><textarea class="form-input" rows="2" placeholder="e.g. Award Application, Supplier Registration Form, Tender Requirement Response"></textarea></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Service Request Division</label><input class="form-input" placeholder="e.g. Haywind, FSF, MEP, Marketing" /></div>
        <div class="form-group"><label class="form-label">Service Requester Name</label><input class="form-input" placeholder="Requester's name" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Total Time Spent by Employee (hrs)</label><input class="form-input" type="number" min="0" step="0.5" placeholder="0.0" /></div>
        <div class="form-group"><label class="form-label">Work Reviewed Person</label><input class="form-input" placeholder="e.g. Mr. Nisal Liyanage" /></div>
        <div class="form-group"><label class="form-label">Total Time Spent for Review (hrs)</label><input class="form-input" type="number" min="0" step="0.25" placeholder="0.0" /></div>
      </div>
      <button class="btn btn-primary" style="align-self:flex-end" onclick="saveDataLog(this)">Save Log Entry</button>
    </div>`;

  if (type === 'training') return `
    <div class="d-flex flex-col gap-14">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" /></div>
        <div class="form-group"><label class="form-label">Activity Name</label><input class="form-input" placeholder="e.g. QHSEEn Induction, Fire Safety Training" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Activity Category</label>
          <div class="pill-select">
            <div class="pill-option" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">Training</div>
            <div class="pill-option" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">Project</div>
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Mode</label>
          <div class="pill-select">
            <div class="pill-option" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">Physical</div>
            <div class="pill-option" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">Online</div>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Scope</label>
          <div class="pill-select">
            <div class="pill-option" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">Internal</div>
            <div class="pill-option" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">External</div>
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Division</label><input class="form-input" placeholder="e.g. Solar, MEP, Head Office(All)" /></div>
        <div class="form-group"><label class="form-label">Conducted By / Project Lead</label><input class="form-input" placeholder="Name" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Duration (hrs)</label><input class="form-input" type="number" min="0" step="0.5" placeholder="0.0" /></div>
        <div class="form-group"><label class="form-label">Start Date</label><input class="form-input" type="date" /></div>
        <div class="form-group"><label class="form-label">End Date</label><input class="form-input" type="date" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Planned Participants</label><input class="form-input" type="number" min="0" placeholder="0" /></div>
        <div class="form-group"><label class="form-label">Actual Participants</label><input class="form-input" type="number" min="0" placeholder="0" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Status</label>
          <div class="pill-select">
            <div class="pill-option" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">Completed</div>
            <div class="pill-option" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">In Progress</div>
            <div class="pill-option" onclick="this.parentElement.querySelectorAll('.pill-option').forEach(p=>p.classList.remove('selected'));this.classList.add('selected')">Planned</div>
          </div>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Remarks</label><textarea class="form-input" rows="2" placeholder="Any additional remarks…"></textarea></div>
      <button class="btn btn-primary" style="align-self:flex-end" onclick="saveDataLog(this)">Save Log Entry</button>
    </div>`;

  // Fallback for future custom categories added by Admin
  return `
    <div class="d-flex flex-col gap-14">
      <div style="padding:12px;background:var(--c-blue-50);border:1px solid var(--c-blue-100);border-radius:var(--r-md);font-size:0.8125rem;color:var(--c-blue-700)">
        ${icon('info',14)} This is a custom category. The Admin can configure the data log fields for this category in <strong>Organisation → Category Settings</strong>.
      </div>
      <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" /></div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" rows="4" placeholder="Describe the work performed…"></textarea></div>
      <div class="form-group"><label class="form-label">Time Spent (hrs)</label><input class="form-input" type="number" step="0.5" placeholder="0.0" /></div>
      <div class="form-group"><label class="form-label">Remarks</label><textarea class="form-input" rows="2" placeholder="Any additional notes…"></textarea></div>
      <button class="btn btn-primary" style="align-self:flex-end" onclick="saveDataLog(this)">Save Log Entry</button>
    </div>`;
}

async function saveDataLog(btn) {
  const task = state.currentTask;
  if (!task?._apiId) { showToast('Cannot save — task not linked to API', 'error'); return; }

  // Collect all inputs/textareas/selects inside the data log panel
  const panel = btn.closest('.d-flex');
  if (!panel) return;
  const body = {};
  panel.querySelectorAll('input[class*="form-input"], textarea[class*="form-input"]').forEach(el => {
    if (el.readOnly) return;
    const label = el.closest('.form-group')?.querySelector('.form-label')?.textContent?.trim() || '';
    // Map label → known DB column names
    const labelMap = {
      'Site Name': 'sitename', 'Actual Date': 'actualdate', 'Description': 'description',
      'Division': 'division', 'Monitoring Type': 'monitoringtype',
      'Inspected By': 'inspectedby', 'Site Incharge': 'siteincharge', 'Contact No': 'contactno',
      'Time for Inspection (hrs)': 'inspectionhrs', 'Time for Reporting (hrs)': 'reportinghrs',
      'Travelling Time (hrs)': 'travellinghrs', 'No. of N/C Raised': 'ncraised',
      'N/C Closed': 'ncclosed', 'Meeting Date with Supervisor': 'meetingdatewithsupervisor',
      'Date': 'actualdate', 'Name of the Employee': 'employeename',
      'Nature of the Service Provided': 'natureofservice',
      'Service Request Division': 'servicerequestdivision',
      'Service Requester Name': 'servicerequestername',
      'Total Time Spent by Employee (hrs)': 'totaltimebyemployee',
      'Work Reviewed Person': 'reviewedby',
      'Total Time Spent for Review (hrs)': 'totaltimeforreview',
      'Activity Name': 'activityname',
      'Conducted By / Project Lead': 'conductedby',
      'Duration (hrs)': 'durationhours', 'Start Date': 'startdate', 'End Date': 'enddate',
      'Planned Participants': 'plannedparticipants', 'Actual Participants': 'actualparticipants',
      'Remarks': 'remarks',
    };
    const col = labelMap[label];
    if (col && el.value.trim() !== '') body[col] = el.value.trim();
  });

  if (!Object.keys(body).length) { showToast('No changes to save', 'error'); return; }

  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiFetch(`/employee/tasks/${task._apiId}`, { method: 'PATCH', body: JSON.stringify(body) });
    showToast('Log entry saved', 'success');
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Log Entry';
  }
}

function switchDetailTab(tabId, btn) {
  document.querySelectorAll('#detail-tab-bar .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('[id^="dtab-"]').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`dtab-${tabId}`);
  if (panel) panel.classList.add('active');
  if (tabId === 'chat') loadChatMessages();
}

// ── Chat ───────────────────────────────────────────────────
let _chatApiId = null;

function _chatEndpoint() {
  const t = state.currentTask;
  if (!t) return null;
  const apiId = t._apiId || t.id?.replace('api-', '');
  if (!apiId || isNaN(apiId)) return null;
  const base = (state.role === 'employee') ? '/employee/tasks' : '/tasks';
  return `${base}/${apiId}/messages`;
}

async function loadChatMessages() {
  const endpoint = _chatEndpoint();
  if (!endpoint) return;
  const box = document.getElementById('chat-messages-box');
  if (!box) return;

  const t = state.currentTask;
  const taskApiId = t?._apiId || t?.id?.replace('api-', '');

  try {
    const [msgData, partData] = await Promise.all([
      apiFetch(endpoint),
      taskApiId ? apiFetch(`/tasks/${taskApiId}/chat-participants`).catch(() => ({ participants: [] })) : Promise.resolve({ participants: [] }),
    ]);
    _chatApiId = endpoint;
    renderChatMessages(msgData.messages || [], box);
    renderChatParticipants(partData.participants || [], taskApiId);
  } catch (err) {
    if (box) box.innerHTML = `<p class="text-muted text-xs" style="padding:16px">Could not load messages: ${err.message}</p>`;
  }
}

function renderChatParticipants(participants, taskApiId) {
  const bar = document.getElementById('chat-participants-bar');
  if (!bar) return;
  const names = participants.map(p => p.name).join(', ') || 'No participants yet';
  const addBtn = (state.role === 'hod')
    ? ` · <span style="text-decoration:underline;cursor:pointer;font-weight:600" onclick="openAddParticipantModal(${taskApiId})">+ Add participant</span>`
    : '';
  bar.innerHTML = `${icon('info',12)} <strong>Participants:</strong> ${escHtml(names)}${addBtn}`;
}

async function openAddParticipantModal(taskApiId) {
  // Load all org users to pick from
  let users = [];
  try {
    const data = await apiFetch('/team');
    users = data.users || [];
  } catch (e) {
    showToast('Could not load users', 'error'); return;
  }

  // Build modal content
  const modal = document.getElementById('modal-add-chat-participant');
  if (!modal) return;
  const list = document.getElementById('add-participant-user-list');
  if (list) {
    list.innerHTML = users.map(u => `
      <div class="participant-option" onclick="addChatParticipant(${taskApiId}, ${u.userid}, this)">
        ${avatar((u.name||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase(), '#2563eb', 'xs')}
        <div style="flex:1">
          <div style="font-weight:600;font-size:0.85rem">${escHtml(u.name)}</div>
          <div style="font-size:0.75rem;color:var(--clr-text-muted)">${escHtml(u.designation||u.role||'')}</div>
        </div>
      </div>`).join('');
  }
  document.getElementById('add-participant-task-id').value = taskApiId;
  openModal('modal-add-chat-participant');
}

function filterParticipantList(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('#add-participant-user-list .participant-option').forEach(el => {
    el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

async function addChatParticipant(taskApiId, userId, el) {
  try {
    await apiFetch(`/tasks/${taskApiId}/chat-participants`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    if (el) {
      el.style.opacity = '0.5';
      el.style.pointerEvents = 'none';
      el.querySelector('div div:first-child').textContent += ' ✓';
    }
    showToast('Participant added to chat', 'success');
    // Refresh participant bar
    const partData = await apiFetch(`/tasks/${taskApiId}/chat-participants`).catch(() => ({ participants: [] }));
    renderChatParticipants(partData.participants || [], taskApiId);
  } catch (err) {
    showToast(err.message || 'Failed to add participant', 'error');
  }
}

function renderChatMessages(messages, box) {
  if (!box) box = document.getElementById('chat-messages-box');
  if (!box) return;
  if (!messages.length) {
    box.innerHTML = `<p class="text-muted text-xs" style="padding:12px 0">No messages yet. Start the conversation.</p>`;
    box.scrollTop = 0;
    return;
  }
  box.innerHTML = messages.map(m => {
    const mine = parseInt(m.senderid) === state.userId;
    const initials = (m.sendername || '?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    // stable colour from sender id
    const palette = ['#2563eb','#7c3aed','#059669','#d97706','#0891b2','#dc2626','#ea580c'];
    const col = palette[(parseInt(m.senderid) || 0) % palette.length];
    const time = m.sentat ? new Date(m.sentat).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';

    if (mine) {
      return `
      <div class="chat-msg mine">
        <div>
          <div class="chat-bubble">${escHtml(m.content)}</div>
          <div class="chat-time">${time}</div>
        </div>
      </div>`;
    }
    return `
    <div class="chat-msg">
      ${avatar(initials, col, 'xs')}
      <div>
        <div class="chat-sender">${escHtml(m.sendername)}</div>
        <div class="chat-bubble">${escHtml(m.content)}</div>
        <div class="chat-time">${time}</div>
      </div>
    </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

async function sendChatMsg() {
  const endpoint = _chatEndpoint();
  if (!endpoint) { showToast('No task selected', 'error'); return; }
  const textarea = document.querySelector('#dtab-chat .chat-input');
  const content  = textarea?.value.trim();
  if (!content) return;

  const sendBtn = document.querySelector('#dtab-chat .chat-input-area .btn-primary');
  if (sendBtn) sendBtn.disabled = true;

  try {
    await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    textarea.value = '';
    await loadChatMessages();
  } catch (err) {
    showToast(err.message || 'Failed to send message', 'error');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

// ── Task Create ────────────────────────────────────────────
function initTaskCreate() {
  state.createStep = 1;
  attachedFiles.splice(0);
  renderAttachmentList();
  customReminders.splice(0);
  _reminderId = 0;

  // Clear all text/select fields
  const tcTitle = document.getElementById('tc-title');
  const tcDesc  = document.getElementById('tc-desc');
  const tcCat   = document.getElementById('tc-category');
  const tcHours = document.getElementById('tc-hours');
  if (tcTitle) tcTitle.value = '';
  if (tcDesc)  tcDesc.value  = '';
  if (tcCat)   tcCat.value   = '';
  if (tcHours) tcHours.value = '';

  const fi = document.getElementById('tc-file-input'); if (fi) fi.value = '';
  goStep(1);

  const role = state.role;
  const titleEl = document.getElementById('tc-page-title');
  const subEl   = document.getElementById('tc-page-sub');
  if (titleEl) titleEl.textContent = role === 'employee' ? 'Log My Work' : 'Create New Task';
  if (subEl)   subEl.textContent   = role === 'employee' ? 'Record a task you completed or are working on' : 'Fill in details, assign, then schedule notification';
  const el = document.getElementById('employee-list');
  const modeSection = document.getElementById('assignee-section');

  // Employees log their own work — hide Publish Mode and Assign To entirely
  const publishModeGroup = document.getElementById('tc-mode-select')?.closest('.form-group');
  if (publishModeGroup) publishModeGroup.style.display = role === 'employee' ? 'none' : '';
  if (modeSection)      modeSection.style.display      = role === 'employee' ? 'none' : '';

  if (el) {
    if (role === 'employee') {
      // no-op — section is hidden
    } else {
      // Load real team from API — employees who report to this user
      el.innerHTML = `<div style="padding:12px;color:var(--clr-text-3);font-size:0.82rem">Loading team…</div>`;
      apiFetch('/team').then(data => {
        let assignable = data.users;
        if (!assignable.length) {
          el.innerHTML = `<div style="padding:12px;color:var(--clr-text-3);font-size:0.82rem">No team members found.</div>`;
          return;
        }
        el.innerHTML = assignable.map(e => {
          const initials = e.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
          const colors = ['#2563eb','#7c3aed','#059669','#d97706','#0891b2','#dc2626'];
          let h = 0; for (let i = 0; i < e.name.length; i++) h = (h * 31 + e.name.charCodeAt(i)) & 0xfffffff;
          const color = colors[h % colors.length];
          return `
          <label data-userid="${e.userid}" style="display:flex;align-items:center;gap:10px;padding:10px 8px;border-radius:var(--r-sm);cursor:pointer;transition:background var(--t-fast)" onmouseover="this.style.background='var(--clr-surface-2)'" onmouseout="this.style.background=''">
            <input type="checkbox" style="accent-color:var(--clr-primary);width:15px;height:15px;flex-shrink:0" onchange="updateSelectedCount()" />
            <div style="width:28px;height:28px;border-radius:50%;background:${color};color:#fff;display:grid;place-items:center;font-size:0.65rem;font-weight:700;flex-shrink:0">${initials}</div>
            <div><div class="text-sm font-semibold">${e.name}</div><div class="text-xs text-muted">${e.designation || e.division || 'Employee'}</div></div>
          </label>`;
        }).join('');
      }).catch(() => {
        el.innerHTML = `<div style="padding:12px;color:var(--c-red-600);font-size:0.82rem">Failed to load team.</div>`;
      });
      // Show floating mode option for supervisors/HOD
      document.querySelectorAll('.pill-option').forEach(o => {
        if (o.textContent.trim().toLowerCase().includes('floating')) o.style.display = '';
      });
    }
  }
  // Default dates
  const today = new Date();
  const due = new Date(); due.setDate(today.getDate() + 14);
  const startEl    = document.getElementById('tc-start');
  const dueEl      = document.getElementById('tc-due');
  const dueDateGrp = document.getElementById('due-date-group');
  const startLabel = document.getElementById('tc-start-label');
  if (startEl) startEl.value = today.toISOString().split('T')[0];
  if (dueEl)   dueEl.value   = due.toISOString().split('T')[0];

  // Step 2 button: employees submit directly, others go to Step 3
  const step2NextBtn = document.getElementById('step2-next-btn');
  if (step2NextBtn) {
    if (role === 'employee') {
      step2NextBtn.textContent = 'Log Work';
      step2NextBtn.onclick = submitTask;
    } else {
      step2NextBtn.textContent = 'Next: Notifications →';
      step2NextBtn.onclick = () => goStep(3);
    }
  }

  // Employees log work they've already done — hide due date/priority, show optional due date toggle
  const priorityGrp   = document.getElementById('priority-group');
  const empDueSec     = document.getElementById('emp-duedate-section');
  const empDueInput   = document.getElementById('tc-emp-due');
  const empDueToggle  = document.getElementById('emp-duedate-toggle');
  if (role === 'employee') {
    if (dueDateGrp)  dueDateGrp.style.display  = 'none';
    if (priorityGrp) priorityGrp.style.display  = 'none';
    if (startLabel)  startLabel.textContent = 'Work Date';
    if (startEl)     startEl.value = today.toISOString().split('T')[0];
    if (empDueSec)   empDueSec.classList.remove('hidden');
    // Reset toggle to "No" each time form opens
    if (empDueInput)  empDueInput.value = '';
    if (empDueToggle) {
      empDueToggle.querySelectorAll('.pill-option').forEach((o, i) => {
        o.classList.toggle('selected', i === 0);
      });
    }
    document.getElementById('emp-duedate-input-group')?.classList.add('hidden');
    const remSel = document.getElementById('emp-reminder-select'); if (remSel) remSel.value = '';
    // Step 3: show employee reminder panel, hide supervisor panel
    const empPanel = document.getElementById('emp-reminder-panel');
    if (empPanel) { empPanel.classList.remove('hidden'); empPanel.style.display = 'flex'; }
    document.getElementById('supervisor-notif-panel')?.classList.add('hidden');
    document.getElementById('step3-title') && (document.getElementById('step3-title').textContent = 'Set a Reminder');
    renderCustomReminders();
  } else {
    if (dueDateGrp)  dueDateGrp.style.display  = '';
    if (priorityGrp) priorityGrp.style.display  = '';
    if (startLabel)  startLabel.textContent = 'Planned Start Date';
    if (empDueSec)   empDueSec.classList.add('hidden');
    // Step 3: show supervisor panel, hide employee reminder panel
    const empPanelHide = document.getElementById('emp-reminder-panel');
    if (empPanelHide) { empPanelHide.classList.add('hidden'); empPanelHide.style.display = 'none'; }
    document.getElementById('supervisor-notif-panel')?.classList.remove('hidden');
    document.getElementById('step3-title') && (document.getElementById('step3-title').textContent = 'Notification Schedule');
  }

  // Wire category change → show/hide module-specific fields
  const catEl = document.getElementById('tc-category');
  if (catEl) {
    catEl.removeEventListener('change', onCategoryChange);
    catEl.addEventListener('change', onCategoryChange);
    onCategoryChange.call(catEl); // run once in case value pre-set
  }
}

function collectModuleFields(slug) {
  const v = id => document.getElementById(id)?.value?.trim() || null;
  const n = id => parseFloat(document.getElementById(id)?.value) || null;
  if (slug === 'WorkTracking') return {
    siteName:          v('wt-sitename'),
    division:          v('wt-division'),
    monitoringType:    v('wt-monitoringtype'),
    inspectedBy:       v('wt-inspectedby'),
    siteInCharge:      v('wt-siteincharge'),
    contactNo:         v('wt-contactno'),
    inspectionHrs:     n('wt-inspectionhrs'),
    reportingHrs:      n('wt-reportinghrs'),
    travellingHrs:     n('wt-travellinghrs'),
    ncRaised:          n('wt-ncraised'),
    ncClosed:          n('wt-ncclosed'),
    reportStatus:      v('wt-reportstatus'),
  };
  if (slug === 'SupportService') return {
    natureOfService:          v('ss-natureofservice'),
    serviceRequestDivision:   v('ss-division'),
    serviceRequesterName:     v('ss-requestername'),
    totalTimeByEmployee:      n('ss-timebyemployee'),
    reviewedBy:               v('ss-reviewedby'),
    totalTimeForReview:       n('ss-timeforreview'),
  };
  if (slug === 'TrainingProject') return {
    activityName:       v('tp-activityname'),
    activityCategory:   v('tp-activitycategory'),
    tpMode:             v('tp-mode'),
    scope:              v('tp-scope'),
    conductedBy:        v('tp-conductedby'),
    durationHours:      n('tp-duration'),
    plannedParticipants: n('tp-planned'),
    actualParticipants:  n('tp-actual'),
  };
  return {};
}

function onCategoryChange() {
  const slug = this.value || document.getElementById('tc-category')?.value || '';
  document.querySelectorAll('.cat-fields').forEach(el => {
    const show = el.id === 'fields-' + slug;
    el.style.display = show ? 'flex' : 'none';
  });
  // Clear inputs of hidden panels
  document.querySelectorAll('.cat-fields:not([style*="flex"])').forEach(panel => {
    panel.querySelectorAll('input, select, textarea').forEach(i => { i.value = ''; });
  });
}

// ── Custom Reminders ────────────────────────────────────────
const customReminders = []; // { id, date, time, active } — form state
// { 'api-N': [{date,time,active}] } — persisted to localStorage so page refresh doesn't lose them
const taskReminders = (function() {
  try { return JSON.parse(localStorage.getItem('taskReminders') || '{}'); } catch(e) { return {}; }
})();
let _reminderId = 0;

function addCustomReminder() {
  const id = ++_reminderId;
  const today = new Date().toISOString().split('T')[0];
  customReminders.push({ id, date: today, time: '09:00', active: true });
  renderCustomReminders();
}

function applyPresetReminder(preset) {
  if (!preset) return;
  const dueDateVal = (state.role === 'employee'
    ? document.getElementById('tc-emp-due')?.value
    : document.getElementById('tc-due')?.value);
  if (!dueDateVal) { showToast('Please set a due date first', 'error'); return; }
  const due = new Date(dueDateVal);
  if (preset === '1d') due.setDate(due.getDate() - 1);
  else if (preset === '3d') due.setDate(due.getDate() - 3);
  else if (preset === '1w') due.setDate(due.getDate() - 7);
  const date = due.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  if (date < today) { showToast('Reminder date is in the past — pick a closer preset or set a later due date', 'error'); return; }
  const id = ++_reminderId;
  customReminders.push({ id, date, time: '09:00', active: true });
  renderCustomReminders();
  showToast('Reminder added', 'success');
}

function removeCustomReminder(id) {
  const idx = customReminders.findIndex(r => r.id === id);
  if (idx !== -1) customReminders.splice(idx, 1);
  renderCustomReminders();
}

function toggleCustomReminderActive(id) {
  const r = customReminders.find(r => r.id === id);
  if (r) { r.active = !r.active; renderCustomReminders(); }
}

function updateCustomReminder(id, field, value) {
  const r = customReminders.find(r => r.id === id);
  if (r) r[field] = value;
}

function renderCustomReminders() {
  const prefix  = state.role === 'employee' ? 'emp-' : '';
  const list         = document.getElementById(prefix + 'custom-reminders-list');
  const summary      = document.getElementById(prefix + 'active-reminders-summary');
  const summaryItems = document.getElementById(prefix + 'active-reminders-items');
  if (!list) return;

  // Always update summary first (even when list is empty)
  const activeOnes = customReminders.filter(function(rem) { return rem.active; });
  if (summary) summary.classList.toggle('hidden', activeOnes.length === 0);
  if (summaryItems) {
    summaryItems.innerHTML = activeOnes.map(function(rem) {
      const label = rem.date
        ? new Date(rem.date + 'T' + (rem.time || '00:00')).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : '(no date set)';
      return `<li style="font-size:0.8125rem;color:var(--clr-text-2)">${label}</li>`;
    }).join('');
  }

  // Render the list
  if (!customReminders.length) {
    list.innerHTML = `<p class="text-xs text-muted" style="padding:4px 0">No custom reminders added.</p>`;
    return;
  }

  list.innerHTML = customReminders.map(function(rem) {
    const isActive = rem.active === true;
    const bellColor = isActive ? 'var(--clr-primary)' : 'var(--clr-text-3)';
    const trackBg  = isActive ? 'var(--clr-primary)' : 'var(--clr-surface-3,#d1d5db)';
    const thumbX   = isActive ? '18px' : '2px';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--clr-surface-2);border:1px solid ${isActive ? 'var(--clr-primary)' : 'var(--clr-border)'};border-radius:var(--r-sm)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${bellColor}" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
      <input type="date" value="${rem.date}" onchange="updateCustomReminder(${rem.id},'date',this.value)"
        style="border:1px solid var(--clr-border);border-radius:var(--r-sm);padding:4px 8px;font-size:0.8125rem;background:var(--clr-surface);color:var(--clr-text);flex:1;min-width:0" />
      <input type="time" value="${rem.time}" onchange="updateCustomReminder(${rem.id},'time',this.value)"
        style="border:1px solid var(--clr-border);border-radius:var(--r-sm);padding:4px 8px;font-size:0.8125rem;background:var(--clr-surface);color:var(--clr-text);width:100px" />
      <div onclick="toggleCustomReminderActive(${rem.id})" title="${isActive ? 'Turn off' : 'Turn on'}"
        style="cursor:pointer;width:38px;height:22px;border-radius:11px;background:${trackBg};position:relative;flex-shrink:0;transition:background 0.2s">
        <div style="position:absolute;top:3px;left:${thumbX};width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left 0.2s"></div>
      </div>
      <button onclick="removeCustomReminder(${rem.id})" title="Remove"
        style="background:none;border:none;cursor:pointer;color:var(--clr-text-3);padding:2px;line-height:1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
  }).join('');
}

function toggleEmpDueDate(show, el) {
  el.closest('.pill-select').querySelectorAll('.pill-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  const inputGroup = document.getElementById('emp-duedate-input-group');
  if (inputGroup) inputGroup.classList.toggle('hidden', !show);
  if (!show) {
    const d = document.getElementById('tc-emp-due'); if (d) d.value = '';
    const dt = document.getElementById('tc-emp-due-time'); if (dt) dt.value = '';
    const r = document.getElementById('emp-reminder-select'); if (r) r.value = '3d';
  }
  // If due date selected → Step 2 button goes to reminder step; otherwise submits directly
  const btn = document.getElementById('step2-next-btn');
  if (btn) {
    if (show) {
      btn.textContent = 'Next: Set Reminder →';
      btn.onclick = () => goStep(3);
    } else {
      btn.textContent = 'Log Work';
      btn.onclick = submitTask;
    }
  }
}

// ── Attachments ────────────────────────────────────────────
const attachedFiles = [];

// Per-task file store (keyed by task ID, session-only)
const taskFiles = {};

function handleDetailFileAttach(taskId, input) {
  const MAX = 20 * 1024 * 1024;
  if (!taskFiles[taskId]) taskFiles[taskId] = [];
  Array.from(input.files).forEach(f => {
    if (f.size > MAX) { showToast(`"${f.name}" exceeds 20 MB limit`, 'error'); return; }
    if (taskFiles[taskId].find(x => x.name === f.name && x.size === f.size)) return;
    taskFiles[taskId].push(f);
  });
  input.value = '';
  refreshDetailFilesTab(taskId);
  // Switch to files tab so the user sees the result
  const tabBtn = document.querySelector('.tab-btn[onclick*="files"]');
  if (tabBtn) switchDetailTab('files', tabBtn);
}

function removeDetailFile(taskId, index) {
  if (taskFiles[taskId]) taskFiles[taskId].splice(index, 1);
  refreshDetailFilesTab(taskId);
}

function refreshDetailFilesTab(taskId) {
  const container = document.getElementById('dtab-files-content');
  if (!container) return;
  const files = taskFiles[taskId] || [];
  const countEl = document.querySelector('.tab-btn[onclick*="files"] .tab-count');
  if (countEl) countEl.textContent = files.length;

  if (!files.length) {
    container.innerHTML = `
      <div class="d-flex items-center justify-between mb-16">
        <span class="text-sm text-muted">0 files attached</span>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('dtab-file-input').click()">${icon('plus',13)} Upload File</button>
      </div>
      <div class="empty-state">${icon('file',40)}<h3>No files yet</h3><p>Attach files to this task using the button above or "Attach File" in the sidebar.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="d-flex items-center justify-between mb-16">
      <span class="text-sm text-muted">${files.length} file${files.length !== 1 ? 's' : ''} attached</span>
      <button class="btn btn-secondary btn-sm" onclick="document.getElementById('dtab-file-input').click()">${icon('plus',13)} Upload File</button>
    </div>
    <div class="d-flex flex-col gap-8">
      ${files.map((f, i) => {
        const size = f.size < 1024*1024 ? (f.size/1024).toFixed(0)+'KB' : (f.size/1024/1024).toFixed(1)+'MB';
        const isImage = f.type.startsWith('image/');
        const isVideo = f.type.startsWith('video/');
        const strokeIcon = isVideo
          ? '<path d="M15 10l4.553-2.277A1 1 0 0121 8.68v6.641a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>'
          : isImage
            ? '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'
            : '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>';
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--clr-surface-2);border:1px solid var(--clr-border);border-radius:var(--r-sm)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" stroke-width="2">${strokeIcon}</svg>
          <span class="text-sm truncate" style="flex:1">${f.name}</span>
          <span class="text-xs text-muted">${size}</span>
          <button onclick="removeDetailFile('${taskId}',${i})" style="background:none;border:none;cursor:pointer;color:var(--clr-text-3);padding:2px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`;
      }).join('')}
    </div>`;
}

function handleAttachmentDrop(event) {
  event.preventDefault();
  const dz = document.getElementById('attachment-dropzone');
  if (dz) { dz.style.borderColor = ''; dz.style.background = ''; }
  handleAttachmentSelect(event.dataTransfer.files);
}

function handleAttachmentSelect(files) {
  const MAX = 20 * 1024 * 1024;
  Array.from(files).forEach(f => {
    if (f.size > MAX) { showToast(`"${f.name}" exceeds 20 MB limit`, 'error'); return; }
    if (attachedFiles.find(x => x.name === f.name && x.size === f.size)) return;
    attachedFiles.push(f);
  });
  renderAttachmentList();
}

function removeAttachment(index) {
  attachedFiles.splice(index, 1);
  renderAttachmentList();
}

function renderAttachmentList() {
  const list = document.getElementById('attachment-list');
  if (!list) return;
  if (!attachedFiles.length) { list.innerHTML = ''; return; }
  list.innerHTML = attachedFiles.map((f, i) => {
    const isVideo = f.type.startsWith('video/');
    const isImage = f.type.startsWith('image/');
    const iconPath = isVideo
      ? '<path d="M15 10l4.553-2.277A1 1 0 0121 8.68v6.641a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>'
      : isImage
        ? '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'
        : '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>';
    const size = f.size < 1024*1024 ? (f.size/1024).toFixed(0)+'KB' : (f.size/1024/1024).toFixed(1)+'MB';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--clr-surface-2);border:1px solid var(--clr-border);border-radius:var(--r-sm)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" stroke-width="2">${iconPath}</svg>
      <span class="text-sm truncate" style="flex:1;max-width:240px">${f.name}</span>
      <span class="text-xs text-muted">${size}</span>
      <button onclick="removeAttachment(${i})" style="background:none;border:none;cursor:pointer;color:var(--clr-text-3);padding:2px;line-height:1" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
  }).join('');
}

function goStep(n) {
  state.createStep = n;
  [1,2,3].forEach(i => {
    const panel = document.getElementById(`create-panel-${i}`);
    const step = document.getElementById(`step-${i}`);
    if (panel) panel.classList.toggle('hidden', i !== n);
    if (step) {
      step.classList.toggle('active', i === n);
      step.classList.toggle('done', i < n);
    }
  });
  document.getElementById('topbar-sub').textContent = `Step ${n} of 3 — ${['Task details','Assignment','Notifications'][n-1]}`;
}

function selectPriority(p, el) {
  state.selectedPriority = p;
  el.closest('.pill-select').querySelectorAll('.pill-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

function selectMode(mode, el) {
  state.selectedMode = mode;
  el.closest('.pill-select').querySelectorAll('.pill-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  const hint = document.getElementById('mode-hint');
  const assigneeSection = document.getElementById('assignee-section');
  const assignmentNotifBlock = document.getElementById('assignment-notif-block');
  if (mode === 'floating') {
    if (hint) hint.textContent = 'Task is published to the pool — any employee can voluntarily pick it up';
    if (assigneeSection) assigneeSection.classList.add('hidden');
    if (assignmentNotifBlock) assignmentNotifBlock.style.display = '';
  } else if (mode === 'self') {
    if (hint) hint.textContent = 'Task is logged as your own work — you are the assignee';
    if (assigneeSection) assigneeSection.classList.add('hidden');
    if (assignmentNotifBlock) assignmentNotifBlock.style.display = 'none';
  } else {
    if (hint) hint.textContent = 'Task is directly assigned to one or more employees';
    if (assigneeSection) assigneeSection.classList.remove('hidden');
    if (assignmentNotifBlock) assignmentNotifBlock.style.display = '';
  }
}

function selectNotifTiming(t, el) {
  state.notifTiming = t;
  el.closest('.pill-select').querySelectorAll('.pill-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  const dt = document.getElementById('schedule-datetime');
  if (dt) dt.classList.toggle('hidden', t !== 'scheduled');
}

function filterEmployeeList(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('#employee-list label').forEach(label => {
    const name = label.querySelector('.font-semibold')?.textContent?.toLowerCase() || '';
    label.style.display = name.includes(q) ? '' : 'none';
  });
}

function updateSelectedCount() {
  const checked = document.querySelectorAll('#employee-list input[type=checkbox]:checked').length;
  const el = document.getElementById('selected-count');
  if (el) el.textContent = checked;
}

async function submitTask() {
  const title    = document.getElementById('tc-title')?.value?.trim();
  const desc     = document.getElementById('tc-desc')?.value?.trim();
  const dueDate  = state.role === 'employee'
    ? (document.getElementById('tc-emp-due')?.value || null)
    : (document.getElementById('tc-due')?.value || null);
  const dueTime  = state.role === 'employee'
    ? (document.getElementById('tc-emp-due-time')?.value || null)
    : (document.getElementById('tc-end-time')?.value || null);
  const workDate    = document.getElementById('tc-start')?.value || null;
  const startTime   = state.role !== 'employee' ? (document.getElementById('tc-start-time')?.value || null) : null;
  const priority = capitalize(state.selectedPriority || 'medium');

  // Category slug comes directly from the select value
  const catSelect    = document.getElementById('tc-category');
  const taskCategory = catSelect?.value || '';

  const hoursRaw  = parseFloat(document.getElementById('tc-hours')?.value) || null;
  const timeUnit  = document.getElementById('tc-time-unit')?.value || 'h';
  const estimatedTime = hoursRaw != null ? (timeUnit === 'd' ? hoursRaw * 8 : hoursRaw) : null;

  if (!title || !title.trim()) { showToast('Please enter a task title', 'error'); return; }
  if (!catSelect?.value) { showToast('Please select a category', 'error'); return; }
  if (hoursRaw !== null && hoursRaw < 0) { showToast('Estimated time cannot be negative', 'error'); return; }

  // Employee-specific: if due date toggled Yes, date must be filled
  if (state.role === 'employee' && dueDate) {
    const today = new Date(); today.setHours(0,0,0,0);
    const picked = new Date(dueDate);
    if (isNaN(picked)) { showToast('Please enter a valid due date', 'error'); return; }
  }

  // Collect category-specific module fields
  const moduleFields = collectModuleFields(taskCategory);

  if (state.role === 'employee') {
    try {
      const result = await employeeApi.createTask({
        title,
        description:   desc        || null,
        priority,
        dueDate:       dueDate     || null,
        dueTime:       dueTime     || null,
        taskCategory,
        estimatedTime,
        estimatedTimeUnit: 'h',
        actualDate:    workDate    || null,
        ...moduleFields,
      });
      // Save reminders keyed by the real task ID returned from the API
      if (customReminders.length && result && result.task) {
        const key = 'api-' + result.task.taskid;
        taskReminders[key] = customReminders.map(function(r) {
          return { date: r.date, time: r.time, active: r.active };
        });
        try {
          localStorage.setItem('taskReminders', JSON.stringify(taskReminders));
          console.log('[submitTask] saved reminders under key:', key, taskReminders[key]);
        } catch(e) { console.error('localStorage save failed:', e); }
      }
      showToast(`"${title}" logged successfully`, 'success');
      apiCache.tasks = [];
      navigate('tasks');
    } catch (err) {
      showToast(`Failed to save: ${err.message}`, 'error');
    }
  } else {
    // Supervisor / HOD — save to API
    try {
      const selectedMode = document.querySelector('#tc-mode-select .pill-option.selected')?.dataset?.mode;
      const publishMode = selectedMode === 'floating' ? 'Floating' : selectedMode === 'self' ? 'Self' : 'Direct';
      let assigneeIds;
      if (selectedMode === 'self') {
        assigneeIds = [state.userId];
      } else {
        const checkedBoxes = document.querySelectorAll('#employee-list input[type=checkbox]:checked');
        assigneeIds = Array.from(checkedBoxes)
          .map(cb => parseInt(cb.closest('label')?.dataset?.userid))
          .filter(id => !isNaN(id));
      }

      // Build scheduled notification datetime if 'Schedule for Later' was chosen
      const notifTiming = state.notifTiming || 'now';
      let notifScheduledAt = null;
      if (notifTiming === 'scheduled' && selectedMode !== 'self') {
        const schedDate = document.getElementById('notif-sched-date')?.value;
        const schedTime = document.getElementById('notif-sched-time')?.value || '09:00';
        if (!schedDate) { showToast('Please set a date for the scheduled notification', 'error'); return; }
        notifScheduledAt = new Date(`${schedDate}T${schedTime}`).toISOString();
        if (isNaN(new Date(notifScheduledAt))) { showToast('Invalid notification schedule date/time', 'error'); return; }
        if (new Date(notifScheduledAt) <= new Date()) { showToast('Scheduled notification must be in the future', 'error'); return; }
      }

      await apiFetch('/supervisor/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description:      desc          || null,
          priority,
          dueDate:          dueDate       || null,
          startDate:        workDate      || null,
          startTime:        startTime     || null,
          endTime:          dueTime       || null,
          taskCategory,
          estimatedTime,
          estimatedTimeUnit: 'h',
          publishMode,
          assignees:        assigneeIds,
          deadlineReminder: document.getElementById('sv-deadline-reminder')?.value || null,
          notifScheduledAt,
          ...moduleFields,
        }),
      });
      showToast(notifScheduledAt ? `Task "${title}" published — notification scheduled` : `Task "${title}" published successfully`, 'success');
      navigate('tasks');
    } catch (err) {
      showToast(`Failed to publish: ${err.message}`, 'error');
    }
  }
}

// ── Calendar ───────────────────────────────────────────────
function renderCalendar() {
  const d = state.calendarMonth;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-month-label').textContent = `${months[d.getMonth()]} ${d.getFullYear()}`;

  const firstDay    = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const today       = new Date();

  const allTasks = (state.role === 'employee' && apiCache.tasks && apiCache.tasks.length)
    ? apiCache.tasks : TASKS;

  const statusClass = {
    inprogress:'cal-bar-inprogress', pending:'cal-bar-upcoming', floating:'cal-bar-upcoming',
    completed:'cal-bar-completed', overdue:'cal-bar-overdue', review:'cal-bar-review',
    unabletocomplete:'cal-bar-overdue'
  };

  function tasksOnDay(day) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return allTasks.filter(t => t.dueDate === dateStr);
  }
  function todosOnDay(day) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return _todoCache.filter(t => !t.done && t.duedate && t.duedate.slice(0,10) === dateStr);
  }

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = `<div class="cal-grid">`;
  html += days.map(function(name) { return `<div class="cal-day-header">${name}</div>`; }).join('');

  const MAX_VISIBLE = 3;
  let dayCount = 1;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 7; j++) {
      const cellNum  = i * 7 + j;
      const isWeekend = j === 0 || j === 6;
      if (cellNum < firstDay || dayCount > daysInMonth) {
        html += `<div class="cal-cell other-month${isWeekend?' weekend':''}"></div>`;
      } else {
        const isToday = dayCount === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        const tasks   = tasksOnDay(dayCount);
        const todos   = todosOnDay(dayCount);
        const allItems = tasks.length + todos.length;
        const visible = tasks.slice(0, MAX_VISIBLE);
        const extra   = allItems - visible.length - todos.slice(0, Math.max(0, MAX_VISIBLE - visible.length)).length;
        const visibleTodos = todos.slice(0, Math.max(0, MAX_VISIBLE - visible.length));
        const barsHtml = visible.map(function(t) {
          const cls = statusClass[t.status] || 'cal-bar-upcoming';
          return `<div class="${cls} cal-task-bar" onclick="openTaskDetail('${t.id}');event.stopPropagation()" title="${t.title}">${t.title}</div>`;
        }).join('') + visibleTodos.map(function(td) {
          return `<div class="cal-task-bar cal-bar-todo" onclick="navigate('todo');event.stopPropagation()" title="To-do: ${td.title}">✦ ${td.title}</div>`;
        }).join('');
        const moreHtml = extra > 0 ? `<div class="cal-more">+${extra} more</div>` : '';
        html += `<div class="cal-cell${isToday?' today':''}${isWeekend?' weekend':''}">
          <div class="cal-date">${dayCount}</div>${barsHtml}${moreHtml}
        </div>`;
        dayCount++;
      }
    }
    if (dayCount > daysInMonth) break;
  }
  html += '</div>';
  document.getElementById('cal-grid').innerHTML = html;

  // Sidebar summary
  const monthStr  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const monthTasks = allTasks.filter(t => t.dueDate && t.dueDate.startsWith(monthStr));
  const counts = { inprogress:0, pending:0, completed:0, overdue:0, review:0 };
  monthTasks.forEach(function(t) { if (counts[t.status] !== undefined) counts[t.status]++; });

  const summaryRows = [
    { label:'In Progress', key:'inprogress', color:'var(--c-blue-500)'   },
    { label:'Pending',     key:'pending',    color:'var(--c-amber-500)'  },
    { label:'Completed',   key:'completed',  color:'var(--c-green-500)'  },
    { label:'Overdue',     key:'overdue',    color:'var(--c-red-500)'    },
    { label:'Under Review',key:'review',     color:'var(--c-violet-600)' },
  ];
  const todoCount = _todoCache.filter(t => !t.done && t.duedate && t.duedate.slice(0,7) === monthStr).length;
  document.getElementById('cal-summary').innerHTML = summaryRows.map(function(r) {
    return `<div class="cal-summary-row">
      <span style="display:flex;align-items:center;gap:6px;font-size:0.8125rem;color:var(--clr-text-2)">
        <span style="width:8px;height:8px;border-radius:50%;background:${r.color};flex-shrink:0"></span>${r.label}
      </span>
      <span class="cal-summary-count" style="color:${counts[r.key]>0?r.color:'var(--clr-text-3)'}">${counts[r.key]}</span>
    </div>`;
  }).join('') + `<div class="cal-summary-row">
    <span style="display:flex;align-items:center;gap:6px;font-size:0.8125rem;color:var(--clr-text-2)">
      <span style="width:8px;height:8px;border-radius:50%;border:1.5px dashed #a78bfa;flex-shrink:0"></span>To-do
    </span>
    <span class="cal-summary-count" style="color:${todoCount>0?'#7c3aed':'var(--clr-text-3)'}">${todoCount}</span>
  </div>`;

  // Sidebar upcoming
  const todayStr = today.toISOString().split('T')[0];
  const upcoming = allTasks
    .filter(t => t.dueDate && t.dueDate >= todayStr && t.status !== 'completed')
    .sort((a,b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  const dotColors = { 'cal-bar-inprogress':'var(--c-blue-500)','cal-bar-upcoming':'var(--c-cyan-500)',
    'cal-bar-overdue':'var(--c-red-500)','cal-bar-review':'var(--c-amber-500)' };

  document.getElementById('cal-upcoming').innerHTML = upcoming.length
    ? upcoming.map(function(t) {
        const cls = statusClass[t.status] || 'cal-bar-upcoming';
        const dot = dotColors[cls] || 'var(--clr-text-3)';
        return `<div class="cal-upcoming-item" onclick="openTaskDetail('${t.id}')">
          <div class="cal-upcoming-title" style="display:flex;align-items:center;gap:5px">
            <span style="width:6px;height:6px;border-radius:50%;background:${dot};flex-shrink:0"></span>${t.title}
          </div>
          <div class="cal-upcoming-date">Due ${fmtDate(t.dueDate)}</div>
        </div>`;
      }).join('')
    : `<p class="text-xs text-muted">No upcoming tasks</p>`;
}

async function markSelfTaskComplete(taskId) {
  const apiId = String(taskId).replace('api-', '');
  try {
    await apiFetch(`/employee/tasks/${apiId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ status: 'Completed', remarks: 'Self-logged task completed' }),
    });
    showToast('Task marked as complete', 'success');
    if (state.currentTask) state.currentTask.status = 'completed';
    renderTaskDetail();
  } catch (err) {
    showToast(err.message || 'Could not complete task', 'error');
  }
}

// ── Task Detail Reminders ──────────────────────────────────
async function submitWorkForReview() {
  const remarks   = document.getElementById('submit-remarks')?.value?.trim();
  const startTime = document.getElementById('submit-start-time')?.value || null;
  const endTime   = document.getElementById('submit-end-time')?.value || null;
  const unit      = document.getElementById('submit-time-unit')?.value || 'h';
  let hoursVal    = parseFloat(document.getElementById('submit-hours')?.value);

  // Auto-calculate hours from start/end time if both provided
  if (startTime && endTime) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let diffMin = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMin < 0) diffMin += 24 * 60; // overnight
    hoursVal = Math.round((diffMin / 60) * 10) / 10;
    document.getElementById('submit-hours').value = hoursVal;
  }

  if (!remarks) { showToast('Please enter completion remarks', 'error'); return; }
  if (isNaN(hoursVal) || hoursVal <= 0) { showToast('Please enter or set the actual time taken', 'error'); return; }

  const actualHours = unit === 'd' ? hoursVal * 8 : hoursVal;
  const task = state.currentTask;

  if (task?._apiId) {
    try {
      await apiFetch(`/employee/tasks/${task._apiId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'Completed',
          remarks,
          actualCompletionTime: actualHours,
          startTime:       startTime || undefined,
          endTime:         endTime   || undefined,
          completionDate:  document.getElementById('submit-completion-date')?.value || undefined,
        }),
      });
      // Fetch updated submissions list
      const data = await apiFetch(`/employee/tasks/${task._apiId}/submissions`);
      task.submissions = (data.submissions || []).map((s, i, arr) => ({
        round:            arr.length - i,
        status:           s.approvaldecision === 'Approved' ? 'approved' : s.approvaldecision === 'Rejected' ? 'rejected' : 'review',
        submittedBy:      state.userName || 'Employee',
        submittedAt:      s.submittedat ? new Date(s.submittedat).toLocaleString() : '',
        actualHours:      s.actualcompletiontime || actualHours,
        remarks:          s.remarks || remarks,
        supervisorFeedback: s.approvalreason || null,
      }));
      task.status = 'review'; // awaiting supervisor review (backend sets task status to Submitted)
      // Invalidate task cache so task list refreshes next visit
      apiCache.tasks = [];
      closeModal('modal-submit');
      showToast('Work submitted for review', 'success');
      renderTaskDetail();
    } catch (err) {
      showToast(err.message || 'Submit failed', 'error');
    }
  } else {
    // Mock / offline fallback
    if (!task.submissions) task.submissions = [];
    task.submissions.unshift({
      round: task.submissions.length + 1,
      status: 'review',
      submittedBy: state.userName || 'Employee',
      submittedAt: new Date().toLocaleString(),
      actualHours,
      remarks,
      supervisorFeedback: null,
    });
    closeModal('modal-submit');
    showToast('Work submitted for review', 'success');
    renderTaskDetail();
  }
}

function toggleDetailReminderForm(taskId) {
  const form = document.getElementById('detail-reminder-form');
  if (!form) return;
  const isHidden = form.classList.contains('hidden');
  form.classList.toggle('hidden', !isHidden);
  form.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) {
    // Default date to tomorrow
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const dr = document.getElementById('dr-date');
    if (dr) dr.value = tomorrow.toISOString().split('T')[0];
  }
}

function addDetailReminder(taskId) {
  const dateEl = document.getElementById('dr-date');
  const timeEl = document.getElementById('dr-time');
  if (!dateEl || !dateEl.value) { showToast('Please pick a date', 'error'); return; }
  const reminder = { date: dateEl.value, time: timeEl?.value || '09:00', active: true };
  if (!taskReminders[taskId]) taskReminders[taskId] = [];
  taskReminders[taskId].push(reminder);
  try { localStorage.setItem('taskReminders', JSON.stringify(taskReminders)); } catch(e) {}

  // Hide the form
  const form = document.getElementById('detail-reminder-form');
  if (form) { form.classList.add('hidden'); form.style.display = 'none'; }

  // Refresh the reminders block in place
  refreshDetailReminders(taskId);
  showToast('Reminder added', 'success');
}

function refreshDetailReminders(taskId) {
  const rems = taskReminders[taskId];
  const activeCount = rems ? rems.filter(function(r) { return r.active; }).length : 0;
  const rows = rems && rems.length ? rems.map(function(r) {
    const label = r.date ? new Date(r.date + 'T' + (r.time || '00:00')).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    const bellColor = r.active ? 'var(--clr-primary)' : 'var(--clr-text-3)';
    const badge = r.active
      ? '<span style="font-size:0.65rem;font-weight:600;color:var(--clr-primary);background:var(--clr-primary-surface);padding:2px 6px;border-radius:99px">Active</span>'
      : '<span style="font-size:0.65rem;color:var(--clr-text-3)">Off</span>';
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--clr-border)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${bellColor}" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
      <span style="flex:1;font-size:0.75rem;color:${r.active?'var(--clr-text)':'var(--clr-text-3)'}">${label}</span>
      ${badge}
    </div>`;
  }).join('') : '';

  const block = document.getElementById('detail-reminders-block');
  if (!block) return;
  block.innerHTML = rems && rems.length
    ? `<div class="divider"></div>
       <div class="section-title text-xs mb-10">REMINDERS <span style="font-weight:400;color:var(--clr-text-3)">(${activeCount} active)</span></div>
       <div style="display:flex;flex-direction:column">${rows}</div>`
    : '';
}

function changeMonth(dir) {
  state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + dir, 1);
  renderCalendar();
}

function goToday() {
  state.calendarMonth = new Date();
  renderCalendar();
}

// ── KPI Page ───────────────────────────────────────────────
let _kpiProgressAssignmentId = null;
let _kpiProgressUnit = '';

async function renderKpiPage() {
  const el = document.getElementById('kpi-page-content');
  if (!el) return;
  el.innerHTML = `
    <style>
      @keyframes kpi-stripe { to { background-position: 56px 0; } }
      @keyframes kpi-bob    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      @keyframes kpi-blink  { 0%,100%{opacity:1} 50%{opacity:.45} }
      .kpi-uc-card {
        max-width: 520px;
        margin: 64px auto;
        background: var(--clr-surface);
        border: 1px solid var(--clr-border-md);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,.10);
      }
      .kpi-uc-stripe {
        height: 52px;
        background-image: repeating-linear-gradient(
          -45deg,
          #f59e0b 0px,
          #f59e0b 20px,
          #1a1200 20px,
          #1a1200 40px
        );
        background-size: 56px 56px;
        animation: kpi-stripe 1s linear infinite;
        border-bottom: 3px solid #d97706;
      }
      .kpi-uc-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px 40px 44px;
        text-align: center;
      }
      .kpi-uc-icon {
        width: 72px; height: 72px;
        border-radius: 50%;
        background: var(--c-amber-50, #fffbeb);
        border: 2px solid var(--c-amber-100, #fef3c7);
        display: flex; align-items: center; justify-content: center;
        color: var(--c-amber-600);
        margin-bottom: 24px;
        animation: kpi-bob 2.8s ease-in-out infinite;
      }
      .kpi-uc-label {
        font-size: .7rem;
        font-weight: 700;
        letter-spacing: .12em;
        text-transform: uppercase;
        color: var(--c-amber-600);
        margin-bottom: 10px;
        display: flex; align-items: center; gap: 6px;
      }
      .kpi-uc-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: var(--c-amber-500);
        animation: kpi-blink 1.2s ease-in-out infinite;
      }
      .kpi-uc-title {
        font-family: var(--font-display);
        font-size: 1.45rem;
        font-weight: 800;
        color: var(--clr-text);
        margin: 0 0 10px;
        line-height: 1.25;
        text-wrap: balance;
      }
      .kpi-uc-sub {
        font-size: .875rem;
        color: var(--clr-text-2);
        line-height: 1.6;
        max-width: 320px;
        margin: 0;
      }
    </style>
    <div class="kpi-uc-card">
      <div class="kpi-uc-stripe"></div>
      <div class="kpi-uc-body">
        <h2 class="kpi-uc-title">KPI Management is on its way</h2>
        <p class="kpi-uc-sub">
          We're building goal-setting, progress tracking, and team performance tools — check back soon.
        </p>
      </div>
    </div>`;
  return;

  try {
    const isSupervisor = state.role === 'supervisor' || state.role === 'hod';
    const endpoint = isSupervisor ? '/supervisor/kpis' : '/employee/kpis';
    const data = await apiFetch(endpoint);
    const kpis = data.kpis || [];

    if (isSupervisor) {
      renderSupervisorKpiPage(el, kpis);
    } else {
      renderEmployeeKpiPage(el, kpis);
    }
  } catch (err) {
    el.innerHTML = `<div class="card"><p class="text-sm" style="color:var(--c-red-500)">Failed to load KPIs: ${err.message}</p></div>`;
  }
}

function kpiProgressBar(current, target, unit) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const color = pct >= 100 ? 'var(--c-green-500)' : pct >= 60 ? 'var(--c-blue-500)' : pct >= 30 ? 'var(--c-amber-500)' : 'var(--c-red-500)';
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
      <div style="flex:1;background:var(--clr-surface-2);border-radius:99px;height:8px;overflow:hidden">
        <div style="width:${pct}%;background:${color};height:100%;border-radius:99px;transition:width .4s ease"></div>
      </div>
      <span style="font-size:0.75rem;font-weight:700;color:${color};min-width:38px;text-align:right">${pct}%</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:4px">
      <span style="font-size:0.72rem;color:var(--clr-text-3)">Current: <strong>${current} ${unit}</strong></span>
      <span style="font-size:0.72rem;color:var(--clr-text-3)">Target: <strong>${target} ${unit}</strong></span>
    </div>`;
}

function renderSupervisorKpiPage(el, kpis) {
  const teamMembers = (apiCache.dashboard?.team || []).map(m => ({ id: m.userid, name: m.name }));

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div>
        <div style="font-size:0.85rem;color:var(--clr-text-2)">${kpis.length} KPI${kpis.length !== 1 ? 's' : ''} active</div>
      </div>
      <button class="btn btn-primary" onclick="openKpiCreateModal()">+ Create KPI</button>
    </div>

    ${kpis.length === 0 ? `
      <div class="card" style="text-align:center;padding:48px 24px">
        ${icon('kpi', 40)}
        <h3 style="margin:16px 0 8px;color:var(--clr-text)">No KPIs yet</h3>
        <p class="text-muted text-sm">Create your first KPI to start tracking your team's performance.</p>
        <button class="btn btn-primary mt-16" onclick="openKpiCreateModal()">Create KPI</button>
      </div>` : `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">
        ${kpis.map(k => {
          const assignments = k.assignments || [];
          const totalCurrent = assignments.reduce((s, a) => s + parseFloat(a.currentvalue || 0), 0);
          const totalTarget  = assignments.reduce((s, a) => s + parseFloat(a.targetvalue || 0), 0);
          const overallPct   = totalTarget > 0 ? Math.min(100, Math.round((totalCurrent / totalTarget) * 100)) : 0;
          const overallColor = overallPct >= 100 ? 'var(--c-green-500)' : overallPct >= 60 ? 'var(--c-blue-500)' : overallPct >= 30 ? 'var(--c-amber-500)' : 'var(--c-red-500)';
          return `
          <div class="card" style="position:relative">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:0.95rem;margin-bottom:2px;color:var(--clr-text)">${k.title}</div>
                <div style="font-size:0.75rem;color:var(--clr-text-3)">${k.metric ? k.metric + ' · ' : ''}${k.period} · ${k.unit}</div>
              </div>
              <button onclick="deleteKpi(${k.kpiid})" title="Delete KPI" style="background:none;border:none;cursor:pointer;color:var(--clr-text-3);padding:2px 4px;font-size:1rem;line-height:1">×</button>
            </div>
            ${k.description ? `<p style="font-size:0.8rem;color:var(--clr-text-2);margin-bottom:12px">${k.description}</p>` : ''}
            <div style="font-size:0.78rem;font-weight:600;color:var(--clr-text-2);margin-bottom:6px">OVERALL TEAM PROGRESS</div>
            <div style="display:flex;align-items:center;gap:10px">
              <div style="flex:1;background:var(--clr-surface-2);border-radius:99px;height:10px;overflow:hidden">
                <div style="width:${overallPct}%;background:${overallColor};height:100%;border-radius:99px;transition:width .4s ease"></div>
              </div>
              <span style="font-size:0.8rem;font-weight:700;color:${overallColor};min-width:38px;text-align:right">${overallPct}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;margin-bottom:14px">
              <span style="font-size:0.72rem;color:var(--clr-text-3)">Total: <strong>${totalCurrent} / ${totalTarget} ${k.unit}</strong></span>
              <span style="font-size:0.72rem;color:var(--clr-text-3)">${assignments.length} employee${assignments.length !== 1 ? 's' : ''}</span>
            </div>
            ${assignments.length ? `
            <div style="border-top:1px solid var(--clr-border);padding-top:12px;display:flex;flex-direction:column;gap:10px">
              ${assignments.map(a => {
                const pct = a.targetvalue > 0 ? Math.min(100, Math.round((a.currentvalue / a.targetvalue) * 100)) : 0;
                const clr = pct >= 100 ? 'var(--c-green-500)' : pct >= 60 ? 'var(--c-blue-500)' : pct >= 30 ? 'var(--c-amber-500)' : 'var(--c-red-500)';
                return `
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <div style="display:flex;align-items:center;gap:6px">
                      ${avatar((a.employeename||'?').split(' ').map(x=>x[0]).join('').slice(0,2), 'var(--c-blue-500)', 'xs')}
                      <span style="font-size:0.8rem;font-weight:600;color:var(--clr-text)">${a.employeename}</span>
                    </div>
                    <span style="font-size:0.72rem;font-weight:700;color:${clr}">${pct}%</span>
                  </div>
                  <div style="background:var(--clr-surface-2);border-radius:99px;height:6px;overflow:hidden">
                    <div style="width:${pct}%;background:${clr};height:100%;border-radius:99px;transition:width .4s ease"></div>
                  </div>
                  <div style="display:flex;justify-content:space-between;margin-top:3px">
                    <span style="font-size:0.7rem;color:var(--clr-text-3)">${a.currentvalue} / ${a.targetvalue} ${k.unit}</span>
                    ${a.enddate ? `<span style="font-size:0.7rem;color:var(--clr-text-3)">Due ${fmtDate(a.enddate)}</span>` : ''}
                  </div>
                </div>`;
              }).join('')}
            </div>` : `<p class="text-xs text-muted">No employees assigned yet.</p>`}
          </div>`;
        }).join('')}
      </div>`}`;
}

function renderEmployeeKpiPage(el, kpis) {
  el.innerHTML = `
    <div style="margin-bottom:20px">
      <div style="font-size:0.85rem;color:var(--clr-text-2)">${kpis.length} KPI${kpis.length !== 1 ? 's' : ''} assigned to you</div>
    </div>

    ${kpis.length === 0 ? `
      <div class="card" style="text-align:center;padding:48px 24px">
        ${icon('kpi', 40)}
        <h3 style="margin:16px 0 8px;color:var(--clr-text)">No KPIs assigned</h3>
        <p class="text-muted text-sm">Your supervisor hasn't assigned any KPIs yet.</p>
      </div>` : `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
        ${kpis.map(k => {
          const pct = parseFloat(k.progress_pct || 0);
          const clr = pct >= 100 ? 'var(--c-green-500)' : pct >= 60 ? 'var(--c-blue-500)' : pct >= 30 ? 'var(--c-amber-500)' : 'var(--c-red-500)';
          const current = parseFloat(k.currentvalue || 0);
          const target  = parseFloat(k.targetvalue || 0);
          return `
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:0.95rem;color:var(--clr-text);margin-bottom:2px">${k.title}</div>
                <div style="font-size:0.75rem;color:var(--clr-text-3)">${k.metric ? k.metric + ' · ' : ''}${k.period} · ${k.unit}</div>
              </div>
              <span class="badge" style="background:${pct>=100?'var(--c-green-100)':'var(--clr-surface-2)'};color:${clr};font-weight:700">${pct}%</span>
            </div>
            ${k.description ? `<p style="font-size:0.8rem;color:var(--clr-text-2);margin-bottom:10px">${k.description}</p>` : ''}
            ${kpiProgressBar(current, target, k.unit)}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--clr-border)">
              <div style="font-size:0.75rem;color:var(--clr-text-3)">
                ${k.supervisorname ? `Supervisor: <strong>${k.supervisorname}</strong>` : ''}
                ${k.enddate ? ` · Due ${fmtDate(k.enddate)}` : ''}
              </div>
              <button class="btn btn-primary btn-sm" onclick="openKpiProgressModal(${k.assignmentid},'${(k.title||'').replace(/'/g,"\\'")}',${current},${target},'${k.unit}')">Log Progress</button>
            </div>
          </div>`;
        }).join('')}
      </div>`}`;
}

function openKpiCreateModal() {
  document.getElementById('kpi-title').value = '';
  document.getElementById('kpi-description').value = '';
  document.getElementById('kpi-metric').value = '';
  document.getElementById('kpi-target').value = '';
  document.getElementById('kpi-unit').value = 'count';
  document.getElementById('kpi-period').value = 'monthly';
  document.getElementById('kpi-start').value = '';
  document.getElementById('kpi-end').value = '';

  const team = apiCache.dashboard?.team || [];
  const listEl = document.getElementById('kpi-assignee-list');
  if (!team.length) {
    listEl.innerHTML = `<p class="text-xs text-muted">No direct reports found. Load the dashboard first.</p>`;
  } else {
    listEl.innerHTML = team.map(m => `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:var(--r-sm);cursor:pointer;background:var(--clr-surface-2)">
        <input type="checkbox" value="${m.userid}" style="accent-color:var(--clr-primary);width:14px;height:14px" />
        ${avatar((m.name||'?').split(' ').map(x=>x[0]).join('').slice(0,2), 'var(--c-blue-500)', 'xs')}
        <span style="font-size:0.85rem;font-weight:500">${m.name}</span>
      </label>`).join('');
  }
  openModal('modal-kpi-create');
}

async function submitCreateKpi() {
  const title = document.getElementById('kpi-title').value.trim();
  const target = parseFloat(document.getElementById('kpi-target').value);
  const assignees = [...document.querySelectorAll('#kpi-assignee-list input[type=checkbox]:checked')].map(c => parseInt(c.value));

  if (!title) { showToast('KPI title is required', 'error'); return; }
  if (!target || isNaN(target)) { showToast('Target value is required', 'error'); return; }
  if (!assignees.length) { showToast('Select at least one employee', 'error'); return; }

  const payload = {
    title,
    description: document.getElementById('kpi-description').value.trim() || undefined,
    metric:      document.getElementById('kpi-metric').value.trim() || undefined,
    unit:        document.getElementById('kpi-unit').value,
    period:      document.getElementById('kpi-period').value,
    targetvalue: target,
    startdate:   document.getElementById('kpi-start').value || undefined,
    enddate:     document.getElementById('kpi-end').value || undefined,
    assignees,
  };

  try {
    await apiFetch('/supervisor/kpis', { method: 'POST', body: JSON.stringify(payload) });
    closeModal('modal-kpi-create');
    showToast('KPI created and assigned', 'success');
    renderKpiPage();
  } catch (err) {
    showToast('Failed to create KPI: ' + err.message, 'error');
  }
}

async function deleteKpi(kpiId) {
  if (!confirm('Delete this KPI? This cannot be undone.')) return;
  try {
    await apiFetch(`/supervisor/kpis/${kpiId}`, { method: 'DELETE' });
    showToast('KPI deleted', 'success');
    renderKpiPage();
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'error');
  }
}

function openKpiProgressModal(assignmentId, title, current, target, unit) {
  _kpiProgressAssignmentId = assignmentId;
  _kpiProgressUnit = unit;
  document.getElementById('kpi-progress-kpi-title').textContent = title;
  document.getElementById('kpi-progress-meta').textContent = `Current: ${current} ${unit} · Target: ${target} ${unit}`;
  document.getElementById('kpi-progress-value').value = '';
  document.getElementById('kpi-progress-notes').value = '';
  openModal('modal-kpi-progress');
}

async function submitKpiProgress() {
  const value = parseFloat(document.getElementById('kpi-progress-value').value);
  if (!value || isNaN(value)) { showToast('Enter a valid value', 'error'); return; }

  const notes = document.getElementById('kpi-progress-notes').value.trim();
  try {
    await apiFetch(`/employee/kpis/${_kpiProgressAssignmentId}/progress`, {
      method: 'POST',
      body: JSON.stringify({ value, notes: notes || undefined }),
    });
    closeModal('modal-kpi-progress');
    showToast('Progress logged!', 'success');
    renderKpiPage();
  } catch (err) {
    showToast('Failed to log progress: ' + err.message, 'error');
  }
}

// ── Notifications ──────────────────────────────────────────
function renderNotifications(filter = 'all') {
  const el = document.getElementById('notif-list');
  if (!el) return;

  let notifs = apiCache.notifications;

  if (filter === 'unread') notifs = notifs.filter(n => n.unread);
  else if (filter === 'task') notifs = notifs.filter(n => n.type === 'task' || n.icon === 'task-assigned');
  else if (filter === 'reminder') notifs = notifs.filter(n => n.type === 'reminder' || n.icon === 'reminder');

  const icons = {
    'task-assigned': icon('tasks',16), 'reminder': icon('clock',16),
    'submitted': icon('submit',16), 'approved': icon('check',16),
    'floating': icon('star',16), 'rejected': icon('x',16),
  };
  el.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.unread?'unread':''}" onclick="markNotifRead(${n._apiId||n.id||0}, this)">
      <div class="notif-icon" style="background:${n.bg||'#eff6ff'};color:${n.color||'#2563eb'}">${icons[n.icon]||icon('bell',16)}</div>
      <div class="notif-body"><strong>${n.title}</strong><p>${n.body}</p></div>
      <div class="notif-time">${n.time}</div>
    </div>`).join('') || `<div class="empty-state">${icon('bell',40)}<h3>All caught up</h3><p>No notifications to show.</p></div>`;
}

function filterNotifs(f, btn) {
  document.querySelectorAll('.page#page-notifications .btn').forEach(b => { b.style.background=''; b.style.color=''; b.className=b.className.replace('btn-primary','btn-secondary'); });
  btn.style.background = 'var(--clr-primary)';
  btn.style.color = '#fff';
  renderNotifications(f);
}

function updateNotifBadge(count) {
  // Topbar badge
  const badge = document.getElementById('notif-topbar-badge');
  if (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
  // Sidebar badge — update the sb-badge inside the notifications sb-item
  document.querySelectorAll('.sb-item').forEach(el => {
    if (el.dataset.page === 'notifications') {
      let sb = el.querySelector('.sb-badge');
      if (count > 0) {
        if (!sb) { sb = document.createElement('span'); sb.className = 'sb-badge'; el.appendChild(sb); }
        sb.textContent = count > 99 ? '99+' : count;
      } else {
        if (sb) sb.remove();
      }
    }
  });
}

async function refreshNotifCount() {
  try {
    const data = await apiFetch('/notifications');
    apiCache.notifications = data.notifications.map(normalizeNotification);
    const unread = apiCache.notifications.filter(n => n.unread).length;
    updateNotifBadge(unread);
  } catch {}
}

async function markNotifRead(apiId, rowEl) {
  if (rowEl) rowEl.classList.remove('unread');
  if (apiId) {
    try { await apiFetch(`/notifications/${apiId}/read`, { method: 'PATCH' }); } catch {}
    const n = apiCache.notifications.find(n => n._apiId === apiId);
    if (n) n.unread = false;
  }
  const unread = apiCache.notifications.filter(n => n.unread).length;
  updateNotifBadge(unread);
}

async function markAllRead() {
  try { await apiFetch('/notifications/read-all', { method: 'PATCH' }); } catch {}
  apiCache.notifications.forEach(n => n.unread = false);
  updateNotifBadge(0);
  renderNotifications();
  showToast('All notifications marked as read', 'success');
}

// ── Org Hierarchy (data-driven collapsible list) ───────────
async function renderOrgChart() {
  const el = document.getElementById('org-chart-container');
  if (!el) return;

  el.innerHTML = `<div style="padding:40px;color:var(--clr-text-3);display:flex;align-items:center;gap:10px">${icon('loader',16)} Loading team…</div>`;

  let users = [];
  try {
    const data = await apiFetch('/admin/users');
    users = data.users;
  } catch (err) {
    el.innerHTML = `<div class="card" style="padding:24px;color:var(--c-red-600)">Failed to load users: ${err.message}</div>`;
    return;
  }

  function initials(name) {
    const parts = (name || '').trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : (name||'?').substring(0,2).toUpperCase();
  }
  function avatarColor(name) {
    const palette = ['#2563eb','#7c3aed','#059669','#d97706','#0891b2','#dc2626','#ea580c','#0f766e'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffffff;
    return palette[h % palette.length];
  }
  function roleChip(role) {
    const map = {
      HOD:        { bg:'var(--c-blue-50)',   color:'#1d4ed8', label:'HOD' },
      Supervisor: { bg:'var(--c-violet-50)', color:'#6d28d9', label:'Supervisor' },
      Employee:   { bg:'var(--c-green-50)',  color:'#047857', label:'Employee' },
    };
    const s = map[role] || { bg:'var(--c-slate-50)', color:'#475569', label: role };
    return `<span style="font-size:0.68rem;font-weight:600;padding:3px 9px;border-radius:999px;background:${s.bg};color:${s.color};letter-spacing:.02em">${s.label}</span>`;
  }

  const hods       = users.filter(u => u.role === 'HOD');
  const supervisors= users.filter(u => u.role === 'Supervisor');
  const employees  = users.filter(u => u.role === 'Employee');
  const supIds     = new Set(supervisors.map(s => s.userid));

  // Match employees to supervisors by reportsto_id
  function teamOf(sup) { return employees.filter(e => e.reportsto_id === sup.userid); }

  const assignedEmpIds = new Set(supervisors.flatMap(s => teamOf(s).map(e => e.userid)));
  const unassigned     = employees.filter(e => !assignedEmpIds.has(e.userid));

  const sectionHeader = (label, count) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:var(--clr-surface-2);border-top:2px solid var(--clr-border-md);border-bottom:1px solid var(--clr-border);margin-top:0">
      <span style="font-size:0.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--clr-text-3)">${label}</span>
      <span style="font-size:0.7rem;color:var(--clr-text-3)">${count}</span>
    </div>`;

  const colHeader = `
    <div style="display:flex;align-items:center;padding:8px 20px;background:var(--clr-surface-2);border-bottom:2px solid var(--clr-border-md)">
      <div style="width:40px;flex-shrink:0"></div>
      <div style="flex:1;font-size:0.68rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--clr-text-3)">Name &amp; Designation</div>
      <div style="width:160px;font-size:0.68rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--clr-text-3)">Reports To</div>
      <div style="width:100px;font-size:0.68rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--clr-text-3)">Role</div>
      <div style="width:80px;font-size:0.68rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--clr-text-3);text-align:right">Division</div>
      <div style="width:32px"></div>
    </div>`;

  function memberRow(u, indented = false) {
    const ini   = initials(u.name);
    const color = avatarColor(u.name);
    const bg    = indented ? 'var(--clr-surface-2)' : 'var(--clr-surface)';
    const pl    = indented ? '52px' : '20px';
    return `
    <div style="display:flex;align-items:center;padding:11px 20px 11px ${pl};border-bottom:1px solid var(--clr-border);background:${bg};transition:background .15s" onmouseover="this.style.background='var(--clr-surface-hover,var(--clr-surface-2))'" onmouseout="this.style.background='${bg}'">
      ${indented ? `<div style="width:20px;border-left:2px solid var(--clr-border);border-bottom:2px solid var(--clr-border);height:20px;flex-shrink:0;margin-right:8px;margin-top:-10px;border-radius:0 0 0 4px"></div>` : ''}
      <div style="width:${indented?'30px':'36px'};height:${indented?'30px':'36px'};border-radius:50%;background:${color};color:#fff;display:grid;place-items:center;font-size:${indented?'0.65rem':'0.7rem'};font-weight:700;flex-shrink:0;margin-right:12px">${ini}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.8375rem;font-weight:600;color:var(--clr-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.name}</div>
        <div style="font-size:0.72rem;color:var(--clr-text-3);margin-top:1px">${u.designation || '—'}</div>
      </div>
      <div style="width:160px;font-size:0.78rem;color:var(--clr-text-2)">${u.reportsto_name || '—'}</div>
      <div style="width:100px">${roleChip(u.role)}</div>
      <div style="width:80px;font-size:0.78rem;color:var(--clr-text-3);text-align:right">${u.division || '—'}</div>
      <div style="width:32px"></div>
    </div>`;
  }

  function supervisorBlock(sup) {
    const team   = teamOf(sup);
    const groupId = `org-g-${sup.userid}`;
    const ini    = initials(sup.name);
    const color  = avatarColor(sup.name);
    return `
    <div>
      <div style="display:flex;align-items:center;padding:11px 20px;border-bottom:1px solid var(--clr-border);cursor:pointer;transition:background .15s" onmouseover="this.style.background='var(--clr-surface-2)'" onmouseout="this.style.background=''" onclick="toggleOrgGroup('${groupId}')">
        <div style="width:36px;height:36px;border-radius:50%;background:${color};color:#fff;display:grid;place-items:center;font-size:0.7rem;font-weight:700;flex-shrink:0;margin-right:12px">${ini}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.8375rem;font-weight:600;color:var(--clr-text)">${sup.name}</div>
          <div style="font-size:0.72rem;color:var(--clr-text-3);margin-top:1px">${sup.designation || '—'}</div>
        </div>
        <div style="width:160px;font-size:0.78rem;color:var(--clr-text-2)">${sup.reportsto_name || '—'}</div>
        <div style="width:100px">${roleChip('Supervisor')}</div>
        <div style="width:80px;font-size:0.78rem;color:var(--clr-text-3);text-align:right">${sup.division || '—'}</div>
        <div style="width:32px;display:flex;align-items:center;justify-content:flex-end">
          <span style="font-size:0.7rem;color:var(--clr-text-3);margin-right:4px">${team.length}</span>
          <span style="color:var(--clr-text-3);transition:transform .2s;display:inline-block" id="${groupId}-chevron">${icon('chevron-down',13)}</span>
        </div>
      </div>
      <div id="${groupId}">
        ${team.length === 0
          ? `<div style="padding:10px 20px 10px 52px;font-size:0.78rem;color:var(--clr-text-3);border-bottom:1px solid var(--clr-border);background:var(--clr-surface-2)">No team members assigned</div>`
          : team.map(e => memberRow(e, true)).join('')}
      </div>
    </div>`;
  }

  // Stat pills
  const total = users.filter(u => u.role !== 'Admin').length;
  const stats = [
    { label:'Total Members', value: total,              color:'var(--c-blue-600)',   icon:'users'  },
    { label:'HOD',           value: hods.length,        color:'var(--c-violet-600)', icon:'user'   },
    { label:'Supervisors',   value: supervisors.length, color:'var(--c-amber-600)',  icon:'org'    },
    { label:'Employees',     value: employees.length,   color:'var(--c-green-600)',  icon:'tasks'  },
  ];

  const statsHtml = `
  <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
    ${stats.map(s => `
    <div style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:var(--clr-surface);border:1px solid var(--clr-border);border-radius:var(--r-lg);flex:1;min-width:120px">
      <div style="font-size:1.5rem;font-weight:800;color:${s.color};font-variant-numeric:tabular-nums;line-height:1">${s.value}</div>
      <div style="font-size:0.75rem;color:var(--clr-text-3);font-weight:500">${s.label}</div>
    </div>`).join('')}
  </div>`;

  let rows = '';

  // HOD block — expandable, showing all supervisors underneath
  hods.forEach(hod => {
    const hodGroupId = `org-g-hod-${hod.userid}`;
    const hodTeam = supervisors.filter(s => s.reportsto_id === hod.userid);
    const ini   = initials(hod.name);
    const color = avatarColor(hod.name);
    rows += `
    <div style="background:var(--c-blue-50);border-bottom:2px solid var(--clr-border-md)">
      <div style="display:flex;align-items:center;padding:14px 20px;cursor:pointer" onclick="toggleOrgGroup('${hodGroupId}')">
        <div style="width:40px;height:40px;border-radius:50%;background:${color};color:#fff;display:grid;place-items:center;font-size:0.75rem;font-weight:700;flex-shrink:0;margin-right:12px">${ini}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.875rem;font-weight:700;color:var(--clr-text)">${hod.name}</div>
          <div style="font-size:0.72rem;color:var(--clr-text-3);margin-top:1px">${hod.designation || '—'}</div>
        </div>
        <div style="width:160px;font-size:0.78rem;color:var(--clr-text-2)">—</div>
        <div style="width:100px">${roleChip('HOD')}</div>
        <div style="width:80px;font-size:0.78rem;color:var(--clr-text-3);text-align:right">${hod.division || '—'}</div>
        <div style="width:32px;display:flex;align-items:center;justify-content:flex-end">
          <span style="font-size:0.7rem;color:var(--clr-text-3);margin-right:4px">${hodTeam.length}</span>
          <span style="color:var(--clr-text-3);transition:transform .2s;display:inline-block" id="${hodGroupId}-chevron">${icon('chevron-down',13)}</span>
        </div>
      </div>
    </div>
    <div id="${hodGroupId}" style="border-bottom:2px solid var(--clr-border-md)">
      ${hodTeam.length === 0
        ? `<div style="padding:12px 20px 12px 72px;font-size:0.78rem;color:var(--clr-text-3);border-bottom:1px solid var(--clr-border)">No supervisors assigned</div>`
        : hodTeam.map(sup => supervisorBlock(sup)).join('')}
    </div>`;
  });

  // Supervisors not assigned to any HOD
  const assignedSupIds = new Set(hods.flatMap(h => supervisors.filter(s => s.reportsto_id === h.userid).map(s => s.userid)));
  const unattachedSups = supervisors.filter(s => !assignedSupIds.has(s.userid));
  if (unattachedSups.length) {
    rows += sectionHeader('Other Supervisors', `${unattachedSups.length}`);
    unattachedSups.forEach(sup => { rows += supervisorBlock(sup); });
  }

  if (unassigned.length) {
    rows += sectionHeader('Unassigned Employees', `${unassigned.length}`);
    unassigned.forEach(u => { rows += memberRow(u); });
  }

  el.innerHTML = `
  ${statsHtml}
  <div class="card" style="overflow:hidden">
    ${colHeader}
    ${rows}
  </div>`;

  loadTaskCategories();
}

// ── Admin: Task Categories ─────────────────────────────────
async function loadTaskCategories() {
  const list = document.getElementById('task-categories-list');
  if (!list) return;
  try {
    const data = await apiFetch('/admin/categories');
    renderTaskCategoriesList(data.categories);
  } catch (err) {
    if (list) list.innerHTML = `<div style="color:var(--c-red-600);font-size:0.8rem">Failed to load categories</div>`;
  }
}

function renderTaskCategoriesList(categories) {
  const list = document.getElementById('task-categories-list');
  if (!list) return;
  if (!categories.length) {
    list.innerHTML = `<div style="color:var(--clr-text-3);font-size:0.8rem;padding:8px 0">No categories yet</div>`;
    return;
  }
  list.innerHTML = categories.map(cat => `
    <div class="d-flex items-center justify-between" style="padding:10px;background:var(--clr-surface-2);border-radius:var(--r-md)" data-cat-color="${cat.color}">
      <div class="d-flex items-center gap-8">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${cat.color};flex-shrink:0"></span>
        <span style="font-size:0.82rem;font-weight:500;color:var(--clr-text)">${cat.name}</span>
      </div>
      <button class="btn btn-ghost btn-sm" style="padding:3px 8px;color:var(--c-red-600)" onclick="deleteCategory(${cat.categoryid},'${cat.name}')">Delete</button>
    </div>`).join('');
}

async function deleteCategory(id, name) {
  if (!confirm(`Delete category "${name}"? This will fail if any tasks use it.`)) return;
  try {
    await apiFetch(`/admin/categories/${id}`, { method: 'DELETE' });
    showToast('Category deleted', 'success');
    invalidateCategoryCache();
    loadTaskCategories();
    loadCategoryOptions();
  } catch (err) {
    showToast(err.message || 'Cannot delete — category may be in use', 'error');
  }
}

// ── Shared category options loader ────────────────────────
// Fills every select with id matching /tc-category|filter-category|sv-category/
// and caches results so multiple calls in one page-load are free.
let _categoryCache = null;

async function loadCategoryOptions() {
  try {
    if (!_categoryCache) {
      const data = await apiFetch('/categories');
      _categoryCache = data.categories;
    }
    const cats = _categoryCache;
    // Populate all known category selects
    _populateCategorySelect('tc-category',     cats, 'Select category');
    _populateCategorySelect('filter-category', cats, 'All Categories');
    _populateCategorySelect('sv-category',     cats, 'Select category');
  } catch (err) {
    console.error('loadCategoryOptions failed:', err.message);
  }
}

function _populateCategorySelect(id, cats, placeholder) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    cats.map(c => `<option value="${c.slug}" ${c.slug === current ? 'selected' : ''}>${c.name}</option>`).join('');
}

// Call after a new category is saved so dropdowns refresh
function invalidateCategoryCache() {
  _categoryCache = null;
}

const CATEGORY_PALETTE = [
  '#2563eb','#7c3aed','#059669','#d97706','#0891b2',
  '#dc2626','#ea580c','#0f766e','#be185d','#4338ca',
  '#65a30d','#0369a1','#9333ea','#b45309','#0d9488',
];

function pickCategoryColor() {
  const usedColors = new Set((_categoryCache || []).map(c => c.color));
  const available = CATEGORY_PALETTE.filter(c => !usedColors.has(c));
  const pool = available.length ? available : CATEGORY_PALETTE;
  return pool[Math.floor(Math.random() * pool.length)];
}

function openAddCategoryModal() {
  const existing = document.getElementById('modal-add-category');
  if (existing) {
    document.getElementById('new-cat-name').value = '';
    openModal('modal-add-category');
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'modal-add-category';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="max-width:380px">
      <div class="modal-header" style="padding:16px 20px 12px">
        <div class="modal-title" style="font-size:0.95rem;font-weight:700">Add Task Category</div>
        <button class="modal-close" onclick="closeModal('modal-add-category')">&times;</button>
      </div>
      <div class="modal-body" style="padding:0 20px 16px;display:flex;flex-direction:column;gap:10px">
        <div class="form-group" style="margin:0">
          <label class="form-label" style="margin-bottom:6px;font-size:0.78rem">Category Name</label>
          <input id="new-cat-name" class="form-input" placeholder="e.g. Field Audit" style="font-size:0.875rem;padding:8px 12px" />
        </div>
        <p style="font-size:0.75rem;color:var(--clr-text-3);margin:0">A colour is automatically assigned.</p>
      </div>
      <div class="modal-footer" style="padding:12px 20px 16px;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="closeModal('modal-add-category')">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="submitAddCategory()">Add Category</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  openModal('modal-add-category');
}

async function submitAddCategory() {
  const name = document.getElementById('new-cat-name')?.value.trim();
  if (!name) { showToast('Category name is required', 'error'); return; }
  const color = pickCategoryColor();
  try {
    await apiFetch('/admin/categories', { method: 'POST', body: JSON.stringify({ name, color }) });
    showToast('Category added', 'success');
    closeModal('modal-add-category');
    invalidateCategoryCache();
    loadTaskCategories();
    loadCategoryOptions();
  } catch (err) {
    showToast(err.message || 'Failed to add category', 'error');
  }
}

function toggleOrgGroup(id) {
  const el  = document.getElementById(id);
  const chv = document.getElementById(id + '-chevron');
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display  = open ? 'none' : '';
  if (chv) chv.style.transform = open ? 'rotate(-90deg)' : '';
}

// ── Admin: Manage Users ────────────────────────────────────
async function renderAdminUsers() {
  const el = document.getElementById('admin-users-container');
  if (!el) return;

  el.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:40px;color:var(--clr-text-3)">${icon('loader',18)} Loading users…</div>`;

  let users = [];
  try {
    const data = await apiFetch('/admin/users');
    users = data.users;
    _userModalAllUsers = users; // make available to Reports To dropdown
  } catch (err) {
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 24px;text-align:center">
        <div style="font-size:2rem;margin-bottom:12px;color:var(--clr-text-3)">${icon('x',32)}</div>
        <div style="font-weight:700;font-size:1rem;color:var(--clr-text);margin-bottom:6px">Could not load users</div>
        <div style="font-size:0.8rem;color:var(--clr-text-3)">${err.message}</div>
        <button class="btn btn-secondary btn-sm" style="margin-top:16px" onclick="renderAdminUsers()">Try Again</button>
      </div>`;
    return;
  }

  const roleColors = { HOD:'#2563eb', Supervisor:'#7c3aed', Employee:'#d97706', Admin:'#16a34a' };
  const roleBadge  = r => `<span class="badge" style="background:${roleColors[r]||'#64748b'}20;color:${roleColors[r]||'#64748b'};font-size:0.7rem">${r}</span>`;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div>
        <div style="font-weight:600;font-size:1rem;color:var(--clr-text)">${users.length} users</div>
        <div style="font-size:0.8rem;color:var(--clr-text-3)">All system accounts</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openAddUserModal()">+ Add User</button>
    </div>
    <div class="card" style="overflow:hidden;padding:0">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--clr-surface-2);border-bottom:1px solid var(--clr-border)">
            <th style="padding:10px 16px;text-align:left;font-size:0.75rem;font-weight:600;color:var(--clr-text-3);text-transform:uppercase;letter-spacing:.04em">Name</th>
            <th style="padding:10px 16px;text-align:left;font-size:0.75rem;font-weight:600;color:var(--clr-text-3);text-transform:uppercase;letter-spacing:.04em">Email</th>
            <th style="padding:10px 16px;text-align:left;font-size:0.75rem;font-weight:600;color:var(--clr-text-3);text-transform:uppercase;letter-spacing:.04em">Role</th>
            <th style="padding:10px 16px;text-align:left;font-size:0.75rem;font-weight:600;color:var(--clr-text-3);text-transform:uppercase;letter-spacing:.04em">Designation</th>
            <th style="padding:10px 16px;text-align:left;font-size:0.75rem;font-weight:600;color:var(--clr-text-3);text-transform:uppercase;letter-spacing:.04em">Division</th>
            <th style="padding:10px 16px;text-align:left;font-size:0.75rem;font-weight:600;color:var(--clr-text-3);text-transform:uppercase;letter-spacing:.04em"></th>
          </tr>
        </thead>
        <tbody>
          ${users.map((u, i) => `
            <tr style="border-bottom:1px solid var(--clr-border);${i % 2 === 1 ? 'background:var(--clr-surface-2)' : ''}">
              <td style="padding:12px 16px">
                <div style="display:flex;align-items:center;gap:10px">
                  ${avatar((u.name||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(), roleColors[u.role]||'#64748b', 'xs')}
                  <span style="font-weight:500;font-size:0.875rem;color:var(--clr-text)">${u.name}</span>
                </div>
              </td>
              <td style="padding:12px 16px;font-size:0.8125rem;color:var(--clr-text-2)">${u.email}</td>
              <td style="padding:12px 16px">${roleBadge(u.role)}</td>
              <td style="padding:12px 16px;font-size:0.8125rem;color:var(--clr-text-2)">${u.designation||'—'}</td>
              <td style="padding:12px 16px;font-size:0.8125rem;color:var(--clr-text-2)">${u.division||'—'}</td>
              <td style="padding:12px 16px;text-align:right">
                <button class="btn btn-ghost btn-sm" onclick="openEditUserModal(${JSON.stringify(u).replace(/"/g,'&quot;')})" style="margin-right:4px">Edit</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

  `;
}

// Populated when the modal opens; used by onUserRoleChange
let _userModalAllUsers = [];

async function openAddUserModal() {
  // Ensure users are loaded for the Reports To dropdown
  if (!_userModalAllUsers.length) {
    try {
      const data = await apiFetch('/admin/users');
      _userModalAllUsers = data.users;
    } catch (e) { /* proceed without dropdown population */ }
  }
  document.getElementById('user-modal-title').textContent = 'Add Member';
  document.getElementById('uf-userid').value       = '';
  document.getElementById('uf-name').value         = '';
  document.getElementById('uf-email').value        = '';
  document.getElementById('uf-password').value     = '';
  document.getElementById('uf-role').value         = '';
  document.getElementById('uf-division').value     = '';
  document.getElementById('uf-designation').value  = '';
  document.getElementById('uf-phone').value        = '';
  document.getElementById('uf-reportsto').value    = '';
  document.getElementById('uf-pass-hint').textContent  = '(required)';
  document.getElementById('uf-submit-btn').textContent = 'Add Member';
  document.getElementById('uf-error').style.display   = 'none';
  document.getElementById('uf-reportsto-group').style.display = 'none';
  openModal('modal-user-form');
}

function openEditUserModal(u) {
  document.getElementById('user-modal-title').textContent = 'Edit Member';
  document.getElementById('uf-userid').value       = u.userid;
  document.getElementById('uf-name').value         = u.name || '';
  document.getElementById('uf-email').value        = u.email || '';
  document.getElementById('uf-password').value     = '';
  document.getElementById('uf-role').value         = u.role || '';
  document.getElementById('uf-division').value     = u.division || '';
  document.getElementById('uf-designation').value  = u.designation || '';
  document.getElementById('uf-phone').value        = u.phone || '';
  document.getElementById('uf-pass-hint').textContent  = '(leave blank to keep current)';
  document.getElementById('uf-submit-btn').textContent = 'Save Changes';
  document.getElementById('uf-error').style.display   = 'none';
  onUserRoleChange(u.reportsto_id);
  openModal('modal-user-form');
}

async function onUserRoleChange(preselect = null) {
  const role  = document.getElementById('uf-role').value;
  const group = document.getElementById('uf-reportsto-group');
  const label = document.getElementById('uf-reportsto-label');
  const sel   = document.getElementById('uf-reportsto');

  if (role === 'Employee' || role === 'Supervisor') {
    // Fetch users if not yet loaded
    if (!_userModalAllUsers.length) {
      try {
        const data = await apiFetch('/admin/users');
        _userModalAllUsers = data.users;
      } catch (e) { /* show empty dropdown */ }
    }

    if (role === 'Employee') {
      const options = _userModalAllUsers
        .filter(u => u.role === 'Supervisor' || u.role === 'HOD')
        .sort((a, b) => a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'HOD' ? -1 : 1);
      sel.innerHTML = `<option value="">— Select who they work under —</option>` +
        options.map(u => `<option value="${u.userid}" ${String(u.userid) === String(preselect) ? 'selected' : ''}>${u.name} (${u.role})</option>`).join('');
      label.textContent = 'Works Under *';
      group.style.display = '';
    } else {
      const hods = _userModalAllUsers.filter(u => u.role === 'HOD');
      sel.innerHTML = `<option value="">— Select HOD —</option>` +
        hods.map(u => `<option value="${u.userid}" ${String(u.userid) === String(preselect) ? 'selected' : ''}>${u.name}</option>`).join('');
      label.textContent = 'Reports To (HOD) *';
      group.style.display = hods.length ? '' : 'none';
    }
  } else {
    group.style.display = 'none';
    sel.value = '';
  }
}

function closeUserModal() {
  closeModal('modal-user-form');
}

async function submitUserForm() {
  const userId = document.getElementById('uf-userid').value;
  const isEdit = !!userId;
  const name        = document.getElementById('uf-name').value.trim();
  const email       = document.getElementById('uf-email').value.trim();
  const password    = document.getElementById('uf-password').value;
  const role        = document.getElementById('uf-role').value;
  const division    = document.getElementById('uf-division').value.trim();
  const designation = document.getElementById('uf-designation').value.trim();
  const phone       = document.getElementById('uf-phone').value.trim();
  const errEl       = document.getElementById('uf-error');
  const btn         = document.getElementById('uf-submit-btn');

  errEl.style.display = 'none';
  if (!name || !email || !role) { errEl.textContent = 'Name, email and role are required.'; errEl.style.display = 'block'; return; }
  if (!isEdit && !password)     { errEl.textContent = 'Password is required for new users.'; errEl.style.display = 'block'; return; }
  if (password && password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display = 'block'; return; }

  btn.disabled = true;
  btn.textContent = isEdit ? 'Saving…' : 'Adding…';

  const reportsTo = document.getElementById('uf-reportsto').value;
  if ((role === 'Employee' || role === 'Supervisor') && !reportsTo) {
    errEl.textContent = role === 'Employee' ? 'Please select which supervisor this employee works under.' : 'Please select the HOD this supervisor reports to.';
    errEl.style.display = 'block';
    return;
  }

  const body = { name, email, role, division, designation, phone, reportsTo: reportsTo || null };
  if (password) body.password = password;

  try {
    if (isEdit) {
      await apiFetch(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(body) });
      showToast('User updated', 'success');
    } else {
      await apiFetch('/admin/users', { method: 'POST', body: JSON.stringify(body) });
      showToast('User added', 'success');
    }
    _userModalAllUsers = []; // invalidate cache
    closeUserModal();
    if (state.currentPage === 'org-chart') {
      renderOrgChart();
    } else {
      renderAdminUsers();
    }
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = isEdit ? 'Save Changes' : 'Add User';
  }
}

// ── Charts (Canvas) ────────────────────────────────────────
function drawHODCharts() {
  // HOD uses supervisor dashboard API data — same charts as supervisor
  drawSupervisorCharts();
}

function drawSupervisorCharts() {
  const team = apiCache.dashboard?.team || [];
  if (!team.length) return;
  const COLORS = ['#2563eb','#7c3aed','#d97706','#059669','#dc2626','#0891b2'];
  drawBarChart('sup-bar-chart', {
    labels: team.map(e => e.name.split(' ')[0]),
    data:   team.map(e => parseInt(e.active) || 0),
    colors: team.map((_, i) => COLORS[i % COLORS.length]),
    label:  'Active Tasks',
  });
  // Task distribution — stacked look: active vs completed
  drawBarChart('sup-dist-chart', {
    labels: team.map(e => e.name.split(' ')[0]),
    data:   team.map(e => parseInt(e.total) || 0),
    colors: team.map((_, i) => COLORS[i % COLORS.length]),
    label:  'Total Tasks',
  });
}

function drawEmployeeCharts() {
  const e3Tasks = apiCache.tasks;
  drawDonutChart('emp-progress-chart', [
    { label: 'Completed',  value: e3Tasks.filter(t=>t.status==='completed').length,  color: '#059669' },
    { label: 'In Progress',value: e3Tasks.filter(t=>t.status==='inprogress').length, color: '#2563eb' },
    { label: 'Overdue',    value: e3Tasks.filter(t=>t.status==='overdue').length,    color: '#dc2626' },
    { label: 'Pending',    value: e3Tasks.filter(t=>t.status==='pending').length,    color: '#94a3b8' },
  ].filter(s => s.value > 0));
}

function drawAdminCharts() {
  drawDonutChart('admin-role-chart', [
    { label: 'Employees',   value: EMPLOYEES.length, color: '#059669' },
    { label: 'Supervisors', value: 1,                color: '#7c3aed' },
    { label: 'HODs',        value: 1,                color: '#2563eb' },
    { label: 'Admins',      value: 1,                color: '#d97706' },
  ]);
}

// ── Employee API action handlers ───────────────────────────
async function claimFloatingTask(taskId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Claiming…'; }
  try {
    await apiFetch(`/employee/floating-tasks/${taskId}/claim`, { method: 'POST' });
    showToast('Task claimed! It is now in your task list.', 'success');
    apiCache.dashboard = null;
    apiCache.tasks = [];
    await navigate('dashboard');
  } catch (err) {
    showToast(err.message || 'Could not claim task', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Pick Up Task'; }
  }
}

async function apiAcceptAssignment(assignmentId) {
  try {
    await employeeApi.acceptAssignment(assignmentId);
    showToast('Task accepted! It is now in progress.', 'success');
    apiCache.dashboard = null;
    apiCache.tasks = [];
    await navigate('dashboard');
  } catch (err) {
    showToast(`Could not accept: ${err.message}`, 'error');
  }
}

async function apiAcceptAssignmentFromTasks(assignmentId) {
  try {
    await employeeApi.acceptAssignment(assignmentId);
    showToast('Task accepted! It is now in progress.', 'success');
    apiCache.dashboard = null;
    apiCache.tasks = [];
    await navigate('tasks');
  } catch (err) {
    showToast(`Could not accept: ${err.message}`, 'error');
  }
}

async function apiRejectAssignment(assignmentId) {
  try {
    await employeeApi.rejectAssignment(assignmentId, '');
    showToast('Task rejected.', 'success');
    apiCache.dashboard = null;
    apiCache.tasks = [];
    await navigate('dashboard');
  } catch (err) {
    console.error('Reject failed:', err);
    showToast(`Could not reject: ${err.message}`, 'error');
  }
}

async function apiSubmitWork(taskId, status, remarks = '') {
  try {
    await employeeApi.submitTask(taskId, { status, remarks });
    showToast(`Work submitted as "${status}".`, 'success');
    apiCache.tasks = [];
    closeModal('modal-submit');
    await navigate('tasks');
  } catch (err) {
    showToast(`Submit failed: ${err.message}`, 'error');
  }
}

// ── Productivity table (supervisor/HOD dashboard) ──────────────
function renderProductivityTable(team) {
  if (!team.length) return `<p class="text-muted text-xs" style="padding:16px">No team data yet.</p>`;
  return `
  <table style="width:100%;border-collapse:collapse;font-size:0.78rem">
    <thead>
      <tr style="border-bottom:2px solid var(--clr-border);color:var(--clr-text-2)">
        <th style="text-align:left;padding:6px 4px;font-weight:600">Member</th>
        <th style="text-align:center;padding:6px 4px;font-weight:600">Total</th>
        <th style="text-align:center;padding:6px 4px;font-weight:600">Done</th>
        <th style="text-align:center;padding:6px 4px;font-weight:600">Rate</th>
        <th style="text-align:right;padding:6px 4px;font-weight:600">Hours</th>
      </tr>
    </thead>
    <tbody>
      ${team.map(m => {
        const rate = m.productivity || 0;
        const color = rate >= 80 ? 'var(--c-green-600)' : rate >= 50 ? 'var(--c-amber-600)' : 'var(--c-red-600)';
        return `<tr style="border-bottom:1px solid var(--clr-border)">
          <td style="padding:7px 4px;font-weight:600;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${m.name}">${m.name.split(' ')[0]}</td>
          <td style="text-align:center;padding:7px 4px">${m.total}</td>
          <td style="text-align:center;padding:7px 4px;color:var(--c-green-600)">${m.completed}</td>
          <td style="text-align:center;padding:7px 4px;font-weight:700;color:${color}">${rate}%</td>
          <td style="text-align:right;padding:7px 4px;color:var(--clr-text-2)">${m.hoursSpent ? m.hoursSpent.toFixed(1)+'h' : '—'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

// ── To-do List Page (Employee) ──────────────────────────────
// In-memory cache so calendar can show todos without re-fetching
let _todoCache = [];

async function renderTodoPage() {
  const el = document.getElementById('todo-content');
  if (!el) return;
  el.innerHTML = `
  <div style="max-width:640px;margin:0 auto">
    <h2 style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:var(--clr-text);margin-bottom:20px">My To-do List</h2>
    <div class="card mb-16">
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <input id="todo-input" class="form-input" placeholder="Add a new to-do…" style="flex:2;min-width:180px"
          onkeydown="if(event.key==='Enter')addTodo()" />
        <input id="todo-due" type="date" class="form-input" style="flex:1;min-width:140px" title="Due date (optional)" />
        <button class="btn btn-primary" onclick="addTodo()">${icon('plus',14)} Add</button>
      </div>
    </div>
    <div id="todo-list"><div style="text-align:center;padding:40px;color:var(--clr-text-3)">${icon('log',20)}<br><br>Loading…</div></div>
  </div>`;
  await refreshTodoList();
}

async function refreshTodoList() {
  const el = document.getElementById('todo-list');
  if (!el) return;
  try {
    const { todos } = await apiFetch('/todos');
    _todoCache = todos;
    if (!todos.length) {
      el.innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--clr-text-3)">${icon('check',24)}<br><br>No to-dos yet. Add one above!</div>`;
      return;
    }
    const pending = todos.filter(t => !t.done);
    const done    = todos.filter(t =>  t.done);
    const renderGroup = (items, label) => items.length ? `
      <div class="text-xs font-semibold text-muted mb-8" style="text-transform:uppercase;letter-spacing:.05em">${label}</div>
      ${items.map(t => renderTodoItem(t)).join('')}` : '';
    el.innerHTML = renderGroup(pending, 'Pending') + renderGroup(done, 'Done');
  } catch (err) {
    el.innerHTML = `<p class="text-sm" style="color:var(--c-red-500)">Failed to load to-dos: ${err.message}</p>`;
  }
}

function renderTodoItem(t) {
  const overdue = t.duedate && !t.done && t.duedate < new Date().toISOString().slice(0,10);
  const dueLabel = t.duedate
    ? `<span style="font-size:0.72rem;padding:2px 7px;border-radius:99px;background:${overdue?'var(--c-red-100)':'var(--c-blue-50)'};color:${overdue?'var(--c-red-600)':'var(--c-blue-600)'};font-weight:600">${overdue?'⚠ ':'📅 '}${fmtDate(t.duedate)}</span>`
    : '';
  return `
  <div class="todo-item card mb-8" id="todo-row-${t.todoid}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;${t.done?'opacity:0.55':''}">
    <input type="checkbox" ${t.done?'checked':''} style="width:17px;height:17px;cursor:pointer;accent-color:var(--clr-primary);flex-shrink:0"
      onchange="toggleTodo(${t.todoid},this)" />
    <div style="flex:1;min-width:0">
      <div style="font-size:0.875rem;font-weight:500;${t.done?'text-decoration:line-through;color:var(--clr-text-2)':'color:var(--clr-text)'}">${t.title}</div>
      ${dueLabel ? `<div style="margin-top:4px">${dueLabel}</div>` : ''}
    </div>
    <button onclick="startEditTodo(${t.todoid})" style="background:none;border:none;cursor:pointer;color:var(--clr-text-3);padding:4px" title="Edit">${icon('edit',14)}</button>
    <button onclick="deleteTodo(${t.todoid})" style="background:none;border:none;cursor:pointer;color:var(--clr-text-3);padding:4px" title="Delete">${icon('x',14)}</button>
  </div>`;
}

function startEditTodo(id) {
  const t = _todoCache.find(x => x.todoid === id);
  if (!t) return;
  const row = document.getElementById(`todo-row-${id}`);
  if (!row) return;
  row.innerHTML = `
    <div style="display:flex;gap:8px;width:100%;flex-wrap:wrap">
      <input id="edit-title-${id}" class="form-input" value="${t.title.replace(/"/g,'&quot;')}" style="flex:2;min-width:160px" />
      <input id="edit-due-${id}" type="date" class="form-input" value="${t.duedate ? t.duedate.slice(0,10) : ''}" style="flex:1;min-width:130px" />
      <button class="btn btn-primary btn-sm" onclick="saveEditTodo(${id})">Save</button>
      <button class="btn btn-ghost btn-sm" onclick="refreshTodoList()">Cancel</button>
    </div>`;
  document.getElementById(`edit-title-${id}`)?.focus();
}

async function saveEditTodo(id) {
  const titleEl = document.getElementById(`edit-title-${id}`);
  const dueEl   = document.getElementById(`edit-due-${id}`);
  if (!titleEl?.value.trim()) { showToast('Title cannot be empty', 'error'); return; }
  try {
    await apiFetch(`/todos/${id}`, { method: 'PUT', body: JSON.stringify({ title: titleEl.value.trim(), duedate: dueEl?.value || null }) });
    await refreshTodoList();
  } catch (err) {
    showToast('Failed to update: ' + err.message, 'error');
  }
}

async function addTodo() {
  const input = document.getElementById('todo-input');
  const due   = document.getElementById('todo-due');
  if (!input || !input.value.trim()) { input?.focus(); return; }
  try {
    await apiFetch('/todos', { method: 'POST', body: JSON.stringify({ title: input.value.trim(), duedate: due?.value || null }) });
    input.value = '';
    if (due) due.value = '';
    await refreshTodoList();
  } catch (err) {
    showToast('Failed to add: ' + err.message, 'error');
  }
}

async function toggleTodo(id, cb) {
  try {
    await apiFetch(`/todos/${id}/toggle`, { method: 'PATCH' });
    await refreshTodoList();
  } catch (err) {
    cb.checked = !cb.checked;
    showToast('Failed to update', 'error');
  }
}

async function deleteTodo(id) {
  try {
    await apiFetch(`/todos/${id}`, { method: 'DELETE' });
    await refreshTodoList();
  } catch (err) {
    showToast('Failed to delete', 'error');
  }
}

// ── Operational Dashboard (HOD only) ───────────────────────
async function renderOperationalPage() {
  const el = document.getElementById('operational-content');
  if (!el) return;
  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--clr-text-3);gap:10px">${icon('log',16)} Loading operational data…</div>`;

  let data;
  try {
    data = await apiFetch('/reports/operational');
  } catch (err) {
    el.innerHTML = `<div class="card"><p class="text-sm" style="color:var(--c-red-500)">Failed to load: ${err.message}</p></div>`;
    return;
  }

  const { categories, activityTrend, records } = data;
  const fmtStatus = s => ({ InProgress:'In Progress', Completed:'Completed', Pending:'Pending', Overdue:'Overdue', Submitted:'Submitted', UnableToComplete:'Unable' }[s] || s);
  const statusColor = s => ({ Completed:'var(--c-green-600)', InProgress:'var(--c-blue-600)', Overdue:'var(--c-red-600)', Submitted:'var(--c-amber-600)', Pending:'var(--clr-text-2)' }[s] || 'var(--clr-text-2)');

  el.innerHTML = `
  <div class="d-flex items-center justify-between mb-20">
    <h2 style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:var(--clr-text)">Operational Dashboard</h2>
  </div>

  <!-- Category stat cards -->
  <div class="d-grid mb-20" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px">
    ${categories.map(c => `
    <div class="stat-card">
      <div class="stat-icon" style="background:${c.color}22;color:${c.color};font-size:18px">📂</div>
      <div>
        <div class="stat-value tabular-nums">${c.total}</div>
        <div class="stat-label">${c.name}</div>
        <div class="text-xs text-muted mt-2 tabular-nums">${c.completed} done · ${c.inprogress} in progress</div>
      </div>
    </div>`).join('')}
  </div>

  <!-- Activity Trends -->
  <div class="card mb-20">
    <div class="card-header">
      <div class="card-title">Activity Trends</div>
      <span class="text-xs text-muted">Last 8 weeks by category</span>
    </div>
    <div style="padding:0 20px 0">
      <canvas id="ops-trend-chart" style="width:100%;height:240px;display:block"></canvas>
      <div id="ops-trend-legend" style="display:flex;flex-wrap:wrap;gap:14px 24px;padding:14px 0 16px;border-top:1px solid var(--clr-border);margin-top:8px"></div>
    </div>
  </div>

  <!-- Recent Records -->
  <div class="card">
    <div class="card-header"><div class="card-title">Recent Records</div><span class="text-xs text-muted">Last 50 tasks</span></div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:0.8rem;min-width:500px">
        <thead>
          <tr style="border-bottom:2px solid var(--clr-border);color:var(--clr-text-2)">
            <th style="text-align:left;padding:8px 6px;font-weight:600">Title</th>
            <th style="text-align:left;padding:8px 6px;font-weight:600">Category</th>
            <th style="text-align:center;padding:8px 6px;font-weight:600">Status</th>
            <th style="text-align:left;padding:8px 6px;font-weight:600">Created By</th>
            <th style="text-align:right;padding:8px 6px;font-weight:600">Date</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => `
          <tr style="border-bottom:1px solid var(--clr-border)">
            <td style="padding:8px 6px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500" title="${r.title}">${r.title}</td>
            <td style="padding:8px 6px"><span class="badge" style="background:${r.categorycolor}22;color:${r.categorycolor};border:1px solid ${r.categorycolor}44">${r.categoryname}</span></td>
            <td style="text-align:center;padding:8px 6px;font-weight:600;color:${statusColor(r.status)}">${fmtStatus(r.status)}</td>
            <td style="padding:8px 6px;color:var(--clr-text-2)">${r.createdbyname}</td>
            <td style="text-align:right;padding:8px 6px;color:var(--clr-text-3)">${new Date(r.createdat).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  // Draw activity trend multi-line chart
  setTimeout(() => {
    if (!activityTrend.length || !categories.length) return;
    const labels = activityTrend.map(w => w.label);
    const datasets = categories
      .map(c => ({
        label: c.name,
        color: c.color,
        data:  activityTrend.map(w => w[c.slug] || 0),
      }))
      .filter(d => d.data.some(v => v > 0));
    if (datasets.length) {
      drawLineChart('ops-trend-chart', { labels, datasets, noLegend: true, height: 240 });
      const legendEl = document.getElementById('ops-trend-legend');
      if (legendEl) {
        legendEl.innerHTML = datasets.map(ds => `
          <div style="display:flex;align-items:center;gap:8px;font-size:0.78rem;color:var(--clr-text-2);font-weight:500">
            <span style="display:inline-block;width:28px;height:3px;border-radius:2px;background:${ds.color};flex-shrink:0"></span>
            ${ds.label}
          </div>`).join('');
      }
    }
  }, 50);
}

let _reportData = null; // cached for export functions

async function renderReportsPage() {
  const el = document.getElementById('reports-content');
  if (!el) return;
  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:60px;color:var(--clr-text-3);gap:10px">${icon('log',16)} Loading report…</div>`;

  let data;
  try {
    data = await apiFetch('/reports/summary');
  } catch (err) {
    el.innerHTML = `<div class="card"><p class="text-sm" style="color:var(--c-red-500)">Failed to load report: ${err.message}</p></div>`;
    return;
  }

  _reportData = data;
  const { stats, trend, byCategory } = data;
  const s = stats;

  function delta(val, unit = '', higherIsBetter = true) {
    if (val === 0) return `<span class="stat-change" style="color:var(--clr-text-3)">— same as last month</span>`;
    const up = val > 0;
    const good = higherIsBetter ? up : !up;
    const cls = good ? 'up' : 'down';
    const arrow = up ? '↑' : '↓';
    return `<span class="stat-change ${cls}">${arrow} ${Math.abs(val)}${unit} vs last month</span>`;
  }

  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;align-items:center;margin-bottom:18px;gap:8px">
      <div style="position:relative;display:inline-block" id="report-dl-menu-wrap">
        <button class="btn btn-secondary" style="display:flex;align-items:center;gap:6px;font-size:0.82rem" onclick="toggleReportDownloadMenu()">
          ${icon('submit',13)} Download Report ▾
        </button>
        <div id="report-dl-menu" style="display:none;position:absolute;right:0;top:calc(100% + 6px);background:var(--clr-surface);border:1px solid var(--clr-border);border-radius:var(--r-md);box-shadow:var(--shadow-md);min-width:160px;z-index:200;overflow:hidden">
          <button onclick="exportReportCSV()" style="width:100%;text-align:left;padding:9px 14px;font-size:0.82rem;background:none;border:none;cursor:pointer;color:var(--clr-text);display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--clr-border)" onmouseover="this.style.background='var(--clr-surface-hover)'" onmouseout="this.style.background='none'">
            ${icon('tasks',13)} Export as CSV
          </button>
          <button onclick="exportReportPDF()" style="width:100%;text-align:left;padding:9px 14px;font-size:0.82rem;background:none;border:none;cursor:pointer;color:var(--clr-text);display:flex;align-items:center;gap:8px" onmouseover="this.style.background='var(--clr-surface-hover)'" onmouseout="this.style.background='none'">
            ${icon('report',13)} Export as PDF
          </button>
        </div>
      </div>
    </div>

    <div class="d-flex gap-16 mb-20" style="flex-wrap:wrap">
      <div class="stat-card" style="flex:1;min-width:160px">
        <div class="stat-icon" style="background:var(--c-blue-50);color:var(--c-blue-600)">${icon('tasks',20)}</div>
        <div>
          <div class="stat-value tabular-nums">${s.totalThisMonth}</div>
          <div class="stat-label">Total Tasks This Month</div>
          ${delta(s.totalDelta, '', true)}
        </div>
      </div>
      <div class="stat-card" style="flex:1;min-width:160px">
        <div class="stat-icon" style="background:var(--c-green-50);color:var(--c-green-600)">${icon('check',20)}</div>
        <div>
          <div class="stat-value tabular-nums">${s.completionRate}%</div>
          <div class="stat-label">Completion Rate</div>
          ${delta(s.completionRateDelta, '%', true)}
        </div>
      </div>
      <div class="stat-card" style="flex:1;min-width:160px">
        <div class="stat-icon" style="background:var(--c-amber-50);color:var(--c-amber-600)">${icon('clock',20)}</div>
        <div>
          <div class="stat-value tabular-nums">${s.avgDuration > 0 ? s.avgDuration + 'h' : '—'}</div>
          <div class="stat-label">Avg Task Duration</div>
          ${s.avgDuration > 0 ? delta(s.avgDurationDelta, 'h', false) : '<span class="stat-change" style="color:var(--clr-text-3)">No completed tasks yet</span>'}
        </div>
      </div>
      <div class="stat-card" style="flex:1;min-width:160px">
        <div class="stat-icon" style="background:var(--c-red-50);color:var(--c-red-600)">${icon('x',20)}</div>
        <div>
          <div class="stat-value tabular-nums">${s.overdueTotal}</div>
          <div class="stat-label">Overdue Tasks</div>
          ${delta(s.overdueDelta, '', false)}
        </div>
      </div>
    </div>

    <div class="d-flex gap-16" style="flex-wrap:wrap">
      <div class="card" style="flex:2;min-width:280px">
        <div class="card-header" style="flex-wrap:wrap;gap:10px">
          <div class="card-title">Task Completion Trend</div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <div class="trend-period-toggle">
              <button class="trend-period-btn active" data-period="7d"  onclick="switchTrendPeriod('7d',this)">7 Days</button>
              <button class="trend-period-btn"         data-period="14d" onclick="switchTrendPeriod('14d',this)">2 Weeks</button>
              <button class="trend-period-btn"         data-period="1m"  onclick="switchTrendPeriod('1m',this)">1 Month</button>
              <button class="trend-period-btn"         data-period="3m"  onclick="switchTrendPeriod('3m',this)">3 Months</button>
              <button class="trend-period-btn"         data-period="6m"  onclick="switchTrendPeriod('6m',this)">6 Months</button>
              <button class="trend-period-btn"         data-period="1y"  onclick="switchTrendPeriod('1y',this)">1 Year</button>
            </div>
            <div style="display:flex;align-items:center;gap:4px">
              <button onclick="shiftTrend(-1)" style="background:none;border:1px solid var(--clr-border);border-radius:6px;padding:3px 8px;cursor:pointer;color:var(--clr-text-2);font-size:0.85rem" title="Previous period">‹</button>
              <span id="trend-offset-label" style="font-size:0.72rem;color:var(--clr-text-3);min-width:60px;text-align:center">Current</span>
              <button onclick="shiftTrend(1)" id="trend-next-btn" style="background:none;border:1px solid var(--clr-border);border-radius:6px;padding:3px 8px;cursor:pointer;color:var(--clr-text-2);font-size:0.85rem" title="Next period" disabled>›</button>
            </div>
          </div>
        </div>
        <div id="report-trend-area">
          ${trend.length ? `<canvas id="report-trend-chart" height="200"></canvas>` : `<p class="text-muted text-xs" style="padding:24px 0">No data yet — tasks will appear here as they are created.</p>`}
        </div>
      </div>
      <div class="card" style="flex:1;min-width:240px">
        <div class="card-header"><div class="card-title">By Category</div></div>
        ${byCategory.some(c => c.total > 0) ? `<canvas id="report-cat-chart" height="200"></canvas>` : `<p class="text-muted text-xs" style="padding:24px 0">No tasks yet.</p>`}
      </div>
    </div>

    <div id="report-emp-perf-section" style="margin-top:24px">
      <div style="display:flex;align-items:center;justify-content:center;padding:32px;color:var(--clr-text-3);gap:8px;font-size:0.82rem">
        ${icon('log',14)} Loading employee performance…
      </div>
    </div>`;

  // Draw charts after DOM is ready
  setTimeout(() => {
    switchTrendPeriod('7d');
    if (byCategory.some(c => c.total > 0)) {
      drawDonutChart('report-cat-chart', byCategory.map(c => ({
        label: c.name,
        value: c.total,
        color: c.color || '#94a3b8',
      })));
    }
  }, 50);

  // Load employee performance section non-blocking
  loadEmployeePerformanceSection();
}

let _empPerfData = [];
let _empPerfSort = { col: 'name', dir: 1 };

async function loadEmployeePerformanceSection() {
  const sec = document.getElementById('report-emp-perf-section');
  if (!sec) return;
  try {
    const data = await apiFetch('/reports/employee-performance');
    _empPerfData = data.employees || [];
    renderEmployeePerformanceSection();
  } catch (err) {
    sec.innerHTML = `<div class="card"><p class="text-sm" style="color:var(--c-red-500)">Could not load employee data: ${err.message}</p></div>`;
  }
}

function sortEmpPerf(col) {
  if (_empPerfSort.col === col) {
    _empPerfSort.dir *= -1;
  } else {
    _empPerfSort.col = col;
    _empPerfSort.dir = col === 'name' ? 1 : -1; // default: names asc, numbers desc
  }
  renderEmployeePerformanceSection();
}

function renderEmployeePerformanceSection() {
  const sec = document.getElementById('report-emp-perf-section');
  if (!sec) return;

  const emps = [..._empPerfData].sort((a, b) => {
    const av = a[_empPerfSort.col] ?? '';
    const bv = b[_empPerfSort.col] ?? '';
    if (typeof av === 'number') return (av - bv) * _empPerfSort.dir;
    return String(av).localeCompare(String(bv)) * _empPerfSort.dir;
  });

  function thBtn(col, label) {
    const active = _empPerfSort.col === col;
    const arrow  = active ? (_empPerfSort.dir > 0 ? ' ↑' : ' ↓') : '';
    return `<th class="emp-perf-th${active ? ' active' : ''}" onclick="sortEmpPerf('${col}')">${label}${arrow}</th>`;
  }

  function scoreBar(val, max, color) {
    const pct = max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0;
    return `<div style="height:5px;border-radius:3px;background:var(--clr-border);margin-top:3px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width .4s"></div>
    </div>`;
  }

  const maxTotal     = Math.max(...emps.map(e => e.total), 1);
  const maxOverdue   = Math.max(...emps.map(e => e.overdue), 1);

  const rows = emps.map(e => {
    const initials = e.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const avatarColor = `hsl(${(e.userid * 67) % 360},50%,42%)`;

    const rateColor = e.completionRate >= 80 ? '#16a34a' : e.completionRate >= 50 ? '#d97706' : '#dc2626';
    const ontimeColor = e.onTimeRate === null ? '#94a3b8'
                      : e.onTimeRate >= 80 ? '#16a34a'
                      : e.onTimeRate >= 50 ? '#d97706' : '#dc2626';

    const statusCells = [
      { label: 'Completed', val: e.completed, color: '#16a34a' },
      { label: 'In Progress', val: e.inprogress, color: '#2563eb' },
      { label: 'Overdue', val: e.overdue, color: '#dc2626' },
      { label: 'Pending', val: e.pending, color: '#94a3b8' },
    ].map(s => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;color:var(--clr-text-2)">
        <span style="width:7px;height:7px;border-radius:50%;background:${s.color};display:inline-block"></span>${s.label}: <strong style="color:var(--clr-text)">${s.val}</strong>
      </span>`).join('');

    return `
    <tr class="emp-perf-row">
      <td style="padding:12px 14px">
        <div style="display:flex;align-items:center;gap:10px">
          ${avatar(initials, avatarColor, 'sm')}
          <div>
            <div style="font-weight:600;font-size:0.85rem;color:var(--clr-text)">${escHtml(e.name)}</div>
            <div style="font-size:0.72rem;color:var(--clr-text-3)">${escHtml(e.designation)} · ${escHtml(e.division)}</div>
          </div>
        </div>
      </td>
      <td style="padding:12px 8px;font-size:0.72rem;color:var(--clr-text-3)">${escHtml(e.supervisor)}</td>
      <td style="padding:12px 8px;text-align:center">
        <span style="font-weight:700;font-size:0.95rem">${e.total}</span>
        ${scoreBar(e.total, maxTotal, '#2563eb')}
      </td>
      <td style="padding:12px 8px">
        <div style="display:flex;flex-wrap:wrap;gap:6px 14px">${statusCells}</div>
      </td>
      <td style="padding:12px 8px;text-align:center">
        <span style="font-weight:700;font-size:0.9rem;color:${rateColor}">${e.completionRate}%</span>
        <div style="height:5px;border-radius:3px;background:var(--clr-border);margin-top:3px;overflow:hidden">
          <div style="height:100%;width:${e.completionRate}%;background:${rateColor};border-radius:3px"></div>
        </div>
      </td>
      <td style="padding:12px 8px;text-align:center">
        <span style="font-weight:700;font-size:0.9rem;color:${ontimeColor}">${e.onTimeRate !== null ? e.onTimeRate + '%' : '—'}</span>
      </td>
      <td style="padding:12px 8px;text-align:center">
        <span style="font-weight:600;font-size:0.85rem">${e.overdue > 0 ? `<span style="color:#dc2626">${e.overdue}</span>` : '<span style="color:#16a34a">0</span>'}</span>
        ${scoreBar(e.overdue, maxOverdue, '#dc2626')}
      </td>
      <td style="padding:12px 14px;text-align:center">
        <span style="font-size:0.82rem;color:var(--clr-text-2)">${e.avgHrs > 0 ? e.avgHrs + 'h' : '—'}</span>
      </td>
    </tr>`;
  }).join('');

  const emptyRow = emps.length === 0
    ? `<tr><td colspan="8" style="padding:32px;text-align:center;color:var(--clr-text-3);font-size:0.82rem">No employee data available.</td></tr>`
    : '';

  sec.innerHTML = `
  <div class="card" style="padding:0;overflow:hidden">
    <div class="card-header" style="padding:16px 20px 14px;border-bottom:1px solid var(--clr-border);margin-bottom:0">
      <div>
        <div class="card-title">Employee Work Performance</div>
        <div style="font-size:0.72rem;color:var(--clr-text-3);margin-top:2px">${emps.length} employee${emps.length !== 1 ? 's' : ''} · click column headers to sort</div>
      </div>
    </div>
    <div style="overflow-x:auto">
      <table class="emp-perf-table">
        <thead>
          <tr>
            ${thBtn('name', 'Employee')}
            ${thBtn('supervisor', 'Supervisor')}
            ${thBtn('total', 'Total Tasks')}
            <th class="emp-perf-th">Breakdown</th>
            ${thBtn('completionRate', 'Completion Rate')}
            ${thBtn('onTimeRate', 'On-Time Rate')}
            ${thBtn('overdue', 'Overdue')}
            ${thBtn('avgHrs', 'Avg Hours')}
          </tr>
        </thead>
        <tbody>${rows}${emptyRow}</tbody>
      </table>
    </div>
  </div>`;
}

function toggleReportDownloadMenu() {
  const menu = document.getElementById('report-dl-menu');
  if (!menu) return;
  const open = menu.style.display !== 'none';
  menu.style.display = open ? 'none' : 'block';
  if (!open) {
    const close = e => {
      if (!document.getElementById('report-dl-menu-wrap')?.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }
}

function exportReportCSV() {
  document.getElementById('report-dl-menu').style.display = 'none';
  const d = _reportData;
  if (!d) return;

  const now = new Date().toLocaleDateString();
  const rows = [];

  // Summary KPIs
  rows.push(['QHSE Task Performance Report', '', `Generated: ${now}`]);
  rows.push([]);
  rows.push(['SUMMARY']);
  rows.push(['Metric', 'Value', 'vs Last Month']);
  rows.push(['Total Tasks This Month', d.stats.totalThisMonth, (d.stats.totalDelta >= 0 ? '+' : '') + d.stats.totalDelta]);
  rows.push(['Completion Rate', d.stats.completionRate + '%', (d.stats.completionRateDelta >= 0 ? '+' : '') + d.stats.completionRateDelta + '%']);
  rows.push(['Avg Task Duration (h)', d.stats.avgDuration || '—', (d.stats.avgDurationDelta >= 0 ? '+' : '') + d.stats.avgDurationDelta + 'h']);
  rows.push(['Overdue Tasks', d.stats.overdueTotal, (d.stats.overdueDelta >= 0 ? '+' : '') + d.stats.overdueDelta]);
  rows.push([]);

  // Trend
  rows.push(['COMPLETION TREND (last 8 weeks)']);
  rows.push(['Week', 'Completed', 'Overdue']);
  (d.trend || []).forEach(r => rows.push([r.label, r.completed, r.overdue]));
  rows.push([]);

  // By Category
  rows.push(['BY CATEGORY']);
  rows.push(['Category', 'Total', 'Completed', 'Completion Rate']);
  (d.byCategory || []).forEach(c => rows.push([
    c.name, c.total, c.completed,
    c.total > 0 ? Math.round((c.completed / c.total) * 100) + '%' : '—',
  ]));

  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `QHSE_Report_${now.replace(/\//g,'-')}.csv` });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast('CSV downloaded', 'success');
}

function exportReportPDF() {
  document.getElementById('report-dl-menu').style.display = 'none';
  const d = _reportData;
  if (!d) return;

  const now = new Date().toLocaleDateString();

  const catRows = (d.byCategory || []).map(c => `
    <tr>
      <td>${escHtml(c.name)}</td>
      <td>${c.total}</td>
      <td>${c.completed}</td>
      <td>${c.total > 0 ? Math.round((c.completed / c.total) * 100) + '%' : '—'}</td>
    </tr>`).join('');

  const trendRows = (d.trend || []).map(r => `
    <tr>
      <td>${escHtml(r.label)}</td>
      <td>${r.completed}</td>
      <td>${r.overdue}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>QHSE Task Performance Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 36px 48px; }
  h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
  .subtitle { color: #64748b; font-size: 11px; margin-bottom: 28px; }
  .generated { font-size: 10px; color: #94a3b8; margin-bottom: 28px; }
  .kpi-row { display: flex; gap: 16px; margin-bottom: 28px; }
  .kpi { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; }
  .kpi-val { font-size: 22px; font-weight: 700; color: #0f172a; }
  .kpi-label { font-size: 10px; color: #64748b; margin-top: 2px; }
  .kpi-delta { font-size: 10px; margin-top: 4px; }
  .kpi-delta.up { color: #16a34a; } .kpi-delta.down { color: #dc2626; }
  h2 { font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 11px; }
  th { background: #f8fafc; text-align: left; padding: 7px 10px; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  .footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>QHSE Task Performance Report</h1>
<div class="subtitle">Performance & completion analytics</div>
<div class="generated">Generated on ${now}</div>

<div class="kpi-row">
  <div class="kpi">
    <div class="kpi-val">${d.stats.totalThisMonth}</div>
    <div class="kpi-label">Total Tasks This Month</div>
    <div class="kpi-delta ${d.stats.totalDelta >= 0 ? 'up' : 'down'}">${d.stats.totalDelta >= 0 ? '↑' : '↓'} ${Math.abs(d.stats.totalDelta)} vs last month</div>
  </div>
  <div class="kpi">
    <div class="kpi-val">${d.stats.completionRate}%</div>
    <div class="kpi-label">Completion Rate</div>
    <div class="kpi-delta ${d.stats.completionRateDelta >= 0 ? 'up' : 'down'}">${d.stats.completionRateDelta >= 0 ? '↑' : '↓'} ${Math.abs(d.stats.completionRateDelta)}% vs last month</div>
  </div>
  <div class="kpi">
    <div class="kpi-val">${d.stats.avgDuration > 0 ? d.stats.avgDuration + 'h' : '—'}</div>
    <div class="kpi-label">Avg Task Duration</div>
    <div class="kpi-delta">${d.stats.avgDuration > 0 ? (d.stats.avgDurationDelta >= 0 ? '↑' : '↓') + ' ' + Math.abs(d.stats.avgDurationDelta) + 'h vs last month' : 'No completed tasks yet'}</div>
  </div>
  <div class="kpi">
    <div class="kpi-val">${d.stats.overdueTotal}</div>
    <div class="kpi-label">Overdue Tasks</div>
    <div class="kpi-delta ${d.stats.overdueDelta <= 0 ? 'up' : 'down'}">${d.stats.overdueDelta >= 0 ? '↑' : '↓'} ${Math.abs(d.stats.overdueDelta)} vs last month</div>
  </div>
</div>

<h2>Completion Trend (Last 8 Weeks)</h2>
<table>
  <thead><tr><th>Week</th><th>Completed</th><th>Overdue</th></tr></thead>
  <tbody>${trendRows}</tbody>
</table>

<h2>By Category</h2>
<table>
  <thead><tr><th>Category</th><th>Total</th><th>Completed</th><th>Completion Rate</th></tr></thead>
  <tbody>${catRows}</tbody>
</table>

<div class="footer">TaskFlow Pro — QHSE Task Performance Dashboard · ${now}</div>
<script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}

let _trendPeriod = '7d';
let _trendOffset = 0;

function shiftTrend(dir) {
  // dir: -1 = go back, +1 = go forward
  _trendOffset = Math.max(0, _trendOffset - dir);
  switchTrendPeriod(_trendPeriod);
}

async function switchTrendPeriod(period, btn) {
  // Reset offset when period changes
  if (period !== _trendPeriod) _trendOffset = 0;
  _trendPeriod = period;

  document.querySelectorAll('.trend-period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else {
    const target = document.querySelector(`.trend-period-btn[data-period="${period}"]`);
    if (target) target.classList.add('active');
  }

  // Update nav controls
  const nextBtn = document.getElementById('trend-next-btn');
  if (nextBtn) nextBtn.disabled = _trendOffset === 0;
  const offsetLabel = document.getElementById('trend-offset-label');
  if (offsetLabel) {
    offsetLabel.textContent = _trendOffset === 0 ? 'Current'
      : _trendOffset === 1 ? 'Previous'
      : `${_trendOffset} periods ago`;
  }

  const area = document.getElementById('report-trend-area');
  if (!area) return;

  area.innerHTML = `<p class="text-muted text-xs" style="padding:24px 0;text-align:center">Loading…</p>`;

  try {
    const { trend } = await apiFetch(`/reports/trend?period=${period}&offset=${_trendOffset}`);
    if (!trend || !trend.length) {
      area.innerHTML = `<p class="text-muted text-xs" style="padding:24px 0">No data for this period.</p>`;
      return;
    }
    area.innerHTML = `<canvas id="report-trend-chart" height="200"></canvas>`;
    setTimeout(() => {
      drawLineChart('report-trend-chart', {
        labels:   trend.map(r => r.label),
        datasets: [
          { data: trend.map(r => r.completed), color: '#2563eb', label: 'Completed' },
          { data: trend.map(r => r.overdue),   color: '#dc2626', label: 'Overdue'   },
        ],
      });
    }, 20);
  } catch (err) {
    area.innerHTML = `<p class="text-muted text-xs" style="padding:24px 0;color:var(--c-red-500)">Failed to load trend data.</p>`;
  }
}

function getCanvas(id, height = 180) {
  const el = document.getElementById(id);
  if (!el) return null;
  const dpr = window.devicePixelRatio || 1;
  const w = el.parentElement.offsetWidth - 40;
  const h = height;
  el.width = w * dpr; el.height = h * dpr;
  el.style.width = w + 'px'; el.style.height = h + 'px';
  const ctx = el.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w, h };
}

function drawLineChart(id, { labels, datasets, noLegend = false, height = 160 }) {
  const c = getCanvas(id, height);
  if (!c) return;
  const { ctx, w, h } = c;
  const pad = { t: 16, r: 20, b: 36, l: 38 };
  const allVals = datasets.flatMap(d => d.data);
  const maxV = Math.max(...allVals) * 1.2 || 10;
  const xStep = (w - pad.l - pad.r) / (labels.length - 1);
  const yScale = v => pad.t + (1 - v / maxV) * (h - pad.t - pad.b);
  const xAt = i => pad.l + i * xStep;

  // Grid
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--clr-border') || '#e2e8f0';
  ctx.lineWidth = 1;
  [0, maxV * 0.5, maxV].forEach(v => {
    const y = yScale(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = '#94a3b8'; ctx.font = '9px Inter,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(v), pad.l - 4, y + 3);
  });

  // Labels
  ctx.fillStyle = '#94a3b8'; ctx.font = '9px Inter,sans-serif'; ctx.textAlign = 'center';
  labels.forEach((l, i) => ctx.fillText(l, xAt(i), h - 6));

  datasets.forEach(ds => {
    const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
    grad.addColorStop(0, ds.color + '30');
    grad.addColorStop(1, ds.color + '00');

    ctx.beginPath();
    ds.data.forEach((v, i) => i === 0 ? ctx.moveTo(xAt(i), yScale(v)) : ctx.lineTo(xAt(i), yScale(v)));
    ctx.lineTo(xAt(ds.data.length - 1), h - pad.b);
    ctx.lineTo(xAt(0), h - pad.b);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath(); ctx.strokeStyle = ds.color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ds.data.forEach((v, i) => i === 0 ? ctx.moveTo(xAt(i), yScale(v)) : ctx.lineTo(xAt(i), yScale(v)));
    ctx.stroke();

    // Dots
    ds.data.forEach((v, i) => {
      ctx.beginPath(); ctx.arc(xAt(i), yScale(v), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = ds.color; ctx.fill();
      ctx.beginPath(); ctx.arc(xAt(i), yScale(v), 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
    });
  });

  // Legend (in-canvas, only when noLegend is false)
  if (!noLegend) {
    let lx = pad.l;
    datasets.forEach(ds => {
      ctx.fillStyle = ds.color; ctx.fillRect(lx, h - pad.b + 10, 14, 3);
      ctx.fillStyle = '#64748b'; ctx.font = '9px Inter,sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(ds.label, lx + 18, h - pad.b + 14);
      lx += 90;
    });
  }
}

function drawBarChart(id, { labels, data, colors }) {
  const c = getCanvas(id, 160);
  if (!c) return;
  const { ctx, w, h } = c;
  const pad = { t: 12, r: 16, b: 30, l: 28 };
  const maxV = Math.max(...data) * 1.25 || 10;
  const slot = (w - pad.l - pad.r) / labels.length;
  const bw = Math.min(slot * 0.55, 40);
  const yScale = v => pad.t + (1 - v / maxV) * (h - pad.t - pad.b);

  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
  [0, maxV * 0.5, maxV].forEach(v => {
    const y = yScale(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = '#94a3b8'; ctx.font = '9px Inter,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(v), pad.l - 4, y + 3);
  });

  data.forEach((v, i) => {
    const x = pad.l + i * slot + (slot - bw) / 2;
    const y = yScale(v);
    const barH = h - pad.b - y;
    const grad = ctx.createLinearGradient(0, y, 0, h - pad.b);
    grad.addColorStop(0, colors[i]); grad.addColorStop(1, colors[i] + '66');
    roundRect(ctx, x, y, bw, barH, 5);
    ctx.fillStyle = grad; ctx.fill();
    ctx.fillStyle = colors[i]; ctx.font = 'bold 10px Inter,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(v, x + bw / 2, y - 4);
    ctx.fillStyle = '#94a3b8'; ctx.font = '9px Inter,sans-serif';
    ctx.fillText(labels[i], x + bw / 2, h - 8);
  });
}

function drawDonutChart(id, segments) {
  const c = getCanvas(id, 160);
  if (!c) return;
  const { ctx, w, h } = c;
  const total = segments.reduce((s, d) => s + d.value, 0);
  const cx = w * 0.38, cy = h / 2, r = Math.min(cx, cy) - 14, ir = r * 0.62;
  let angle = -Math.PI / 2;

  segments.forEach(seg => {
    const sweep = (seg.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = seg.color; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, ir, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--clr-surface') || '#fff';
    ctx.fill();
    angle += sweep;
  });

  // Center text
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--clr-text') || '#0f172a';
  ctx.font = `bold 18px Plus Jakarta Sans,sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(total, cx, cy + 6);
  ctx.fillStyle = '#94a3b8'; ctx.font = '9px Inter,sans-serif';
  ctx.fillText('total', cx, cy + 18);

  // Legend
  let ly = 16;
  segments.forEach(seg => {
    ctx.fillStyle = seg.color; ctx.fillRect(w * 0.66, ly, 10, 10);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--clr-text') || '#0f172a';
    ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${seg.label} (${seg.value})`, w * 0.66 + 14, ly + 9);
    ly += 22;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Toast ──────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const inner = document.getElementById('toast-inner');
  const msgEl = document.getElementById('toast-msg');
  const iconEl = document.getElementById('toast-icon');
  const colors = { success: '#059669', error: '#dc2626', info: '#2563eb', warning: '#d97706' };
  const icons  = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  inner.style.background = colors[type] || colors.info;
  iconEl.textContent = icons[type];
  msgEl.textContent = msg;
  toast.style.display = 'block';
  toast.style.transform = 'translateY(0)';
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(8px)'; setTimeout(() => toast.style.display = 'none', 300); }, 3000);
}

// ── Modal ──────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
  if (id === 'modal-submit') initSubmitTimeCalc();
}
function initSubmitTimeCalc() {
  const startEl = document.getElementById('submit-start-time');
  const endEl   = document.getElementById('submit-end-time');
  const hoursEl = document.getElementById('submit-hours');
  function calc() {
    const s = startEl?.value; const e = endEl?.value;
    if (!s || !e) return;
    const [sh, sm] = s.split(':').map(Number);
    const [eh, em] = e.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 1440;
    if (hoursEl) hoursEl.value = Math.round((diff / 60) * 10) / 10;
  }
  startEl?.addEventListener('change', calc);
  endEl?.addEventListener('change', calc);
}
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── Supervisor Task Review ─────────────────────────────────
let _reviewTaskId = null;
let _reviewSubmissionId = null;

async function openReviewModal(taskId, taskTitle) {
  _reviewTaskId = taskId;
  _reviewSubmissionId = null;

  // Reset modal state
  document.querySelectorAll('input[name="review-decision"]').forEach(r => r.checked = false);
  document.getElementById('review-reason-group').style.display = 'none';
  document.getElementById('review-reason').value = '';
  document.getElementById('review-task-title').textContent = taskTitle || 'Task';
  document.getElementById('review-submitted-by').textContent = 'Loading submission…';
  document.getElementById('review-remarks').textContent = '';
  document.getElementById('review-opt-approve').style.borderColor = 'var(--clr-border)';
  document.getElementById('review-opt-revision').style.borderColor = 'var(--clr-border)';
  openModal('modal-review');

  try {
    const data = await apiFetch(`/supervisor/tasks/${taskId}/submissions`);
    const latest = data.submissions[0];
    if (!latest) {
      document.getElementById('review-submitted-by').textContent = 'No submission found.';
      return;
    }
    _reviewSubmissionId = latest.submissionid;
    const submittedAt = latest.submittedat ? fmtDate(latest.submittedat) : '';
    document.getElementById('review-submitted-by').textContent =
      `Submitted by ${latest.submittedbyname}${submittedAt ? ' · ' + submittedAt : ''} · Status: ${latest.status}`;
    document.getElementById('review-remarks').textContent =
      latest.remarks ? `Remarks: ${latest.remarks}` :
      latest.unablereason ? `Unable reason: ${latest.unablereason}` : 'No remarks provided.';
  } catch (err) {
    document.getElementById('review-submitted-by').textContent = `Error: ${err.message}`;
  }
}

function reviewDecisionChanged(radio) {
  const group = document.getElementById('review-reason-group');
  group.style.display = radio.value === 'Revision' ? 'block' : 'none';
  document.getElementById('review-opt-approve').style.borderColor =
    radio.value === 'Approved' ? 'var(--c-green-500)' : 'var(--clr-border)';
  document.getElementById('review-opt-revision').style.borderColor =
    radio.value === 'Revision' ? 'var(--c-amber-500)' : 'var(--clr-border)';
}

async function submitReview() {
  const decision = document.querySelector('input[name="review-decision"]:checked')?.value;
  if (!decision) { showToast('Please select Approve or Request Revision', 'error'); return; }

  const reason = document.getElementById('review-reason').value.trim();
  if (decision === 'Revision' && !reason) { showToast('Please provide a reason for revision', 'error'); return; }

  const btn = document.getElementById('review-submit-btn');
  btn.disabled = true; btn.textContent = 'Submitting…';

  try {
    await apiFetch(`/supervisor/tasks/${_reviewTaskId}/review`, {
      method: 'POST',
      body: JSON.stringify({ submissionId: _reviewSubmissionId, decision, reason: reason || null }),
    });
    closeModal('modal-review');
    showToast(decision === 'Approved' ? 'Submission approved! Employee notified.' : 'Revision requested. Employee notified.', 'success');
    apiCache.dashboard = null;
    apiCache.tasks = [];
    await navigate('tasks');
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Submit Decision';
  }
}

// ── Theme Toggle ───────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const current = html.dataset.theme;
  const next = current === 'dark' ? 'light' : 'dark';
  html.dataset.theme = next;
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) themeIcon.innerHTML = next === 'dark'
    ? `<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>`
    : `<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>`;
  setTimeout(() => { if (state.currentPage === 'dashboard') drawHODCharts() || drawSupervisorCharts() || drawEmployeeCharts(); }, 80);
}

// ── Achievements ──────────────────────────────────────────

const BADGE_EMOJI = { star:'⭐', trophy:'🏆', medal:'🥇', rocket:'🚀', shield:'🛡️', fire:'🔥', heart:'❤️', crown:'👑' };

async function loadAchievementFeed() {
  const el = document.getElementById('achievement-feed-section');
  if (!el) return;
  try {
    const data = await apiFetch('/achievements?limit=20');
    apiCache.achievements = data.achievements || [];
    el.innerHTML = renderAchievementFeed(apiCache.achievements);
  } catch (err) {
    console.warn('Achievement feed failed:', err.message);
  }
}

function renderAchievementFeed(achievements) {
  const canDelete = state.role === 'supervisor' || state.role === 'hod' || state.role === 'admin';

  return `
  <div class="achievement-card-wrapper">
    <div class="card" style="position:relative;z-index:1">
    <div class="section-header mb-12">
      <div class="section-title">🏅 Employee Achievements</div>
      ${canDelete ? `<button class="btn btn-secondary btn-sm" onclick="openAwardAchievementModal()">${icon('star',13)} Award</button>` : ''}
    </div>
    ${achievements.length ? `
    <div class="achievement-feed">
      ${achievements.map(a => {
        const emoji = BADGE_EMOJI[a.badge] || '⭐';
        const badgeCls = `badge-${a.badge || 'star'}`;
        const recipientInitials = (a.username || '?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
        const recipientColor = `hsl(${(a.userid * 67) % 360},55%,45%)`;
        return `
        <div class="achievement-card">
          <div class="achievement-badge-icon ${badgeCls}">${emoji}</div>
          <div style="flex-shrink:0;margin-top:2px">${avatar(recipientInitials, recipientColor, 'sm')}</div>
          <div class="achievement-body">
            <div class="achievement-title">${escHtml(a.title)}</div>
            <div style="font-size:0.9rem;font-weight:700;color:var(--clr-primary);margin-top:3px">${escHtml(a.username)}</div>
            ${a.description ? `<div class="achievement-desc">${escHtml(a.description)}</div>` : ''}
            <div class="achievement-meta">
              ${a.designation || a.division ? `<span>${escHtml(a.designation || a.division)}</span><span>·</span>` : ''}
              <span>Awarded by <strong>${escHtml(a.awardedbyname)}</strong></span>
              <span>·</span>
              <span class="tabular-nums">${fmtDate(a.createdat)}</span>
            </div>
          </div>
          ${canDelete && parseInt(a.awardedby) === state.userId ? `
            <button class="achievement-delete-btn" onclick="deleteAchievement(${a.achievementid},this)" title="Remove">✕</button>
          ` : ''}
        </div>`;
      }).join('')}
    </div>` : `<p class="text-muted text-sm" style="padding:8px 0">No achievements awarded yet.</p>`}
  </div>
  </div>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function deleteAchievement(id, btn) {
  if (!confirm('Remove this achievement?')) return;
  btn.disabled = true;
  try {
    await apiFetch(`/achievements/${id}`, { method: 'DELETE' });
    apiCache.achievements = apiCache.achievements.filter(a => a.achievementid !== id);
    const el = document.getElementById('achievement-feed-section');
    if (el) el.innerHTML = renderAchievementFeed(apiCache.achievements);
    showToast('Achievement removed.', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to delete', 'error');
    btn.disabled = false;
  }
}

async function openAwardAchievementModal() {
  // Populate employee dropdown from team
  const select = document.getElementById('ach-userid');
  select.innerHTML = '<option value="">Select employee…</option>';
  try {
    const data = await apiFetch('/team');
    const employees = (data.users || []).filter(u => u.role === 'Employee');
    employees.forEach(u => {
      const o = document.createElement('option');
      o.value = u.userid;
      o.textContent = u.name + (u.designation ? ` — ${u.designation}` : '');
      select.appendChild(o);
    });
  } catch (e) { /* team list is optional */ }

  document.getElementById('ach-title').value = '';
  document.getElementById('ach-description').value = '';
  // reset badge selection to star
  document.querySelectorAll('#ach-badge-selector .badge-option').forEach(el => el.classList.remove('selected'));
  const star = document.querySelector('#ach-badge-selector .badge-option[data-badge="star"]');
  if (star) star.classList.add('selected');

  openModal('modal-award-achievement');
}

function selectBadge(el) {
  document.querySelectorAll('#ach-badge-selector .badge-option').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

async function submitAchievement() {
  const userid = parseInt(document.getElementById('ach-userid').value);
  const title   = document.getElementById('ach-title').value.trim();
  const desc    = document.getElementById('ach-description').value.trim();
  const badgeEl = document.querySelector('#ach-badge-selector .badge-option.selected');
  const badge   = badgeEl ? badgeEl.dataset.badge : 'star';

  if (!userid) { showToast('Please select an employee.', 'error'); return; }
  if (!title)  { showToast('Please enter an achievement title.', 'error'); return; }

  const btn = document.getElementById('ach-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await apiFetch('/achievements', {
      method: 'POST',
      body: JSON.stringify({ userid, title, description: desc || undefined, badge }),
    });
    closeModal('modal-award-achievement');
    showToast('Achievement awarded! 🏅', 'success');
    await loadAchievementFeed();
  } catch (err) {
    showToast(err.message || 'Failed to save achievement', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Award Achievement';
  }
}

// ── Auto-login for quick demo ──────────────────────────────
// Select HOD by default
document.addEventListener('DOMContentLoaded', () => {
  // Allow Enter key to submit login
  ['login-email','login-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  });
});
