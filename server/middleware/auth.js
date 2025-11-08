// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_now';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/** Sign JWT */
function signToken(user) {
  return jwt.sign(
    { sub: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/** Verify token middleware (can be used directly as app.use(require('...')) ) */
async function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.sub).select('-password');
    if (!user) return res.status(401).json({ error: 'Invalid token - user not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Role guard factory */
function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden — insufficient role' });
    }
    next();
  };
}

/**
 * Compatibility export:
 * - default export is the verifyToken middleware function (so old `const auth = require('./auth')` still works)
 * - named exports are attached so `const { verifyToken, requireRole } = require('./auth')` also works
 */
module.exports = verifyToken;
module.exports.signToken = signToken;
module.exports.verifyToken = verifyToken;
module.exports.requireRole = requireRole;
