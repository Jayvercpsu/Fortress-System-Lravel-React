#!/usr/bin/env sh
set -e

cd /var/www/html

mkdir -p \
  storage/app/public \
  storage/framework/cache/data \
  storage/framework/sessions \
  storage/framework/views \
  storage/logs \
  bootstrap/cache

ln -sfn /var/www/html/storage/app/public /var/www/html/public/storage
chown -R www-data:www-data storage bootstrap/cache

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Running database migrations..."
  php artisan migrate --force
fi

if [ "${RUN_CONFIG_CACHE:-false}" = "true" ]; then
  echo "Caching Laravel config and views..."
  php artisan config:cache
  php artisan view:cache
else
  # Clear stale config cache so env vars from env_file are always read fresh.
  # The app_cache volume persists across deploys; if config:cache was ever
  # run, the cached values override env() calls even when the .env changes.
  if [ -f bootstrap/cache/config.php ]; then
    echo "Clearing stale Laravel config cache..."
    php artisan config:clear
  fi
fi

exec "$@"

