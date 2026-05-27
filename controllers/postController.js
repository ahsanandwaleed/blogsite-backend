// ============================================
// POST CONTROLLER
// Handle blog post CRUD operations
// ============================================

const Post = require('../models/Post');
const User = require('../models/User');
const Category = require('../models/Category');
const Tag = require('../models/Tag');
const Comment = require('../models/Comment');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');
const { deleteFile } = require('../middleware/uploadMiddleware');
const { generateAndSaveSitemap } = require('../utils/generateSitemap');

// ─────────────────────────────────────────────
// @desc    Get all published posts (with pagination)
// @route   GET /api/posts
// @access  Public
// ─────────────────────────────────────────────
exports.getAllPosts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    tag,
    author,
    status = 'published',
    sort = '-publishedAt',
    featured,
  } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // ─── Build Filter ─────────────────────────────
  const filter = {};

  // Non-admin users can only see published posts
  if (req.user?.role !== 'admin') {
    filter.status = 'published';
  } else {
    if (status) filter.status = status;
  }

  if (category) filter.category = category;
  if (author) filter.author = author;
  if (featured === 'true') filter.isFeatured = true;

  // Filter by tag
  if (tag) {
    const tagDoc = await Tag.findOne({ slug: tag });
    if (tagDoc) filter.tags = tagDoc._id;
  }

  // ─── Execute Query ────────────────────────────
  const [posts, totalPosts] = await Promise.all([
    Post.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate('author', 'name username avatar')
      .populate('category', 'name slug color icon')
      .populate('tags', 'name slug color')
      .select('-content'), // Exclude full content for list view
    Post.countDocuments(filter),
  ]);

  // ─── Pagination Info ──────────────────────────
  const totalPages = Math.ceil(totalPosts / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  res.status(200).json({
    success: true,
    count: posts.length,
    totalPosts,
    totalPages,
    currentPage: pageNum,
    hasNextPage,
    hasPrevPage,
    posts,
  });
});

// ─────────────────────────────────────────────
// @desc    Get single post by slug
// @route   GET /api/posts/:slug
// @access  Public
// ─────────────────────────────────────────────
exports.getPostBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // ─── Find Post ────────────────────────────────
  const post = await Post.findOne({ slug })
    .populate('author', 'name username avatar bio socialLinks')
    .populate('category', 'name slug color icon')
    .populate('tags', 'name slug color')
    .populate({
      path: 'relatedPosts',
      select: 'title slug excerpt thumbnail readingTime publishedAt',
      populate: { path: 'author', select: 'name username' },
    });

  if (!post) {
    throw new AppError('Post not found.', 404);
  }

  // ─── Check Status ─────────────────────────────
  if (
    post.status !== 'published' &&
    req.user?.role !== 'admin' &&
    post.author._id.toString() !== req.user?._id?.toString()
  ) {
    throw new AppError('Post not found.', 404);
  }

  // ─── Increment Views ──────────────────────────
  await post.incrementViews();

  // ─── Check if Liked by Current User ──────────
  let isLiked = false;
  let isBookmarked = false;

  if (req.user) {
    isLiked = post.isLikedBy(req.user._id);

    const { Bookmark } = require('../models/Bookmark') || {};
    if (Bookmark) {
      isBookmarked = await require('../models/Bookmark').isBookmarked(
        req.user._id,
        post._id
      );
    }
  }

  res.status(200).json({
    success: true,
    post,
    isLiked,
    isBookmarked,
  });
});

// ─────────────────────────────────────────────
// @desc    Create new blog post
// @route   POST /api/posts
// @access  Private
// ─────────────────────────────────────────────
exports.createPost = asyncHandler(async (req, res) => {
  const {
    title,
    content,
    excerpt,
    category,
    tags,
    status,
    isFeatured,
    metaTitle,
    metaDescription,
    metaKeywords,
    allowComments,
    scheduledFor,
  } = req.body;

  // ─── Handle Tags ──────────────────────────────
  let tagIds = [];
  if (tags) {
    const tagNames = Array.isArray(tags) ? tags : tags.split(',');
    const tagDocs = await Promise.all(
      tagNames.map((name) => Tag.findOrCreate(name.trim(), req.userId))
    );
    tagIds = tagDocs.map((tag) => tag._id);
  }

  // ─── Handle Thumbnail ─────────────────────────
  let thumbnail = '/assets/images/default-thumbnail.jpg';
  if (req.file) {
    thumbnail = req.file.publicUrl;
  }

  // ─── Create Post ──────────────────────────────
  const post = await Post.create({
    title,
    content,
    excerpt,
    thumbnail,
    category,
    tags: tagIds,
    author: req.userId,
    status: status || 'draft',
    isFeatured: isFeatured === 'true',
    metaTitle,
    metaDescription,
    metaKeywords: metaKeywords
      ? metaKeywords.split(',').map((k) => k.trim())
      : [],
    allowComments: allowComments !== 'false',
    scheduledFor: scheduledFor || null,
  });

  // ─── Update Author's Post Count ───────────────
  await User.findByIdAndUpdate(req.userId, {
    $inc: { postsCount: 1 },
  });

  // ─── Update Category Post Count ───────────────
  const categoryDoc = await Category.findById(category);
  if (categoryDoc) await categoryDoc.updatePostsCount();

  // ─── Update Tag Post Counts ───────────────────
  await Promise.all(tagIds.map((id) => Tag.findById(id).then((t) => t?.updatePostsCount())));

  // ─── Regenerate Sitemap ───────────────────────
  if (post.status === 'published') {
    try {
      const [allPosts, allCategories] = await Promise.all([
        Post.find({ status: 'published' }).select('slug updatedAt isFeatured'),
        Category.find({ isActive: true }).select('slug updatedAt'),
      ]);
      generateAndSaveSitemap(allPosts, allCategories);
    } catch (sitemapError) {
      console.error('⚠️ Sitemap update failed:', sitemapError.message);
    }
  }

  // ─── Populate and Return ──────────────────────
  const populatedPost = await Post.findById(post._id)
    .populate('author', 'name username avatar')
    .populate('category', 'name slug color')
    .populate('tags', 'name slug color');

  console.log(`✅ Post created: "${title}" by ${req.user.name}`);

  res.status(201).json({
    success: true,
    message: 'Post created successfully!',
    post: populatedPost,
  });
});

// ─────────────────────────────────────────────
// @desc    Update blog post
// @route   PUT /api/posts/:id
// @access  Private (owner or admin)
// ─────────────────────────────────────────────
exports.updatePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // ─── Find Post ────────────────────────────────
  let post = await Post.findById(id);

  if (!post) {
    throw new AppError('Post not found.', 404);
  }

  // ─── Check Ownership ──────────────────────────
  if (
    post.author.toString() !== req.userId.toString() &&
    req.userRole !== 'admin'
  ) {
    throw new AppError(
      'Access denied. You can only edit your own posts.',
      403
    );
  }

  // ─── Handle Tags ──────────────────────────────
  if (req.body.tags) {
    const tagNames = Array.isArray(req.body.tags)
      ? req.body.tags
      : req.body.tags.split(',');

    const tagDocs = await Promise.all(
      tagNames.map((name) => Tag.findOrCreate(name.trim(), req.userId))
    );
    req.body.tags = tagDocs.map((tag) => tag._id);
  }

  // ─── Handle New Thumbnail ─────────────────────
  if (req.file) {
    // Delete old thumbnail (if not default)
    if (post.thumbnail && !post.thumbnail.includes('default-thumbnail')) {
      deleteFile(post.thumbnail);
    }
    req.body.thumbnail = req.file.publicUrl;
  }

  // ─── Handle Meta Keywords ─────────────────────
  if (req.body.metaKeywords && typeof req.body.metaKeywords === 'string') {
    req.body.metaKeywords = req.body.metaKeywords
      .split(',')
      .map((k) => k.trim());
  }

  // ─── Track Status Change ──────────────────────
  const wasPublished = post.status === 'published';
  const willPublish = req.body.status === 'published';

  // ─── Update Post ──────────────────────────────
  post = await Post.findByIdAndUpdate(
    id,
    { ...req.body },
    {
      new: true,         // Return updated doc
      runValidators: true,
    }
  )
    .populate('author', 'name username avatar')
    .populate('category', 'name slug color')
    .populate('tags', 'name slug color');

  // ─── Update Category Count If Changed ─────────
  if (req.body.category) {
    const newCategory = await Category.findById(req.body.category);
    if (newCategory) await newCategory.updatePostsCount();
  }

  // ─── Regenerate Sitemap ───────────────────────
  if (!wasPublished && willPublish) {
    try {
      const [allPosts, allCategories] = await Promise.all([
        Post.find({ status: 'published' }).select('slug updatedAt isFeatured'),
        Category.find({ isActive: true }).select('slug updatedAt'),
      ]);
      generateAndSaveSitemap(allPosts, allCategories);
    } catch (sitemapError) {
      console.error('⚠️ Sitemap update failed:', sitemapError.message);
    }
  }

  console.log(`✅ Post updated: "${post.title}"`);

  res.status(200).json({
    success: true,
    message: 'Post updated successfully!',
    post,
  });
});

// ─────────────────────────────────────────────
// @desc    Delete blog post
// @route   DELETE /api/posts/:id
// @access  Private (owner or admin)
// ─────────────────────────────────────────────
exports.deletePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // ─── Find Post ────────────────────────────────
  const post = await Post.findById(id);

  if (!post) {
    throw new AppError('Post not found.', 404);
  }

  // ─── Check Ownership ──────────────────────────
  if (
    post.author.toString() !== req.userId.toString() &&
    req.userRole !== 'admin'
  ) {
    throw new AppError('Access denied. You can only delete your own posts.', 403);
  }

  // ─── Delete Thumbnail ─────────────────────────
  if (post.thumbnail && !post.thumbnail.includes('default-thumbnail')) {
    deleteFile(post.thumbnail);
  }

  // ─── Delete All Comments ──────────────────────
  await Comment.deleteMany({ post: id });

  // ─── Delete Post ──────────────────────────────
  await Post.findByIdAndDelete(id);

  // ─── Update Author's Post Count ───────────────
  await User.findByIdAndUpdate(post.author, {
    $inc: { postsCount: -1 },
  });

  // ─── Update Category Count ────────────────────
  const category = await Category.findById(post.category);
  if (category) await category.updatePostsCount();

  console.log(`🗑️ Post deleted: "${post.title}"`);

  res.status(200).json({
    success: true,
    message: 'Post deleted successfully.',
  });
});

// ─────────────────────────────────────────────
// @desc    Like / Unlike a post
// @route   PUT /api/posts/:id/like
// @access  Private
// ─────────────────────────────────────────────
exports.toggleLike = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw new AppError('Post not found.', 404);
  }

  const isLiked = await post.toggleLike(req.userId);

  res.status(200).json({
    success: true,
    message: isLiked ? 'Post liked!' : 'Post unliked.',
    isLiked,
    likesCount: post.likesCount,
  });
});

// ─────────────────────────────────────────────
// @desc    Get featured posts
// @route   GET /api/posts/featured
// @access  Public
// ─────────────────────────────────────────────
exports.getFeaturedPosts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const posts = await Post.getFeatured(limit);

  res.status(200).json({
    success: true,
    count: posts.length,
    posts,
  });
});

// ─────────────────────────────────────────────
// @desc    Get trending posts
// @route   GET /api/posts/trending
// @access  Public
// ─────────────────────────────────────────────
exports.getTrendingPosts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const days = parseInt(req.query.days) || 7;
  const posts = await Post.getTrending(limit, days);

  res.status(200).json({
    success: true,
    count: posts.length,
    posts,
  });
});

// ─────────────────────────────────────────────
// @desc    Get latest posts
// @route   GET /api/posts/latest
// @access  Public
// ─────────────────────────────────────────────
exports.getLatestPosts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const posts = await Post.getLatest(limit);

  res.status(200).json({
    success: true,
    count: posts.length,
    posts,
  });
});

// ─────────────────────────────────────────────
// @desc    Get related posts
// @route   GET /api/posts/:id/related
// @access  Public
// ─────────────────────────────────────────────
exports.getRelatedPosts = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    throw new AppError('Post not found.', 404);
  }

  const limit = parseInt(req.query.limit) || 4;

  // Find posts with same category or tags
  const relatedPosts = await Post.find({
    _id: { $ne: post._id },
    status: 'published',
    $or: [
      { category: post.category },
      { tags: { $in: post.tags } },
    ],
  })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('author', 'name username avatar')
    .populate('category', 'name slug color')
    .select('title slug excerpt thumbnail readingTime publishedAt likesCount');

  res.status(200).json({
    success: true,
    count: relatedPosts.length,
    posts: relatedPosts,
  });
});

// ─────────────────────────────────────────────
// @desc    Get logged in user's posts
// @route   GET /api/posts/my-posts
// @access  Private
// ─────────────────────────────────────────────
exports.getMyPosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const filter = { author: req.userId };
  if (status) filter.status = status;

  const [posts, total] = await Promise.all([
    Post.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('category', 'name slug')
      .populate('tags', 'name slug')
      .select('-content'),
    Post.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: posts.length,
    totalPosts: total,
    totalPages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    posts,
  });
});

// ─────────────────────────────────────────────
// @desc    Track post share
// @route   POST /api/posts/:id/share
// @access  Public
// ─────────────────────────────────────────────
exports.trackShare = asyncHandler(async (req, res) => {
  await Post.findByIdAndUpdate(req.params.id, {
    $inc: { sharesCount: 1 },
  });

  res.status(200).json({
    success: true,
    message: 'Share tracked.',
  });
});

// postController.js
const {
  deleteFromCloudinary,
  getPublicIdFromUrl,
} = require('../config/cloudinary');

// When creating post
exports.createPost = asyncHandler(async (req, res) => {
  let thumbnail = '/assets/images/default-thumbnail.jpg';

  if (req.file) {
    // Cloudinary gives secure_url directly
    thumbnail = req.file.cloudinaryUrl;
  }

  const post = await Post.create({
    ...req.body,
    thumbnail,
    author: req.userId,
  });

  res.status(201).json({ success: true, post });
});

// When deleting post
exports.deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  // Delete image from Cloudinary
  if (post.thumbnail && post.thumbnail.includes('cloudinary.com')) {
    const publicId = getPublicIdFromUrl(post.thumbnail);
    await deleteFromCloudinary(publicId);
  }

  await Post.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Post deleted.',
  });
});