// ============================================
// USER CONTROLLER
// Handle user profile and bookmarks
// ============================================

const User = require('../models/User');
const Post = require('../models/Post');
const Bookmark = require('../models/Bookmark');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');
const { deleteFile } = require('../middleware/uploadMiddleware');

// ─────────────────────────────────────────────
// @desc    Get user public profile
// @route   GET /api/users/:username
// @access  Public
// ─────────────────────────────────────────────
exports.getUserProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  const user = await User.findOne({ username })
    .select('-password -emailVerificationToken -passwordResetToken');

  if (!user || !user.isActive) {
    throw new AppError('User not found.', 404);
  }

  // ─── Get User's Published Posts ───────────────
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 9;
  const skip = (page - 1) * limit;

  const [posts, totalPosts] = await Promise.all([
    Post.find({ author: user._id, status: 'published' })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('category', 'name slug color')
      .select('title slug excerpt thumbnail readingTime publishedAt likesCount commentsCount views'),
    Post.countDocuments({ author: user._id, status: 'published' }),
  ]);

  res.status(200).json({
    success: true,
    user: user.getPublicProfile(),
    posts,
    totalPosts,
    totalPages: Math.ceil(totalPosts / limit),
    currentPage: page,
  });
});

// ─────────────────────────────────────────────
// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
// ─────────────────────────────────────────────
exports.updateProfile = asyncHandler(async (req, res) => {
  const {
    name,
    username,
    bio,
    website,
    socialLinks,
    newsletterSubscribed,
  } = req.body;

  // ─── Check Username Availability ─────────────
  if (username && username !== req.user.username) {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      throw new AppError('Username already taken. Please choose another.', 409);
    }
  }

  // ─── Build Update Object ──────────────────────
  const updateData = {};
  if (name) updateData.name = name;
  if (username) updateData.username = username;
  if (bio !== undefined) updateData.bio = bio;
  if (website !== undefined) updateData.website = website;
  if (newsletterSubscribed !== undefined) {
    updateData.newsletterSubscribed = newsletterSubscribed;
  }

  // ─── Handle Social Links ──────────────────────
  if (socialLinks) {
    updateData.socialLinks = {
      ...req.user.socialLinks,
      ...socialLinks,
    };
  }

  // ─── Handle Avatar Upload ─────────────────────
  if (req.file) {
    // Delete old avatar (if not default)
    if (
      req.user.avatar &&
      !req.user.avatar.includes('default-avatar')
    ) {
      deleteFile(req.user.avatar);
    }
    updateData.avatar = req.file.publicUrl;
  }

  // ─── Update User ──────────────────────────────
  const updatedUser = await User.findByIdAndUpdate(
    req.userId,
    { ...updateData },
    { new: true, runValidators: true }
  ).select('-password');

  console.log(`✅ Profile updated for: ${updatedUser.email}`);

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully.',
    user: updatedUser.getPublicProfile(),
  });
});

// ─────────────────────────────────────────────
// @desc    Toggle post bookmark
// @route   POST /api/users/bookmarks/:postId
// @access  Private
// ─────────────────────────────────────────────
exports.toggleBookmark = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  // ─── Check Post Exists ────────────────────────
  const post = await Post.findById(postId);
  if (!post || post.status !== 'published') {
    throw new AppError('Post not found.', 404);
  }

  // ─── Toggle Bookmark ──────────────────────────
  const result = await Bookmark.toggle(req.userId, postId);

  res.status(200).json({
    success: true,
    message: result.bookmarked ? 'Post bookmarked!' : 'Bookmark removed.',
    bookmarked: result.bookmarked,
  });
});

// ─────────────────────────────────────────────
// @desc    Get user's bookmarks
// @route   GET /api/users/bookmarks
// @access  Private
// ─────────────────────────────────────────────
exports.getBookmarks = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, collection } = req.query;

  const bookmarks = await Bookmark.getUserBookmarks(req.userId, {
    page: parseInt(page),
    limit: parseInt(limit),
    collection,
  });

  const total = await Bookmark.countDocuments({ user: req.userId });
  const collections = await Bookmark.getUserCollections(req.userId);

  res.status(200).json({
    success: true,
    count: bookmarks.length,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page),
    collections,
    bookmarks,
  });
});

// ─────────────────────────────────────────────
// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
// ─────────────────────────────────────────────
exports.deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const user = await User.findById(req.userId).select('+password');

  // ─── Verify Password ──────────────────────────
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Password is incorrect.', 401);
  }

  // ─── Anonymize User's Posts ───────────────────
  await Post.updateMany(
    { author: req.userId },
    { status: 'archived' }
  );

  // ─── Delete Bookmarks ─────────────────────────
  await Bookmark.deleteMany({ user: req.userId });

  // ─── Soft Delete User ─────────────────────────
  await User.findByIdAndUpdate(req.userId, {
    isActive: false,
    email: `deleted_${req.userId}@deleted.com`,
    name: 'Deleted User',
  });

  console.log(`🗑️ Account deleted for user: ${req.userId}`);

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully.',
  });
});

// ─────────────────────────────────────────────
// @desc    Get all users (admin)
// @route   GET /api/users
// @access  Private (Admin)
// ─────────────────────────────────────────────
exports.getAllUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    role,
    search,
    sort = '-createdAt',
  } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // ─── Build Filter ─────────────────────────────
  const filter = {};
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .select('-password'),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    totalPages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    users,
  });
});