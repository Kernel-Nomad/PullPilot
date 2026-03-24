SHELL := /bin/sh
IMAGE_NAME ?= ghcr.io/kernel-nomad/pullpilot

.PHONY: dev-server dev-web build up lint test

dev-server:
	uvicorn server.app:app --reload

dev-web:
	cd web && npm run dev

build:
	docker build -t $(IMAGE_NAME) -t pullpilot .

up:
	@test -f .env || (printf '%s\n' "Missing .env — copy and edit: cp .env.example .env (set DOCKER_ROOT_PATH at minimum)." >&2; exit 1)
	docker compose up -d

lint:
	ruff check server tests && python -m compileall server && cd web && npm run lint && npm run build

test:
	python3 -m pytest tests/
