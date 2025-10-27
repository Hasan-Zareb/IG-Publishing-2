const express = require('express');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/instagram_reels'
});

// Configure Facebook OAuth Strategy
const facebookConfig = {
  clientID: process.env.FACEBOOK_APP_ID || 'placeholder-app-id',
  clientSecret: process.env.FACEBOOK_APP_SECRET || 'placeholder-app-secret',
  callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:5001/api/auth/facebook/callback',
  profileFields: ['id', 'name', 'email', 'picture']
};

if (facebookConfig.clientID === 'placeholder-app-id') {
  console.warn('⚠️  Facebook OAuth not configured. Using placeholder values.');
}

passport.use(new FacebookStrategy(facebookConfig, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE facebook_id = $1',
      [profile.id]
    );

    if (existingUser.rows.length > 0) {
      // Update token if user exists
      await pool.query(
        'UPDATE users SET facebook_token = $1 WHERE facebook_id = $2',
        [accessToken, profile.id]
      );
      return done(null, existingUser.rows[0]);
    } else {
      // Create new user
      const newUser = await pool.query(
        'INSERT INTO users (username, email, facebook_id, facebook_token) VALUES ($1, $2, $3, $4) RETURNING *',
        [
          profile.displayName || profile.username || profile.id,
          profile.emails?.[0]?.value || `${profile.id}@facebook.com`,
          profile.id,
          accessToken
        ]
      );
      return done(null, newUser.rows[0]);
    }
  } catch (error) {
    return done(error, null);
  }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, user.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

// Facebook OAuth routes
router.get('/facebook', (req, res) => {
  if (facebookConfig.clientID === 'placeholder-app-id') {
    // Development mode - redirect to mock login
    return res.redirect('/api/auth/facebook/dev-login');
  }
  passport.authenticate('facebook', {
    scope: ['email', 'pages_manage_posts', 'pages_read_engagement', 'instagram_basic']
  })(req, res);
});

// Development mode login (bypasses Facebook OAuth)
router.get('/facebook/dev-login', async (req, res) => {
  try {
    // Create or get a development user
    const devUser = await pool.query(
      'SELECT * FROM users WHERE facebook_id = $1',
      ['dev-user-123']
    );

    let user;
    if (devUser.rows.length > 0) {
      user = devUser.rows[0];
    } else {
      // Create development user
      const newUser = await pool.query(
        'INSERT INTO users (username, email, facebook_id, facebook_token) VALUES ($1, $2, $3, $4) RETURNING *',
        ['Dev User', 'dev@example.com', 'dev-user-123', 'dev-token']
      );
      user = newUser.rows[0];
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-jwt-secret',
      { expiresIn: '24h' }
    );

    // Redirect to frontend with token
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('Dev login error:', error);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=auth_failed`);
  }
});

router.get('/facebook/callback', 
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      // Generate JWT token
      const token = jwt.sign(
        { userId: req.user.id, email: req.user.email },
        process.env.JWT_SECRET || 'your-jwt-secret',
        { expiresIn: '24h' }
      );

      // Redirect to frontend with token
      const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Auth callback error:', error);
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=auth_failed`);
    }
  }
);

// Logout route
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    
    const user = await pool.query('SELECT id, username, email, facebook_id, created_at FROM users WHERE id = $1', [decoded.userId]);
    
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
