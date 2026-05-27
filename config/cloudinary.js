// ============================================
// CLOUDINARY CONFIGURATION
// Cloud-based image storage and management
// Alternative to local file storage
// ============================================

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');

// ─────────────────────────────────────────────
// CLOUDINARY SETUP
// Configure with your account credentials
// ─────────────────────────────────────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Always use HTTPS
});

// ─────────────────────────────────────────────
// TEST CONNECTION
// Verify cloudinary credentials on startup
// ─────────────────────────────────────────────

/**
 * Test Cloudinary connection
 * Call this in server.js to verify setup
 */
const testCloudinaryConnection = async () => {
  try {
    const result = await cloudinary.api.ping();

    if (result.status === 'ok') {
      console.log('');
      console.log('☁️  ================================');
      console.log('☁️   Cloudinary Connected!');
      console.log(`☁️   Cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);
      console.log('☁️  ================================');
      console.log('');
    }
  } catch (error) {
    console.error('❌ Cloudinary connection failed:', error.message);
    console.error('💡 Check CLOUDINARY_* variables in .env file');
  }
};

// ─────────────────────────────────────────────
// CLOUDINARY STORAGE CONFIGS
// Different folders for different upload types
// ─────────────────────────────────────────────

/**
 * Storage for Blog Post Thumbnails
 * Folder: blogsite/thumbnails/
 * Format: webp (best compression)
 * Max size: 5MB
 */
const thumbnailStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: 'blogsite/thumbnails',
      format: 'webp',               // Convert all to webp
      transformation: [
        {
          width: 1200,
          height: 630,
          crop: 'fill',             // Crop to exact size
          gravity: 'auto',          // Smart crop focus
          quality: 'auto:good',     // Auto quality
        },
      ],
      public_id: `thumbnail_${req.user?._id}_${Date.now()}`,
      overwrite: true,
    };
  },
});

/**
 * Storage for User Avatars
 * Folder: blogsite/avatars/
 * Format: webp
 * Size: 400x400 (square)
 */
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: 'blogsite/avatars',
      format: 'webp',
      transformation: [
        {
          width: 400,
          height: 400,
          crop: 'fill',
          gravity: 'face',          // Focus on face
          quality: 'auto:good',
          radius: 'max',            // Circular crop (optional)
        },
      ],
      public_id: `avatar_${req.user?._id}_${Date.now()}`,
      overwrite: true,
    };
  },
});

/**
 * Storage for Category Cover Images
 * Folder: blogsite/categories/
 */
const categoryStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: 'blogsite/categories',
      format: 'webp',
      transformation: [
        {
          width: 800,
          height: 400,
          crop: 'fill',
          gravity: 'auto',
          quality: 'auto:good',
        },
      ],
      public_id: `category_${Date.now()}`,
      overwrite: true,
    };
  },
});

/**
 * Storage for General/Temp images
 * Folder: blogsite/general/
 */
const generalStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: 'blogsite/general',
      format: 'webp',
      transformation: [
        {
          width: 1920,
          height: 1080,
          crop: 'limit',            // Only resize if larger
          quality: 'auto:good',
        },
      ],
      public_id: `image_${Date.now()}`,
      overwrite: true,
    };
  },
});

// ─────────────────────────────────────────────
// FILE FILTER
// Only allow image file types
// ─────────────────────────────────────────────

/**
 * Image file filter for multer
 * Accepts: jpg, jpeg, png, gif, webp, svg
 */
const imageFileFilter = (req, file, cb) => {
  // Allowed MIME types
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ];

  // Allowed extensions
  const allowedExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.svg',
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const isMimeOk = allowedMimes.includes(file.mimetype);
  const isExtOk = allowedExtensions.includes(ext);

  if (isMimeOk && isExtOk) {
    cb(null, true); // Accept
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Only images are allowed (JPG, PNG, GIF, WebP, SVG)`
      ),
      false // Reject
    );
  }
};

// ─────────────────────────────────────────────
// MULTER UPLOAD INSTANCES
// Ready-to-use upload middleware
// ─────────────────────────────────────────────

/**
 * Upload thumbnail to Cloudinary
 * Field name: "thumbnail"
 * Max size: 5MB
 */
const uploadThumbnail = multer({
  storage: thumbnailStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
  fileFilter: imageFileFilter,
}).single('thumbnail');

/**
 * Upload avatar to Cloudinary
 * Field name: "avatar"
 * Max size: 2MB
 */
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
    files: 1,
  },
  fileFilter: imageFileFilter,
}).single('avatar');

/**
 * Upload category image to Cloudinary
 * Field name: "coverImage"
 * Max size: 3MB
 */
const uploadCategoryImage = multer({
  storage: categoryStorage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
    files: 1,
  },
  fileFilter: imageFileFilter,
}).single('coverImage');

/**
 * Upload multiple images to Cloudinary
 * Field name: "images"
 * Max: 5 files, each 5MB
 */
const uploadMultipleImages = multer({
  storage: generalStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
  fileFilter: imageFileFilter,
}).array('images', 5);

// ─────────────────────────────────────────────
// ERROR HANDLER WRAPPER
// Wraps multer to handle errors properly
// ─────────────────────────────────────────────

/**
 * Wrap multer upload in error handler
 * @param {Function} uploadFn - Multer upload function
 * @returns {Function} - Express middleware
 */
const handleCloudinaryUpload = (uploadFn) => {
  return (req, res, next) => {
    uploadFn(req, res, (err) => {
      if (err) {
        // Multer errors
        if (err instanceof multer.MulterError) {
          let message;

          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              message = 'File too large. Maximum size exceeded.';
              break;
            case 'LIMIT_FILE_COUNT':
              message = 'Too many files uploaded at once.';
              break;
            case 'LIMIT_UNEXPECTED_FILE':
              message = `Wrong field name. Got: ${err.field}`;
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

        // Cloudinary errors
        if (err.http_code) {
          return res.status(400).json({
            success: false,
            message: `Cloud upload failed: ${err.message}`,
            code: 'CLOUDINARY_ERROR',
          });
        }

        // Custom file filter errors
        if (err.message) {
          return res.status(400).json({
            success: false,
            message: err.message,
          });
        }

        // Unknown errors
        return res.status(500).json({
          success: false,
          message: 'File upload failed. Please try again.',
        });
      }

      // ─── Upload Success ────────────────────────────
      if (req.file) {
        console.log(`☁️  Uploaded to Cloudinary: ${req.file.path}`);

        // Add clean URL to req.file
        req.file.cloudinaryUrl = req.file.path;
        req.file.publicId = req.file.filename;
      }

      if (req.files && req.files.length > 0) {
        console.log(`☁️  ${req.files.length} files uploaded to Cloudinary`);

        req.files = req.files.map((file) => ({
          ...file,
          cloudinaryUrl: file.path,
          publicId: file.filename,
        }));
      }

      next();
    });
  };
};

// ─────────────────────────────────────────────
// CLOUDINARY HELPER FUNCTIONS
// Direct Cloudinary operations
// ─────────────────────────────────────────────

/**
 * Delete image from Cloudinary by public ID
 * @param {string} publicId - Cloudinary public ID
 * @returns {object} - Deletion result
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) {
      console.warn('⚠️  No public ID provided for deletion');
      return null;
    }

    // Skip default/placeholder images
    if (publicId.includes('default-')) {
      return null;
    }

    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === 'ok') {
      console.log(`🗑️  Deleted from Cloudinary: ${publicId}`);
    } else {
      console.warn(`⚠️  Cloudinary deletion result: ${result.result}`);
    }

    return result;
  } catch (error) {
    console.error(`❌ Cloudinary deletion failed: ${error.message}`);
    return null;
  }
};

/**
 * Delete multiple images from Cloudinary
 * @param {string[]} publicIds - Array of public IDs
 * @returns {object} - Deletion result
 */
const deleteMultipleFromCloudinary = async (publicIds) => {
  try {
    if (!publicIds || publicIds.length === 0) return null;

    // Filter out empty or default IDs
    const validIds = publicIds.filter(
      (id) => id && !id.includes('default-')
    );

    if (validIds.length === 0) return null;

    const result = await cloudinary.api.delete_resources(validIds);
    console.log(`🗑️  Deleted ${validIds.length} files from Cloudinary`);

    return result;
  } catch (error) {
    console.error(`❌ Cloudinary bulk deletion failed: ${error.message}`);
    return null;
  }
};

/**
 * Extract public ID from Cloudinary URL
 * Example: https://res.cloudinary.com/cloud/image/upload/v123/blogsite/thumbnails/thumbnail_123.webp
 * Returns: blogsite/thumbnails/thumbnail_123
 * @param {string} url - Cloudinary URL
 * @returns {string} - Public ID
 */
const getPublicIdFromUrl = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;

  try {
    // Remove base URL and version
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');

    if (uploadIndex === -1) return null;

    // Skip version number (v1234567890)
    const afterUpload = parts.slice(uploadIndex + 1);
    const withoutVersion = afterUpload[0].startsWith('v')
      ? afterUpload.slice(1)
      : afterUpload;

    // Remove file extension
    const fullPath = withoutVersion.join('/');
    const withoutExt = fullPath.replace(/\.[^/.]+$/, '');

    return withoutExt;
  } catch (error) {
    console.error('❌ Error extracting public ID:', error.message);
    return null;
  }
};

/**
 * Upload image directly from URL to Cloudinary
 * Useful for importing images from external sources
 * @param {string} imageUrl - External image URL
 * @param {string} folder - Cloudinary folder
 * @param {string} publicId - Custom public ID
 * @returns {object} - Upload result
 */
const uploadFromUrl = async (imageUrl, folder = 'blogsite/general', publicId = null) => {
  try {
    const options = {
      folder,
      format: 'webp',
      transformation: [
        {
          width: 1200,
          quality: 'auto:good',
          fetch_format: 'auto',
        },
      ],
    };

    if (publicId) {
      options.public_id = publicId;
    }

    const result = await cloudinary.uploader.upload(imageUrl, options);
    console.log(`☁️  Image uploaded from URL: ${result.secure_url}`);

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
    };
  } catch (error) {
    console.error('❌ URL upload failed:', error.message);
    throw new Error(`Failed to upload image from URL: ${error.message}`);
  }
};

/**
 * Upload base64 image to Cloudinary
 * Used for editor-pasted images
 * @param {string} base64String - Base64 image string
 * @param {string} folder - Target folder
 * @returns {object} - Upload result
 */
const uploadBase64Image = async (
  base64String,
  folder = 'blogsite/general'
) => {
  try {
    const result = await cloudinary.uploader.upload(base64String, {
      folder,
      format: 'webp',
      transformation: [
        {
          quality: 'auto:good',
          fetch_format: 'auto',
        },
      ],
    });

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error('❌ Base64 upload failed:', error.message);
    throw new Error(`Base64 upload failed: ${error.message}`);
  }
};

/**
 * Generate optimized image URL with transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {object} options - Transformation options
 * @returns {string} - Optimized image URL
 */
const getOptimizedUrl = (publicId, options = {}) => {
  const {
    width = 800,
    height,
    crop = 'fill',
    quality = 'auto:good',
    format = 'auto',
    gravity = 'auto',
  } = options;

  const transformation = [
    {
      width,
      ...(height && { height }),
      crop,
      gravity,
      quality,
      fetch_format: format,
    },
  ];

  return cloudinary.url(publicId, {
    transformation,
    secure: true,
  });
};

/**
 * Get all images in a folder
 * @param {string} folder - Cloudinary folder path
 * @param {number} maxResults - Max results to return
 * @returns {Array} - Array of image resources
 */
const getFolderImages = async (
  folder = 'blogsite',
  maxResults = 50
) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: folder,
      max_results: maxResults,
      resource_type: 'image',
    });

    return result.resources.map((resource) => ({
      publicId: resource.public_id,
      url: resource.secure_url,
      width: resource.width,
      height: resource.height,
      format: resource.format,
      size: resource.bytes,
      createdAt: resource.created_at,
    }));
  } catch (error) {
    console.error('❌ Error fetching folder images:', error.message);
    return [];
  }
};

/**
 * Get Cloudinary usage stats
 * @returns {object} - Account usage information
 */
const getCloudinaryStats = async () => {
  try {
    const usage = await cloudinary.api.usage();

    return {
      plan: usage.plan,
      storage: {
        used: formatBytes(usage.storage.usage),
        limit: formatBytes(usage.storage.limit),
        percentage: (
          (usage.storage.usage / usage.storage.limit) *
          100
        ).toFixed(1),
      },
      bandwidth: {
        used: formatBytes(usage.bandwidth.usage),
        limit: formatBytes(usage.bandwidth.limit),
      },
      requests: usage.requests,
      resources: usage.resources,
      transformations: usage.transformations,
    };
  } catch (error) {
    console.error('❌ Error getting Cloudinary stats:', error.message);
    return null;
  }
};

// ─────────────────────────────────────────────
// PRIVATE HELPER
// ─────────────────────────────────────────────

/**
 * Format bytes to human readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} - Human readable size
 */
const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

module.exports = {
  // Cloudinary instance (for direct use)
  cloudinary,

  // Connection test
  testCloudinaryConnection,

  // Ready-to-use upload middlewares
  uploadThumbnailCloud: handleCloudinaryUpload(uploadThumbnail),
  uploadAvatarCloud: handleCloudinaryUpload(uploadAvatar),
  uploadCategoryImageCloud: handleCloudinaryUpload(uploadCategoryImage),
  uploadMultipleCloud: handleCloudinaryUpload(uploadMultipleImages),

  // Raw multer instances
  uploadThumbnail,
  uploadAvatar,
  uploadCategoryImage,

  // Helper functions
  deleteFromCloudinary,
  deleteMultipleFromCloudinary,
  getPublicIdFromUrl,
  uploadFromUrl,
  uploadBase64Image,
  getOptimizedUrl,
  getFolderImages,
  getCloudinaryStats,
  formatBytes,
};