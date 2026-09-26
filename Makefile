.PHONY: dev dev-web dev-api install install-web install-api lint test build clean

# ── One command to start everything ──────────────────────────
dev:
	@echo "Starting NyayaPath development servers..."
	$(MAKE) -j2 dev-web dev-api

dev-web:
	cd apps/web && npm run dev

dev-api:
	cd apps/api && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# ── Install ──────────────────────────────────────────────────
install: install-web install-api

install-web:
	cd apps/web && npm install

install-api:
	cd apps/api && pip install -r requirements.txt

# ── Lint ─────────────────────────────────────────────────────
lint:
	cd apps/web && npm run lint
	cd apps/api && python -m ruff check .

# ── Test ─────────────────────────────────────────────────────
test:
	cd apps/web && npm run build
	cd apps/api && python -m pytest tests/ -v

# ── Build ────────────────────────────────────────────────────
build:
	cd apps/web && npm run build
	docker-compose build

# ── Docker ───────────────────────────────────────────────────
up:
	docker-compose up --build

down:
	docker-compose down

# ── Clean ────────────────────────────────────────────────────
clean:
	cd apps/web && rm -rf .next node_modules
	cd apps/api && rm -rf __pycache__ .pytest_cache .mypy_cache
