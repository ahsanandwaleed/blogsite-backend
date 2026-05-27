// ============================================
// SEND EMAIL UTILITY
// Using Nodemailer for email functionality
// ============================================

const nodemailer = require('nodemailer');

/**
 * Create email transporter
 * Uses Gmail SMTP or any other provider
 */
const createTransporter = () => {
  const transporter = nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  return transporter;
};

/**
 * Send a generic email
 * @param {object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body
 */
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"BlogSite" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text || '',
      html: options.html || '',
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${options.to} | ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    throw new Error('Email could not be sent');
  }
};

/**
 * Send Welcome Email to new user
 * @param {string} email - User email
 * @param {string} name - User name
 */
const sendWelcomeEmail = async (email, name) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #f4f4f4; }
        .container {
          max-width: 600px;
          margin: 30px auto;
          background: #ffffff;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px;
          text-align: center;
          color: white;
        }
        .header h1 { margin: 0; font-size: 28px; }
        .body { padding: 40px; color: #333; }
        .body p { line-height: 1.8; font-size: 16px; }
        .btn {
          display: inline-block;
          padding: 14px 30px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          text-decoration: none;
          border-radius: 25px;
          margin-top: 20px;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #999;
          font-size: 13px;
          border-top: 1px solid #eee;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to BlogSite!</h1>
        </div>
        <div class="body">
          <p>Hi <strong>${name}</strong>,</p>
          <p>
            Welcome aboard! We're thrilled to have you join our blogging community.
            Start sharing your thoughts, ideas, and stories with the world.
          </p>
          <p>Here's what you can do:</p>
          <ul>
            <li>✍️ Create and publish blog posts</li>
            <li>💬 Comment on posts</li>
            <li>❤️ Like and bookmark articles</li>
            <li>📧 Subscribe to newsletters</li>
          </ul>
          <a href="${process.env.CLIENT_URL}" class="btn">
            Visit BlogSite →
          </a>
        </div>
        <div class="footer">
          <p>© 2024 BlogSite. All rights reserved.</p>
          <p>You received this email because you registered on BlogSite.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: '🎉 Welcome to BlogSite!',
    html,
  });
};

/**
 * Send Password Reset Email
 * @param {string} email - User email
 * @param {string} name - User name
 * @param {string} resetToken - Password reset token
 */
const sendPasswordResetEmail = async (email, name, resetToken) => {
  const resetURL = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #f4f4f4; }
        .container {
          max-width: 600px;
          margin: 30px auto;
          background: #ffffff;
          border-radius: 10px;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          padding: 40px;
          text-align: center;
          color: white;
        }
        .header h1 { margin: 0; }
        .body { padding: 40px; color: #333; }
        .body p { line-height: 1.8; }
        .btn {
          display: inline-block;
          padding: 14px 30px;
          background: linear-gradient(135deg, #f093fb, #f5576c);
          color: white;
          text-decoration: none;
          border-radius: 25px;
          margin: 20px 0;
          font-weight: bold;
        }
        .warning {
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 8px;
          padding: 15px;
          margin-top: 20px;
          color: #856404;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #999;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset</h1>
        </div>
        <div class="body">
          <p>Hi <strong>${name}</strong>,</p>
          <p>
            We received a request to reset your password.
            Click the button below to create a new password.
          </p>
          <a href="${resetURL}" class="btn">Reset My Password →</a>
          <div class="warning">
            ⚠️ This link will expire in <strong>1 hour</strong>.
            If you didn't request a password reset, please ignore this email.
          </div>
        </div>
        <div class="footer">
          <p>© 2024 BlogSite. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: '🔐 Reset Your BlogSite Password',
    html,
  });
};

/**
 * Send Newsletter Email
 * @param {string} email - Subscriber email
 * @param {string} postTitle - New post title
 * @param {string} postSlug - Post slug for URL
 * @param {string} postExcerpt - Short description
 */
const sendNewsletterEmail = async (
  email,
  postTitle,
  postSlug,
  postExcerpt
) => {
  const postURL = `${process.env.CLIENT_URL}/blog/${postSlug}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #f4f4f4; }
        .container {
          max-width: 600px;
          margin: 30px auto;
          background: #ffffff;
          border-radius: 10px;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          padding: 40px;
          text-align: center;
          color: white;
        }
        .body { padding: 40px; color: #333; }
        .post-title {
          font-size: 22px;
          font-weight: bold;
          color: #333;
          margin-bottom: 10px;
        }
        .post-excerpt {
          color: #666;
          line-height: 1.8;
          margin-bottom: 20px;
        }
        .btn {
          display: inline-block;
          padding: 14px 30px;
          background: linear-gradient(135deg, #4facfe, #00f2fe);
          color: white;
          text-decoration: none;
          border-radius: 25px;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #999;
          font-size: 13px;
          border-top: 1px solid #eee;
        }
        .unsubscribe { color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📰 New Post Alert!</h1>
        </div>
        <div class="body">
          <p>A new article has been published:</p>
          <div class="post-title">${postTitle}</div>
          <div class="post-excerpt">${postExcerpt}</div>
          <a href="${postURL}" class="btn">Read Full Article →</a>
        </div>
        <div class="footer">
          <p>© 2024 BlogSite</p>
          <p class="unsubscribe">
            Don't want these emails?
            <a href="${process.env.CLIENT_URL}/unsubscribe?email=${email}">
              Unsubscribe
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `📰 New Post: ${postTitle}`,
    html,
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendNewsletterEmail,
};