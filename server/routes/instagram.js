const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

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

// Get Facebook Pages and discover Instagram Business accounts
router.get('/discover', authenticateToken, async (req, res) => {
  try {
    // Check if this is a development user
    if (req.user.facebook_id === 'dev-user-123') {
      // Return mock Instagram accounts for development
      const mockAccounts = [
        {
          id: 1,
          user_id: req.user.id,
          username: 'dev_account_1',
          business_account_id: 'dev_ig_1',
          access_token: 'dev_token_1',
          is_active: true,
          follower_count: 1500,
          profile_picture_url: 'https://via.placeholder.com/150/FF6B6B/FFFFFF?text=IG1',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          user_id: req.user.id,
          username: 'dev_account_2',
          business_account_id: 'dev_ig_2',
          access_token: 'dev_token_2',
          is_active: true,
          follower_count: 3200,
          profile_picture_url: 'https://via.placeholder.com/150/4ECDC4/FFFFFF?text=IG2',
          created_at: new Date().toISOString()
        }
      ];

      // Insert mock accounts if they don't exist
      for (const account of mockAccounts) {
        const existingAccount = await pool.query(
          'SELECT * FROM instagram_accounts WHERE business_account_id = $1',
          [account.business_account_id]
        );

        if (existingAccount.rows.length === 0) {
          await pool.query(
            `INSERT INTO instagram_accounts 
             (user_id, username, business_account_id, access_token, follower_count, profile_picture_url) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              account.user_id,
              account.username,
              account.business_account_id,
              account.access_token,
              account.follower_count,
              account.profile_picture_url
            ]
          );
        }
      }

      // Get the actual accounts from database
      const accounts = await pool.query(
        'SELECT * FROM instagram_accounts WHERE user_id = $1',
        [req.user.id]
      );

      return res.json({
        success: true,
        accounts: accounts.rows,
        total: accounts.rows.length
      });
    }

    const { facebook_token } = req.user;
    
    // Get Facebook Pages
    const pagesResponse = await axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
      params: {
        access_token: facebook_token,
        fields: 'id,name,access_token,instagram_business_account'
      }
    });

    const pages = pagesResponse.data.data;
    const instagramAccounts = [];

    for (const page of pages) {
      if (page.instagram_business_account) {
        // Get Instagram Business account details
        const instagramResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${page.instagram_business_account.id}`,
          {
            params: {
              access_token: page.access_token,
              fields: 'id,username,account_type,media_count,followers_count,profile_picture_url'
            }
          }
        );

        const instagramData = instagramResponse.data;
        
        // Check if account already exists
        const existingAccount = await pool.query(
          'SELECT * FROM instagram_accounts WHERE business_account_id = $1',
          [instagramData.id]
        );

        if (existingAccount.rows.length === 0) {
          // Insert new Instagram account
          const newAccount = await pool.query(
            `INSERT INTO instagram_accounts 
             (user_id, username, business_account_id, access_token, follower_count, profile_picture_url) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [
              req.user.id,
              instagramData.username,
              instagramData.id,
              page.access_token,
              instagramData.followers_count || 0,
              instagramData.profile_picture_url
            ]
          );
          instagramAccounts.push(newAccount.rows[0]);
        } else {
          // Update existing account
          await pool.query(
            `UPDATE instagram_accounts 
             SET access_token = $1, follower_count = $2, profile_picture_url = $3 
             WHERE business_account_id = $4`,
            [
              page.access_token,
              instagramData.followers_count || 0,
              instagramData.profile_picture_url,
              instagramData.id
            ]
          );
          instagramAccounts.push(existingAccount.rows[0]);
        }
      }
    }

    res.json({
      success: true,
      accounts: instagramAccounts,
      total: instagramAccounts.length
    });
  } catch (error) {
    console.error('Instagram discovery error:', error);
    res.status(500).json({ 
      error: 'Failed to discover Instagram accounts',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

// Get all Instagram accounts for user
router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const accounts = await pool.query(
      'SELECT * FROM instagram_accounts WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({
      success: true,
      accounts: accounts.rows
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Toggle account active status
router.patch('/accounts/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const account = await pool.query(
      'UPDATE instagram_accounts SET is_active = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [is_active, id, req.user.id]
    );

    if (account.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({
      success: true,
      account: account.rows[0]
    });
  } catch (error) {
    console.error('Toggle account error:', error);
    res.status(500).json({ error: 'Failed to toggle account status' });
  }
});

// Test Instagram account connection
router.post('/accounts/:id/test', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const account = await pool.query(
      'SELECT * FROM instagram_accounts WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (account.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const { business_account_id, access_token } = account.rows[0];

    // Test connection by getting account info
    const testResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${business_account_id}`,
      {
        params: {
          access_token,
          fields: 'id,username,account_type'
        }
      }
    );

    res.json({
      success: true,
      message: 'Connection successful',
      account_info: testResponse.data
    });
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ 
      error: 'Connection test failed',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

module.exports = router;
