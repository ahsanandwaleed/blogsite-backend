// ============================================
// READING TIME ESTIMATOR UTILITY
// Calculates estimated reading time for posts
// ============================================

// Average reading speed (words per minute)
const AVERAGE_READING_SPEED = 200;

// Average image viewing time in seconds
const IMAGE_VIEW_TIME = 12;

/**
 * Count words in a text string
 * @param {string} text - Plain text content
 * @returns {number} - Word count
 */
const countWords = (text) => {
  if (!text || typeof text !== 'string') return 0;

  // Remove extra whitespace and split by spaces
  const words = text
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 0);

  return words.length;
};

/**
 * Strip HTML tags from content
 * @param {string} html - HTML content
 * @returns {string} - Plain text
 */
const stripHtml = (html) => {
  if (!html) return '';

  return html
    .replace(/<[^>]*>/g, ' ')  // Replace tags with space
    .replace(/&nbsp;/g, ' ')   // Replace &nbsp;
    .replace(/&amp;/g, '&')    // Replace &amp;
    .replace(/&lt;/g, '<')     // Replace &lt;
    .replace(/&gt;/g, '>')     // Replace &gt;
    .replace(/&quot;/g, '"')   // Replace &quot;
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
};

/**
 * Count images in HTML content
 * @param {string} html - HTML content
 * @returns {number} - Number of images
 */
const countImages = (html) => {
  if (!html) return 0;
  const imgMatches = html.match(/<img[^>]*>/gi);
  return imgMatches ? imgMatches.length : 0;
};

/**
 * Calculate reading time for content
 * @param {string} content - Blog post content (HTML or plain text)
 * @param {boolean} isHtml - Whether content is HTML
 * @returns {object} - Reading time details
 */
const calculateReadingTime = (content, isHtml = true) => {
  if (!content) {
    return {
      minutes: 0,
      seconds: 0,
      text: '0 min read',
      wordCount: 0,
    };
  }

  // Strip HTML if content is HTML
  const plainText = isHtml ? stripHtml(content) : content;

  // Count words
  const wordCount = countWords(plainText);

  // Count images (add image viewing time)
  const imageCount = isHtml ? countImages(content) : 0;

  // Calculate reading time in seconds
  const wordsReadingTime = (wordCount / AVERAGE_READING_SPEED) * 60;
  const imagesReadingTime = imageCount * IMAGE_VIEW_TIME;
  const totalSeconds = wordsReadingTime + imagesReadingTime;

  // Convert to minutes
  const totalMinutes = Math.ceil(totalSeconds / 60);

  // Format the reading time text
  let readingText;
  if (totalMinutes < 1) {
    readingText = 'Less than 1 min read';
  } else if (totalMinutes === 1) {
    readingText = '1 min read';
  } else {
    readingText = `${totalMinutes} min read`;
  }

  return {
    minutes: totalMinutes,
    seconds: Math.ceil(totalSeconds),
    text: readingText,
    wordCount: wordCount,
    imageCount: imageCount,
  };
};

/**
 * Get reading speed category
 * @param {number} wordCount - Total word count
 * @returns {string} - Post length category
 */
const getPostLengthCategory = (wordCount) => {
  if (wordCount < 300) return 'Quick Read';
  if (wordCount < 700) return 'Short Read';
  if (wordCount < 1500) return 'Medium Read';
  if (wordCount < 3000) return 'Long Read';
  return 'Deep Dive';
};

/**
 * Format reading time for display
 * @param {number} minutes - Minutes to read
 * @returns {string} - Formatted string
 */
const formatReadingTime = (minutes) => {
  if (!minutes || minutes < 1) return '< 1 min';
  if (minutes === 1) return '1 min read';
  return `${minutes} min read`;
};

/**
 * Get full reading stats for a post
 * @param {string} content - Post content
 * @param {string} title - Post title
 * @returns {object} - Complete reading stats
 */
const getReadingStats = (content, title = '') => {
  const readingTime = calculateReadingTime(content);
  const titleWordCount = countWords(title);
  const totalWordCount = readingTime.wordCount + titleWordCount;

  return {
    ...readingTime,
    wordCount: totalWordCount,
    category: getPostLengthCategory(totalWordCount),
    charactersCount: stripHtml(content).length,
  };
};

module.exports = {
  calculateReadingTime,
  countWords,
  stripHtml,
  countImages,
  getPostLengthCategory,
  formatReadingTime,
  getReadingStats,
};