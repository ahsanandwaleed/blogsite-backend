const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── Only create directories in development ───
if (process.env.NODE_ENV !== 'production') {
  const dirs = [
    path.join(__dirname, '../public/uploads/thumbnails'),
    path.join(__dirname, '../public/uploads/avatars'),
    path.join(__dirname, '../public/uploads/temp'),
  ];

  dirs.forEach((dir) => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      console.warn('Directory creation skipped:', dir);
    }
  });
}

// ─── Memory Storage (works on Vercel) ────────
const memoryStorage = multer.memoryStorage();

// ─── File Filter ──────────────────────────────
const imageFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files allowed!'), false);
  }
};

// ─── Multer Upload Instances ──────────────────
const uploadThumbnail = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single('thumbnail');

const uploadAvatar = multer({
  storage: memoryStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single('avatar');

const uploadMultipleImages = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: imageFilter,
}).array('images', 5);

// ─── Error Handler Wrapper ────────────────────
const handleUpload = (uploadFn) => {
  return (req, res, next) => {
    uploadFn(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          let message;
          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              message = 'File too large. Maximum 5MB allowed.';
              break;
            case 'LIMIT_FILE_COUNT':
              message = 'Too many files.';
              break;
            default:
              message = `Upload error: ${err.message}`;
          }
          return res.status(400).json({ success: false, message });
        }
        if (err.message) {
          return res.status(400).json({ success: false, message: err.message });
        }
        return res.status(500).json({ success: false, message: 'Upload failed.' });
      }

      if (req.file) {
        req.file.publicUrl = `/uploads/${req.file.originalname}`;
      }

      next();
    });
  };
};

// ─── Delete File Helper ───────────────────────
const deleteFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn('File deletion skipped');
  }
};

const deleteOldFile = (oldFileUrl) => {
  if (!oldFileUrl) return;
  if (oldFileUrl.includes('default-') || oldFileUrl.startsWith('http')) return;
  deleteFile(oldFileUrl);
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const UPLOAD_PATHS = {
  thumbnails: '/tmp/thumbnails',
  avatars: '/tmp/avatars',
  temp: '/tmp/temp',
};

module.exports = {
  uploadThumbnailMiddleware: handleUpload(uploadThumbnail),
  uploadAvatarMiddleware: handleUpload(uploadAvatar),
  uploadMultipleMiddleware: handleUpload(uploadMultipleImages),
  uploadThumbnail,
  uploadAvatar,
  deleteFile,
  deleteOldFile,
  formatFileSize,
  UPLOAD_PATHS,
};const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── Only create directories in development ───
if (process.env.NODE_ENV !== 'production') {
  const dirs = [
    path.join(__dirname, '../public/uploads/thumbnails'),
    path.join(__dirname, '../public/uploads/avatars'),
    path.join(__dirname, '../public/uploads/temp'),
  ];

  dirs.forEach((dir) => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      console.warn('Directory creation skipped:', dir);
    }
  });
}

// ─── Memory Storage (works on Vercel) ────────
const memoryStorage = multer.memoryStorage();

// ─── File Filter ──────────────────────────────
const imageFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files allowed!'), false);
  }
};

// ─── Multer Upload Instances ──────────────────
const uploadThumbnail = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single('thumbnail');

const uploadAvatar = multer({
  storage: memoryStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single('avatar');

const uploadMultipleImages = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: imageFilter,
}).array('images', 5);

// ─── Error Handler Wrapper ────────────────────
const handleUpload = (uploadFn) => {
  return (req, res, next) => {
    uploadFn(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          let message;
          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              message = 'File too large. Maximum 5MB allowed.';
              break;
            case 'LIMIT_FILE_COUNT':
              message = 'Too many files.';
              break;
            default:
              message = `Upload error: ${err.message}`;
          }
          return res.status(400).json({ success: false, message });
        }
        if (err.message) {
          return res.status(400).json({ success: false, message: err.message });
        }
        return res.status(500).json({ success: false, message: 'Upload failed.' });
      }

      if (req.file) {
        req.file.publicUrl = `/uploads/${req.file.originalname}`;
      }

      next();
    });
  };
};

// ─── Delete File Helper ───────────────────────
const deleteFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn('File deletion skipped');
  }
};

const deleteOldFile = (oldFileUrl) => {
  if (!oldFileUrl) return;
  if (oldFileUrl.includes('default-') || oldFileUrl.startsWith('http')) return;
  deleteFile(oldFileUrl);
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const UPLOAD_PATHS = {
  thumbnails: '/tmp/thumbnails',
  avatars: '/tmp/avatars',
  temp: '/tmp/temp',
};

module.exports = {
  uploadThumbnailMiddleware: handleUpload(uploadThumbnail),
  uploadAvatarMiddleware: handleUpload(uploadAvatar),
  uploadMultipleMiddleware: handleUpload(uploadMultipleImages),
  uploadThumbnail,
  uploadAvatar,
  deleteFile,
  deleteOldFile,
  formatFileSize,
  UPLOAD_PATHS,
};
