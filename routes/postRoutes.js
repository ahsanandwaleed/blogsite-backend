// ============================================
// POST ROUTES
// /api/posts
// ============================================

const express = require('express');
const router = express.Router();

// ─── Import Controller ────────────────────────
const {
  getAllPosts,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  getFeaturedPosts,
  getTrendingPosts,
  getLatestPosts,
  getRelatedPosts,
  getMyPosts,
  trackShare,
} = require('../controllers/postController');

// ─── Import Middleware ────────────────────────
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { uploadThumbnailMiddleware } = require('../middleware/uploadMiddleware');
const {
  validatePost,
  sanitizeBody,
} = require('../middleware/validationMiddleware');

// ─────────────────────────────────────────────
// SPECIAL ROUTES
// Must be before /:slug to avoid conflicts
// ─────────────────────────────────────────────

// @route   GET /api/posts/featured
// @desc    Get featured posts
// @access  Public
router.get('/featured', getFeaturedPosts);

// @route   GET /api/posts/trending
// @desc    Get trending posts
// @access  Public
router.get('/trending', getTrendingPosts);

// @route   GET /api/posts/latest
// @desc    Get latest posts
// @access  Public
router.get('/latest', getLatestPosts);

// @route   GET /api/posts/my-posts
// @desc    Get logged in user's posts
// @access  Private
router.get('/my-posts', protect, getMyPosts);

// ─────────────────────────────────────────────
// MAIN ROUTES
// ─────────────────────────────────────────────

// @route   GET /api/posts
// @desc    Get all posts with pagination
// @access  Public
router.get('/', optionalAuth, getAllPosts);

// @route   POST /api/posts
// @desc    Create new blog post
// @access  Private
router.post(
  '/',
  protect,
  uploadThumbnailMiddleware,
  sanitizeBody,
  validatePost,
  createPost
);

// ─────────────────────────────────────────────
// SINGLE POST ROUTES
// ─────────────────────────────────────────────

// @route   GET /api/posts/:slug
// @desc    Get single post by slug
// @access  Public (optionalAuth for like status)
router.get('/:slug', optionalAuth, getPostBySlug);

// @route   PUT /api/posts/:id
// @desc    Update blog post
// @access  Private
router.put(
  '/:id',
  protect,
  uploadThumbnailMiddleware,
  sanitizeBody,
  updatePost
);

// @route   DELETE /api/posts/:id
// @desc    Delete blog post
// @access  Private
router.delete('/:id', protect, deletePost);

// ─────────────────────────────────────────────
// POST ACTIONS
// ─────────────────────────────────────────────

// @route   PUT /api/posts/:id/like
// @desc    Like or unlike a post
// @access  Private
router.put('/:id/like', protect, toggleLike);

// @route   GET /api/posts/:id/related
// @desc    Get related posts
// @access  Public
router.get('/:id/related', getRelatedPosts);

// @route   POST /api/posts/:id/share
// @desc    Track post share
// @access  Public
router.post('/:id/share', trackShare);

module.exports = router;

// postRoutes.js
const {
  uploadThumbnailCloud,
} = require('../config/cloudinary');

// Use Cloudinary upload instead of local
router.post(
  '/',
  protect,
  uploadThumbnailCloud,   // ← Cloudinary middleware
  validatePost,
  createPost
);