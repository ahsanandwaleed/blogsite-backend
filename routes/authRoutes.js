// ============================================
// AUTH ROUTES
// /api/auth
// ============================================

const express = require('express');
const router = express.Router();

// ─── Import Controller ────────────────────────
const {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  refreshToken,
} = require('../controllers/authController');

// ─── Import Middleware ────────────────────────
const { protect } = require('../middleware/authMiddleware');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validatePasswordChange,
  sanitizeBody,
  formRateLimit,
} = require('../middleware/validationMiddleware');

// ─────────────────────────────────────────────
// PUBLIC ROUTES
// No authentication required
// ─────────────────────────────────────────────

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post(
  '/register',
  sanitizeBody,
  formRateLimit('email'),
  validateRegister,
  register
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  '/login',
  sanitizeBody,
  formRateLimit('email'),
  validateLogin,
  login
);

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post(
  '/forgot-password',
  sanitizeBody,
  formRateLimit('email'),
  validateForgotPassword,
  forgotPassword
);

// @route   POST /api/auth/reset-password/:token
// @desc    Reset password using token
// @access  Public
router.post(
  '/reset-password/:token',
  sanitizeBody,
  validateResetPassword,
  resetPassword
);

// @route   GET /api/auth/verify-email/:token
// @desc    Verify user email
// @access  Public
router.get('/verify-email/:token', verifyEmail);

// ─────────────────────────────────────────────
// PROTECTED ROUTES
// Authentication required
// ─────────────────────────────────────────────

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', protect, getMe);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, logout);

// @route   PUT /api/auth/change-password
// @desc    Change password
// @access  Private
router.put(
  '/change-password',
  protect,
  sanitizeBody,
  validatePasswordChange,
  changePassword
);

// @route   POST /api/auth/refresh-token
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh-token', protect, refreshToken);

module.exports = router;