#!/bin/bash

# Configuration
SERVER="root@178.104.188.37"
REMOTE_PATH="/var/www/ayla-ai"

echo "📁 Ensuring remote directory exists..."
ssh $SERVER "mkdir -p $REMOTE_PATH"

echo "🚀 Syncing code to $SERVER..."
# Note: We let Docker build the React app in production, so we don't build locally.
rsync -avzP \
    --exclude 'front-end/kapruka-front/node_modules' \
    --exclude 'front-end/kapruka-front/dist' \
    --exclude 'kapruka-bridge/node_modules' \
    --exclude 'storage/framework' \
    --exclude 'public/hot' \
    --exclude 'bootstrap/cache' \
    --exclude '.git' \
    . $SERVER:$REMOTE_PATH/

echo "🔄 Updating Server Environment..."
ssh $SERVER << EOF
    cd $REMOTE_PATH
    
    # 1. FIX PERMISSIONS & FOLDERS FOR LARAVEL (CRITICAL)
    echo "🔧 Setting up Laravel storage permissions..."
    mkdir -p storage/framework/{sessions,views,cache}
    mkdir -p storage/logs
    
    # Wipe Mac caches
    rm -rf bootstrap/cache/*.php
    rm -f public/hot

    # Give the web user (www-data is usually 33) ownership of the ENTIRE directory 
    # so composer can install dependencies and Laravel can write logs.
    chown -R 33:33 $REMOTE_PATH
    chmod -R 775 $REMOTE_PATH/storage $REMOTE_PATH/bootstrap/cache

    # 2. Rebuild and restart containers
    echo "🐳 Rebuilding and restarting Docker containers..."
    docker-compose down
    docker-compose up -d --build
    
    # Wait for backend container to be ready
    echo "⏳ Waiting for PHP backend container to be ready..."
    for i in {1..30}; do
        if docker-compose exec -T kapruka-backend php -v > /dev/null 2>&1; then
            echo "✅ PHP Backend container ready"
            break
        fi
        sleep 2
    done

    # 3. Install PHP Dependencies and Run Migrations
    echo "📦 Installing PHP dependencies..."
    docker-compose exec -T -e COMPOSER_ALLOW_SUPERUSER=1 kapruka-backend composer install --no-dev --optimize-autoloader || echo "⚠️ Composer install failed!"
    
    # Make sure the newly created vendor directory is owned by the web server
    chown -R 33:33 $REMOTE_PATH/vendor 2>/dev/null || true

    # Re-create the storage symlink
    docker-compose exec -T kapruka-backend php artisan storage:link --force
    
    # Fix permissions on storage AFTER symlink is created
    chown -R 33:33 $REMOTE_PATH/storage/app/public
    chmod -R 755 $REMOTE_PATH/storage/app/public
    chown -R 33:33 $REMOTE_PATH/public/storage 2>/dev/null || true

    echo "🗄️ Running database migrations..."
    # Warning: Ensure .env has correct DB connection before running
    docker-compose exec -T kapruka-backend php artisan migrate --force || echo "⚠️ Migrations failed, check DB connection"
    
    echo "🧹 Caching Laravel configuration..."
    docker-compose exec -T kapruka-backend php artisan config:clear
    docker-compose exec -T kapruka-backend php artisan config:cache
    docker-compose exec -T kapruka-backend php artisan route:cache
    docker-compose exec -T kapruka-backend php artisan view:cache
    
    rm -f public/hot

    echo "✨ Server-side updates complete!"
EOF

echo "✅ Deployment Complete! Ayla and Kapruka Backend are now live on the server."
