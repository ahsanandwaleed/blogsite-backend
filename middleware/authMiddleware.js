// ============================================
// AUTH MIDDLEWARE
// Protect routes - verify JWT token
// ============================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect Route Middleware
 * Verifies JWT token from request header
 * Attaches user object to req.user
 */
const protect = async (req, res, next) => {
  let token;

  try {
    // ─── Check Authorization Header ──────────────
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // Extract token from "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];
    }

    // ─── Also Check Cookie (optional) ────────────
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // ─── No Token Found ───────────────────────────
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided. Please login first.',
      });
    }

    // ─── Verify Token ─────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // Handle specific JWT errors
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please login again.',
          code: 'TOKEN_EXPIRED',
        });
      }

      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please login again.',
          code: 'TOKEN_INVALID',
        });
      }

      throw jwtError;
    }

    // ─── Find User in Database ────────────────────
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists.',
        code: 'USER_NOT_FOUND',
      });
    }

    // ─── Check if User is Active ──────────────────
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Contact support.',
        code: 'ACCOUNT_BLOCKED',
      });
    }

    // ─── Check if Password Changed After Token ────
    if (user.passwordChangedAt) {
      const passwordChangedTime = parseInt(
        user.passwordChangedAt.getTime() / 1000,
        10
      );

      if (decoded.iat < passwordChangedTime) {
        return res.status(401).json({
          success: false,
          message: 'Password was recently changed. Please login again.',
          code: 'PASSWORD_CHANGED',
        });
      }
    }

    // ─── Attach User to Request ───────────────────
    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;

    console.log(`✅ Auth: User "${user.name}" accessing ${req.method} ${req.path}`);

    next();
  } catch (error) {
    console.error('❌ Auth Middleware Error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Authentication failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Optional Auth Middleware
 * Does NOT block request if no token
 * Just attaches user if token exists
 * Used for routes accessible by both guest and logged-in users
 */
const optionalAuth = async (req, res, next) => {
  let token;

  try {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      // No token - continue as guest
      req.user = null;
      req.userId = null;
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (user && !user.isBlocked) {
      req.user = user;
      req.userId = user._id;
      req.userRole = user.role;
    } else {
      req.user = null;
      req.userId = null;
    }

    next();
  } catch (error) {
    // Token invalid - continue as guest (don't block)
    req.user = null;
    req.userId = null;
    next();
  }
};

/**
 * Check Token Validity Without Blocking
 * Returns token status info
 */
const checkTokenStatus = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    req.tokenStatus = 'missing';
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.tokenStatus = 'valid';
    req.tokenPayload = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      req.tokenStatus = 'expired';
    } else {
      req.tokenStatus = 'invalid';
    }
    next();
  }
};

module.exports = {
  protect,
  optionalAuth,
  checkTokenStatus,
};