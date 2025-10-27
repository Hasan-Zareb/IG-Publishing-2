const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/instagram_reels'
});

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    req.user = user.rows[0];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get total posts count
    const totalPostsResult = await pool.query(
      'SELECT COUNT(*) FROM posts WHERE user_id = $1',
      [userId]
    );
    const totalPosts = parseInt(totalPostsResult.rows[0].count);

    // Get posts by status
    const statusStatsResult = await pool.query(
      `SELECT status, COUNT(*) as count 
       FROM posts 
       WHERE user_id = $1 
       GROUP BY status`,
      [userId]
    );
    const statusStats = statusStatsResult.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {});

    // Get posts scheduled for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayPostsResult = await pool.query(
      'SELECT COUNT(*) FROM posts WHERE user_id = $1 AND scheduled_for BETWEEN $2 AND $3',
      [userId, todayStart, todayEnd]
    );
    const todayPosts = parseInt(todayPostsResult.rows[0].count);

    // Get posts scheduled for this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekPostsResult = await pool.query(
      'SELECT COUNT(*) FROM posts WHERE user_id = $1 AND scheduled_for BETWEEN $2 AND $3',
      [userId, weekStart, weekEnd]
    );
    const weekPosts = parseInt(weekPostsResult.rows[0].count);

    // Get active Instagram accounts count
    const activeAccountsResult = await pool.query(
      'SELECT COUNT(*) FROM instagram_accounts WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    const activeAccounts = parseInt(activeAccountsResult.rows[0].count);

    // Get recent import batches
    const recentImportsResult = await pool.query(
      `SELECT * FROM import_batches 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [userId]
    );

    // Get recent posts
    const recentPostsResult = await pool.query(
      `SELECT p.*, ia.username as instagram_username 
       FROM posts p 
       JOIN instagram_accounts ia ON p.instagram_account_id = ia.id 
       WHERE p.user_id = $1 
       ORDER BY p.created_at DESC 
       LIMIT 10`,
      [userId]
    );

    res.json({
      success: true,
      stats: {
        totalPosts,
        statusStats,
        todayPosts,
        weekPosts,
        activeAccounts
      },
      recentImports: recentImportsResult.rows,
      recentPosts: recentPostsResult.rows
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get posts calendar view
router.get('/calendar', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    const posts = await pool.query(
      `SELECT p.id, p.content, p.scheduled_for, p.status, ia.username as instagram_username 
       FROM posts p 
       JOIN instagram_accounts ia ON p.instagram_account_id = ia.id 
       WHERE p.user_id = $1 AND p.scheduled_for BETWEEN $2 AND $3 
       ORDER BY p.scheduled_for`,
      [req.user.id, start_date, end_date]
    );

    res.json({
      success: true,
      posts: posts.rows
    });
  } catch (error) {
    console.error('Calendar view error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
});

// Get posts by status
router.get('/posts/:status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const posts = await pool.query(
      `SELECT p.*, ia.username as instagram_username 
       FROM posts p 
       JOIN instagram_accounts ia ON p.instagram_account_id = ia.id 
       WHERE p.user_id = $1 AND p.status = $2 
       ORDER BY p.scheduled_for DESC 
       LIMIT $3 OFFSET $4`,
      [req.user.id, status, limit, offset]
    );

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM posts WHERE user_id = $1 AND status = $2',
      [req.user.id, status]
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      posts: posts.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get posts by status error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Retry failed posts
router.post('/retry-failed', authenticateToken, async (req, res) => {
  try {
    const { post_ids } = req.body;

    if (!Array.isArray(post_ids) || post_ids.length === 0) {
      return res.status(400).json({ error: 'post_ids array is required' });
    }

    // Reset failed posts to pending status
    const result = await pool.query(
      `UPDATE posts 
       SET status = 'pending', error_message = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ANY($1) AND user_id = $2 AND status = 'failed' 
       RETURNING id`,
      [post_ids, req.user.id]
    );

    res.json({
      success: true,
      message: `${result.rows.length} posts reset to pending status`,
      reset_count: result.rows.length
    });
  } catch (error) {
    console.error('Retry failed posts error:', error);
    res.status(500).json({ error: 'Failed to retry posts' });
  }
});

// Bulk update posts status
router.patch('/bulk-update', authenticateToken, async (req, res) => {
  try {
    const { post_ids, status } = req.body;

    if (!Array.isArray(post_ids) || !status) {
      return res.status(400).json({ error: 'post_ids array and status are required' });
    }

    const result = await pool.query(
      `UPDATE posts 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ANY($2) AND user_id = $3 
       RETURNING id`,
      [status, post_ids, req.user.id]
    );

    res.json({
      success: true,
      message: `${result.rows.length} posts updated to ${status}`,
      updated_count: result.rows.length
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to update posts' });
  }
});

// Get system health
router.get('/health', authenticateToken, async (req, res) => {
  try {
    // Check database connection
    const dbCheck = await pool.query('SELECT NOW()');
    const dbStatus = dbCheck.rows.length > 0 ? 'connected' : 'disconnected';

    // Check Instagram API (simplified)
    const apiStatus = 'operational'; // In production, you'd check actual API status

    res.json({
      success: true,
      health: {
        database: dbStatus,
        instagram_api: apiStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      error: 'Health check failed',
      health: {
        database: 'error',
        instagram_api: 'unknown',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
