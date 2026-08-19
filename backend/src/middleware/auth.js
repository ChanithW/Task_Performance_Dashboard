const jwt = require('jsonwebtoken');

// In dev mode (DEV_USER_ID set in .env), skip JWT and use that user ID.
function authenticate(req, res, next) {
  if (process.env.DEV_USER_ID) {
    req.user = {
      userId: parseInt(process.env.DEV_USER_ID),
      role:   process.env.DEV_USER_ROLE || 'Employee',
    };
    return next();
  }

  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

function requireEmployee(req, res, next) {
  if (req.user.role !== 'Employee') {
    return res.status(403).json({ error: 'Employee access required' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, requireEmployee, requireAdmin };
