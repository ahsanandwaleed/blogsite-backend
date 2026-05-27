// ============================================
// COMMENT MODEL
// MongoDB schema for post comments
// ============================================

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    // ─── Content ──────────────────────────────────
    text: {
      type: String,
      required: [true, 'Comment text is required'],
      trim: true,
      minlength: [2, 'Comment must be at least 2 characters'],
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },

    // ─── Relations ────────────────────────────────
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: [true, 'Post reference is required'],
      index: true,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Comment author is required'],
    },

    // ─── Nested Comments (Replies) ────────────────
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },

    replies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
      },
    ],

    repliesCount: {
      type: Number,
      default: 0,
    },

    // ─── Engagement ───────────────────────────────
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

    // ─── Status ───────────────────────────────────
    isApproved: {
      type: Boolean,
      default: true, // Auto-approve comments
    },

    isSpam: {
      type: Boolean,
      default: false,
    },

    isEdited: {
      type: Boolean,
      default: false,
    },

    editedAt: {
      type: Date,
      default: null,
    },

    // ─── Moderation ───────────────────────────────
    reportedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    reportsCount: {
      type: Number,
      default: 0,
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

commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ author: 1 });
commentSchema.index({ parentComment: 1 });
commentSchema.index({ isApproved: 1 });
commentSchema.index({ isSpam: 1 });

// ─────────────────────────────────────────────
// PRE-SAVE HOOKS
// ─────────────────────────────────────────────

/**
 * Update likes count when likes array changes
 */
commentSchema.pre('save', function (next) {
  if (this.isModified('likes')) {
    this.likesCount = this.likes.length;
  }

  if (this.isModified('reportedBy')) {
    this.reportsCount = this.reportedBy.length;
  }

  next();
});

/**
 * After saving comment - update post's commentsCount
 */
commentSchema.post('save', async function () {
  try {
    if (this.isNew && !this.parentComment) {
      // Only count top-level comments for post
      const count = await mongoose.model('Comment').countDocuments({
        post: this.post,
        parentComment: null,
        isApproved: true,
        isSpam: false,
      });

      await mongoose.model('Post').findByIdAndUpdate(this.post, {
        commentsCount: count,
      });
    }
  } catch (error) {
    console.error('❌ Error updating post comments count:', error.message);
  }
});

/**
 * After deleting comment - update post's commentsCount
 */
commentSchema.post('findOneAndDelete', async function (doc) {
  if (doc && !doc.parentComment) {
    try {
      const count = await mongoose.model('Comment').countDocuments({
        post: doc.post,
        parentComment: null,
        isApproved: true,
        isSpam: false,
      });

      await mongoose.model('Post').findByIdAndUpdate(doc.post, {
        commentsCount: count,
      });
    } catch (error) {
      console.error('❌ Error updating post comments count:', error.message);
    }
  }
});

// ─────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────

/**
 * Toggle like on comment
 * @param {string} userId - User ID
 * @returns {boolean} - True if liked, false if unliked
 */
commentSchema.methods.toggleLike = async function (userId) {
  const index = this.likes.indexOf(userId);

  if (index === -1) {
    this.likes.push(userId);
    this.likesCount = this.likes.length;
    await this.save({ validateBeforeSave: false });
    return true;
  } else {
    this.likes.splice(index, 1);
    this.likesCount = this.likes.length;
    await this.save({ validateBeforeSave: false });
    return false;
  }
};

/**
 * Report comment as spam
 * @param {string} userId - Reporting user's ID
 * @returns {boolean} - True if reported
 */
commentSchema.methods.report = async function (userId) {
  if (this.reportedBy.includes(userId)) {
    return false; // Already reported
  }

  this.reportedBy.push(userId);
  this.reportsCount = this.reportedBy.length;

  // Auto mark as spam if reported 5+ times
  if (this.reportsCount >= 5) {
    this.isSpam = true;
    this.isApproved = false;
  }

  await this.save({ validateBeforeSave: false });
  return true;
};

/**
 * Edit comment text
 * @param {string} newText - Updated text
 */
commentSchema.methods.edit = async function (newText) {
  this.text = newText;
  this.isEdited = true;
  this.editedAt = new Date();
  await this.save();
};

// ─────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────

/**
 * Get comments for a post with replies
 * @param {string} postId - Post ID
 * @param {number} page - Page number
 * @param {number} limit - Comments per page
 */
commentSchema.statics.getPostComments = function (postId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  return this.find({
    post: postId,
    parentComment: null, // Only top-level comments
    isApproved: true,
    isSpam: false,
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author', 'name username avatar')
    .populate({
      path: 'replies',
      match: { isApproved: true, isSpam: false },
      populate: {
        path: 'author',
        select: 'name username avatar',
      },
      options: { sort: { createdAt: 1 } },
    });
};

/**
 * Get total approved comments stats
 */
commentSchema.statics.getStats = async function () {
  const total = await this.countDocuments();
  const approved = await this.countDocuments({ isApproved: true });
  const spam = await this.countDocuments({ isSpam: true });
  const reported = await this.countDocuments({ reportsCount: { $gt: 0 } });

  return { total, approved, spam, reported };
};

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;