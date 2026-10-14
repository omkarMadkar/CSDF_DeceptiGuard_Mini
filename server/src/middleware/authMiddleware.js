// Express middleware verifying JWT authentication tokens and enforcing user role access
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'deceptiguard_super_secret_jwt_key_2026';

// Validates the JWT token from Bearer header or cookie and attaches user payload to req.user
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Ensures the authenticated user possesses one of the allowed roles
function roleMiddleware(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
}

module.exports = {
  authMiddleware,
  roleMiddleware
};
