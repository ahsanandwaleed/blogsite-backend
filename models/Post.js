// ============================================
// POST MODEL
// MongoDB schema for blog posts
// ============================================

const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    // ─── Content ──────────────────────────────────
    title: {
      type: String,
      required: [true, 'Post title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    excerpt: {
      type: String,
      maxlength: [500, 'Excerpt cannot exceed 500 characters'],
      default: '',
    },

    content: {
      type: String,
      required: [true, 'Post content is required'],
      minlength: [50, 'Content must be at least 50 characters'],
    },

    // ─── Media ────────────────────────────────────
    thumbnail: {
      type: String,
      default: '/assets/images/default-thumbnail.jpg',
    },

    thumbnailAlt: {
      type: String,
      default: 'Blog post thumbnail',
      maxlength: [150, 'Alt text cannot exceed 150 characters'],
    },

    // ─── Categorization ───────────────────────────
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },

    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag',
      },
    ],

    // ─── Author ───────────────────────────────────
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },

    // ─── Status & Visibility ──────────────────────
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'archived'],
        message: 'Status must be draft, published or archived',
      },
      default: 'draft',
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    isTrending: {
      type: Boolean,
      default: false,
    },

    isEditorsPick: {
      type: Boolean,
      default: false,
    },

    // ─── SEO Fields ───────────────────────────────
    metaTitle: {
      type: String,
      maxlength: [70, 'Meta title cannot exceed 70 characters'],
      default: '',
    },

    metaDescription: {
      type: String,
      maxlength: [160, 'Meta description cannot exceed 160 characters'],
      default: '',
    },

    metaKeywords: [
      {
        type: String,
        trim: true,
      },
    ],

    // ─── Engagement Stats ─────────────────────────
    views: {
      type: Number,
      default: 0,
    },

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    likesCount: {
      type: Number,
      default: 0,
    },

    commentsCount: {
      type: Number,
      default: 0,
    },

    sharesCount: {
      type: Number,
      default: 0,
    },

    bookmarksCount: {
      type: Number,
      default: 0,
    },

    // ─── Reading Info ─────────────────────────────
    readingTime: {
      type: String,
      default: '1 min read',
    },

    wordCount: {
      type: Number,
      default: 0,
    },

    // ─── Schedule Publishing ──────────────────────
    publishedAt: {
      type: Date,
      default: null,
    },

    scheduledFor: {
      type: Date,
      default: null,
    },

    // ─── Related Posts ────────────────────────────
    relatedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
      },
    ],

    // ─── Allow Comments ───────────────────────────
    allowComments: {
      type: Boolean,
      default: true,
    },
  },

  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────

postSchema.index({ slug: 1 });
postSchema.index({ author: 1 });
postSchema.index({ category: 1 });
postSchema.index({ status: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ views: -1 });
postSchema.index({ likesCount: -1 });
postSchema.index({ isFeatured: 1 });
postSchema.index({ isTrending: 1 });

// Full-text search index
postSchema.index(
  {
    title: 'text',
    content: 'text',
    excerpt: 'text',
  },
  {
    weights: {
      title: 10,    // Title has highest weight
      excerpt: 5,
      content: 1,
    },
    name: 'post_text_search',
  }
);

// ─────────────────────────────────────────────
// VIRTUAL FIELDS
// ─────────────────────────────────────────────

/**
 * Virtual: Get post comments
 */
postSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'post',
});

/**
 * Virtual: Full post URL
 */
postSchema.virtual('postUrl').get(function () {
  return `/blog/${this.slug}`;
});

/**
 * Virtual: Check if post is published
 */
postSchema.virtual('isPublished').get(function () {
  return this.status === 'published';
});

/**
 * Virtual: Thumbnail full URL
 */
postSchema.virtual('thumbnailUrl').get(function () {
  if (this.thumbnail && this.thumbnail.startsWith('http')) {
    return this.thumbnail;
  }
  return `${process.env.CLIENT_URL || ''}${this.thumbnail}`;
});

// ─────────────────────────────────────────────
// PRE-SAVE HOOKS
// ─────────────────────────────────────────────

/**
 * Auto-generate slug from title
 * Auto-generate excerpt from content
 * Calculate reading time and word count
 */
postSchema.pre('save', async function (next) {
  try {
    // ─── Generate Slug ────────────────────────────
    if (this.isModified('title')) {
      let baseSlug = this.title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');

      // Ensure unique slug
      let slug = baseSlug;
      let counter = 1;

      while (true) {
        const existing = await mongoose
          .model('Post')
          .findOne({ slug, _id: { $ne: this._id } });

        if (!existing) break;

        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      this.slug = slug;
    }

    // ─── Generate Excerpt ─────────────────────────
    if (this.isModified('content') && !this.excerpt) {
      // Strip HTML tags for excerpt
      const plainText = this.content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      this.excerpt = plainText.substring(0, 200) + '...';
    }

    // ─── Calculate Word Count ─────────────────────
    if (this.isModified('content')) {
      const plainText = this.content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      this.wordCount = plainText.split(' ').filter((w) => w.length > 0).length;
    }

    // ─── Calculate Reading Time ───────────────────
    if (this.isModified('content')) {
      const wordsPerMinute = 200;
      const minutes = Math.ceil(this.wordCount / wordsPerMinute);
      this.readingTime = minutes < 1 ? '< 1 min read' : `${minutes} min read`;
    }

    // ─── Set Published Date ───────────────────────
    if (
      this.isModified('status') &&
      this.status === 'published' &&
      !this.publishedAt
    ) {
      this.publishedAt = new Date();
    }

    // ─── Update Likes Count ───────────────────────
    if (this.isModified('likes')) {
      this.likesCount = this.likes.length;
    }

    // ─── Auto Meta Title ──────────────────────────
    if (!this.metaTitle && this.title) {
      this.metaTitle = this.title.substring(0, 70);
    }

    // ─── Auto Meta Description ────────────────────
    if (!this.metaDescription && this.excerpt) {
      this.metaDescription = this.excerpt.substring(0, 160);
    }

    next();
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────

/**
 * Increment view count
 */
postSchema.methods.incrementViews = async function () {
  this.views += 1;
  await this.save({ validateBeforeSave: false });
};

/**
 * Toggle like for a user
 * @param {string} userId - User ID
 * @returns {boolean} - True if liked, false if unliked
 */
postSchema.methods.toggleLike = async function (userId) {
  const index = this.likes.indexOf(userId);

  if (index === -1) {
    this.likes.push(userId);
    this.likesCount = this.likes.length;
    await this.save({ validateBeforeSave: false });
    return true; // Liked
  } else {
    this.likes.splice(index, 1);
    this.likesCount = this.likes.length;
    await this.save({ validateBeforeSave: false });
    return false; // Unliked
  }
};

/**
 * Check if user has liked this post
 * @param {string} userId - User ID
 * @returns {boolean}
 */
postSchema.methods.isLikedBy = function (userId) {
  return this.likes.includes(userId);
};

/**
 * Get post summary (for lists)
 */
postSchema.methods.getSummary = function () {
  return {
    _id: this._id,
    title: this.title,
    slug: this.slug,
    excerpt: this.excerpt,
    thumbnail: this.thumbnail,
    author: this.author,
    category: this.category,
    tags: this.tags,
    status: this.status,
    isFeatured: this.isFeatured,
    views: this.views,
    likesCount: this.likesCount,
    commentsCount: this.commentsCount,
    readingTime: this.readingTime,
    publishedAt: this.publishedAt,
    createdAt: this.createdAt,
  };
};

// ─────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────

/**
 * Get featured posts
 * @param {number} limit - Number of posts
 */
postSchema.statics.getFeatured = function (limit = 5) {
  return this.find({ status: 'published', isFeatured: true })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('author', 'name username avatar')
    .populate('category', 'name slug');
};

/**
 * Get trending posts (by views)
 * @param {number} limit - Number of posts
 * @param {number} days - Look back days
 */
postSchema.statics.getTrending = function (limit = 5, days = 7) {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  return this.find({
    status: 'published',
    publishedAt: { $gte: dateFrom },
  })
    .sort({ views: -1, likesCount: -1 })
    .limit(limit)
    .populate('author', 'name username avatar')
    .populate('category', 'name slug');
};

/**
 * Get latest published posts
 * @param {number} limit - Number of posts
 */
postSchema.statics.getLatest = function (limit = 10) {
  return this.find({ status: 'published' })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .populate('author', 'name username avatar')
    .populate('category', 'name slug');
};

/**
 * Search posts by keyword
 * @param {string} keyword - Search keyword
 * @param {object} options - Pagination options
 */
postSchema.statics.searchPosts = function (keyword, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  return this.find(
    {
      $text: { $search: keyword },
      status: 'published',
    },
    {
      score: { $meta: 'textScore' },
    }
  )
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(limit)
    .populate('author', 'name username avatar')
    .populate('category', 'name slug');
};

/**
 * Get posts by category
 * @param {string} categoryId - Category ID
 * @param {object} options - Pagination options
 */
postSchema.statics.getByCategory = function (categoryId, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  return this.find({
    category: categoryId,
    status: 'published',
  })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author', 'name username avatar')
    .populate('category', 'name slug');
};

/**
 * Get dashboard analytics stats
 */
postSchema.statics.getStats = async function () {
  const totalPosts = await this.countDocuments();
  const publishedPosts = await this.countDocuments({ status: 'published' });
  const draftPosts = await this.countDocuments({ status: 'draft' });

  const viewsResult = await this.aggregate([
    { $group: { _id: null, totalViews: { $sum: '$views' } } },
  ]);

  const totalViews = viewsResult[0]?.totalViews || 0;

  const newThisMonth = await this.countDocuments({
    createdAt: { $gte: new Date(new Date().setDate(1)) },
  });

  return {
    totalPosts,
    publishedPosts,
    draftPosts,
    totalViews,
    newThisMonth,
  };
};

const Post = mongoose.model('Post', postSchema);

module.exports = Post;