// ============================================
// ERROR HANDLING MIDDLEWARE
// Global error handler for the Express app
// ============================================

/**
 * Custom Error Class
 * Extends built-in Error with status code
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Marks it as known/expected error

    Error.captureStackTrace(this, this.constructor);
  }
}

// ─────────────────────────────────────────────
// SPECIFIC ERROR HANDLERS
// ─────────────────────────────────────────────

/**
 * Handle MongoDB Cast Error (invalid ObjectId)
 * Example: /api/posts/invalid-id
 */
const handleCastError = (err) => {
  const message = `Invalid ${err.path}: "${err.value}". Please provide a valid ID.`;
  return new AppError(message, 400);
};

/**
 * Handle MongoDB Duplicate Key Error (code 11000)
 * Example: duplicate email on registration
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field} "${value}" already exists. Please use a different ${field}.`;
  return new AppError(message, 409);
};

/**
 * Handle Mongoose Validation Error
 * Example: required field missing
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Validation failed: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * Handle JWT Authentication Errors
 */
const handleJWTError = () => {
  return new AppError('Invalid token. Please login again.', 401);
};

/**
 * Handle JWT Expired Error
 */
const handleJWTExpiredError = () => {
  return new AppError('Session expired. Please login again.', 401);
};

/**
 * Handle Multer File Upload Errors
 */
const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large. Maximum size is 5MB.', 400);
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Too many files. Maximum is 1 file.', 400);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError(`Unexpected field: ${err.field}`, 400);
  }
  return new AppError(`File upload error: ${err.message}`, 400);
};

// ─────────────────────────────────────────────
// RESPONSE SENDERS
// ─────────────────────────────────────────────

/**
 * Send error response in Development mode
 * Shows full error details for debugging
 */
const sendErrorDev = (err, res) => {
  console.error('💥 ERROR DETAILS:', {
    status: err.status,
    statusCode: err.statusCode,
    message: err.message,
    stack: err.stack,
  });

  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message,
    stack: err.stack,
    error: err,
  });
};

/**
 * Send error response in Production mode
 * Hides sensitive details from users
 */
const sendErrorProd = (err, res) => {
  // Operational/known errors: safe to show to user
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
    });
  }

  // Unknown/programming errors: don't leak details
  console.error('💥 UNEXPECTED ERROR:', err);

  return res.status(500).json({
    success: false,
    status: 'error',
    message: 'Something went wrong. Please try again later.',
  });
};

// ─────────────────────────────────────────────
// MAIN ERROR HANDLER
// ─────────────────────────────────────────────

/**
 * Global Error Handler Middleware
 * Must be registered LAST in Express app
 *
 * Usage in server.js:
 * app.use(errorHandler)
 *
 * @param {Error} err - Error object
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {Function} next - Next middleware
 */
const errorHandler = (err, req, res, next) => {
  // Set default values
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error details
  console.error(`❌ [${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.error(`   Status: ${err.statusCode} | Message: ${err.message}`);

  // Handle errors differently by environment
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    // Create copy to avoid mutating original
    let error = { ...err, message: err.message };
    error.name = err.name;

    // ─── Transform Known Error Types ──────────────
    if (error.name === 'CastError') {
      error = handleCastError(error);
    }

    if (error.code === 11000) {
      error = handleDuplicateKeyError(error);
    }

    if (error.name === 'ValidationError') {
      error = handleValidationError(error);
    }

    if (error.name === 'JsonWebTokenError') {
      error = handleJWTError();
    }

    if (error.name === 'TokenExpiredError') {
      error = handleJWTExpiredError();
    }

    if (error.name === 'MulterError') {
      error = handleMulterError(error);
    }

    sendErrorProd(error, res);
  }
};

// ─────────────────────────────────────────────
// 404 NOT FOUND HANDLER
// ─────────────────────────────────────────────

/**
 * Handle 404 - Route Not Found
 * Use BEFORE errorHandler in server.js
 *
 * Usage in server.js:
 * app.use(notFound)
 * app.use(errorHandler)
 */
const notFound = (req, res, next) => {
  const message = `Route not found: ${req.method} ${req.originalUrl}`;
  console.warn(`⚠️ 404: ${message}`);

  const error = new AppError(message, 404);
  next(error);
};

/**
 * Async Error Wrapper
 * Wraps async controller functions to catch errors
 * Eliminates need for try/catch in every controller
 *
 * Usage in controllers:
 * exports.getPost = asyncHandler(async (req, res) => { ... })
 *
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle Unhandled Promise Rejections
 * Register in server.js
 */
const handleUnhandledRejection = (server) => {
  process.on('unhandledRejection', (err) => {
    console.error('💥 UNHANDLED REJECTION:', err.name, err.message);
    console.error('Shutting down server gracefully...');

    server.close(() => {
      process.exit(1);
    });
  });
};

/**
 * Handle Uncaught Exceptions
 * Register at top of server.js
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION:', err.name, err.message);
    console.error('Shutting down server immediately...');
    process.exit(1);
  });
};

module.exports = {
  AppError,
  errorHandler,
  notFound,
  asyncHandler,
  handleUnhandledRejection,
  handleUncaughtException,
};