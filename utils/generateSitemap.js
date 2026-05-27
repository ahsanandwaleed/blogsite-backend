// ============================================
// SITEMAP GENERATOR UTILITY
// Generates XML sitemap for SEO
// ============================================

const fs = require('fs');
const path = require('path');

/**
 * Format date to W3C format for sitemap
 * @param {Date} date - JavaScript Date object
 * @returns {string} - Formatted date string
 */
const formatDate = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

/**
 * Escape special XML characters
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
const escapeXml = (str) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Generate a single URL entry for sitemap
 * @param {object} urlData - URL configuration
 * @returns {string} - XML URL element
 */
const generateUrlEntry = ({
  loc,
  lastmod,
  changefreq = 'weekly',
  priority = '0.5',
}) => {
  return `
  <url>
    <loc>${escapeXml(loc)}</loc>
    ${lastmod ? `<lastmod>${formatDate(lastmod)}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
};

/**
 * Generate complete XML sitemap
 * @param {Array} urls - Array of URL objects
 * @returns {string} - Complete XML sitemap string
 */
const generateSitemapXml = (urls) => {
  const urlEntries = urls.map(generateUrlEntry).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="
    http://www.sitemaps.org/schemas/sitemap/0.9
    http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd
  ">
${urlEntries}
</urlset>`;
};

/**
 * Generate full sitemap with static + dynamic URLs
 * @param {Array} posts - Array of blog posts from DB
 * @param {Array} categories - Array of categories from DB
 * @returns {string} - Complete sitemap XML
 */
const generateSitemap = (posts = [], categories = []) => {
  const baseUrl = process.env.CLIENT_URL || 'http://localhost:5500';
  const today = new Date();

  // ─── Static Pages ─────────────────────────────
  const staticUrls = [
    {
      loc: `${baseUrl}/`,
      lastmod: today,
      changefreq: 'daily',
      priority: '1.0',
    },
    {
      loc: `${baseUrl}/pages/about.html`,
      lastmod: today,
      changefreq: 'monthly',
      priority: '0.8',
    },
    {
      loc: `${baseUrl}/pages/contact.html`,
      lastmod: today,
      changefreq: 'monthly',
      priority: '0.7',
    },
    {
      loc: `${baseUrl}/pages/login.html`,
      lastmod: today,
      changefreq: 'monthly',
      priority: '0.5',
    },
    {
      loc: `${baseUrl}/pages/register.html`,
      lastmod: today,
      changefreq: 'monthly',
      priority: '0.5',
    },
    {
      loc: `${baseUrl}/pages/search.html`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.6',
    },
  ];

  // ─── Dynamic Post URLs ─────────────────────────
  const postUrls = posts.map((post) => ({
    loc: `${baseUrl}/pages/single-post.html?slug=${post.slug}`,
    lastmod: post.updatedAt || post.createdAt,
    changefreq: 'weekly',
    priority: post.featured ? '0.9' : '0.8',
  }));

  // ─── Category URLs ─────────────────────────────
  const categoryUrls = categories.map((category) => ({
    loc: `${baseUrl}/pages/category.html?slug=${category.slug}`,
    lastmod: category.updatedAt || today,
    changefreq: 'weekly',
    priority: '0.7',
  }));

  // Combine all URLs
  const allUrls = [...staticUrls, ...postUrls, ...categoryUrls];

  return generateSitemapXml(allUrls);
};

/**
 * Save sitemap to file
 * @param {string} sitemapContent - XML sitemap content
 * @param {string} outputPath - Path to save the sitemap
 * @returns {boolean} - Success status
 */
const saveSitemap = (sitemapContent, outputPath) => {
  try {
    const dir = path.dirname(outputPath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, sitemapContent, 'utf8');
    console.log(`✅ Sitemap saved to: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('❌ Error saving sitemap:', error.message);
    return false;
  }
};

/**
 * Generate and save sitemap (main function)
 * Call this when posts/categories are updated
 * @param {Array} posts - Blog posts
 * @param {Array} categories - Categories
 */
const generateAndSaveSitemap = (posts, categories) => {
  try {
    const sitemapContent = generateSitemap(posts, categories);

    // Save to public directory
    const outputPath = path.join(
      __dirname,
      '../public/sitemap.xml'
    );

    saveSitemap(sitemapContent, outputPath);

    return sitemapContent;
  } catch (error) {
    console.error('❌ Sitemap generation failed:', error.message);
    throw error;
  }
};

/**
 * Generate robots.txt content
 * @returns {string} - Robots.txt content
 */
const generateRobotsTxt = () => {
  const baseUrl = process.env.CLIENT_URL || 'http://localhost:5500';

  return `# Robots.txt - BlogSite
# Generated automatically

User-agent: *
Allow: /

# Block admin pages from indexing
Disallow: /pages/admin/
Disallow: /pages/dashboard.html
Disallow: /pages/create-post.html
Disallow: /pages/edit-post.html

# API routes
Disallow: /api/

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml
`;
};

module.exports = {
  generateSitemap,
  generateSitemapXml,
  generateAndSaveSitemap,
  saveSitemap,
  generateRobotsTxt,
  formatDate,
  escapeXml,
};