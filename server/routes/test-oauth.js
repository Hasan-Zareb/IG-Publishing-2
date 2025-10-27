const express = require('express');
const router = express.Router();

// Test OAuth configuration
router.get('/test', (req, res) => {
  const config = {
    facebook_app_id: process.env.FACEBOOK_APP_ID,
    facebook_app_secret: process.env.FACEBOOK_APP_SECRET ? '***configured***' : 'NOT_SET',
    facebook_callback_url: process.env.FACEBOOK_CALLBACK_URL,
    instagram_app_id: process.env.INSTAGRAM_APP_ID,
    instagram_app_secret: process.env.INSTAGRAM_APP_SECRET ? '***configured***' : 'NOT_SET',
    instagram_redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
    client_url: process.env.CLIENT_URL,
    node_env: process.env.NODE_ENV
  };

  res.json({
    status: 'OAuth Configuration Test',
    config,
    recommendations: {
      facebook_oauth_url: `${process.env.CLIENT_URL}/api/auth/facebook`,
      facebook_callback_url: `${process.env.CLIENT_URL}/api/auth/facebook/callback`,
      required_facebook_scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list', 'instagram_basic'],
      facebook_app_settings: 'https://developers.facebook.com/apps/',
      instagram_basic_display: 'https://developers.facebook.com/apps/'
    }
  });
});

module.exports = router;
