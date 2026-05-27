// ============================================
// SLUGIFY UTILITY
// Converts text to SEO-friendly URL slugs
// ============================================

/**
 * Convert text to a URL-friendly slug
 * Example: "Hello World! My Post" → "hello-world-my-post"
 * @param {string} text - Input text
 * @returns {string} - URL slug
 */
const slugify = (text) => {
  if (!text || typeof text !== 'string') {
    throw new Error('Slugify requires a valid string input');
  }

  const slug = text
    .toString()
    .toLowerCase()                        // Convert to lowercase
    .trim()                               // Remove whitespace from ends
    .replace(/\s+/g, '-')               // Replace spaces with -
    .replace(/[^\w\-]+/g, '')           // Remove non-word chars
    .replace(/\-\-+/g, '-')            // Replace multiple - with single -
    .replace(/^-+/, '')                 // Trim - from start
    .replace(/-+$/, '');               // Trim - from end

  return slug;
};

/**
 * Generate a unique slug by appending a timestamp
 * Used when a slug already exists in database
 * @param {string} text - Input text
 * @returns {string} - Unique slug with timestamp
 */
const generateUniqueSlug = (text) => {
  const baseSlug = slugify(text);
  const timestamp = Date.now().toString(36); // Short timestamp in base36
  return `${baseSlug}-${timestamp}`;
};

/**
 * Generate slug from title and check uniqueness in DB
 * @param {string} title - Post title
 * @param {object} Model - Mongoose model to check against
 * @param {string} excludeId - ID to exclude (for edits)
 * @returns {string} - Unique slug
 */
const generateSlugFromTitle = async (title, Model, excludeId = null) => {
  try {
    let slug = slugify(title);
    let slugExists = true;
    let counter = 0;

    // Keep checking until we find a unique slug
    while (slugExists) {
      const query = { slug: counter === 0 ? slug : `${slug}-${counter}` };

      // Exclude current document when editing
      if (excludeId) {
        query._id = { $ne: excludeId };
      }

      const existingDoc = await Model.findOne(query);

      if (!existingDoc) {
        // Slug is unique
        slug = counter === 0 ? slug : `${slug}-${counter}`;
        slugExists = false;
      } else {
        counter++;
      }
    }

    return slug;
  } catch (error) {
    console.error('❌ Error generating slug:', error.message);
    // Fallback to unique slug with timestamp
    return generateUniqueSlug(title);
  }
};

/**
 * Validate if a string is a valid slug format
 * @param {string} slug - Slug to validate
 * @returns {boolean} - True if valid slug
 */
const isValidSlug = (slug) => {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
};

/**
 * Convert slug back to readable title
 * Example: "hello-world" → "Hello World"
 * @param {string} slug - URL slug
 * @returns {string} - Readable title
 */
const deslugify = (slug) => {
  if (!slug || typeof slug !== 'string') return '';

  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

module.exports = {
  slugify,
  generateUniqueSlug,
  generateSlugFromTitle,
  isValidSlug,
  deslugify,
};