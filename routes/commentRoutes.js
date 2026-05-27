// ============================================
// COMMENT ROUTES
// /api/comments
// ============================================

const express = require('express');
const router = express.Router();

// ─── Import Controller ────────────────────────
const {
  getPostComments,
  addComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
  reportComment,
} = require('../controllers/commentController');

// ─── Import Middleware ────────────────────────
const { protect } = require('../middleware/authMiddleware');
const {
  validateComment,
  sanitizeBody,
} = require('../middleware/validationMiddleware');

// ─────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────

// @route   GET /api/comments/:postId
// @desc    Get comments for a specific post
// @access  Public
router.get('/:postId', getPostComments);

// ─────────────────────────────────────────────
// PROTECTED ROUTES
// ─────────────────────────────────────────────

// @route   POST /api/comments
// @desc    Add comment to a post
// @access  Private
router.post(
  '/',
  protect,
  sanitizeBody,
  validateComment,
  addComment
);

// @route   PUT /api/comments/:id
// @desc    Update a comment
// @access  Private (owner only)
router.put('/:id', protect, sanitizeBody, updateComment);

// @route   DELETE /api/comments/:id
// @desc    Delete a comment
// @access  Private (owner or admin)
router.delete('/:id', protect, deleteComment);

// ─────────────────────────────────────────────
// COMMENT ACTIONS
// ─────────────────────────────────────────────

// @route   PUT /api/comments/:id/like
// @desc    Like or unlike a comment
// @access  Private
router.put('/:id/like', protect, toggleCommentLike);

// @route   POST /api/comments/:id/report
// @desc    Report a comment as spam
// @access  Private
router.post('/:id/report', protect, reportComment);

module.exports = router;