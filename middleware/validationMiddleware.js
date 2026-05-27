// ============================================
// VALIDATION MIDDLEWARE
// Validate request body before processing
// ============================================

const { AppError } = require('./errorMiddleware');

// ─────────────────────────────────────────────
// CORE VALIDATOR
// ─────────────────────────────────────────────

/**
 * Run validations and collect errors
 * @param {Array} validations - Array of validation functions
 * @returns {Function} - Express middleware
 */
const validate = (validations) => {
  return async (req, res, next) => {
    const errors = [];

    // Run all validations
    for (const validation of validations) {
      const error = await validation(req);
      if (error) errors.push(error);
    }

    // Return errors if any found
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors,
      });
    }

    next();
  };
};

// ─────────────────────────────────────────────
// FIELD VALIDATORS (HELPER FUNCTIONS)
// ─────────────────────────────────────────────

/**
 * Check if field is required
 * @param {string} field - Field name in req.body
 * @param {string} label - Human-readable field name
 */
const required = (field, label) => (req) => {
  const value = req.body[field];
  if (value === undefined || value === null || value === '') {
    return `${label || field} is required.`;
  }
  return null;
};

/**
 * Check minimum length
 * @param {string} field - Field name
 * @param {number} min - Minimum length
 * @param {string} label - Human-readable label
 */
const minLength = (field, min, label) => (req) => {
  const value = req.body[field];
  if (value && value.trim().length < min) {
    return `${label || field} must be at least ${min} characters long.`;
  }
  return null;
};

/**
 * Check maximum length
 * @param {string} field - Field name
 * @param {number} max - Maximum length
 * @param {string} label - Human-readable label
 */
const maxLength = (field, max, label) => (req) => {
  const value = req.body[field];
  if (value && value.trim().length > max) {
    return `${label || field} must not exceed ${max} characters.`;
  }
  return null;
};

/**
 * Validate email format
 * @param {string} field - Field name (default: 'email')
 */
const isEmail = (field = 'email') => (req) => {
  const value = req.body[field];
  if (!value) return null;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return `Please provide a valid email address.`;
  }
  return null;
};

/**
 * Validate password strength
 * @param {string} field - Field name (default: 'password')
 */
const isStrongPassword = (field = 'password') => (req) => {
  const value = req.body[field];
  if (!value) return null;

  const errors = [];

  if (value.length < 8) {
    errors.push('at least 8 characters');
  }
  if (!/[A-Z]/.test(value)) {
    errors.push('one uppercase letter');
  }
  if (!/[a-z]/.test(value)) {
    errors.push('one lowercase letter');
  }
  if (!/[0-9]/.test(value)) {
    errors.push('one number');
  }

  if (errors.length > 0) {
    return `Password must contain: ${errors.join(', ')}.`;
  }
  return null;
};

/**
 * Check if two fields match (e.g., password confirmation)
 * @param {string} field1 - First field
 * @param {string} field2 - Second field to match
 * @param {string} label - Error label
 */
const matches = (field1, field2, label) => (req) => {
  if (req.body[field1] !== req.body[field2]) {
    return `${label || `${field1} and ${field2}`} do not match.`;
  }
  return null;
};

/**
 * Validate URL format
 * @param {string} field - Field name
 */
const isUrl = (field) => (req) => {
  const value = req.body[field];
  if (!value) return null;

  try {
    new URL(value);
    return null;
  } catch {
    return `${field} must be a valid URL (include https://).`;
  }
};

/**
 * Validate MongoDB ObjectId
 * @param {string} field - Param or body field name
 * @param {string} source - 'params' or 'body'
 */
const isMongoId = (field, source = 'params') => (req) => {
  const value = req[source][field];
  if (!value) return null;

  const mongoIdRegex = /^[a-fA-F0-9]{24}$/;
  if (!mongoIdRegex.test(value)) {
    return `Invalid ${field} format.`;
  }
  return null;
};

/**
 * Check if value is in allowed list
 * @param {string} field - Field name
 * @param {Array} allowedValues - Allowed values
 */
const isIn = (field, allowedValues) => (req) => {
  const value = req.body[field];
  if (!value) return null;

  if (!allowedValues.includes(value)) {
    return `${field} must be one of: ${allowedValues.join(', ')}.`;
  }
  return null;
};

/**
 * Check if value is a positive number
 * @param {string} field - Field name
 */
const isPositiveNumber = (field) => (req) => {
  const value = req.body[field];
  if (!value && value !== 0) return null;

  if (isNaN(value) || Number(value) <= 0) {
    return `${field} must be a positive number.`;
  }
  return null;
};

// ─────────────────────────────────────────────
// PRE-BUILT VALIDATION SETS
// ─────────────────────────────────────────────

/**
 * Validate User Registration
 * POST /api/auth/register
 */
const validateRegister = validate([
  // Name validations
  required('name', 'Name'),
  minLength('name', 2, 'Name'),
  maxLength('name', 50, 'Name'),

  // Email validations
  required('email', 'Email'),
  isEmail('email'),

  // Password validations
  required('password', 'Password'),
  minLength('password', 8, 'Password'),
  isStrongPassword('password'),

  // Confirm password
  required('confirmPassword', 'Confirm Password'),
  matches('password', 'confirmPassword', 'Passwords'),
]);

/**
 * Validate User Login
 * POST /api/auth/login
 */
const validateLogin = validate([
  required('email', 'Email'),
  isEmail('email'),
  required('password', 'Password'),
  minLength('password', 6, 'Password'),
]);

/**
 * Validate Blog Post Creation/Update
 * POST /api/posts
 * PUT  /api/posts/:id
 */
const validatePost = validate([
  // Title validations
  required('title', 'Title'),
  minLength('title', 5, 'Title'),
  maxLength('title', 200, 'Title'),

  // Content validations
  required('content', 'Content'),
  minLength('content', 50, 'Content'),

  // Category validation
  required('category', 'Category'),

  // Status validation
  isIn('status', ['draft', 'published', 'archived']),
]);

/**
 * Validate Comment
 * POST /api/comments
 */
const validateComment = validate([
  required('text', 'Comment'),
  minLength('text', 2, 'Comment'),
  maxLength('text', 1000, 'Comment'),
  required('postId', 'Post ID'),
  isMongoId('postId', 'body'),
]);

/**
 * Validate Category
 * POST /api/categories
 */
const validateCategory = validate([
  required('name', 'Category name'),
  minLength('name', 2, 'Category name'),
  maxLength('name', 50, 'Category name'),
]);

/**
 * Validate User Profile Update
 * PUT /api/users/profile
 */
const validateProfileUpdate = validate([
  minLength('name', 2, 'Name'),
  maxLength('name', 50, 'Name'),
  maxLength('bio', 500, 'Bio'),
  isUrl('website'),
]);

/**
 * Validate Password Change
 * PUT /api/users/change-password
 */
const validatePasswordChange = validate([
  required('currentPassword', 'Current Password'),
  required('newPassword', 'New Password'),
  minLength('newPassword', 8, 'New Password'),
  isStrongPassword('newPassword'),
  required('confirmNewPassword', 'Confirm New Password'),
  matches('newPassword', 'confirmNewPassword', 'New passwords'),
]);

/**
 * Validate Password Reset Request
 * POST /api/auth/forgot-password
 */
const validateForgotPassword = validate([
  required('email', 'Email'),
  isEmail('email'),
]);

/**
 * Validate Password Reset
 * POST /api/auth/reset-password
 */
const validateResetPassword = validate([
  required('password', 'Password'),
  minLength('password', 8, 'Password'),
  isStrongPassword('password'),
  required('confirmPassword', 'Confirm Password'),
  matches('password', 'confirmPassword', 'Passwords'),
]);

/**
 * Validate Newsletter Subscription
 * POST /api/newsletter/subscribe
 */
const validateNewsletter = validate([
  required('email', 'Email'),
  isEmail('email'),
]);

/**
 * Validate Contact Form
 * POST /api/contact
 */
const validateContact = validate([
  required('name', 'Name'),
  minLength('name', 2, 'Name'),
  required('email', 'Email'),
  isEmail('email'),
  required('subject', 'Subject'),
  minLength('subject', 5, 'Subject'),
  required('message', 'Message'),
  minLength('message', 20, 'Message'),
  maxLength('message', 2000, 'Message'),
]);

/**
 * Sanitize request body
 * Remove dangerous HTML/script tags
 * Add this before validation middleware
 */
const sanitizeBody = (req, res, next) => {
  const sanitize = (value) => {
    if (typeof value !== 'string') return value;

    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  };

  // Sanitize all string fields in body
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Don't sanitize content field (it's HTML from rich text editor)
        if (key !== 'content') {
          req.body[key] = sanitize(req.body[key]);
        }
      }
    }
  }

  next();
};

/**
 * Rate limit by field value
 * Prevent spam submissions
 * Simple in-memory rate limiter
 */
const formRateLimit = (() => {
  const attempts = new Map();
  const MAX_ATTEMPTS = 5;
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  return (field = 'email') => (req, res, next) => {
    const key = req.body[field] || req.ip;
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    // Get existing attempts
    const userAttempts = attempts.get(key) || [];

    // Filter attempts within window
    const recentAttempts = userAttempts.filter((t) => t > windowStart);

    if (recentAttempts.length >= MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Please try again after 15 minutes.`,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    // Record this attempt
    recentAttempts.push(now);
    attempts.set(key, recentAttempts);

    next();
  };
})();

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

module.exports = {
  // Core validator
  validate,

  // Field validators (for custom use)
  validators: {
    required,
    minLength,
    maxLength,
    isEmail,
    isStrongPassword,
    matches,
    isUrl,
    isMongoId,
    isIn,
    isPositiveNumber,
  },

  // Pre-built validation sets
  validateRegister,
  validateLogin,
  validatePost,
  validateComment,
  validateCategory,
  validateProfileUpdate,
  validatePasswordChange,
  validateForgotPassword,
  validateResetPassword,
  validateNewsletter,
  validateContact,

  // Extra middleware
  sanitizeBody,
  formRateLimit,
};