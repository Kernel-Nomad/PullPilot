SHELL := /bin/sh
IMAGE_NAME ?= ghcr.io/kernel-nomad/pullpilot
# Intérprete Python para test/lint (3.11+). Con venv activado suele bastar `python`; si `python3` del sistema es antiguo: PY=python3.11 make test
PY ?= python

.PHONY: dev-server dev-web build up lint test

dev-server:
	ALLOW_NO_AUTH=true uvicorn server.app:app --reload

dev-web:
	cd web && npm run dev

build:
	docker build -t $(IMAGE_NAME) -t pullpilot .

up:
	docker compose up -d

lint:
	ruff check server tests && $(PY) -m compileall server && cd web && npm run lint && npm run build

test:
	$(PY) -m pytest tests/
