#!/bin/bash

# Build script for production deployment

echo "🚀 Building Instagram Reels Publisher for production..."

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:all

# Build client
echo "🏗️ Building client..."
npm run build

# Create production directory
echo "📁 Creating production directory..."
mkdir -p dist
cp -r server dist/
cp -r client/dist dist/client/

# Copy necessary files
cp package.json dist/
cp Procfile dist/
cp railway.json dist/
cp Dockerfile dist/
cp docker-compose.yml dist/

echo "✅ Build complete! Production files are in the 'dist' directory."
echo "📋 Next steps:"
echo "1. Update your .env file with production values"
echo "2. Deploy to your chosen platform"
echo "3. Configure your Facebook App with the production URL"
