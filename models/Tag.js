// ============================================
// TAG MODEL
// MongoDB schema for blog post tags
// ============================================

const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema(
  {
    // ─── Basic Info ───────────────────────────────
    name: {
      type: String,
      required: [true, 'Tag name is required'],
      trim: true,
      unique: true,
      lowercase: true,
      minlength: [2, 'Tag name must be at least 2 characters'],
      maxlength: [30, 'Tag name cannot exceed 30 characters'],
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      maxlength: [200, 'Description cannot exceed 200 characters'],
      default: '',
    },

    // ─── Visual ───────────────────────────────────
    color: {
      type: String,
      default: '#64748b',
      match: [/^#[0-9A-Fa-f]{6}$/, 'Color must be valid hex code'],
    },

    // ─── Stats ────────────────────────────────────
    postsCount: {
      type: Number,
      default: 0,
    },

    usageCount: {
      type: Number,
      default: 0,
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

tagSchema.index({ slug: 1 });
tagSchema.index({ name: 1 });
tagSchema.index({ usageCount: -1 });
tagSchema.index({ isActive: 1 });

// ─────────────────────────────────────────────
// VIRTUAL FIELDS
// ─────────────────────────────────────────────

/**
 * Virtual: Tag page URL
 */
tagSchema.virtual('tagUrl').get(function () {
  return `/tag/${this.slug}`;
});

// ─────────────────────────────────────────────
// PRE-SAVE HOOKS
// ─────────────────────────────────────────────

/**
 * Auto-generate slug from name
 */
tagSchema.pre('save', async function (next) {
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
        .model('Tag')
        .findOne({ slug, _id: { $ne: this._id } });

      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;
    next();
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────

/**
 * Update post count for this tag
 */
tagSchema.methods.updatePostsCount = async function () {
  const count = await mongoose.model('Post').countDocuments({
    tags: this._id,
    status: 'published',
  });

  this.postsCount = count;
  this.usageCount = count;
  await this.save({ validateBeforeSave: false });
};

// ─────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────

/**
 * Find or create a tag by name
 * @param {string} name - Tag name
 * @param {string} userId - Creator user ID
 */
tagSchema.statics.findOrCreate = async function (name, userId) {
  const tagName = name.toLowerCase().trim();

  let tag = await this.findOne({ name: tagName });

  if (!tag) {
    tag = await this.create({
      name: tagName,
      createdBy: userId,
    });
    console.log(`🏷️ New tag created: ${tagName}`);
  }

  return tag;
};

/**
 * Get popular tags
 * @param {number} limit - Number of tags
 */
tagSchema.statics.getPopular = function (limit = 20) {
  return this.find({ isActive: true, postsCount: { $gt: 0 } })
    .sort({ usageCount: -1 })
    .limit(limit)
    .select('name slug color postsCount');
};

/**
 * Get featured tags
 * @param {number} limit - Number of tags
 */
tagSchema.statics.getFeatured = function (limit = 10) {
  return this.find({ isActive: true, isFeatured: true })
    .sort({ usageCount: -1 })
    .limit(limit)
    .select('name slug color postsCount');
};

/**
 * Get tags cloud data (all tags with sizes)
 */
tagSchema.statics.getTagCloud = async function () {
  const tags = await this.find({ isActive: true, postsCount: { $gt: 0 } })
    .sort({ postsCount: -1 })
    .limit(50)
    .select('name slug color postsCount');

  if (tags.length === 0) return [];

  // Calculate relative sizes for tag cloud
  const maxCount = tags[0].postsCount;
  const minCount = tags[tags.length - 1].postsCount;
  const range = maxCount - minCount || 1;

  return tags.map((tag) => ({
    ...tag.toObject(),
    size: Math.ceil(((tag.postsCount - minCount) / range) * 4) + 1,
    // size: 1 (smallest) to 5 (largest)
  }));
};

/**
 * Search tags by name
 * @param {string} query - Search query
 */
tagSchema.statics.search = function (query) {
  return this.find({
    name: { $regex: query, $options: 'i' },
    isActive: true,
  })
    .limit(10)
    .select('name slug color postsCount');
};

const Tag = mongoose.model('Tag', tagSchema);

module.exports = Tag;