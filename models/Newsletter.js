// ============================================
// NEWSLETTER MODEL
// MongoDB schema for newsletter subscriptions
// ============================================

const mongoose = require('mongoose');
const crypto = require('crypto');

const newsletterSchema = new mongoose.Schema(
  {
    // ─── Subscriber Info ──────────────────────────
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },

    name: {
      type: String,
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
      default: '',
    },

    // ─── Linked User (if registered) ─────────────
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ─── Status ───────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    // ─── Preferences ─────────────────────────────
    preferences: {
      weeklyDigest: {
        type: Boolean,
        default: true,
      },
      newPosts: {
        type: Boolean,
        default: true,
      },
      featuredOnly: {
        type: Boolean,
        default: false,
      },
    },

    // ─── Categories Subscribed To ─────────────────
    subscribedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],

    // ─── Verification Token ───────────────────────
    verificationToken: {
      type: String,
      select: false,
    },

    verificationExpires: {
      type: Date,
      select: false,
    },

    // ─── Unsubscribe Token ────────────────────────
    unsubscribeToken: {
      type: String,
      unique: true,
    },

    // ─── Stats ────────────────────────────────────
    emailsSent: {
      type: Number,
      default: 0,
    },

    emailsOpened: {
      type: Number,
      default: 0,
    },

    lastEmailSentAt: {
      type: Date,
      default: null,
    },

    subscribedAt: {
      type: Date,
      default: Date.now,
    },

    unsubscribedAt: {
      type: Date,
      default: null,
    },

    // ─── Source ───────────────────────────────────
    source: {
      type: String,
      enum: ['website', 'registration', 'import', 'api'],
      default: 'website',
    },

    ipAddress: {
      type: String,
      default: '',
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

newsletterSchema.index({ email: 1 });
newsletterSchema.index({ isActive: 1 });
newsletterSchema.index({ isVerified: 1 });
newsletterSchema.index({ unsubscribeToken: 1 });
newsletterSchema.index({ createdAt: -1 });

// ─────────────────────────────────────────────
// PRE-SAVE HOOKS
// ─────────────────────────────────────────────

/**
 * Generate unsubscribe token on creation
 */
newsletterSchema.pre('save', function (next) {
  // Generate unique unsubscribe token
  if (this.isNew && !this.unsubscribeToken) {
    this.unsubscribeToken = crypto.randomBytes(32).toString('hex');
  }

  // Generate verification token
  if (this.isNew && !this.isVerified) {
    this.verificationToken = crypto.randomBytes(32).toString('hex');
    this.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  }

  next();
});

// ─────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────

/**
 * Verify email subscription
 * @param {string} token - Verification token
 * @returns {boolean} - Success status
 */
newsletterSchema.methods.verifyEmail = async function (token) {
  const sub = await mongoose
    .model('Newsletter')
    .findById(this._id)
    .select('+verificationToken +verificationExpires');

  if (
    sub.verificationToken !== token ||
    sub.verificationExpires < Date.now()
  ) {
    return false;
  }

  this.isVerified = true;
  this.verificationToken = undefined;
  this.verificationExpires = undefined;
  await this.save({ validateBeforeSave: false });

  return true;
};

/**
 * Unsubscribe from newsletter
 */
newsletterSchema.methods.unsubscribe = async function () {
  this.isActive = false;
  this.unsubscribedAt = new Date();
  await this.save({ validateBeforeSave: false });
};

/**
 * Re-subscribe to newsletter
 */
newsletterSchema.methods.resubscribe = async function () {
  this.isActive = true;
  this.unsubscribedAt = null;
  await this.save({ validateBeforeSave: false });
};

/**
 * Track email open
 */
newsletterSchema.methods.trackOpen = async function () {
  this.emailsOpened += 1;
  await this.save({ validateBeforeSave: false });
};

// ─────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────

/**
 * Get all active verified subscribers
 */
newsletterSchema.statics.getActiveSubscribers = function () {
  return this.find({
    isActive: true,
    isVerified: true,
  }).select('email name preferences');
};

/**
 * Get subscriber by unsubscribe token
 * @param {string} token - Unsubscribe token
 */
newsletterSchema.statics.findByUnsubscribeToken = function (token) {
  return this.findOne({ unsubscribeToken: token });
};

/**
 * Get newsletter stats for admin
 */
newsletterSchema.statics.getStats = async function () {
  const total = await this.countDocuments();
  const active = await this.countDocuments({ isActive: true });
  const verified = await this.countDocuments({ isActive: true, isVerified: true });
  const unsubscribed = await this.countDocuments({ isActive: false });

  const newThisMonth = await this.countDocuments({
    createdAt: { $gte: new Date(new Date().setDate(1)) },
  });

  return {
    total,
    active,
    verified,
    unsubscribed,
    newThisMonth,
  };
};

/**
 * Subscribe email to newsletter
 * @param {string} email - Email address
 * @param {string} name - Subscriber name
 * @param {object} options - Extra options
 */
newsletterSchema.statics.subscribe = async function (email, name = '', options = {}) {
  const existing = await this.findOne({ email });

  if (existing) {
    if (!existing.isActive) {
      // Re-subscribe
      existing.isActive = true;
      existing.unsubscribedAt = null;
      existing.name = name || existing.name;
      await existing.save({ validateBeforeSave: false });
      return { subscriber: existing, isNew: false, resubscribed: true };
    }
    return { subscriber: existing, isNew: false, resubscribed: false };
  }

  // Create new subscriber
  const subscriber = await this.create({
    email,
    name,
    source: options.source || 'website',
    ipAddress: options.ipAddress || '',
    user: options.userId || null,
  });

  return { subscriber, isNew: true, resubscribed: false };
};

const Newsletter = mongoose.model('Newsletter', newsletterSchema);

module.exports = Newsletter;