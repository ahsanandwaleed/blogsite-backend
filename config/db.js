// ============================================
// DATABASE CONFIG
// MongoDB connection setup
// ============================================

const mongoose = require('mongoose');

/**
 * Connect to MongoDB
 * Uses MONGO_URI from environment variables
 */
const connectDB = async () => {
  try {
    // ─── Connection Options ───────────────────────
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    // ─── Connect ──────────────────────────────────
    const conn = await mongoose.connect(process.env.MONGO_URI, options);

    console.log('');
    console.log('✅ ================================');
    console.log(`✅  MongoDB Connected!`);
    console.log(`✅  Host: ${conn.connection.host}`);
    console.log(`✅  DB  : ${conn.connection.name}`);
    console.log('✅ ================================');
    console.log('');

    // ─── Connection Events ────────────────────────
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected!');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅  MongoDB reconnected!');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌  MongoDB error:', err.message);
    });

  } catch (error) {
    console.error('❌  MongoDB connection failed:', error.message);
    console.error('💡  Check your MONGO_URI in .env file');
    process.exit(1); // Exit process on DB connection failure
  }
};

module.exports = connectDB;