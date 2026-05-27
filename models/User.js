// ============================================
// USER MODEL
// MongoDB schema for user accounts
// ============================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // ─── Basic Info ───────────────────────────────
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    username: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [
        /^[a-zA-Z0-9_]+$/,
        'Username can only contain letters, numbers and underscores',
      ],
    },

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

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password in queries
    },

    // ─── Profile Info ─────────────────────────────
    avatar: {
      type: String,
      default: '/assets/images/default-avatar.png',
    },

    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: '',
    },

    website: {
      type: String,
      match: [
        /^https?:\/\/.+/,
        'Website must be a valid URL starting with http:// or https://',
      ],
      default: '',
    },

    // ─── Social Links ─────────────────────────────
    socialLinks: {
      facebook: { type: String, default: '' },
      twitter: { type: String, default: '' },
      instagram: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      github: { type: String, default: '' },
    },

    // ─── Role & Status ────────────────────────────
    role: {
      type: String,
      enum: {
        values: ['user', 'admin', 'editor'],
        message: 'Role must be user, admin or editor',
      },
      default: 'user',
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // ─── Password Reset ───────────────────────────
    passwordChangedAt: {
      type: Date,
    },

    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },

    // ─── Email Verification ───────────────────────
    emailVerificationToken: {
      type: String,
      select: false,
    },

    emailVerificationExpires: {
      type: Date,
      select: false,
    },

    // ─── Stats ────────────────────────────────────
    postsCount: {
      type: Number,
      default: 0,
    },

    followersCount: {
      type: Number,
      default: 0,
    },

    followingCount: {
      type: Number,
      default: 0,
    },

    // ─── Bookmarks ────────────────────────────────
    bookmarks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
      },
    ],

    // ─── Newsletter ───────────────────────────────
    newsletterSubscribed: {
      type: Boolean,
      default: false,
    },

    // ─── Login Info ───────────────────────────────
    lastLogin: {
      type: Date,
      default: null,
    },

    loginCount: {
      type: Number,
      default: 0,
    },
  },

  {
    // ─── Schema Options ───────────────────────────
    timestamps: true, // Auto add createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────

// Speed up queries
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

// ─────────────────────────────────────────────
// VIRTUAL FIELDS
// ─────────────────────────────────────────────

/**
 * Virtual: Get user's posts
 * Allows populate('posts')
 */
userSchema.virtual('posts', {
  ref: 'Post',
  localField: '_id',
  foreignField: 'author',
});

/**
 * Virtual: Full profile URL
 */
userSchema.virtual('profileUrl').get(function () {
  return `/profile/${this.username || this._id}`;
});

/**
 * Virtual: Avatar full URL
 */
userSchema.virtual('avatarUrl').get(function () {
  if (this.avatar && this.avatar.startsWith('http')) {
    return this.avatar;
  }
  return `${process.env.CLIENT_URL || ''}${this.avatar}`;
});

// ─────────────────────────────────────────────
// PRE-SAVE HOOKS
// ─────────────────────────────────────────────

/**
 * Hash password before saving
 * Only runs when password is new or changed
 */
userSchema.pre('save', async function (next) {
  // Only hash if password was modified
  if (!this.isModified('password')) return next();

  try {
    // Generate salt with cost factor 12
    const salt = await bcrypt.genSalt(12);

    // Hash the password
    this.password = await bcrypt.hash(this.password, salt);

    // Set passwordChangedAt for existing users
    if (!this.isNew) {
      this.passwordChangedAt = Date.now() - 1000;
    }

    console.log(`🔐 Password hashed for user: ${this.email}`);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Auto-generate username from name if not provided
 */
userSchema.pre('save', async function (next) {
  if (!this.isNew || this.username) return next();

  try {
    // Generate username from name
    let baseUsername = this.name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 20);

    // Make sure it's unique
    let username = baseUsername;
    let counter = 1;

    while (await mongoose.model('User').findOne({ username })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    this.username = username;
    next();
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────

/**
 * Compare entered password with hashed password
 * @param {string} enteredPassword - Plain text password
 * @returns {boolean} - Match result
 */
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Check if password was changed after JWT was issued
 * @param {number} jwtTimestamp - JWT issued at timestamp
 * @returns {boolean} - True if changed after JWT
 */
userSchema.methods.passwordChangedAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedAt = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp < changedAt;
  }
  return false;
};

/**
 * Get public profile (safe to send to client)
 * Removes sensitive fields
 */
userSchema.methods.getPublicProfile = function () {
  return {
    _id: this._id,
    name: this.name,
    username: this.username,
    email: this.email,
    avatar: this.avatar,
    bio: this.bio,
    website: this.website,
    socialLinks: this.socialLinks,
    role: this.role,
    isVerified: this.isVerified,
    postsCount: this.postsCount,
    followersCount: this.followersCount,
    followingCount: this.followingCount,
    newsletterSubscribed: this.newsletterSubscribed,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
  };
};

/**
 * Update last login timestamp
 */
userSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date();
  this.loginCount += 1;
  await this.save({ validateBeforeSave: false });
};

// ─────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────

/**
 * Find user by email (includes password)
 * @param {string} email - User email
 */
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email }).select('+password');
};

/**
 * Get all admins
 */
userSchema.statics.getAdmins = function () {
  return this.find({ role: 'admin' }).select('-password');
};

/**
 * Get user stats for admin dashboard
 */
userSchema.statics.getUserStats = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
      },
    },
  ]);

  const totalUsers = await this.countDocuments();
  const newThisMonth = await this.countDocuments({
    createdAt: {
      $gte: new Date(new Date().setDate(1)), // Start of month
    },
  });

  return { stats, totalUsers, newThisMonth };
};

const User = mongoose.model('User', userSchema);

module.exports = User;