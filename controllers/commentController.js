// ============================================
// COMMENT CONTROLLER
// Handle post comments CRUD
// ============================================

const Comment = require('../models/Comment');
const Post = require('../models/Post');
const { asyncHandler, AppError } = require('../middleware/errorMiddleware');

// ─────────────────────────────────────────────
// @desc    Get comments for a post
// @route   GET /api/comments/:postId
// @access  Public
// ─────────────────────────────────────────────
exports.getPostComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // ─── Check Post Exists ────────────────────────
  const post = await Post.findById(postId);
  if (!post) {
    throw new AppError('Post not found.', 404);
  }

  // ─── Check Comments Allowed ───────────────────
  if (!post.allowComments) {
    return res.status(200).json({
      success: true,
      message: 'Comments are disabled for this post.',
      comments: [],
      total: 0,
    });
  }

  // ─── Get Comments ─────────────────────────────
  const comments = await Comment.getPostComments(postId, page, limit);
  const total = await Comment.countDocuments({
    post: postId,
    parentComment: null,
    isApproved: true,
    isSpam: false,
  });

  res.status(200).json({
    success: true,
    count: comments.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    comments,
  });
});

// ─────────────────────────────────────────────
// @desc    Add comment to a post
// @route   POST /api/comments
// @access  Private
// ─────────────────────────────────────────────
exports.addComment = asyncHandler(async (req, res) => {
  const { text, postId, parentCommentId } = req.body;

  // ─── Check Post Exists ────────────────────────
  const post = await Post.findById(postId);
  if (!post) {
    throw new AppError('Post not found.', 404);
  }

  // ─── Check Comments Allowed ───────────────────
  if (!post.allowComments) {
    throw new AppError('Comments are disabled for this post.', 403);
  }

  // ─── Check Parent Comment (if reply) ─────────
  if (parentCommentId) {
    const parentComment = await Comment.findById(parentCommentId);
    if (!parentComment) {
      throw new AppError('Parent comment not found.', 404);
    }
  }

  // ─── Create Comment ───────────────────────────
  const comment = await Comment.create({
    text,
    post: postId,
    author: req.userId,
    parentComment: parentCommentId || null,
  });

  // ─── If Reply - Update Parent's Replies ───────
  if (parentCommentId) {
    await Comment.findByIdAndUpdate(parentCommentId, {
      $push: { replies: comment._id },
      $inc: { repliesCount: 1 },
    });
  }

  // ─── Populate Author Info ─────────────────────
  await comment.populate('author', 'name username avatar');

  console.log(`💬 New comment on post: ${post.title}`);

  res.status(201).json({
    success: true,
    message: 'Comment added successfully.',
    comment,
  });
});

// ─────────────────────────────────────────────
// @desc    Update a comment
// @route   PUT /api/comments/:id
// @access  Private (owner only)
// ─────────────────────────────────────────────
exports.updateComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  // ─── Find Comment ─────────────────────────────
  const comment = await Comment.findById(id);
  if (!comment) {
    throw new AppError('Comment not found.', 404);
  }

  // ─── Check Ownership ──────────────────────────
  if (
    comment.author.toString() !== req.userId.toString() &&
    req.userRole !== 'admin'
  ) {
    throw new AppError(
      'Access denied. You can only edit your own comments.',
      403
    );
  }

  // ─── Update Comment ───────────────────────────
  await comment.edit(text);
  await comment.populate('author', 'name username avatar');

  res.status(200).json({
    success: true,
    message: 'Comment updated successfully.',
    comment,
  });
});

// ─────────────────────────────────────────────
// @desc    Delete a comment
// @route   DELETE /api/comments/:id
// @access  Private (owner or admin)
// ─────────────────────────────────────────────
exports.deleteComment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // ─── Find Comment ─────────────────────────────
  const comment = await Comment.findById(id);
  if (!comment) {
    throw new AppError('Comment not found.', 404);
  }

  // ─── Check Ownership ──────────────────────────
  if (
    comment.author.toString() !== req.userId.toString() &&
    req.userRole !== 'admin'
  ) {
    throw new AppError(
      'Access denied. You can only delete your own comments.',
      403
    );
  }

  // ─── Delete Replies (if parent comment) ───────
  if (!comment.parentComment) {
    await Comment.deleteMany({ parentComment: id });
  }

  // ─── Update Parent's Reply Count ──────────────
  if (comment.parentComment) {
    await Comment.findByIdAndUpdate(comment.parentComment, {
      $pull: { replies: id },
      $inc: { repliesCount: -1 },
    });
  }

  // ─── Delete Comment ───────────────────────────
  await Comment.findOneAndDelete({ _id: id });

  console.log(`🗑️ Comment deleted by ${req.user.name}`);

  res.status(200).json({
    success: true,
    message: 'Comment deleted successfully.',
  });
});

// ─────────────────────────────────────────────
// @desc    Like / Unlike a comment
// @route   PUT /api/comments/:id/like
// @access  Private
// ─────────────────────────────────────────────
exports.toggleCommentLike = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    throw new AppError('Comment not found.', 404);
  }

  const isLiked = await comment.toggleLike(req.userId);

  res.status(200).json({
    success: true,
    message: isLiked ? 'Comment liked!' : 'Comment unliked.',
    isLiked,
    likesCount: comment.likesCount,
  });
});

// ─────────────────────────────────────────────
// @desc    Report a comment as spam
// @route   POST /api/comments/:id/report
// @access  Private
// ─────────────────────────────────────────────
exports.reportComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    throw new AppError('Comment not found.', 404);
  }

  // ─── Can't Report Own Comment ─────────────────
  if (comment.author.toString() === req.userId.toString()) {
    throw new AppError('You cannot report your own comment.', 400);
  }

  const reported = await comment.report(req.userId);

  if (!reported) {
    return res.status(200).json({
      success: true,
      message: 'You have already reported this comment.',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Comment reported. Our team will review it.',
  });
});