const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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

// Process video for Instagram
const processVideo = async (inputUrl, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputUrl)
      .videoCodec('libx264')
      .audioCodec('aac')
      .size('1080x1920') // Instagram Reels aspect ratio
      .aspect('9:16')
      .fps(30)
      .outputOptions([
        '-preset fast',
        '-crf 23',
        '-maxrate 4M',
        '-bufsize 8M',
        '-movflags +faststart'
      ])
      .on('end', () => {
        console.log('Video processing completed');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Video processing error:', err);
        reject(err);
      })
      .save(outputPath);
  });
};

// Download video from URL
const downloadVideo = async (url, outputPath) => {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream'
  });

  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(outputPath));
    writer.on('error', reject);
  });
};

// Create Instagram Reel container
const createReelContainer = async (instagramAccountId, accessToken, mediaUrl, caption) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${instagramAccountId}/media`,
      {
        media_type: 'REELS',
        video_url: mediaUrl,
        caption: caption
      },
      {
        params: {
          access_token: accessToken
        }
      }
    );

    return response.data.id;
  } catch (error) {
    console.error('Create container error:', error);
    throw error;
  }
};

// Publish Instagram Reel
const publishReel = async (instagramAccountId, accessToken, containerId) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`,
      {
        creation_id: containerId
      },
      {
        params: {
          access_token: accessToken
        }
      }
    );

    return response.data.id;
  } catch (error) {
    console.error('Publish error:', error);
    throw error;
  }
};

// Get all posts for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check if this is a development user and create some mock posts
    if (req.user.facebook_id === 'dev-user-123') {
      // Create some mock posts for development
      const mockPosts = [
        {
          id: 1,
          user_id: req.user.id,
          instagram_account_id: 1,
          content: 'Amazing sunset view! 🌅 #sunset #nature #photography',
          media_url: 'https://via.placeholder.com/1080x1920/FF6B6B/FFFFFF?text=Sunset+Reel',
          media_type: 'reel',
          scheduled_for: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
          status: 'pending',
          instagram_username: 'dev_account_1',
          labels: ['nature', 'sunset'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          user_id: req.user.id,
          instagram_account_id: 2,
          content: 'Cooking tutorial time! 👨‍🍳 #cooking #tutorial #food',
          media_url: 'https://via.placeholder.com/1080x1920/4ECDC4/FFFFFF?text=Cooking+Reel',
          media_type: 'reel',
          scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
          status: 'pending',
          instagram_username: 'dev_account_2',
          labels: ['cooking', 'tutorial'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 3,
          user_id: req.user.id,
          instagram_account_id: 1,
          content: 'Dance moves that went viral! 💃 #dance #viral #trending',
          media_url: 'https://via.placeholder.com/1080x1920/45B7D1/FFFFFF?text=Dance+Reel',
          media_type: 'reel',
          scheduled_for: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          status: 'published',
          instagram_username: 'dev_account_1',
          labels: ['dance', 'viral'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      // Insert mock posts if they don't exist
      for (const post of mockPosts) {
        const existingPost = await pool.query(
          'SELECT * FROM posts WHERE id = $1',
          [post.id]
        );

        if (existingPost.rows.length === 0) {
          await pool.query(
            `INSERT INTO posts 
             (id, user_id, instagram_account_id, content, media_url, media_type, scheduled_for, status, labels) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              post.id,
              post.user_id,
              post.instagram_account_id,
              post.content,
              post.media_url,
              post.media_type,
              post.scheduled_for,
              post.status,
              post.labels
            ]
          );
        }
      }
    }

    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, ia.username as instagram_username 
      FROM posts p 
      JOIN instagram_accounts ia ON p.instagram_account_id = ia.id 
      WHERE p.user_id = $1
    `;
    const params = [req.user.id];

    if (status) {
      query += ' AND p.status = $2';
      params.push(status);
    }

    query += ' ORDER BY p.scheduled_for DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const posts = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM posts WHERE user_id = $1';
    const countParams = [req.user.id];
    
    if (status) {
      countQuery += ' AND status = $2';
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);
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
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get post by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const post = await pool.query(
      `SELECT p.*, ia.username as instagram_username 
       FROM posts p 
       JOIN instagram_accounts ia ON p.instagram_account_id = ia.id 
       WHERE p.id = $1 AND p.user_id = $2`,
      [id, req.user.id]
    );

    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({
      success: true,
      post: post.rows[0]
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Create new post
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { content, media_url, media_type, scheduled_for, instagram_account, labels } = req.body;

    // Get Instagram account ID
    const accountResult = await pool.query(
      'SELECT id FROM instagram_accounts WHERE username = $1 AND user_id = $2',
      [instagram_account, req.user.id]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Instagram account not found' });
    }

    const instagramAccountId = accountResult.rows[0].id;

    // Insert post
    const postResult = await pool.query(
      `INSERT INTO posts 
       (user_id, instagram_account_id, content, media_url, media_type, scheduled_for, labels) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        req.user.id,
        instagramAccountId,
        content,
        media_url,
        media_type || 'reel',
        new Date(scheduled_for),
        labels ? labels.split(',').map(l => l.trim()) : []
      ]
    );

    res.json({
      success: true,
      post: postResult.rows[0]
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Update post
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, media_url, scheduled_for, labels } = req.body;

    const post = await pool.query(
      'UPDATE posts SET content = $1, media_url = $2, scheduled_for = $3, labels = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND user_id = $6 RETURNING *',
      [content, media_url, new Date(scheduled_for), labels, id, req.user.id]
    );

    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({
      success: true,
      post: post.rows[0]
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const post = await pool.query(
      'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Publish post immediately (for testing)
router.post('/:id/publish', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const post = await pool.query(
      `SELECT p.*, ia.business_account_id, ia.access_token 
       FROM posts p 
       JOIN instagram_accounts ia ON p.instagram_account_id = ia.id 
       WHERE p.id = $1 AND p.user_id = $2`,
      [id, req.user.id]
    );

    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postData = post.rows[0];

    // Process video if needed
    let processedMediaUrl = postData.media_url;
    
    if (postData.media_url.includes('youtube.com') || postData.media_url.includes('youtu.be')) {
      // For YouTube videos, you'd need to extract the actual video URL
      // This is a simplified example - in production, you'd use youtube-dl or similar
      return res.status(400).json({ 
        error: 'YouTube videos need to be processed first. Please provide a direct video URL.' 
      });
    }

    // Create container
    const containerId = await createReelContainer(
      postData.business_account_id,
      postData.access_token,
      processedMediaUrl,
      postData.content
    );

    // Update post with container ID
    await pool.query(
      'UPDATE posts SET container_id = $1, status = $2 WHERE id = $3',
      [containerId, 'container_created', id]
    );

    // Publish the reel
    const publishedId = await publishReel(
      postData.business_account_id,
      postData.access_token,
      containerId
    );

    // Update post with published ID
    await pool.query(
      'UPDATE posts SET published_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [publishedId, 'published', id]
    );

    res.json({
      success: true,
      message: 'Post published successfully',
      published_id: publishedId
    });
  } catch (error) {
    console.error('Publish post error:', error);
    
    // Update post status to failed
    await pool.query(
      'UPDATE posts SET status = $1, error_message = $2 WHERE id = $3',
      ['failed', error.message, req.params.id]
    );

    res.status(500).json({ 
      error: 'Failed to publish post',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

module.exports = router;
