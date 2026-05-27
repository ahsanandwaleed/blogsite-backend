// ============================================
// ADMIN CONTROLLER
// Handle admin dashboard and management
// ============================================

const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Category = require('../models/Category');
const Newsletter = require('../models/Newsletter');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');

// ─────────────────────────────────────────────
// @desc    Get dashboard analytics
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
// ─────────────────────────────────────────────
exports.getDashboardStats = asyncHandler(async (req, res) => {
  // ─── Fetch All Stats in Parallel ──────────────
  const [
    userStats,
    postStats,
    commentStats,
    newsletterStats,
  ] = await Promise.all([
    User.getUserStats(),
    Post.getStats(),
    Comment.getStats(),
    Newsletter.getStats(),
  ]);

  // ─── Recent Activity ──────────────────────────
  const [recentPosts, recentUsers, recentComments] = await Promise.all([
    Post.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('author', 'name avatar')
      .populate('category', 'name')
      .select('title status views createdAt'),

    User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email avatar role createdAt'),

    Comment.find({ isApproved: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('author', 'name avatar')
      .populate('post', 'title slug')
      .select('text createdAt'),
  ]);

  // ─── Top Posts ────────────────────────────────
  const topPosts = await Post.find({ status: 'published' })
    .sort({ views: -1 })
    .limit(5)
    .select('title slug views likesCount commentsCount');

  // ─── Monthly Growth Data ──────────────────────
  const monthlyData = await Post.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
        },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  res.status(200).json({
    success: true,
    stats: {
      users: userStats,
      posts: postStats,
      comments: commentStats,
      newsletter: newsletterStats,
    },
    recentActivity: {
      posts: recentPosts,
      users: recentUsers,
      comments: recentComments,
    },
    topPosts,
    monthlyData,
  });
});

// ─────────────────────────────────────────────
// @desc    Get all users for admin management
// @route   GET /api/admin/users
// @access  Private (Admin)
// ─────────────────────────────────────────────
exports.getAdminUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    role,
    status,
    sort = '-createdAt',
  } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // ─── Build Filter ─────────────────────────────
  const filter = {};
  if (role) filter.role = role;

  if (status === 'blocked') filter.isBlocked = true;
  if (status === 'active') filter.isBlocked = false;
  if (status === 'verified') filter.isVerified = true;

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
      .select('-password -emailVerificationToken -passwordResetToken'),
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

// ─────────────────────────────────────────────
// @desc    Toggle user block status
// @route   PUT /api/admin/users/:id/block
// @access  Private (Admin)
// ─────────────────────────────────────────────
exports.toggleUserBlock = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // ─── Prevent Self Block ───────────────────────
  if (id === req.userId.toString()) {
    throw new AppError('You cannot block your own account.', 400);
  }

  const user = await User.findById(id);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  // ─── Prevent Blocking Another Admin ──────────
  if (user.role === 'admin') {
    throw new AppError('Cannot block another admin account.', 403);
  }

  user.isBlocked = !user.isBlocked;
  await user.save({ validateBeforeSave: false });

  console.log(
    `👑 Admin ${req.user.name} ${user.isBlocked ? 'blocked' : 'unblocked'} user: ${user.email}`
  );

  res.status(200).json({
    success: true,
    message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully.`,
    isBlocked: user.isBlocked,
  });
});

// ─────────────────────────────────────────────
// @desc    Change user role
// @route   PUT /api/admin/users/:id/role
// @access  Private (Admin)
// ─────────────────────────────────────────────
exports.changeUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles = ['user', 'admin', 'editor'];
  if (!validRoles.includes(role)) {
    throw new AppError(`Invalid role. Must be: ${validRoles.join(', ')}`, 400);
  }

  // ─── Prevent Self Role Change ─────────────────
  if (id === req.userId.toString()) {
    throw new AppError('You cannot change your own role.', 400);
  }

  const user = await User.findByIdAndUpdate(
    id,
    { role },
    { new: true }
  ).select('-password');

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  console.log(`👑 Role changed to "${role}" for user: ${user.email}`);

  res.status(200).json({
    success: true,
    message: `User role updated to "${role}".`,
    user,
  });
});

// ─────────────────────────────────────────────
// @desc    Admin delete user account
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
// ─────────────────────────────────────────────
exports.deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id === req.userId.toString()) {
    throw new AppError('You cannot delete your own account from here.', 400);
  }

  const user = await User.findById(id);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  // ─── Delete User's Content ────────────────────
  await Promise.all([
    Post.deleteMany({ author: id }),
    Comment.deleteMany({ author: id }),
  ]);

  await User.findByIdAndDelete(id);

  console.log(`🗑️ Admin deleted user: ${user.email}`);

  res.status(200).json({
    success: true,
    message: 'User and all their content deleted successfully.',
  });
});

// ─────────────────────────────────────────────
// @desc    Get all posts for admin management
// @route   GET /api/admin/posts
// @access  Private (Admin)
// ─────────────────────────────────────────────
exports.getAdminPosts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    search,
    category,
    sort = '-createdAt',
  } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // ─── Build Filter ─────────────────────────────
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
    ];
  }

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('author', 'name email username')
      .populate('category', 'name slug')
      .select('-content'),
    Post.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: posts.length,
    total,
    totalPages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    posts,
  });
});

// ─────────────────────────────────────────────
// @desc    Toggle post featured status
// @route   PUT /api/admin/posts/:id/featured
// @access  Private (Admin)
// ─────────────────────────────────────────────
exports.toggleFeatured = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw new AppError('Post not found.', 404);
  }

  post.isFeatured = !post.isFeatured;
  await post.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: `Post ${post.isFeatured ? 'marked as featured' : 'removed from featured'}.`,
    isFeatured: post.isFeatured,
  });
});

// ─────────────────────────────────────────────
// @desc    Get reported/spam comments
// @route   GET /api/admin/comments
// @access  Private (Admin)
// ─────────────────────────────────────────────
exports.getAdminComments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, filter: filterType } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // ─── Build Filter ─────────────────────────────
  const filter = {};
  if (filterType === 'spam') filter.isSpam = true;
  if (filterType === 'reported') filter.reportsCount = { $gt: 0 };
  if (filterType === 'pending') filter.isApproved = false;

  const [comments, total] = await Promise.all([
    Comment.find(filter)
      .sort({ reportsCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('author', 'name email avatar')
      .populate('post', 'title slug'),
    Comment.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: comments.length,
    total,
    totalPages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    comments,
  });
});

// ─────────────────────────────────────────────
// @desc    Approve or reject comment
// @route   PUT /api/admin/comments/:id/approve
// @access  Private (Admin)
// ─────────────────────────────────────────────
exports.toggleCommentApproval = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    throw new AppError('Comment not found.', 404);
  }

  comment.isApproved = !comment.isApproved;
  comment.isSpam = false;
  await comment.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: `Comment ${comment.isApproved ? 'approved' : 'disapproved'}.`,
    isApproved: comment.isApproved,
  });
});

// ─────────────────────────────────────────────
// @desc    Admin delete comment
// @route   DELETE /api/admin/comments/:id
// @access  Private (Admin)
// ─────────────────────────────────────────────
exports.adminDeleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    throw new AppError('Comment not found.', 404);
  }

  // Delete replies too
  if (!comment.parentComment) {
    await Comment.deleteMany({ parentComment: comment._id });
  }

  await Comment.findOneAndDelete({ _id: req.params.id });

  res.status(200).json({
    success: true,
    message: 'Comment deleted by admin.',
  });
});