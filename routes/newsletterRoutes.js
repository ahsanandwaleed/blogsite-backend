// ============================================
// NEWSLETTER ROUTES
// /api/newsletter
// ============================================

const express = require('express');
const router = express.Router();

// ─── Import Controller ────────────────────────
const {
  subscribe,
  verifySubscription,
  unsubscribe,
  getNewsletterStats,
  sendNewsletter,
  getAllSubscribers,
} = require('../controllers/newsletterController');

// ─── Import Middleware ────────────────────────
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const {
  validateNewsletter,
  sanitizeBody,
  formRateLimit,
} = require('../middleware/validationMiddleware');

// ─────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────

// @route   POST /api/newsletter/subscribe
// @desc    Subscribe to newsletter
// @access  Public (optionalAuth to link user)
router.post(
  '/subscribe',
  optionalAuth,
  sanitizeBody,
  formRateLimit('email'),
  validateNewsletter,
  subscribe
);

// @route   GET /api/newsletter/verify/:token
// @desc    Verify email subscription
// @access  Public
router.get('/verify/:token', verifySubscription);

// @route   GET /api/newsletter/unsubscribe/:token
// @desc    Unsubscribe from newsletter
// @access  Public
router.get('/unsubscribe/:token', unsubscribe);

// ─────────────────────────────────────────────
// ADMIN ONLY ROUTES
// ─────────────────────────────────────────────

// @route   GET /api/newsletter/stats
// @desc    Get newsletter statistics
// @access  Private (Admin)
router.get('/stats', protect, adminOnly, getNewsletterStats);

// @route   GET /api/newsletter/subscribers
// @desc    Get all subscribers
// @access  Private (Admin)
router.get('/subscribers', protect, adminOnly, getAllSubscribers);

// @route   POST /api/newsletter/send
// @desc    Send newsletter to all subscribers
// @access  Private (Admin)
router.post('/send', protect, adminOnly, sendNewsletter);

module.exports = router;