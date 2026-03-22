# syntax=docker/dockerfile:1.7

FROM composer:2.8 AS vendor
WORKDIR /var/www/html
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --prefer-dist \
    --optimize-autoloader \
    --no-interaction \
    --no-scripts

FROM node:20-bookworm-slim AS frontend
WORKDIR /var/www/html
COPY package.json package-lock.json ./
RUN npm ci
COPY resources ./resources
COPY public ./public
COPY vite.config.js postcss.config.js tailwind.config.js ./
RUN npm run build

FROM php:8.3-fpm-bookworm AS php_runtime
WORKDIR /var/www/html

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libfreetype6-dev \
    libjpeg62-turbo-dev \
    libonig-dev \
    libpng-dev \
    libxml2-dev \
    libzip-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" bcmath exif gd pcntl pdo_mysql \
    && rm -rf /var/lib/apt/lists/*

COPY . .
COPY --from=vendor /var/www/html/vendor ./vendor
COPY --from=frontend /var/www/html/public/build ./public/build
COPY docker/php/php.ini /usr/local/etc/php/conf.d/99-fortress.ini
COPY docker/php/entrypoint.sh /usr/local/bin/docker-entrypoint-app

RUN chmod +x /usr/local/bin/docker-entrypoint-app \
    && mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && ln -sfn /var/www/html/storage/app/public /var/www/html/public/storage \
    && php artisan package:discover --ansi \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 9000

ENTRYPOINT ["docker-entrypoint-app"]
CMD ["php-fpm", "-F"]

FROM nginx:1.27-alpine AS nginx
WORKDIR /var/www/html

COPY . .
COPY --from=frontend /var/www/html/public/build ./public/build
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

RUN mkdir -p /var/www/html/storage/app/public \
    && ln -sfn /var/www/html/storage/app/public /var/www/html/public/storage

EXPOSE 80
