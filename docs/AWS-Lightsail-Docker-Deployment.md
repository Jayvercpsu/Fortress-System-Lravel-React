# Fortress System Docker Deployment on AWS Lightsail

This guide prepares the app to run in production on a Lightsail Linux instance using Docker Compose.

## 1) Prerequisites

- AWS Lightsail Ubuntu instance (2 GB RAM or higher recommended)
- Open firewall ports:
  - `80` (HTTP)
  - `443` (HTTPS, if terminating SSL on instance)
  - `22` (SSH)

## 2) Install Docker + Compose on the instance

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and SSH back in so Docker group access applies.

## 3) Upload project and configure env

```bash
git clone <your-repo-url> fortress
cd fortress
cp .env.lightsail.example .env.lightsail
```

Edit `.env.lightsail` and set at minimum:

- `APP_URL`
- `CERT_DOMAIN` (primary domain for the SSL certificate)
- `NGINX_SERVER_NAME` (space-separated server names, ex: `example.com www.example.com`)
- `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `DB_ROOT_PASSWORD` (if using bundled `db` service)
- `AWS_*` values if using S3/Lightsail Object Storage

Generate `APP_KEY`:

```bash
docker compose --env-file .env.lightsail -f docker-compose.prod.yml run --rm app php artisan key:generate --show
```

Paste that value into `.env.lightsail` as `APP_KEY=...`.

## 4) Build and start services

```bash
docker compose --env-file .env.lightsail -f docker-compose.prod.yml build
docker compose --env-file .env.lightsail -f docker-compose.prod.yml up -d
```

Run migrations once:

```bash
docker compose --env-file .env.lightsail -f docker-compose.prod.yml run --rm app php artisan migrate --force
```

## 5) Verify health

```bash
docker compose --env-file .env.lightsail -f docker-compose.prod.yml ps
curl -I http://<lightsail-ip>/up
docker compose --env-file .env.lightsail -f docker-compose.prod.yml logs -f app web
```

## 6) SSL recommendation for Lightsail

Recommended:

1. Create a Lightsail Load Balancer.
2. Attach your instance target on port `80`.
3. Create/attach an HTTPS certificate in Lightsail.
4. Point your DNS A/AAAA/CNAME to the load balancer.

This keeps TLS termination outside the container and simplifies renewal.

## 7) Optional: Host-level certbot with systemd timer

Use this when TLS is terminated on the instance (Nginx in Docker). Certs live on the host and are mounted into the Nginx container.

### 7.1) Install certbot on the host

```bash
sudo apt-get update
sudo apt-get install -y certbot
```

### 7.2) Issue the first certificate (webroot)

Make sure the Nginx container serves `/.well-known/acme-challenge` from a host path (for example `./certbot/www` mounted to `/var/www/certbot`).

Create the webroot directory on the host:

```bash
mkdir -p /home/ubuntu/fortress/certbot/www
```

```bash
sudo certbot certonly \
  --webroot -w /home/ubuntu/fortress/certbot/www \
  -d yourdomain.com -d www.yourdomain.com
```

### 7.3) Mount certs into Nginx

Ensure the Nginx service in `docker-compose.prod.yml` mounts host certs read-only:

```yaml
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
  - ./certbot/www:/var/www/certbot
```

The Nginx config uses environment variables for domains. Make sure `CERT_DOMAIN` and `NGINX_SERVER_NAME` are set in `.env.lightsail` so the template renders correctly.

### 7.4) Reload Nginx after renewals

Create a deploy hook so certbot reloads Nginx inside Docker when a certificate is renewed.

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh >/dev/null <<'EOF'
#!/bin/sh
docker compose --env-file /home/ubuntu/fortress/.env.lightsail \
  -f /home/ubuntu/fortress/docker-compose.prod.yml \
  exec -T web nginx -s reload
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

Update `/home/ubuntu/fortress` and `web` to match your server path and compose service name.

### 7.5) Enable auto-renew

```bash
sudo systemctl enable --now certbot.timer
sudo systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

### 7.6) Stop or disable auto-renew

```bash
sudo systemctl stop certbot.timer
sudo systemctl disable certbot.timer
systemctl status certbot.timer
```

### 7.7) Re-enable auto-renew

```bash
sudo systemctl enable --now certbot.timer
systemctl status certbot.timer
```

## 8) Storage and uploads

- For production durability, use S3/Lightsail Object Storage via `AWS_*` env values.
- If you want all Laravel `Storage` calls to default to the bucket, set `FILESYSTEM_DISK=s3`.
- This app's `UploadManager` also auto-switches to `s3` in non-local environments when `AWS_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` are set.
- If using local disk uploads, data persists in Docker volume `app_storage`.

## 9) Updating deployment

```bash
git pull
docker compose --env-file .env.lightsail -f docker-compose.prod.yml build
docker compose --env-file .env.lightsail -f docker-compose.prod.yml up -d
docker compose --env-file .env.lightsail -f docker-compose.prod.yml run --rm app php artisan migrate --force
```

## 10) Optional: Use external DB instead of container MySQL

If using Lightsail Managed Database or RDS:

1. Set `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` in `.env.lightsail`.
2. Remove or comment out the `db` service in `docker-compose.prod.yml`.
3. Remove `depends_on: db` under `app`, `queue`, and `scheduler`.
