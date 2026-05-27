// ============================================
// SERVER.JS
// Main Express server entry point
// ============================================

// ─── Handle Uncaught Exceptions ───────────────
// Must be at very top
const {
  handleUncaughtException,
} = require('./middleware/errorMiddleware');
handleUncaughtException();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// ─── Import Routes ────────────────────────────
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const searchRoutes = require('./routes/searchRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');

// ─── Import Error Middleware ───────────────────
const {
  errorHandler,
  notFound,
  handleUnhandledRejection,
} = require('./middleware/errorMiddleware');

// ─── Import DB Config ─────────────────────────
const connectDB = require('./config/db');

// ─────────────────────────────────────────────
// INITIALIZE EXPRESS APP
// ─────────────────────────────────────────────
const app = express();

// ─────────────────────────────────────────────
// CONNECT TO DATABASE
// ─────────────────────────────────────────────
connectDB();

// ─────────────────────────────────────────────
// GLOBAL RATE LIMITER
// Limit all API requests
// ─────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // Max 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again after 15 minutes.',
  },
  skip: (req) => {
    // Skip rate limit for static files
    return req.path.startsWith('/uploads');
  },
});

// Strict limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // Only 20 auth requests
  message: {
    success: false,
    message: 'Too many auth attempts. Please wait 15 minutes.',
  },
});

// ─────────────────────────────────────────────
// SECURITY MIDDLEWARE
// ─────────────────────────────────────────────

// Set security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Disable for development
  })
);

// ─────────────────────────────────────────────
// CORS CONFIGURATION
// ─────────────────────────────────────────────
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.CLIENT_URL || 'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3000',
      'http://localhost:5000',
    ];

    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,              // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight

// ─────────────────────────────────────────────
// BODY PARSERS
// ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─────────────────────────────────────────────
// LOGGER (Development only)
// ─────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  console.log('📝 Morgan logger enabled');
}

// ─────────────────────────────────────────────
// STATIC FILES
// Serve uploaded files and frontend
// ─────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// ─────────────────────────────────────────────
// APPLY RATE LIMITERS
// ─────────────────────────────────────────────
app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter);

// ─────────────────────────────────────────────
// HEALTH CHECK ROUTE
// ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'BlogSite API is running!',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    mongodb:
      mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
  });
});

// ─────────────────────────────────────────────
// SITEMAP ROUTE
// ─────────────────────────────────────────────
app.get('/sitemap.xml', (req, res) => {
  const sitemapPath = path.join(__dirname, 'public/sitemap.xml');

  if (require('fs').existsSync(sitemapPath)) {
    res.setHeader('Content-Type', 'application/xml');
    res.sendFile(sitemapPath);
  } else {
    res.status(404).json({ message: 'Sitemap not generated yet.' });
  }
});

// ─────────────────────────────────────────────
// ROBOTS.TXT ROUTE
// ─────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  const { generateRobotsTxt } = require('./utils/generateSitemap');
  res.setHeader('Content-Type', 'text/plain');
  res.send(generateRobotsTxt());
});

// ─────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/newsletter', newsletterRoutes);

// ─────────────────────────────────────────────
// FRONTEND CATCH-ALL
// Serve frontend HTML files
// ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/index.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/about.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/contact.html'));
});

app.get('/blog/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/single-post.html'));
});

// ─────────────────────────────────────────────
// ERROR HANDLING
// Must be AFTER all routes
// ─────────────────────────────────────────────

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ================================');
  console.log(`🚀  BlogSite Server Started!`);
  console.log('🚀 ================================');
  console.log(`📡  Port     : ${PORT}`);
  console.log(`🌍  Mode     : ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗  URL      : http://localhost:${PORT}`);
  console.log(`📊  API      : http://localhost:${PORT}/api`);
  console.log(`❤️   Health   : http://localhost:${PORT}/api/health`);
  console.log('🚀 ================================');
  console.log('');
});

// ─────────────────────────────────────────────
// HANDLE UNHANDLED REJECTIONS
// ─────────────────────────────────────────────
handleUnhandledRejection(server);

module.exports = app;

// server.js - Add after connectDB()
const {
  testCloudinaryConnection,
} = require('./config/cloudinary');

// Test Cloudinary on startup
if (process.env.CLOUDINARY_CLOUD_NAME) {
  testCloudinaryConnection();
}