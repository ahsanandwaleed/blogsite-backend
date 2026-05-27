// ============================================
// CATEGORY MODEL
// MongoDB schema for blog post categories
// ============================================

const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    // ─── Basic Info ───────────────────────────────
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      unique: true,
      minlength: [2, 'Category name must be at least 2 characters'],
      maxlength: [50, 'Category name cannot exceed 50 characters'],
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: '',
    },

    // ─── Visual ───────────────────────────────────
    color: {
      type: String,
      default: '#667eea', // Default gradient color
      match: [/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code'],
    },

    icon: {
      type: String,
      default: '📝', // Default emoji icon
    },

    coverImage: {
      type: String,
      default: '',
    },

    // ─── Parent Category (for sub-categories) ────
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },

    // ─── Status ───────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    // ─── Stats ────────────────────────────────────
    postsCount: {
      type: Number,
      default: 0,
    },

    // ─── SEO ──────────────────────────────────────
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

    // ─── Order ────────────────────────────────────
    sortOrder: {
      type: Number,
      default: 0,
    },

    // ─── Created By ───────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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

categorySchema.index({ slug: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ isFeatured: 1 });
categorySchema.index({ sortOrder: 1 });
categorySchema.index({ parent: 1 });

// ─────────────────────────────────────────────
// VIRTUAL FIELDS
// ─────────────────────────────────────────────

/**
 * Virtual: Get subcategories
 */
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
});

/**
 * Virtual: Category page URL
 */
categorySchema.virtual('categoryUrl').get(function () {
  return `/category/${this.slug}`;
});

// ─────────────────────────────────────────────
// PRE-SAVE HOOKS
// ─────────────────────────────────────────────

/**
 * Auto-generate slug from name
 */
categorySchema.pre('save', async function (next) {
  if (!this.isModified('name')) return next();

  try {
    let baseSlug = this.name
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
        .model('Category')
        .findOne({ slug, _id: { $ne: this._id } });

      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;

    // Auto set meta fields
    if (!this.metaTitle) {
      this.metaTitle = `${this.name} - Blog Posts`;
    }

    if (!this.metaDescription && this.description) {
      this.metaDescription = this.description.substring(0, 160);
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
 * Update post count for this category
 */
categorySchema.methods.updatePostsCount = async function () {
  const count = await mongoose.model('Post').countDocuments({
    category: this._id,
    status: 'published',
  });

  this.postsCount = count;
  await this.save({ validateBeforeSave: false });
};

// ─────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────

/**
 * Get all active categories with post count
 */
categorySchema.statics.getActiveCategories = function () {
  return this.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .select('name slug description color icon postsCount isFeatured');
};

/**
 * Get featured categories
 * @param {number} limit - Number of categories
 */
categorySchema.statics.getFeatured = function (limit = 6) {
  return this.find({ isActive: true, isFeatured: true })
    .sort({ sortOrder: 1 })
    .limit(limit)
    .select('name slug description color icon postsCount');
};

/**
 * Get categories with their post counts (updated)
 */
categorySchema.statics.getCategoriesWithCounts = async function () {
  return this.aggregate([
    {
      $match: { isActive: true },
    },
    {
      $lookup: {
        from: 'posts',
        let: { categoryId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$category', '$$categoryId'] },
              status: 'published',
            },
          },
          { $count: 'count' },
        ],
        as: 'postStats',
      },
    },
    {
      $addFields: {
        postsCount: {
          $ifNull: [{ $arrayElemAt: ['$postStats.count', 0] }, 0],
        },
      },
    },
    {
      $project: { postStats: 0 },
    },
    {
      $sort: { sortOrder: 1, name: 1 },
    },
  ]);
};

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;