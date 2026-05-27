// ============================================
// GENERATE JWT TOKEN UTILITY
// Used for creating authentication tokens
// ============================================

const jwt = require('jsonwebtoken');

/**
 * Generate JWT Token for a user
 * @param {string} userId - MongoDB user ID
 * @param {string} role - User role (admin/user)
 * @returns {string} - Signed JWT token
 */
const generateToken = (userId, role) => {
  try {
    const token = jwt.sign(
      {
        id: userId,
        role: role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRE || '30d',
      }
    );

    return token;
  } catch (error) {
    console.error('❌ Error generating token:', error.message);
    throw new Error('Token generation failed');
  }
};

/**
 * Verify JWT Token
 * @param {string} token - JWT token to verify
 * @returns {object} - Decoded token payload
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('❌ Invalid token:', error.message);
    throw new Error('Invalid or expired token');
  }
};

/**
 * Generate short-lived token for email verification
 * @param {string} userId - MongoDB user ID
 * @returns {string} - Short JWT token (15 minutes)
 */
const generateEmailVerificationToken = (userId) => {
  try {
    const token = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    return token;
  } catch (error) {
    console.error('❌ Error generating email token:', error.message);
    throw new Error('Email token generation failed');
  }
};

/**
 * Generate password reset token
 * @param {string} userId - MongoDB user ID
 * @returns {string} - Reset token (1 hour)
 */
const generatePasswordResetToken = (userId) => {
  try {
    const token = jwt.sign(
      { id: userId, purpose: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    return token;
  } catch (error) {
    console.error('❌ Error generating reset token:', error.message);
    throw new Error('Password reset token generation failed');
  }
};

module.exports = {
  generateToken,
  verifyToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
};