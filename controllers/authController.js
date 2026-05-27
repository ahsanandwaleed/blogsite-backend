// ============================================
// AUTH CONTROLLER
// Handle register, login, logout, password reset
// ============================================

const User = require('../models/User');
const Newsletter = require('../models/Newsletter');
const { generateToken } = require('../utils/generateToken');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/sendEmail');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');
const crypto = require('crypto');

// ─────────────────────────────────────────────
// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
// ─────────────────────────────────────────────
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, newsletterSubscribe } = req.body;

  // ─── Check if Email Already Exists ───────────
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('Email already registered. Please login instead.', 409);
  }

  // ─── Create New User ──────────────────────────
  const user = await User.create({
    name,
    email,
    password, // Will be hashed by pre-save hook
    newsletterSubscribed: newsletterSubscribe || false,
  });

  // ─── Subscribe to Newsletter ──────────────────
  if (newsletterSubscribe) {
    await Newsletter.subscribe(email, name, {
      source: 'registration',
      userId: user._id,
    });
  }

  // ─── Send Welcome Email ───────────────────────
  try {
    await sendWelcomeEmail(email, name);
  } catch (emailError) {
    // Don't fail registration if email fails
    console.error('⚠️ Welcome email failed:', emailError.message);
  }

  // ─── Generate Token ───────────────────────────
  const token = generateToken(user._id, user.role);

  // ─── Send Response ────────────────────────────
  console.log(`✅ New user registered: ${email}`);

  res.status(201).json({
    success: true,
    message: 'Registration successful! Welcome aboard.',
    token,
    user: user.getPublicProfile(),
  });
});

// ─────────────────────────────────────────────
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // ─── Find User with Password ──────────────────
  const user = await User.findByEmail(email);

  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  // ─── Check if Account is Blocked ─────────────
  if (user.isBlocked) {
    throw new AppError(
      'Your account has been blocked. Please contact support.',
      403
    );
  }

  // ─── Check if Account is Active ──────────────
  if (!user.isActive) {
    throw new AppError('Account deactivated. Please contact support.', 403);
  }

  // ─── Verify Password ──────────────────────────
  const isPasswordMatch = await user.comparePassword(password);

  if (!isPasswordMatch) {
    throw new AppError('Invalid email or password.', 401);
  }

  // ─── Update Last Login ────────────────────────
  await user.updateLastLogin();

  // ─── Generate Token ───────────────────────────
  const token = generateToken(user._id, user.role);

  console.log(`✅ User logged in: ${email}`);

  res.status(200).json({
    success: true,
    message: 'Login successful! Welcome back.',
    token,
    user: user.getPublicProfile(),
  });
});

// ─────────────────────────────────────────────
// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
// ─────────────────────────────────────────────
exports.getMe = asyncHandler(async (req, res) => {
  // req.user is set by protect middleware
  const user = await User.findById(req.userId)
    .populate('bookmarks', 'title slug thumbnail')
    .select('-password');

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  res.status(200).json({
    success: true,
    user: user.getPublicProfile(),
  });
});

// ─────────────────────────────────────────────
// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
// ─────────────────────────────────────────────
exports.logout = asyncHandler(async (req, res) => {
  // JWT is stateless - actual logout happens on frontend
  // Here we just confirm the request
  console.log(`👋 User logged out: ${req.user.email}`);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

// ─────────────────────────────────────────────
// @desc    Forgot password - send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
// ─────────────────────────────────────────────
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // ─── Find User ────────────────────────────────
  const user = await User.findOne({ email });

  // Always send success (security - don't reveal if email exists)
  if (!user) {
    return res.status(200).json({
      success: true,
      message: 'If this email exists, a reset link has been sent.',
    });
  }

  // ─── Generate Reset Token ─────────────────────
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash token before saving (security)
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Save to user with expiry (1 hour)
  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  // ─── Send Reset Email ─────────────────────────
  try {
    await sendPasswordResetEmail(email, user.name, resetToken);
    console.log(`📧 Password reset email sent to: ${email}`);
  } catch (emailError) {
    // Clear reset token if email fails
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    throw new AppError('Failed to send reset email. Please try again.', 500);
  }

  res.status(200).json({
    success: true,
    message: 'Password reset link sent to your email.',
  });
});

// ─────────────────────────────────────────────
// @desc    Reset password using token
// @route   POST /api/auth/reset-password/:token
// @access  Public
// ─────────────────────────────────────────────
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  // ─── Hash Incoming Token ──────────────────────
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // ─── Find User with Valid Token ───────────────
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    throw new AppError(
      'Password reset token is invalid or has expired.',
      400
    );
  }

  // ─── Set New Password ─────────────────────────
  user.password = password; // Pre-save hook will hash it
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.passwordChangedAt = Date.now();

  await user.save();

  // ─── Generate New Token (auto login) ─────────
  const newToken = generateToken(user._id, user.role);

  console.log(`✅ Password reset successful for: ${user.email}`);

  res.status(200).json({
    success: true,
    message: 'Password reset successful. You are now logged in.',
    token: newToken,
    user: user.getPublicProfile(),
  });
});

// ─────────────────────────────────────────────
// @desc    Change password (logged in user)
// @route   PUT /api/auth/change-password
// @access  Private
// ─────────────────────────────────────────────
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // ─── Get User with Password ───────────────────
  const user = await User.findById(req.userId).select('+password');

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  // ─── Verify Current Password ──────────────────
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect.', 401);
  }

  // ─── Check New Password != Current ───────────
  const isSamePassword = await user.comparePassword(newPassword);
  if (isSamePassword) {
    throw new AppError(
      'New password must be different from current password.',
      400
    );
  }

  // ─── Update Password ──────────────────────────
  user.password = newPassword; // Pre-save hook will hash it
  user.passwordChangedAt = Date.now();
  await user.save();

  // ─── Generate New Token ───────────────────────
  const token = generateToken(user._id, user.role);

  console.log(`✅ Password changed for: ${user.email}`);

  res.status(200).json({
    success: true,
    message: 'Password changed successfully.',
    token, // New token since password changed
  });
});

// ─────────────────────────────────────────────
// @desc    Verify email address
// @route   GET /api/auth/verify-email/:token
// @access  Public
// ─────────────────────────────────────────────
exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  // ─── Find User with Token ─────────────────────
  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() },
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) {
    throw new AppError('Email verification token is invalid or expired.', 400);
  }

  // ─── Mark Email as Verified ───────────────────
  user.isVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  console.log(`✅ Email verified for: ${user.email}`);

  res.status(200).json({
    success: true,
    message: 'Email verified successfully!',
  });
});

// ─────────────────────────────────────────────
// @desc    Refresh JWT token
// @route   POST /api/auth/refresh-token
// @access  Private
// ─────────────────────────────────────────────
exports.refreshToken = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);

  if (!user || user.isBlocked) {
    throw new AppError('Unable to refresh token.', 401);
  }

  const token = generateToken(user._id, user.role);

  res.status(200).json({
    success: true,
    message: 'Token refreshed.',
    token,
  });
});