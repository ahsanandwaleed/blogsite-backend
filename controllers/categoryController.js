// ============================================
// CATEGORY CONTROLLER
// Handle category CRUD operations
// ============================================

const Category = require('../models/Category');
const Post = require('../models/Post');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');

// ─────────────────────────────────────────────
// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
// ─────────────────────────────────────────────
exports.getAllCategories = asyncHandler(async (req, res) => {
  const { withCounts, featured } = req.query;

  let categories;

  if (withCounts === 'true') {
    // Get categories with live post counts
    categories = await Category.getCategoriesWithCounts();
  } else if (featured === 'true') {
    categories = await Category.getFeatured(6);
  } else {
    categories = await Category.getActiveCategories();
  }

  res.status(200).json({
    success: true,
    count: categories.length,
    categories,
  });
});

// ─────────────────────────────────────────────
// @desc    Get single category by slug
// @route   GET /api/categories/:slug
// @access  Public
// ─────────────────────────────────────────────
exports.getCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const category = await Category.findOne({ slug, isActive: true })
    .populate('subcategories', 'name slug color icon postsCount')
    .populate('parent', 'name slug');

  if (!category) {
    throw new AppError('Category not found.', 404);
  }

  // ─── Get Posts in Category ────────────────────
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const posts = await Post.getByCategory(category._id, { page, limit });
  const totalPosts = await Post.countDocuments({
    category: category._id,
    status: 'published',
  });

  res.status(200).json({
    success: true,
    category,
    posts,
    totalPosts,
    totalPages: Math.ceil(totalPosts / limit),
    currentPage: page,
  });
});

// ─────────────────────────────────────────────
// @desc    Create new category
// @route   POST /api/categories
// @access  Private (Admin only)
// ─────────────────────────────────────────────
exports.createCategory = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    color,
    icon,
    parent,
    isFeatured,
    sortOrder,
    metaTitle,
    metaDescription,
  } = req.body;

  // ─── Check Duplicate Name ─────────────────────
  const existing = await Category.findOne({
    name: { $regex: new RegExp(`^${name}$`, 'i') },
  });

  if (existing) {
    throw new AppError(`Category "${name}" already exists.`, 409);
  }

  // ─── Handle Cover Image ───────────────────────
  let coverImage = '';
  if (req.file) {
    coverImage = req.file.publicUrl;
  }

  // ─── Create Category ──────────────────────────
  const category = await Category.create({
    name,
    description,
    color: color || '#667eea',
    icon: icon || '📝',
    coverImage,
    parent: parent || null,
    isFeatured: isFeatured === 'true',
    sortOrder: sortOrder || 0,
    metaTitle,
    metaDescription,
    createdBy: req.userId,
  });

  console.log(`✅ Category created: "${name}"`);

  res.status(201).json({
    success: true,
    message: 'Category created successfully.',
    category,
  });
});

// ─────────────────────────────────────────────
// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private (Admin only)
// ─────────────────────────────────────────────
exports.updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await Category.findById(id);
  if (!category) {
    throw new AppError('Category not found.', 404);
  }

  // ─── Handle Cover Image ───────────────────────
  if (req.file) {
    req.body.coverImage = req.file.publicUrl;
  }

  const updatedCategory = await Category.findByIdAndUpdate(
    id,
    { ...req.body },
    { new: true, runValidators: true }
  );

  console.log(`✅ Category updated: "${updatedCategory.name}"`);

  res.status(200).json({
    success: true,
    message: 'Category updated successfully.',
    category: updatedCategory,
  });
});

// ─────────────────────────────────────────────
// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private (Admin only)
// ─────────────────────────────────────────────
exports.deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const category = await Category.findById(id);
  if (!category) {
    throw new AppError('Category not found.', 404);
  }

  // ─── Check if Category Has Posts ─────────────
  const postsCount = await Post.countDocuments({ category: id });
  if (postsCount > 0) {
    throw new AppError(
      `Cannot delete category with ${postsCount} posts. Reassign posts first.`,
      400
    );
  }

  await Category.findByIdAndDelete(id);

  console.log(`🗑️ Category deleted: "${category.name}"`);

  res.status(200).json({
    success: true,
    message: 'Category deleted successfully.',
  });
});

// ─────────────────────────────────────────────
// @desc    Toggle category active status
// @route   PUT /api/categories/:id/toggle
// @access  Private (Admin only)
// ─────────────────────────────────────────────
exports.toggleCategoryStatus = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    throw new AppError('Category not found.', 404);
  }

  category.isActive = !category.isActive;
  await category.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: `Category ${category.isActive ? 'activated' : 'deactivated'}.`,
    isActive: category.isActive,
  });
});