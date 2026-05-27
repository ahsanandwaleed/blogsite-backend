// ============================================
// USER ROUTES
// /api/users
// ============================================

const express = require('express');
const router = express.Router();

// ─── Import Controller ────────────────────────
const {
  getUserProfile,
  updateProfile,
  toggleBookmark,
  getBookmarks,
  deleteAccount,
  getAllUsers,
} = require('../controllers/userController');

// ─── Import Middleware ────────────────────────
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const { uploadAvatarMiddleware } = require('../middleware/uploadMiddleware');
const {
  validateProfileUpdate,
  sanitizeBody,
} = require('../middleware/validationMiddleware');

// ─────────────────────────────────────────────
// PROTECTED SELF ROUTES
// Logged in user managing their own account
// ─────────────────────────────────────────────

// @route   PUT /api/users/profile
// @desc    Update own profile
// @access  Private
router.put(
  '/profile',
  protect,
  uploadAvatarMiddleware,
  sanitizeBody,
  validateProfileUpdate,
  updateProfile
);

// @route   DELETE /api/users/account
// @desc    Delete own account
// @access  Private
router.delete('/account', protect, deleteAccount);

// ─────────────────────────────────────────────
// BOOKMARK ROUTES
// ─────────────────────────────────────────────

// @route   GET /api/users/bookmarks
// @desc    Get user's bookmarked posts
// @access  Private
router.get('/bookmarks', protect, getBookmarks);

// @route   POST /api/users/bookmarks/:postId
// @desc    Toggle bookmark on a post
// @access  Private
router.post('/bookmarks/:postId', protect, toggleBookmark);

// ─────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────

// @route   GET /api/users
// @desc    Get all users
// @access  Private (Admin)
router.get('/', protect, adminOnly, getAllUsers);

// ─────────────────────────────────────────────
// PUBLIC PROFILE ROUTES
// Must be after specific routes
// ─────────────────────────────────────────────

// @route   GET /api/users/:username
// @desc    Get user public profile
// @access  Public
router.get('/:username', getUserProfile);

module.exports = router;