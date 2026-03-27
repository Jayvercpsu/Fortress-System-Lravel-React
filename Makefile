PROD_ENV=.env.lightsail
PROD_COMPOSE=docker-compose.prod.yml

.PHONY: prod-build prod-up prod-migrate prod-deploy

prod-build:
	docker compose --env-file $(PROD_ENV) -f $(PROD_COMPOSE) build

prod-up:
	docker compose --env-file $(PROD_ENV) -f $(PROD_COMPOSE) up -d

prod-migrate:
	docker compose --env-file $(PROD_ENV) -f $(PROD_COMPOSE) run --rm app php artisan migrate --force

prod-deploy: prod-build prod-up prod-migrate
