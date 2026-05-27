// ============================================
// ADMIN ROUTES
// /api/admin
// All routes require admin access
// ============================================

const express = require('express');
const router = express.Router();

// ─── Import Controller ────────────────────────
const {
  getDashboardStats,
  getAdminUsers,
  toggleUserBlock,
  changeUserRole,
  deleteUser,
  getAdminPosts,
  toggleFeatured,
  getAdminComments,
  toggleCommentApproval,
  adminDeleteComment,
} = require('../controllers/adminController');

// ─── Import Middleware ────────────────────────
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');

// ─── Apply Auth to ALL Admin Routes ──────────
// Every route below requires: logged in + admin role
router.use(protect);
router.use(adminOnly);

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────

// @route   GET /api/admin/dashboard
// @desc    Get dashboard analytics and stats
// @access  Private (Admin)
router.get('/dashboard', getDashboardStats);

// ─────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────

// @route   GET /api/admin/users
// @desc    Get all users with filters
// @access  Private (Admin)
router.get('/users', getAdminUsers);

// @route   PUT /api/admin/users/:id/block
// @desc    Block or unblock a user
// @access  Private (Admin)
router.put('/users/:id/block', toggleUserBlock);

// @route   PUT /api/admin/users/:id/role
// @desc    Change user role
// @access  Private (Admin)
router.put('/users/:id/role', changeUserRole);

// @route   DELETE /api/admin/users/:id
// @desc    Delete user and all their content
// @access  Private (Admin)
router.delete('/users/:id', deleteUser);

// ─────────────────────────────────────────────
// POST MANAGEMENT
// ─────────────────────────────────────────────

// @route   GET /api/admin/posts
// @desc    Get all posts with filters
// @access  Private (Admin)
router.get('/posts', getAdminPosts);

// @route   PUT /api/admin/posts/:id/featured
// @desc    Toggle post featured status
// @access  Private (Admin)
router.put('/posts/:id/featured', toggleFeatured);

// ─────────────────────────────────────────────
// COMMENT MANAGEMENT
// ─────────────────────────────────────────────

// @route   GET /api/admin/comments
// @desc    Get comments (all/spam/reported)
// @access  Private (Admin)
router.get('/comments', getAdminComments);

// @route   PUT /api/admin/comments/:id/approve
// @desc    Approve or reject a comment
// @access  Private (Admin)
router.put('/comments/:id/approve', toggleCommentApproval);

// @route   DELETE /api/admin/comments/:id
// @desc    Delete a comment
// @access  Private (Admin)
router.delete('/comments/:id', adminDeleteComment);

module.exports = router;