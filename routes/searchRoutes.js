// ============================================
// SEARCH ROUTES
// /api/search
// ============================================

const express = require('express');
const router = express.Router();

// ─── Import Controller ────────────────────────
const {
  globalSearch,
  getSearchSuggestions,
  getPostsByTag,
} = require('../controllers/searchController');

// ─────────────────────────────────────────────
// PUBLIC ROUTES
// All search routes are public
// ─────────────────────────────────────────────

// @route   GET /api/search
// @desc    Global search across posts, users, tags, categories
// @query   q=keyword&type=posts&page=1&limit=10
// @access  Public
router.get('/', globalSearch);

// @route   GET /api/search/suggestions
// @desc    Get autocomplete suggestions
// @query   q=keyword
// @access  Public
router.get('/suggestions', getSearchSuggestions);

// @route   GET /api/search/tag/:slug
// @desc    Get posts by tag slug
// @access  Public
router.get('/tag/:slug', getPostsByTag);

module.exports = router;