SHELL := /bin/sh
IMAGE_NAME ?= ghcr.io/kernel-nomad/pullpilot

.PHONY: dev-server dev-web build up lint

dev-server:
	uvicorn server.app:app --reload

dev-web:
	cd web && npm run dev

build:
	docker build -t $(IMAGE_NAME) -t pullpilot .

up:
	docker compose up -d

lint:
	python -m compileall server && cd web && npm run build
