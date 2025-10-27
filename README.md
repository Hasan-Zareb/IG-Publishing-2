# Instagram Reels Publisher

A high-volume Instagram Reels publishing platform that allows you to publish 200-500 Instagram Reels daily across multiple Instagram Business accounts using CSV-based bulk content management.

## Features

- **Facebook OAuth Login**: Single Facebook account login
- **Auto-Discovery**: Automatically find all Instagram Business accounts linked to Facebook Pages
- **CSV Import System**: Bulk import 200-500 posts with validation and preview
- **Instagram Reels Publishing**: Official Instagram Graph API integration
- **Video Processing**: Automatic video optimization for Instagram using FFmpeg
- **Scheduling**: Future-dated posting with timezone support
- **Status Tracking**: Real-time publishing status updates
- **Multi-Account Management**: Manage multiple Instagram Business accounts
- **Calendar View**: Visual calendar for scheduled posts

## Tech Stack

### Backend
- Node.js + Express
- PostgreSQL database
- Instagram Graph API
- FFmpeg for video processing
- Passport.js for Facebook OAuth
- Multer for file uploads
- Node-cron for scheduling

### Frontend
- React + TypeScript
- Tailwind CSS
- React Query for data fetching
- React Hook Form
- React Router
- Lucide React icons

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- FFmpeg installed on your system
- Facebook Developer Account
- Instagram Business Account

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd instagram-reels-publisher
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Database
   DATABASE_URL=postgresql://localhost:5432/instagram_reels
   
   # Server
   PORT=5000
   NODE_ENV=development
   CLIENT_URL=http://localhost:5173
   
   # JWT
   JWT_SECRET=your-super-secret-jwt-key-here
   SESSION_SECRET=your-session-secret-key-here
   
   # Facebook OAuth
   FACEBOOK_APP_ID=your-facebook-app-id
   FACEBOOK_APP_SECRET=your-facebook-app-secret
   FACEBOOK_CALLBACK_URL=http://localhost:5000/api/auth/facebook/callback
   ```

4. **Set up the database**
   ```bash
   # Create PostgreSQL database
   createdb instagram_reels
   
   # Run migrations
   cd server
   npm run migrate
   ```

5. **Install FFmpeg**
   
   **macOS:**
   ```bash
   brew install ffmpeg
   ```
   
   **Ubuntu/Debian:**
   ```bash
   sudo apt update
   sudo apt install ffmpeg
   ```
   
   **Windows:**
   Download from https://ffmpeg.org/download.html

6. **Set up Facebook App**
   
   - Go to [Facebook Developers](https://developers.facebook.com/)
   - Create a new app
   - Add Facebook Login and Instagram Basic Display products
   - Configure OAuth redirect URIs
   - Get your App ID and App Secret

## Running the Application

1. **Start the development servers**
   ```bash
   npm run dev
   ```
   
   This will start both the backend (port 5000) and frontend (port 5173) servers.

2. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000/api

## Usage

### 1. Initial Setup
1. Visit http://localhost:5173
2. Click "Continue with Facebook" to authenticate
3. The system will automatically discover your Instagram Business accounts
4. Review and activate desired accounts

### 2. CSV Import
1. Go to the Import page
2. Download the CSV template
3. Fill in your posts with the required format:
   ```csv
   content,media_url,media_type,scheduled_for,instagram_account,labels
   "Amazing dance! 💃 #viral #dance",https://youtu.be/VIDEO_ID,reel,"2025-01-15 20:30","dance_account","dance,viral"
   ```
4. Upload your CSV file
5. Review validation results and preview
6. Import the posts

### 3. Managing Posts
- View all posts in the Posts page
- Filter by status (pending, processing, published, failed)
- Publish posts immediately for testing
- Delete unwanted posts

### 4. Calendar View
- See all scheduled posts in calendar format
- Click on dates to view posts for that day
- Navigate between months

## CSV Format

Your CSV file must include these columns:

| Column | Required | Format | Example |
|--------|----------|--------|---------|
| content | Yes | Text (max 2200 chars) | "Amazing dance! 💃 #viral #dance" |
| media_url | Yes | Valid URL | "https://youtu.be/VIDEO_ID" |
| media_type | Yes | "reel" | "reel" |
| scheduled_for | Yes | ISO Date | "2025-01-15 20:30" |
| instagram_account | Yes | Username (no @) | "dance_account" |
| labels | No | Comma-separated | "dance,viral" |

## API Endpoints

### Authentication
- `GET /api/auth/facebook` - Initiate Facebook OAuth
- `GET /api/auth/facebook/callback` - OAuth callback
- `GET /api/auth/me` - Get current user

### Instagram Accounts
- `GET /api/instagram/discover` - Discover Instagram accounts
- `GET /api/instagram/accounts` - Get all accounts
- `PATCH /api/instagram/accounts/:id/toggle` - Toggle account status
- `POST /api/instagram/accounts/:id/test` - Test connection

### Posts
- `GET /api/posts` - Get all posts
- `POST /api/posts` - Create new post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/publish` - Publish post immediately

### CSV Import
- `GET /api/csv/template` - Download CSV template
- `POST /api/csv/upload` - Upload and validate CSV
- `POST /api/csv/import` - Import validated posts

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/calendar` - Get calendar data

## Production Deployment

1. **Set up production environment variables**
2. **Configure reverse proxy (nginx)**
3. **Set up SSL certificates**
4. **Configure database backups**
5. **Set up monitoring and logging**

## Troubleshooting

### Common Issues

1. **FFmpeg not found**
   - Ensure FFmpeg is installed and in your PATH
   - Set `FFMPEG_PATH` in environment variables

2. **Facebook OAuth errors**
   - Check Facebook App configuration
   - Verify redirect URIs match exactly
   - Ensure Instagram Basic Display is enabled

3. **Database connection issues**
   - Verify PostgreSQL is running
   - Check database credentials
   - Ensure database exists

4. **Video processing fails**
   - Check FFmpeg installation
   - Verify video URLs are accessible
   - Check file permissions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support, please open an issue in the GitHub repository or contact the development team.
