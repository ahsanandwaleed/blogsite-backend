// ============================================
// CATEGORY ROUTES
// /api/categories
// ============================================

const express = require('express');
const router = express.Router();

// ─── Import Controller ────────────────────────
const {
  getAllCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
} = require('../controllers/categoryController');

// ─── Import Middleware ────────────────────────
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const { uploadThumbnailMiddleware } = require('../middleware/uploadMiddleware');
const {
  validateCategory,
  sanitizeBody,
} = require('../middleware/validationMiddleware');

// ─────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────

// @route   GET /api/categories
// @desc    Get all active categories
// @access  Public
router.get('/', getAllCategories);

// @route   GET /api/categories/:slug
// @desc    Get single category with its posts
// @access  Public
router.get('/:slug', getCategoryBySlug);

// ─────────────────────────────────────────────
// ADMIN ONLY ROUTES
// ─────────────────────────────────────────────

// @route   POST /api/categories
// @desc    Create new category
// @access  Private (Admin)
router.post(
  '/',
  protect,
  adminOnly,
  uploadThumbnailMiddleware,
  sanitizeBody,
  validateCategory,
  createCategory
);

// @route   PUT /api/categories/:id
// @desc    Update category
// @access  Private (Admin)
router.put(
  '/:id',
  protect,
  adminOnly,
  uploadThumbnailMiddleware,
  sanitizeBody,
  updateCategory
);

// @route   DELETE /api/categories/:id
// @desc    Delete category
// @access  Private (Admin)
router.delete('/:id', protect, adminOnly, deleteCategory);

// @route   PUT /api/categories/:id/toggle
// @desc    Toggle category active status
// @access  Private (Admin)
router.put('/:id/toggle', protect, adminOnly, toggleCategoryStatus);

module.exports = router;