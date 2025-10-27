const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

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

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// CSV validation schema
const postSchema = Joi.object({
  content: Joi.string().required().max(2200),
  media_url: Joi.string().uri().required(),
  media_type: Joi.string().valid('reel').default('reel'),
  scheduled_for: Joi.date().iso().required(),
  instagram_account: Joi.string().required(),
  labels: Joi.string().optional()
});

// Download CSV template
router.get('/template', authenticateToken, (req, res) => {
  try {
    const csvWriter = createCsvWriter({
      path: 'template.csv',
      header: [
        { id: 'content', title: 'content' },
        { id: 'media_url', title: 'media_url' },
        { id: 'media_type', title: 'media_type' },
        { id: 'scheduled_for', title: 'scheduled_for' },
        { id: 'instagram_account', title: 'instagram_account' },
        { id: 'labels', title: 'labels' }
      ]
    });

    const sampleData = [
      {
        content: 'Amazing dance! 💃 #viral #dance',
        media_url: 'https://youtu.be/VIDEO_ID',
        media_type: 'reel',
        scheduled_for: '2025-01-15 20:30',
        instagram_account: 'dance_account',
        labels: 'dance,viral'
      }
    ];

    csvWriter.writeRecords(sampleData).then(() => {
      res.download('template.csv', 'instagram_reels_template.csv', (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // Clean up the file
        fs.unlink('template.csv', (unlinkErr) => {
          if (unlinkErr) console.error('Cleanup error:', unlinkErr);
        });
      });
    });
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// Upload and validate CSV
router.post('/upload', authenticateToken, upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file provided' });
    }

    const filePath = req.file.path;
    const posts = [];
    const errors = [];
    let rowNumber = 0;

    // Parse CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          rowNumber++;
          
          // Validate each row
          const { error, value } = postSchema.validate(row);
          if (error) {
            errors.push({
              row: rowNumber,
              error: error.details[0].message,
              data: row
            });
          } else {
            posts.push(value);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Validate Instagram accounts exist
    const instagramAccounts = await pool.query(
      'SELECT username FROM instagram_accounts WHERE user_id = $1 AND is_active = true',
      [req.user.id]
    );

    const validAccounts = instagramAccounts.rows.map(acc => acc.username);
    const accountErrors = [];

    posts.forEach((post, index) => {
      if (!validAccounts.includes(post.instagram_account)) {
        accountErrors.push({
          row: index + 1,
          error: `Instagram account '${post.instagram_account}' not found or inactive`,
          data: post
        });
      }
    });

    // Combine validation errors
    const allErrors = [...errors, ...accountErrors];

    // Clean up uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('File cleanup error:', err);
    });

    res.json({
      success: true,
      total_posts: posts.length,
      valid_posts: posts.length - allErrors.length,
      errors: allErrors,
      preview: posts.slice(0, 5) // Show first 5 posts as preview
    });
  } catch (error) {
    console.error('CSV upload error:', error);
    res.status(500).json({ error: 'Failed to process CSV file' });
  }
});

// Import validated posts
router.post('/import', authenticateToken, async (req, res) => {
  try {
    const { posts } = req.body;

    if (!posts || !Array.isArray(posts)) {
      return res.status(400).json({ error: 'Posts array is required' });
    }

    // Create import batch record
    const batchResult = await pool.query(
      'INSERT INTO import_batches (user_id, filename, total_posts) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, 'csv_import', posts.length]
    );

    const batchId = batchResult.rows[0].id;
    let importedCount = 0;
    let failedCount = 0;

    // Process each post
    for (const postData of posts) {
      try {
        // Get Instagram account ID
        const accountResult = await pool.query(
          'SELECT id FROM instagram_accounts WHERE username = $1 AND user_id = $2',
          [postData.instagram_account, req.user.id]
        );

        if (accountResult.rows.length === 0) {
          failedCount++;
          continue;
        }

        const instagramAccountId = accountResult.rows[0].id;

        // Insert post
        await pool.query(
          `INSERT INTO posts 
           (user_id, instagram_account_id, content, media_url, media_type, scheduled_for, labels) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.user.id,
            instagramAccountId,
            postData.content,
            postData.media_url,
            postData.media_type,
            new Date(postData.scheduled_for),
            postData.labels ? postData.labels.split(',').map(l => l.trim()) : []
          ]
        );

        importedCount++;
      } catch (error) {
        console.error('Post import error:', error);
        failedCount++;
      }
    }

    // Update batch status
    await pool.query(
      'UPDATE import_batches SET imported_count = $1, failed_count = $2, status = $3, completed_at = CURRENT_TIMESTAMP WHERE id = $4',
      [importedCount, failedCount, 'completed', batchId]
    );

    res.json({
      success: true,
      batch_id: batchId,
      imported_count: importedCount,
      failed_count: failedCount,
      total_posts: posts.length
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import posts' });
  }
});

// Get import history
router.get('/imports', authenticateToken, async (req, res) => {
  try {
    const imports = await pool.query(
      'SELECT * FROM import_batches WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );

    res.json({
      success: true,
      imports: imports.rows
    });
  } catch (error) {
    console.error('Get imports error:', error);
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
});

module.exports = router;
