// ============================================
// UPLOAD MIDDLEWARE
// Handle file uploads using Multer
// ============================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────
// DIRECTORY SETUP
// ─────────────────────────────────────────────

/**
 * Ensure upload directory exists
 * Creates folder if it doesn't exist
 * @param {string} dirPath - Directory path
 */
const ensureDirectoryExists = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dirPath}`);
    }
  } catch (error) {
    console.warn(`⚠️ Could not create directory: ${dirPath}`);
  }
};

// Define upload paths
const UPLOAD_PATHS = {
  thumbnails: path.join(__dirname, '../public/uploads/thumbnails'),
  avatars: path.join(__dirname, '../public/uploads/avatars'),
  temp: path.join(__dirname, '../public/uploads/temp'),
};

// Create directories only in development
if (process.env.NODE_ENV !== 'production') {
  Object.values(UPLOAD_PATHS).forEach(ensureDirectoryExists);
}

// ─────────────────────────────────────────────
// STORAGE CONFIGURATIONS
// ─────────────────────────────────────────────

/**
 * Disk Storage for Thumbnails
 * Saves post thumbnail images to /uploads/thumbnails/
 */
const thumbnailStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirectoryExists(UPLOAD_PATHS.thumbnails);
    cb(null, UPLOAD_PATHS.thumbnails);
  },

  filename: (req, file, cb) => {
    // Generate unique filename
    // Format: thumbnail-{userId}-{timestamp}.{ext}
    const userId = req.user ? req.user._id : 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `thumbnail-${userId}-${timestamp}${ext}`;

    cb(null, filename);
  },
});

/**
 * Disk Storage for User Avatars
 * Saves profile pictures to /uploads/avatars/
 */
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirectoryExists(UPLOAD_PATHS.avatars);
    cb(null, UPLOAD_PATHS.avatars);
  },

  filename: (req, file, cb) => {
    // Format: avatar-{userId}-{timestamp}.{ext}
    const userId = req.user ? req.user._id : 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `avatar-${userId}-${timestamp}${ext}`;

    cb(null, filename);
  },
});

/**
 * Memory Storage
 * Stores file in memory as Buffer
 * Used for processing before saving (resize, compress)
 */
const memoryStorage = multer.memoryStorage();

// ─────────────────────────────────────────────
// FILE FILTERS
// ─────────────────────────────────────────────

/**
 * Image File Filter
 * Only allows common image formats
 */
const imageFilter = (req, file, cb) => {
  // Allowed image MIME types
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ];

  // Allowed image extensions
  const allowedExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.svg',
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const isMimeAllowed = allowedMimes.includes(file.mimetype);
  const isExtAllowed = allowedExtensions.includes(ext);

  if (isMimeAllowed && isExtAllowed) {
    cb(null, true); // Accept file
  } else {
    cb(
      new Error(
        `Invalid file type. Only images allowed (JPG, PNG, GIF, WebP, SVG). You uploaded: ${file.mimetype}`
      ),
      false
    );
  }
};

/**
 * Document File Filter
 * Only allows PDF and document formats
 */
const documentFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and Word documents are allowed.'), false);
  }
};

// ─────────────────────────────────────────────
// MULTER INSTANCES
// ─────────────────────────────────────────────

/**
 * Thumbnail Upload
 * Single image, max 5MB
 * Field name: "thumbnail"
 */
const uploadThumbnail = multer({
  storage: thumbnailStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB in bytes
    files: 1,                   // Only 1 file
  },
  fileFilter: imageFilter,
}).single('thumbnail');

/**
 * Avatar Upload
 * Single image, max 2MB
 * Field name: "avatar"
 */
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB in bytes
    files: 1,
  },
  fileFilter: imageFilter,
}).single('avatar');

/**
 * Multiple Images Upload
 * Max 5 images, each max 5MB
 * Field name: "images"
 */
const uploadMultipleImages = multer({
  storage: thumbnailStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
  fileFilter: imageFilter,
}).array('images', 5);

/**
 * Memory Upload (for processing)
 * Used when image needs to be processed before saving
 */
const uploadToMemory = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: imageFilter,
}).single('image');

// ─────────────────────────────────────────────
// MIDDLEWARE WRAPPERS
// ─────────────────────────────────────────────

/**
 * Wrap multer upload in promise
 * Handles multer errors properly
 * @param {Function} uploadFn - Multer upload function
 * @returns {Function} - Express middleware
 */
const handleUpload = (uploadFn) => {
  return (req, res, next) => {
    uploadFn(req, res, (err) => {
      if (err) {
        // Multer specific errors
        if (err instanceof multer.MulterError) {
          let message;

          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              message = 'File too large. Maximum allowed size is 5MB.';
              break;
            case 'LIMIT_FILE_COUNT':
              message = 'Too many files. Maximum 5 files allowed.';
              break;
            case 'LIMIT_UNEXPECTED_FILE':
              message = `Unexpected field name. Use correct field name.`;
              break;
            case 'LIMIT_PART_COUNT':
              message = 'Too many form parts.';
              break;
            default:
              message = `Upload error: ${err.message}`;
          }

          return res.status(400).json({
            success: false,
            message,
            code: err.code,
          });
        }

        // Custom filter errors
        if (err.message) {
          return res.status(400).json({
            success: false,
            message: err.message,
          });
        }

        // Other errors
        return res.status(500).json({
          success: false,
          message: 'File upload failed. Please try again.',
        });
      }

      // Upload successful
      if (req.file) {
        console.log(`📸 File uploaded: ${req.file.filename} (${formatFileSize(req.file.size)})`);

        // Add public URL to req.file
        req.file.publicUrl = `/uploads/${getUploadSubfolder(req.file.destination)}/${req.file.filename}`;
      }

      if (req.files && req.files.length > 0) {
        console.log(`📸 ${req.files.length} files uploaded`);

        // Add public URLs to all files
        req.files = req.files.map((file) => ({
          ...file,
          publicUrl: `/uploads/${getUploadSubfolder(file.destination)}/${file.filename}`,
        }));
      }

      next();
    });
  };
};

// ─────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Get subfolder name from full path
 * @param {string} fullPath - Full directory path
 * @returns {string} - Subfolder name
 */
const getUploadSubfolder = (fullPath) => {
  if (!fullPath) return 'uploads';
  const parts = fullPath.split(path.sep);
  return parts[parts.length - 1];
};

/**
 * Format file size to human-readable
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size
 */
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Delete uploaded file from disk
 * @param {string} filePath - Full file path or filename
 */
const deleteFile = (filePath) => {
  try {
    // Build full path if only filename provided
    let fullPath = filePath;
    if (!path.isAbsolute(filePath)) {
      fullPath = path.join(__dirname, '../public', filePath);
    }

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`🗑️ Deleted file: ${fullPath}`);
      return true;
    }

    console.warn(`⚠️ File not found for deletion: ${fullPath}`);
    return false;
  } catch (error) {
    console.error(`❌ Error deleting file: ${error.message}`);
    return false;
  }
};

/**
 * Delete old file when updating (e.g., replacing avatar)
 * @param {string} oldFileUrl - Old file public URL
 */
const deleteOldFile = (oldFileUrl) => {
  if (!oldFileUrl) return;

  // Skip if it's a default/placeholder image
  if (
    oldFileUrl.includes('default-') ||
    oldFileUrl.startsWith('http://') ||
    oldFileUrl.startsWith('https://')
  ) {
    return;
  }

  deleteFile(oldFileUrl);
};

// ─────────────────────────────────────────────
// EXPORT READY-TO-USE MIDDLEWARES
// ─────────────────────────────────────────────

module.exports = {
  // Ready-to-use middleware (with error handling)
  uploadThumbnailMiddleware: handleUpload(uploadThumbnail),
  uploadAvatarMiddleware: handleUpload(uploadAvatar),
  uploadMultipleMiddleware: handleUpload(uploadMultipleImages),
  uploadMemoryMiddleware: handleUpload(uploadToMemory),

  // Raw multer instances (if needed)
  uploadThumbnail,
  uploadAvatar,

  // Utility functions
  deleteFile,
  deleteOldFile,
  formatFileSize,
  ensureDirectoryExists,
  UPLOAD_PATHS,
};
