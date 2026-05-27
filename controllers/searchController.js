// ============================================
// SEARCH CONTROLLER
// Handle search functionality
// ============================================

const Post = require('../models/Post');
const User = require('../models/User');
const Tag = require('../models/Tag');
const Category = require('../models/Category');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');

// ─────────────────────────────────────────────
// @desc    Global search
// @route   GET /api/search?q=keyword
// @access  Public
// ─────────────────────────────────────────────
exports.globalSearch = asyncHandler(async (req, res) => {
  const { q, type, page = 1, limit = 10 } = req.query;

  // ─── Validate Query ───────────────────────────
  if (!q || q.trim().length < 2) {
    throw new AppError('Search query must be at least 2 characters.', 400);
  }

  const keyword = q.trim();
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  let results = {};

  if (!type || type === 'posts') {
    // ─── Search Posts ──────────────────────────
    const postFilter = {
      status: 'published',
      $or: [
        { title: { $regex: keyword, $options: 'i' } },
        { excerpt: { $regex: keyword, $options: 'i' } },
        { content: { $regex: keyword, $options: 'i' } },
      ],
    };

    const [posts, totalPosts] = await Promise.all([
      Post.find(postFilter)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('author', 'name username avatar')
        .populate('category', 'name slug color')
        .select('title slug excerpt thumbnail readingTime publishedAt views likesCount'),
      Post.countDocuments(postFilter),
    ]);

    results.posts = {
      items: posts,
      total: totalPosts,
      totalPages: Math.ceil(totalPosts / limitNum),
      currentPage: pageNum,
    };
  }

  if (!type || type === 'users') {
    // ─── Search Users ──────────────────────────
    const users = await User.find({
      isActive: true,
      $or: [
        { name: { $regex: keyword, $options: 'i' } },
        { username: { $regex: keyword, $options: 'i' } },
        { bio: { $regex: keyword, $options: 'i' } },
      ],
    })
      .limit(5)
      .select('name username avatar bio postsCount');

    results.users = { items: users, total: users.length };
  }

  if (!type || type === 'tags') {
    // ─── Search Tags ───────────────────────────
    const tags = await Tag.search(keyword);
    results.tags = { items: tags, total: tags.length };
  }

  if (!type || type === 'categories') {
    // ─── Search Categories ─────────────────────
    const categories = await Category.find({
      isActive: true,
      $or: [
        { name: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
      ],
    })
      .limit(5)
      .select('name slug description color icon postsCount');

    results.categories = { items: categories, total: categories.length };
  }

  // ─── Calculate Total Results ──────────────────
  const totalResults =
    (results.posts?.total || 0) +
    (results.users?.total || 0) +
    (results.tags?.total || 0) +
    (results.categories?.total || 0);

  console.log(`🔍 Search: "${keyword}" → ${totalResults} results`);

  res.status(200).json({
    success: true,
    keyword,
    totalResults,
    results,
  });
});

// ─────────────────────────────────────────────
// @desc    Search suggestions (autocomplete)
// @route   GET /api/search/suggestions?q=keyword
// @access  Public
// ─────────────────────────────────────────────
exports.getSearchSuggestions = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 1) {
    return res.status(200).json({
      success: true,
      suggestions: [],
    });
  }

  const keyword = q.trim();

  // ─── Get Suggestions from Multiple Sources ────
  const [postTitles, tagNames, categoryNames] = await Promise.all([
    Post.find({
      status: 'published',
      title: { $regex: keyword, $options: 'i' },
    })
      .limit(5)
      .select('title slug'),

    Tag.find({
      isActive: true,
      name: { $regex: keyword, $options: 'i' },
    })
      .limit(3)
      .select('name slug'),

    Category.find({
      isActive: true,
      name: { $regex: keyword, $options: 'i' },
    })
      .limit(3)
      .select('name slug'),
  ]);

  // ─── Format Suggestions ───────────────────────
  const suggestions = [
    ...postTitles.map((p) => ({
      text: p.title,
      type: 'post',
      slug: p.slug,
      url: `/pages/single-post.html?slug=${p.slug}`,
    })),
    ...tagNames.map((t) => ({
      text: t.name,
      type: 'tag',
      slug: t.slug,
      url: `/pages/search.html?tag=${t.slug}`,
    })),
    ...categoryNames.map((c) => ({
      text: c.name,
      type: 'category',
      slug: c.slug,
      url: `/pages/category.html?slug=${c.slug}`,
    })),
  ];

  res.status(200).json({
    success: true,
    keyword,
    suggestions,
  });
});

// ─────────────────────────────────────────────
// @desc    Get posts by tag
// @route   GET /api/search/tag/:slug
// @access  Public
// ─────────────────────────────────────────────
exports.getPostsByTag = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // ─── Find Tag ─────────────────────────────────
  const tag = await Tag.findOne({ slug, isActive: true });
  if (!tag) {
    throw new AppError('Tag not found.', 404);
  }

  // ─── Get Posts with Tag ───────────────────────
  const [posts, total] = await Promise.all([
    Post.find({ tags: tag._id, status: 'published' })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'name username avatar')
      .populate('category', 'name slug color')
      .select('title slug excerpt thumbnail readingTime publishedAt likesCount commentsCount'),
    Post.countDocuments({ tags: tag._id, status: 'published' }),
  ]);

  res.status(200).json({
    success: true,
    tag,
    count: posts.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    posts,
  });
});