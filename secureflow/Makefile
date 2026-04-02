## Makefile — SecureFlow Vault
## Shortcuts for common Docker Compose workflows.
##
## Prerequisites: Docker Desktop (or Docker Engine + Compose plugin)
##
## Quick start:
##   cp .env.example .env
##   make dev

COMPOSE         := docker compose
COMPOSE_PROD    := docker compose -f docker-compose.yml -f docker-compose.prod.yml
BACKEND_SERVICE := backend

.PHONY: help dev prod seed logs logs-backend logs-frontend \
        shell-backend shell-db psql stop clean clean-volumes \
        rebuild build-prod lint-check

# ── Default target ─────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  SecureFlow Vault — make targets"
	@echo ""
	@echo "  Dev workflow"
	@echo "    make dev              Start all services with hot-reload"
	@echo "    make seed             Seed the database with demo data"
	@echo "    make logs             Tail logs from all containers"
	@echo "    make logs-backend     Tail backend logs only"
	@echo "    make logs-frontend    Tail frontend logs only"
	@echo "    make stop             Stop all containers (keep volumes)"
	@echo "    make clean            Stop containers + remove volumes"
	@echo ""
	@echo "  Production-like testing"
	@echo "    make prod             Start compiled JS backend + nginx frontend"
	@echo "    make build-prod       Build prod images without starting"
	@echo ""
	@echo "  Debugging"
	@echo "    make shell-backend    Open a shell inside the backend container"
	@echo "    make shell-db         Open a shell inside the db container"
	@echo "    make psql             Connect to PostgreSQL via psql"
	@echo "    make rebuild          Rebuild all images and restart"
	@echo "    make lint-check       Run TypeScript type-check inside backend"
	@echo ""

# ── Development ────────────────────────────────────────────────────────────────

## Start all services (build images on first run / when Dockerfiles change)
dev: .env
	$(COMPOSE) up --build

## Run database seed inside the running backend container
seed:
	$(COMPOSE) exec $(BACKEND_SERVICE) npm run seed

## Tail logs from all containers (-f follow, --tail show last 50 lines)
logs:
	$(COMPOSE) logs -f --tail=50

## Tail backend logs only
logs-backend:
	$(COMPOSE) logs -f --tail=50 backend

## Tail frontend logs only
logs-frontend:
	$(COMPOSE) logs -f --tail=50 frontend

## Stop all containers but keep volumes (data preserved)
stop:
	$(COMPOSE) stop

## Stop containers and remove the Postgres data volume (fresh slate)
clean:
	$(COMPOSE) down -v --remove-orphans
	@echo "Stopped containers and removed volumes."

## Rebuild all images from scratch (--no-cache) then start
rebuild:
	$(COMPOSE) build --no-cache
	$(COMPOSE) up

# ── Production-like testing ────────────────────────────────────────────────────

## Start in production mode (compiled JS + nginx)
## Access app at: http://localhost:8080
prod: .env
	$(COMPOSE_PROD) up --build

## Build production images without starting containers
build-prod:
	$(COMPOSE_PROD) build

# ── Debugging / introspection ──────────────────────────────────────────────────

## Open a shell inside the running backend container
shell-backend:
	$(COMPOSE) exec $(BACKEND_SERVICE) /bin/sh

## Open a shell inside the running db container
shell-db:
	$(COMPOSE) exec db /bin/sh

## Connect to the database with psql
psql:
	$(COMPOSE) exec db psql -U $${POSTGRES_USER:-securevault} -d $${POSTGRES_DB:-securevault}

## Type-check TypeScript without emitting files
lint-check:
	$(COMPOSE) exec $(BACKEND_SERVICE) npx tsc --noEmit

# ── Guard: copy .env.example if .env is missing ───────────────────────────────
.env:
	@echo ".env not found — copying from .env.example"
	cp .env.example .env
	@echo "Copied .env.example → .env. Edit it if needed, then re-run make dev."
