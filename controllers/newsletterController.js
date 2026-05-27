// ============================================
// NEWSLETTER CONTROLLER
// Handle newsletter subscriptions
// ============================================

const Newsletter = require('../models/Newsletter');
const { sendEmail } = require('../utils/sendEmail');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');

// ─────────────────────────────────────────────
// @desc    Subscribe to newsletter
// @route   POST /api/newsletter/subscribe
// @access  Public
// ─────────────────────────────────────────────
exports.subscribe = asyncHandler(async (req, res) => {
  const { email, name, preferences } = req.body;

  // ─── Get IP Address ───────────────────────────
  const ipAddress =
    req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';

  // ─── Subscribe ────────────────────────────────
  const { subscriber, isNew, resubscribed } = await Newsletter.subscribe(
    email,
    name,
    {
      source: 'website',
      ipAddress,
      userId: req.user?._id || null,
    }
  );

  // ─── Update Preferences ───────────────────────
  if (preferences && isNew) {
    subscriber.preferences = { ...subscriber.preferences, ...preferences };
    await subscriber.save({ validateBeforeSave: false });
  }

  // ─── Send Confirmation Email ──────────────────
  if (isNew || resubscribed) {
    try {
      const verifyUrl = `${process.env.CLIENT_URL}/api/newsletter/verify/${subscriber.verificationToken}`;

      await sendEmail({
        to: email,
        subject: '✅ Confirm your newsletter subscription',
        html: `
          <div style="font-family:Arial;max-width:600px;margin:auto;padding:30px;">
            <h2 style="color:#667eea;">Almost there! 🎉</h2>
            <p>Hi ${name || 'there'},</p>
            <p>Please confirm your subscription by clicking the button below:</p>
            <a href="${verifyUrl}"
              style="
                display:inline-block;
                padding:14px 30px;
                background:linear-gradient(135deg,#667eea,#764ba2);
                color:white;
                text-decoration:none;
                border-radius:25px;
                margin:20px 0;
                font-weight:bold;
              ">
              Confirm Subscription ✅
            </a>
            <p style="color:#999;font-size:13px;">
              This link expires in 24 hours.
              If you didn't subscribe, please ignore this email.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('⚠️ Newsletter confirmation email failed:', emailError.message);
    }
  }

  // ─── Response Message ─────────────────────────
  let message;
  if (isNew) {
    message = 'Subscribed! Please check your email to confirm.';
  } else if (resubscribed) {
    message = 'Welcome back! You have been re-subscribed.';
  } else {
    message = 'You are already subscribed to our newsletter.';
  }

  console.log(`📧 Newsletter subscription: ${email} (new: ${isNew})`);

  res.status(isNew ? 201 : 200).json({
    success: true,
    message,
    isNew,
    resubscribed,
  });
});

// ─────────────────────────────────────────────
// @desc    Verify newsletter subscription
// @route   GET /api/newsletter/verify/:token
// @access  Public
// ─────────────────────────────────────────────
exports.verifySubscription = asyncHandler(async (req, res) => {
  const { token } = req.params;

  // ─── Find Subscriber ──────────────────────────
  const subscriber = await Newsletter.findOne({
    verificationToken: token,
    verificationExpires: { $gt: Date.now() },
  }).select('+verificationToken +verificationExpires');

  if (!subscriber) {
    throw new AppError(
      'Verification link is invalid or has expired. Please subscribe again.',
      400
    );
  }

  // ─── Verify Subscription ──────────────────────
  subscriber.isVerified = true;
  subscriber.verificationToken = undefined;
  subscriber.verificationExpires = undefined;
  await subscriber.save({ validateBeforeSave: false });

  console.log(`✅ Newsletter verified: ${subscriber.email}`);

  // Redirect to frontend success page
  res.redirect(
    `${process.env.CLIENT_URL}/frontend/pages/index.html?newsletter=verified`
  );
});

// ─────────────────────────────────────────────
// @desc    Unsubscribe from newsletter
// @route   GET /api/newsletter/unsubscribe/:token
// @access  Public
// ─────────────────────────────────────────────
exports.unsubscribe = asyncHandler(async (req, res) => {
  const { token } = req.params;

  // ─── Find Subscriber ──────────────────────────
  const subscriber = await Newsletter.findByUnsubscribeToken(token);

  if (!subscriber) {
    throw new AppError('Invalid unsubscribe link.', 400);
  }

  // ─── Unsubscribe ──────────────────────────────
  await subscriber.unsubscribe();

  console.log(`👋 Newsletter unsubscribed: ${subscriber.email}`);

  res.status(200).json({
    success: true,
    message: 'You have been successfully unsubscribed.',
  });
});

// ─────────────────────────────────────────────
// @desc    Get newsletter stats (admin)
// @route   GET /api/newsletter/stats
// @access  Private (Admin)
// ─────────────────────────────────────────────
exports.getNewsletterStats = asyncHandler(async (req, res) => {
  const stats = await Newsletter.getStats();

  const recentSubscribers = await Newsletter.find({ isActive: true })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('email name isVerified createdAt source');

  res.status(200).json({
    success: true,
    stats,
    recentSubscribers,
  });
});

// ─────────────────────────────────────────────
// @desc    Send newsletter to all subscribers (admin)
// @route   POST /api/newsletter/send
// @access  Private (Admin)
// ─────────────────────────────────────────────
exports.sendNewsletter = asyncHandler(async (req, res) => {
  const { subject, htmlContent, postId } = req.body;

  if (!subject || !htmlContent) {
    throw new AppError('Subject and content are required.', 400);
  }

  // ─── Get All Active Subscribers ───────────────
  const subscribers = await Newsletter.getActiveSubscribers();

  if (subscribers.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'No active subscribers found.',
      sent: 0,
    });
  }

  // ─── Send Emails in Batches ───────────────────
  const BATCH_SIZE = 50;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);

    const emailPromises = batch.map(async (subscriber) => {
      try {
        const unsubscribeUrl = `${process.env.CLIENT_URL}/api/newsletter/unsubscribe/${subscriber.unsubscribeToken || ''}`;

        const fullHtml = `
          ${htmlContent}
          <hr style="margin:30px 0;border:none;border-top:1px solid #eee;">
          <p style="color:#999;font-size:12px;text-align:center;">
            You're receiving this because you subscribed to our newsletter.<br>
            <a href="${unsubscribeUrl}" style="color:#667eea;">Unsubscribe</a>
          </p>
        `;

        await sendEmail({
          to: subscriber.email,
          subject,
          html: fullHtml,
        });

        sent++;
      } catch (error) {
        failed++;
        console.error(`❌ Failed to send to ${subscriber.email}:`, error.message);
      }
    });

    await Promise.allSettled(emailPromises);

    // Small delay between batches
    if (i + BATCH_SIZE < subscribers.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`📧 Newsletter sent: ${sent} success, ${failed} failed`);

  res.status(200).json({
    success: true,
    message: `Newsletter sent to ${sent} subscribers.`,
    totalSubscribers: subscribers.length,
    sent,
    failed,
  });
});

// ─────────────────────────────────────────────
// @desc    Get all subscribers (admin)
// @route   GET /api/newsletter/subscribers
// @access  Private (Admin)
// ─────────────────────────────────────────────
exports.getAllSubscribers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // ─── Build Filter ─────────────────────────────
  const filter = {};
  if (status === 'active') filter.isActive = true;
  if (status === 'unsubscribed') filter.isActive = false;
  if (status === 'verified') { filter.isActive = true; filter.isVerified = true; }

  const [subscribers, total] = await Promise.all([
    Newsletter.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-verificationToken -verificationExpires'),
    Newsletter.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: subscribers.length,
    total,
    totalPages: Math.ceil(total / limitNum),
    currentPage: pageNum,
    subscribers,
  });
});