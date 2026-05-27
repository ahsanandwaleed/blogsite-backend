// ============================================
// BOOKMARK MODEL
// MongoDB schema for user bookmarked posts
// ============================================

const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
  {
    // ─── Relations ────────────────────────────────
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: [true, 'Post is required'],
    },

    // ─── Organization ─────────────────────────────
    collection: {
      type: String,
      trim: true,
      maxlength: [50, 'Collection name cannot exceed 50 characters'],
      default: 'General',
    },

    note: {
      type: String,
      maxlength: [300, 'Note cannot exceed 300 characters'],
      default: '',
    },

    // ─── Status ───────────────────────────────────
    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
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

// Compound index - one bookmark per user per post
bookmarkSchema.index({ user: 1, post: 1 }, { unique: true });
bookmarkSchema.index({ user: 1, collection: 1 });
bookmarkSchema.index({ user: 1, createdAt: -1 });
bookmarkSchema.index({ post: 1 });

// ─────────────────────────────────────────────
// PRE-SAVE HOOKS
// ─────────────────────────────────────────────

/**
 * After saving bookmark - update post's bookmarksCount
 * And add to user's bookmarks array
 */
bookmarkSchema.post('save', async function () {
  if (this.isNew) {
    try {
      // Update post bookmarks count
      await mongoose.model('Post').findByIdAndUpdate(this.post, {
        $inc: { bookmarksCount: 1 },
      });

      // Add to user bookmarks array
      await mongoose.model('User').findByIdAndUpdate(this.user, {
        $addToSet: { bookmarks: this.post },
      });

      console.log(`🔖 Bookmark saved for post: ${this.post}`);
    } catch (error) {
      console.error('❌ Error updating bookmark counts:', error.message);
    }
  }
});

/**
 * After deleting bookmark - update post's bookmarksCount
 * And remove from user's bookmarks array
 */
bookmarkSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    try {
      // Decrease post bookmarks count
      await mongoose.model('Post').findByIdAndUpdate(doc.post, {
        $inc: { bookmarksCount: -1 },
      });

      // Remove from user bookmarks array
      await mongoose.model('User').findByIdAndUpdate(doc.user, {
        $pull: { bookmarks: doc.post },
      });

      console.log(`🗑️ Bookmark removed for post: ${doc.post}`);
    } catch (error) {
      console.error('❌ Error updating bookmark counts after delete:', error.message);
    }
  }
});

// ─────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────

/**
 * Mark bookmark as read
 */
bookmarkSchema.methods.markAsRead = async function () {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    await this.save({ validateBeforeSave: false });
  }
};

/**
 * Update collection name
 * @param {string} collectionName - New collection name
 */
bookmarkSchema.methods.moveToCollection = async function (collectionName) {
  this.collection = collectionName;
  await this.save({ validateBeforeSave: false });
};

/**
 * Add note to bookmark
 * @param {string} noteText - Note text
 */
bookmarkSchema.methods.addNote = async function (noteText) {
  this.note = noteText;
  await this.save({ validateBeforeSave: false });
};

// ─────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────

/**
 * Get user's bookmarks with post details
 * @param {string} userId - User ID
 * @param {object} options - Query options
 */
bookmarkSchema.statics.getUserBookmarks = function (userId, options = {}) {
  const {
    page = 1,
    limit = 10,
    collection = null,
    isRead = null,
  } = options;

  const skip = (page - 1) * limit;

  // Build query filter
  const filter = { user: userId };
  if (collection) filter.collection = collection;
  if (isRead !== null) filter.isRead = isRead;

  return this.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: 'post',
      select: 'title slug excerpt thumbnail author category readingTime publishedAt',
      populate: [
        { path: 'author', select: 'name username avatar' },
        { path: 'category', select: 'name slug color' },
      ],
    });
};

/**
 * Check if user has bookmarked a post
 * @param {string} userId - User ID
 * @param {string} postId - Post ID
 * @returns {boolean}
 */
bookmarkSchema.statics.isBookmarked = async function (userId, postId) {
  const bookmark = await this.findOne({ user: userId, post: postId });
  return !!bookmark;
};

/**
 * Toggle bookmark for a user
 * @param {string} userId - User ID
 * @param {string} postId - Post ID
 * @returns {object} - Result with action and bookmark
 */
bookmarkSchema.statics.toggle = async function (userId, postId) {
  const existing = await this.findOne({ user: userId, post: postId });

  if (existing) {
    await this.findOneAndDelete({ user: userId, post: postId });
    return { action: 'removed', bookmarked: false };
  } else {
    const bookmark = await this.create({ user: userId, post: postId });
    return { action: 'added', bookmarked: true, bookmark };
  }
};

/**
 * Get user's bookmark collections list
 * @param {string} userId - User ID
 * @returns {Array} - List of collection names with counts
 */
bookmarkSchema.statics.getUserCollections = function (userId) {
  return this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$collection',
        count: { $sum: 1 },
        unreadCount: {
          $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        collection: '$_id',
        count: 1,
        unreadCount: 1,
        _id: 0,
      },
    },
    { $sort: { collection: 1 } },
  ]);
};

/**
 * Get bookmark stats for admin
 */
bookmarkSchema.statics.getStats = async function () {
  const total = await this.countDocuments();
  const unread = await this.countDocuments({ isRead: false });

  const topBookmarked = await this.aggregate([
    {
      $group: {
        _id: '$post',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'posts',
        localField: '_id',
        foreignField: '_id',
        as: 'post',
      },
    },
    {
      $project: {
        post: { $arrayElemAt: ['$post', 0] },
        bookmarkCount: '$count',
      },
    },
  ]);

  return { total, unread, topBookmarked };
};

const Bookmark = mongoose.model('Bookmark', bookmarkSchema);

module.exports = Bookmark;