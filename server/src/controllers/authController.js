// Handles user logins, decoy account traps, session validation, and logouts
const User = require('../models/User');
const Event = require('../models/Event');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'deceptiguard_super_secret_jwt_key_2026';

class AuthController {
  // Authenticates employee accounts or triggers Rule R2 on fake decoy account logins
  static async login(req, res, rulesEngine) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const user = await User.findOne({ username });
      const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Browser';

      // 1. Trap Decoy Accounts (admin.backup)
      if (user && user.isDecoy) {
        const rawEvent = await Event.create({
          userId: user._id,
          username: user.username,
          role: user.role,
          action: 'LOGIN_FAILED',
          target: `Decoy Account Authentication (${user.username})`,
          ip,
          userAgent,
          metadata: { isDecoyAccount: true }
        });
        await rulesEngine.processEvent(rawEvent);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        const rawEvent = await Event.create({
          userId: user._id,
          username: user.username,
          role: user.role,
          action: 'LOGIN_FAILED',
          target: `/api/auth/login`,
          ip,
          userAgent
        });
        await rulesEngine.processEvent(rawEvent);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Successful login creates JWT token
      const token = jwt.sign(
        { userId: user._id, username: user.username, role: user.role, department: user.department },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      const rawEvent = await Event.create({
        userId: user._id,
        username: user.username,
        role: user.role,
        action: 'LOGIN_SUCCESS',
        target: `/portal/dashboard`,
        ip,
        userAgent
      });
      await rulesEngine.processEvent(rawEvent);

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 3600 * 1000
      });

      return res.json({
        message: 'Authentication successful',
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
          department: user.department,
          status: user.status,
          riskScore: user.riskScore
        },
        token
      });
    } catch (err) {
      console.error('[Auth Error]', err);
      res.status(500).json({ error: 'Internal authentication error' });
    }
  }

  // Returns the currently logged in user profile
  static async getMe(req, res) {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const user = await User.findById(req.user.userId).select('-passwordHash');
    res.json({ user });
  }

  // Logs out the active user and records the logout event
  static async logout(req, res, rulesEngine) {
    if (req.user) {
      const rawEvent = await Event.create({
        userId: req.user.userId,
        username: req.user.username,
        role: req.user.role,
        action: 'LOGOUT',
        target: `/api/auth/logout`,
        ip: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Browser'
      });
      await rulesEngine.processEvent(rawEvent);
    }
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
  }
}

module.exports = AuthController;
