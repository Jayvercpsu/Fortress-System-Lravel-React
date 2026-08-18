PROD_ENV=.env.lightsail
PROD_COMPOSE=docker-compose.prod.yml
BACKUP_DIR=backups

.PHONY: prod-build prod-up prod-migrate prod-backup local-backup prod-deploy

prod-build:
	docker compose --env-file $(PROD_ENV) -f $(PROD_COMPOSE) build

prod-up:
	docker compose --env-file $(PROD_ENV) -f $(PROD_COMPOSE) up -d

prod-migrate:
	docker compose --env-file $(PROD_ENV) -f $(PROD_COMPOSE) run --rm app php artisan migrate --force

prod-backup:
	@mkdir -p $(BACKUP_DIR); \
	backup_file="$(BACKUP_DIR)/fortress-$$(date +%Y%m%d-%H%M%S).sql"; \
	docker compose --env-file $(PROD_ENV) -f $(PROD_COMPOSE) exec -T db sh -c 'exec mysqldump -uroot -p"$$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --events --no-tablespaces "$$MYSQL_DATABASE"' > "$$backup_file"; \
	echo "Backup written to $$backup_file"

local-backup:
	@mkdir -p $(BACKUP_DIR); \
	backup_file="$(BACKUP_DIR)/fortress-local-$$(date +%Y%m%d-%H%M%S).sql"; \
	set -a; . ./.env; set +a; \
	mysqldump -h "$${DB_HOST:-127.0.0.1}" -P "$${DB_PORT:-3306}" -u "$${DB_USERNAME:-root}" $${DB_PASSWORD:+ -p"$$DB_PASSWORD"} --single-transaction --routines --triggers --events --no-tablespaces "$${DB_DATABASE:-fortress}" > "$$backup_file"; \
	echo "Backup written to $$backup_file"

prod-deploy: prod-build prod-up prod-migrate
