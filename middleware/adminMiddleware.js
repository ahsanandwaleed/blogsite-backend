// ============================================
// ADMIN MIDDLEWARE
// Restrict routes to admin users only
// Must be used AFTER protect middleware
// ============================================

/**
 * Admin Only Middleware
 * Checks if authenticated user has admin role
 * MUST use protect middleware before this
 *
 * Usage:
 * router.get('/admin-route', protect, adminOnly, controller)
 */
const adminOnly = (req, res, next) => {
  try {
    // ─── Check if User is Attached ────────────────
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login first.',
        code: 'NOT_AUTHENTICATED',
      });
    }

    // ─── Check Admin Role ─────────────────────────
    if (req.user.role !== 'admin') {
      console.warn(
        `⚠️ Unauthorized admin access attempt by: ${req.user.email} | Route: ${req.path}`
      );

      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        code: 'NOT_ADMIN',
      });
    }

    console.log(
      `👑 Admin "${req.user.name}" accessing ${req.method} ${req.path}`
    );

    next();
  } catch (error) {
    console.error('❌ Admin Middleware Error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Authorization check failed.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Role Based Access Control Middleware
 * Allow multiple roles to access a route
 *
 * Usage:
 * router.get('/route', protect, authorize('admin', 'editor'), controller)
 *
 * @param {...string} roles - Allowed roles
 * @returns {Function} - Middleware function
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    try {
      // ─── Check if User Exists ──────────────────
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
          code: 'NOT_AUTHENTICATED',
        });
      }

      // ─── Check if User Role is Allowed ────────
      if (!roles.includes(req.user.role)) {
        console.warn(
          `⚠️ Role "${req.user.role}" attempted to access role-restricted route: ${req.path}`
        );

        return res.status(403).json({
          success: false,
          message: `Access denied. Requires one of these roles: ${roles.join(', ')}`,
          code: 'INSUFFICIENT_ROLE',
          requiredRoles: roles,
          yourRole: req.user.role,
        });
      }

      next();
    } catch (error) {
      console.error('❌ Authorization Error:', error.message);

      return res.status(500).json({
        success: false,
        message: 'Authorization failed.',
      });
    }
  };
};

/**
 * Owner or Admin Middleware
 * Allows access if user is the resource owner OR admin
 * Used for edit/delete operations on user's own content
 *
 * Usage:
 * router.put('/posts/:id', protect, ownerOrAdmin('Post'), controller)
 *
 * @param {string} modelName - Mongoose model name
 * @param {string} paramField - URL param with resource ID (default: 'id')
 * @param {string} ownerField - Field in model that stores owner ID (default: 'author')
 */
const ownerOrAdmin = (modelName, paramField = 'id', ownerField = 'author') => {
  return async (req, res, next) => {
    try {
      // ─── Admin Bypasses Ownership Check ───────
      if (req.user.role === 'admin') {
        return next();
      }

      // ─── Get Resource ID from URL ──────────────
      const resourceId = req.params[paramField];

      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: `Resource ID not found in URL param: ${paramField}`,
        });
      }

      // ─── Dynamically Load Model ────────────────
      let Model;
      try {
        Model = require(`../models/${modelName}`);
      } catch (modelError) {
        console.error(`❌ Model "${modelName}" not found`);
        return res.status(500).json({
          success: false,
          message: `Model configuration error.`,
        });
      }

      // ─── Find Resource in Database ─────────────
      const resource = await Model.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: `${modelName} not found.`,
        });
      }

      // ─── Check Ownership ───────────────────────
      const ownerId = resource[ownerField]?.toString();
      const userId = req.user._id.toString();

      if (ownerId !== userId) {
        console.warn(
          `⚠️ Ownership violation: User "${req.user.email}" tried to modify ${modelName} owned by someone else.`
        );

        return res.status(403).json({
          success: false,
          message: `Access denied. You can only modify your own ${modelName.toLowerCase()}.`,
          code: 'NOT_OWNER',
        });
      }

      // ─── Attach Resource to Request ───────────
      req.resource = resource;
      next();
    } catch (error) {
      console.error('❌ Owner/Admin Middleware Error:', error.message);

      return res.status(500).json({
        success: false,
        message: 'Ownership verification failed.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  };
};

/**
 * Check if user is verified (email verified)
 * Use after protect middleware
 */
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email address first.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }

  next();
};

module.exports = {
  adminOnly,
  authorize,
  ownerOrAdmin,
  requireVerified,
};