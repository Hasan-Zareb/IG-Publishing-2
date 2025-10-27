# 🚀 Deployment Guide

This guide covers deploying your Instagram Reels Publisher app to various platforms.

## 📋 Pre-Deployment Checklist

1. **Update Environment Variables**
   - Replace all placeholder values in your `.env` file
   - Set up your Facebook App with production URLs
   - Configure your database connection

2. **Facebook App Configuration**
   - Add your production domain to Valid OAuth Redirect URIs
   - Update App Domains in Facebook App Settings
   - Ensure all required permissions are approved

3. **Database Setup**
   - Set up a production PostgreSQL database
   - Run database migrations
   - Configure connection string

## 🌐 Deployment Platforms

### 1. Railway (Recommended for Full-Stack Apps)

**Pros:**
- Easy PostgreSQL integration
- Automatic deployments from GitHub
- Built-in environment variable management
- Good for full-stack applications

**Steps:**
1. Push your code to GitHub
2. Connect Railway to your GitHub repo
3. Add PostgreSQL service
4. Set environment variables
5. Deploy

**Commands:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### 2. Heroku

**Pros:**
- Mature platform with good documentation
- Easy PostgreSQL add-on
- Good for Node.js applications

**Steps:**
1. Install Heroku CLI
2. Create Heroku app
3. Add PostgreSQL add-on
4. Set environment variables
5. Deploy

**Commands:**
```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Login and create app
heroku login
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set DATABASE_URL=your-database-url

# Deploy
git push heroku main
```

### 3. Vercel (Frontend) + Railway (Backend)

**Pros:**
- Excellent for React applications
- Fast global CDN
- Easy GitHub integration

**Steps:**
1. Deploy backend to Railway
2. Deploy frontend to Vercel
3. Update API URLs in frontend

**Commands:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy frontend
cd client
vercel --prod

# Deploy backend to Railway
railway up
```

### 4. DigitalOcean App Platform

**Pros:**
- Good pricing
- Easy scaling
- Built-in database options

**Steps:**
1. Connect GitHub repository
2. Configure build settings
3. Add database
4. Set environment variables
5. Deploy

### 5. AWS (Advanced)

**Pros:**
- Highly scalable
- Full control
- Enterprise-grade

**Services:**
- EC2 for application server
- RDS for PostgreSQL
- S3 for file storage
- CloudFront for CDN

## 🔧 Environment Variables Setup

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Session
SESSION_SECRET=your-super-secret-session-key

# Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_CALLBACK_URL=https://your-domain.com/api/auth/facebook/callback

# Instagram API
INSTAGRAM_APP_ID=your-instagram-app-id
INSTAGRAM_APP_SECRET=your-instagram-app-secret
INSTAGRAM_REDIRECT_URI=https://your-domain.com/api/auth/instagram/callback
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=your-webhook-verify-token
INSTAGRAM_CLIENT_TOKEN=your-instagram-client-token

# Server
PORT=5001
NODE_ENV=production

# Client
CLIENT_URL=https://your-domain.com
```

## 🐳 Docker Deployment

### Local Docker Testing

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Docker Deployment

```bash
# Build image
docker build -t instagram-reels-publisher .

# Run with environment variables
docker run -d \
  -p 5001:5001 \
  -e DATABASE_URL=your-database-url \
  -e FACEBOOK_APP_ID=your-app-id \
  -e FACEBOOK_APP_SECRET=your-app-secret \
  instagram-reels-publisher
```

## 🔍 Post-Deployment Steps

1. **Test OAuth Flow**
   - Visit your deployed app
   - Test Facebook login
   - Verify Instagram account discovery

2. **Database Migration**
   - Run database migrations
   - Verify all tables are created

3. **File Uploads**
   - Ensure uploads directory is writable
   - Test CSV import functionality

4. **Monitoring**
   - Set up error monitoring (Sentry)
   - Configure logging
   - Set up health checks

## 🚨 Common Issues

### 1. CORS Errors
- Ensure CLIENT_URL is set correctly
- Check CORS configuration in server

### 2. Database Connection Issues
- Verify DATABASE_URL format
- Check database accessibility
- Ensure migrations are run

### 3. Facebook OAuth Issues
- Verify redirect URIs in Facebook App
- Check environment variables
- Ensure HTTPS is enabled

### 4. File Upload Issues
- Check uploads directory permissions
- Verify file size limits
- Test with different file types

## 📊 Recommended Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Vercel)      │◄──►│   (Railway)     │◄──►│   (PostgreSQL)  │
│   React App     │    │   Node.js API   │    │   Production DB │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   CDN           │    │   File Storage  │
│   (CloudFront)  │    │   (S3/R2)       │
└─────────────────┘    └─────────────────┘
```

## 💰 Cost Estimates

### Railway
- **Hobby Plan**: $5/month
- **Pro Plan**: $20/month
- **Database**: Included

### Heroku
- **Basic Dyno**: $7/month
- **PostgreSQL**: $9/month
- **Total**: ~$16/month

### Vercel + Railway
- **Vercel Pro**: $20/month
- **Railway Pro**: $20/month
- **Total**: ~$40/month

### DigitalOcean
- **Basic App**: $12/month
- **Managed Database**: $15/month
- **Total**: ~$27/month

## 🎯 Quick Start Recommendation

**For testing and development:**
1. Use **Railway** for full-stack deployment
2. Connect your GitHub repository
3. Add PostgreSQL service
4. Set environment variables
5. Deploy and test

This gives you a production-ready app with a real domain that you can use for Facebook OAuth testing!
