.PHONY: help install install-backend install-frontend dev backend frontend lint format test

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

################################################
# Setup 
################################################

install: install-backend install-frontend ## Install all dependencies

install-backend: ## Install backend dependencies
	cd backend && python3 -m pip install -e ".[dev]"

install-frontend: ## Install frontend dependencies
	cd frontend && npm install

################################################
# Development 
################################################

dev: ## Run backend and frontend concurrently
	$(MAKE) backend & $(MAKE) frontend & wait

backend: ## Run the backend API server
	cd backend && uvicorn app.main:app --reload

frontend: ## Run the frontend dev server
	cd frontend && npm run dev

################################################
# Quality 
################################################

lint: ## Run linters (ruff + eslint)
	cd backend && ruff check app tests
	cd frontend && npm run lint

format: ## Check code formatting
	cd backend && ruff format --check app tests

test: ## Run backend tests
	cd backend && pytest

typecheck: ## Run mypy on the backend
	cd backend && mypy app