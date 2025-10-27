const cron = require('node-cron');
const { Pool } = require('pg');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/instagram_reels'
});

class SchedulerService {
  constructor() {
    this.isRunning = false;
    this.processingQueue = new Set();
  }

  start() {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting Instagram Reels Scheduler...');

    // Run every minute to check for scheduled posts
    cron.schedule('* * * * *', () => {
      this.processScheduledPosts();
    });

    // Run every 5 minutes to process video queue
    cron.schedule('*/5 * * * *', () => {
      this.processVideoQueue();
    });

    // Run every hour to clean up old files
    cron.schedule('0 * * * *', () => {
      this.cleanupOldFiles();
    });

    console.log('✅ Scheduler started successfully');
  }

  stop() {
    this.isRunning = false;
    console.log('🛑 Scheduler stopped');
  }

  async processScheduledPosts() {
    try {
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      // Get posts scheduled for the next 5 minutes
      const posts = await pool.query(
        `SELECT p.*, ia.business_account_id, ia.access_token, ia.username 
         FROM posts p 
         JOIN instagram_accounts ia ON p.instagram_account_id = ia.id 
         WHERE p.scheduled_for <= $1 
         AND p.scheduled_for >= $2 
         AND p.status = 'pending' 
         AND ia.is_active = true`,
        [fiveMinutesFromNow, now]
      );

      for (const post of posts.rows) {
        if (this.processingQueue.has(post.id)) {
          continue; // Skip if already processing
        }

        this.processingQueue.add(post.id);
        
        // Process in background
        setImmediate(() => {
          this.publishPost(post);
        });
      }
    } catch (error) {
      console.error('Error processing scheduled posts:', error);
    }
  }

  async publishPost(post) {
    try {
      console.log(`📤 Publishing post ${post.id} to @${post.username}`);

      // Update status to processing
      await pool.query(
        'UPDATE posts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['processing', post.id]
      );

      // Process video if needed
      let mediaUrl = post.media_url;
      
      if (this.needsVideoProcessing(post.media_url)) {
        mediaUrl = await this.processVideoForPost(post);
      }

      // Create Instagram container
      const containerId = await this.createReelContainer(
        post.business_account_id,
        post.access_token,
        mediaUrl,
        post.content
      );

      // Update post with container ID
      await pool.query(
        'UPDATE posts SET container_id = $1, status = $2 WHERE id = $3',
        [containerId, 'container_created', post.id]
      );

      // Wait a moment before publishing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Publish the reel
      const publishedId = await this.publishReel(
        post.business_account_id,
        post.access_token,
        containerId
      );

      // Update post with published ID
      await pool.query(
        'UPDATE posts SET published_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [publishedId, 'published', post.id]
      );

      console.log(`✅ Post ${post.id} published successfully as ${publishedId}`);

    } catch (error) {
      console.error(`❌ Failed to publish post ${post.id}:`, error);
      
      // Update post status to failed
      await pool.query(
        'UPDATE posts SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['failed', error.message, post.id]
      );
    } finally {
      this.processingQueue.delete(post.id);
    }
  }

  needsVideoProcessing(url) {
    return url.includes('youtube.com') || 
           url.includes('youtu.be') || 
           url.includes('drive.google.com') ||
           !url.endsWith('.mp4');
  }

  async processVideoForPost(post) {
    try {
      const videoId = uuidv4();
      const inputPath = path.join(__dirname, '../uploads', `temp_${videoId}.mp4`);
      const outputPath = path.join(__dirname, '../uploads', `processed_${videoId}.mp4`);

      // Download video
      await this.downloadVideo(post.media_url, inputPath);

      // Process video
      await this.processVideo(inputPath, outputPath);

      // Upload to cloud storage (simplified - in production use AWS S3, etc.)
      const processedUrl = await this.uploadProcessedVideo(outputPath);

      // Clean up local files
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);

      return processedUrl;
    } catch (error) {
      console.error('Video processing error:', error);
      throw error;
    }
  }

  async downloadVideo(url, outputPath) {
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
  }

  async processVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
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
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .save(outputPath);
    });
  }

  async uploadProcessedVideo(filePath) {
    // In production, upload to AWS S3, Google Cloud Storage, etc.
    // For now, return the local file path
    return `file://${filePath}`;
  }

  async createReelContainer(instagramAccountId, accessToken, mediaUrl, caption) {
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
  }

  async publishReel(instagramAccountId, accessToken, containerId) {
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
  }

  async processVideoQueue() {
    try {
      // Get posts that need video processing
      const posts = await pool.query(
        `SELECT p.*, ia.business_account_id, ia.access_token 
         FROM posts p 
         JOIN instagram_accounts ia ON p.instagram_account_id = ia.id 
         WHERE p.status = 'video_processing' 
         AND p.scheduled_for <= NOW() + INTERVAL '1 hour'`,
        []
      );

      for (const post of posts.rows) {
        if (this.processingQueue.has(post.id)) {
          continue;
        }

        this.processingQueue.add(post.id);
        
        setImmediate(() => {
          this.processVideoForPost(post);
        });
      }
    } catch (error) {
      console.error('Error processing video queue:', error);
    }
  }

  async cleanupOldFiles() {
    try {
      const uploadsDir = path.join(__dirname, '../uploads');
      const files = fs.readdirSync(uploadsDir);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < oneDayAgo) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Cleaned up old file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up files:', error);
    }
  }
}

// Create singleton instance
const scheduler = new SchedulerService();

module.exports = scheduler;
