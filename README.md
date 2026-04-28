<p align="center">
  <img src="./web/public/assets/logo.png" alt="pullpilot" width="200"/>
</p>

<div align="center">

<h3>
  <a href="#english">English</a> | <a href="#español">Español</a>
</h3>

<p align="center">
  <a href="https://github.com/KN990x/PullPilot/stargazers">
    <img src="https://img.shields.io/github/stars/KN990x/PullPilot?style=social" alt="GitHub stars"/>
  </a>
  &nbsp;
  <a href="https://github.com/KN990x/PullPilot/issues">
    <img src="https://img.shields.io/github/issues/KN990x/PullPilot" alt="GitHub issues"/>
  </a>
  &nbsp;
  <a href="./LICENSE">
    <img src="https://img.shields.io/github/license/KN990x/PullPilot" alt="License"/>
  </a>
  &nbsp;
  <img src="https://img.shields.io/github/last-commit/KN990x/PullPilot" alt="Last commit"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB?logo=react&logoColor=white" alt="React + Vite"/>
  &nbsp;
  <img src="https://img.shields.io/badge/backend-FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI"/>
  &nbsp;
  <img src="https://img.shields.io/badge/infra-Docker-2496ED?logo=docker&logoColor=white" alt="Docker"/>
</p>

</div>

<p align="center">
  <img src="./web/public/assets/dashboard.gif" alt="dashboard" width="auto" height="auto">
</p>


---

<a name="english"></a>
# PullPilot

PullPilot is an app aimed at homelab and personal deployments. It lets you manage updates for your Docker images and services (status, logs, deployment modes) from a single UI.

## Quick install

```bash
sudo mkdir -p /srv/docker-stacks
mkdir -p ~/pullpilot && cd ~/pullpilot
curl -fsSL -o docker-compose.yml https://raw.githubusercontent.com/KN990x/PullPilot/main/docker-compose.yml
curl -fsSL -o .env.example https://raw.githubusercontent.com/KN990x/PullPilot/main/.env.example
docker compose up -d
```

Open **http://your-server-ip:8000** (or the host port from `PULLPILOT_PORT` in `.env`).

No `.env` is required if you use the default stacks path **`/srv/docker-stacks`**; use **`.env.example`** as reference and copy it to **`.env`** when you need overrides. The official `docker-compose.yml` sets **`ALLOW_NO_AUTH=true`** by default so the quick start works without login on a trusted LAN. For anything reachable beyond that, set **`ALLOW_NO_AUTH=false`**, define **`AUTH_USER`** and **`AUTH_PASS`**, and a fixed **`SESSION_SECRET`** (see [Environment variables (reference)](#environment-variables-reference)). Local `make dev-server` also sets `ALLOW_NO_AUTH=true` for convenience.

## After startup

- **Different stacks location:** create the folder on the host, then add `.env` next to `docker-compose.yml` with **`DOCKER_ROOT_PATH=/absolute/path/to/stacks`** (same path on host and in the container). After any `.env` change, run `docker compose up -d` or `docker compose restart`.
- **Layout:** each project is a **subfolder** under that root with `docker-compose.yml` or `docker-compose.yaml` inside. Keep PullPilot’s compose folder **outside** that tree when you can.

```
/srv/docker-stacks/          # default DOCKER_ROOT_PATH
├── plex/
│   └── docker-compose.yml
└── ...
```

> Folders named `pullpilot`, `pullpilot-ui`, `docker-updater`, and `data` are ignored under the stacks root.

**Cloned repo (development):** use [`docker-compose.yml`](./docker-compose.yml) from the tree; overrides are documented in [`.env.example`](./.env.example).

## Usage Guide

- **Dashboard:** cards per project; status, per-project update, **Full stop** and **Exclude** toggles.
- **Update All:** scans non-excluded projects, `git pull` where applicable, recreates containers; summary in **History**.
- **Schedule:** default global update daily at 04:00 (container time).

## Local development (contributors)

```bash
git clone https://github.com/KN990x/PullPilot
cd PullPilot
docker compose -f docker-compose-build.yml up -d --build
```

Day-to-day: `make dev-server`, `make dev-web` (see [`Makefile`](./Makefile)).

## Important notes

- **GHCR image:** the published image is `ghcr.io/kn990x/pullpilot`. If you still pin `ghcr.io/kernel-nomad/pullpilot`, update your compose file or `docker pull` to the new path.
- **Docker socket:** treat PullPilot like root access; do not expose port 8000 to the public internet without TLS (reverse proxy), **`ALLOW_NO_AUTH=false`**, strong **`AUTH_USER` / `AUTH_PASS`**, and ideally an extra auth layer (Authelia, Authentik, etc.).
- **Stack paths:** updates and scheduled jobs only run under **`PROJECTS_ROOT`** (resolved); database paths outside that tree are rejected.
- **Single worker:** one Uvicorn worker per instance (scheduler and login rate limit are in-memory). If you ever run **`UVICORN_WORKERS` > 1**, you **must** set **`SESSION_SECRET`** so all workers share the same signing key.
- **Auth:** with **`ALLOW_NO_AUTH=false`** (default when not using the official compose defaults), the app **refuses to start** until **both** `AUTH_USER` and `AUTH_PASS` are set. With **`ALLOW_NO_AUTH=true`**, the API is open unless you also set credentials (middleware then enforces login when both are set).
- **SESSION_SECRET:** unset ⇒ new secret each restart ⇒ sessions reset; set a long random value in production (`openssl rand -hex 32`).
- **HTTPS / cookies:** behind a TLS-terminating proxy, set **`SESSION_HTTPS_ONLY=true`**. **`SESSION_SAME_SITE`** defaults to `lax` (Starlette); use `strict` for stricter same-site behaviour, or `none` only with HTTPS and cross-site requirements (browsers require `Secure`).
- **PROJECTS_ROOT:** use only if the path *inside* the container must differ from the bind mount; otherwise use `DOCKER_ROOT_PATH`.
- **Proxy:** `TRUST_X_FORWARDED_FOR=true` only behind a proxy you trust (affects login rate-limit IP).

---

<a name="environment-variables-reference"></a>
## Environment variables (reference)

Single list for Compose `.env` and runtime. Details also in [`.env.example`](./.env.example).

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCKER_ROOT_PATH` | `/srv/docker-stacks` | Same absolute stacks path on host and container (bind mount). |
| `PROJECTS_ROOT` | (from `DOCKER_ROOT_PATH`) | Advanced: different path *inside* the container only. |
| `PULLPILOT_PORT` | `8000` | Published host port for the UI. |
| `TZ` | `UTC` | Container timezone. |
| `DATA_DIR` | `/app/data` | SQLite and runtime data (official compose uses volume `pullpilot_data`). |
| `ALLOW_NO_AUTH` | `false`* | *Official compose defaults to `true` via substitution. If `false`, **`AUTH_USER`** and **`AUTH_PASS`** are required or startup fails. |
| `AUTH_USER` / `AUTH_PASS` | (unset) | Required when `ALLOW_NO_AUTH=false`. If both set, session login is enforced by middleware. |
| `SESSION_SECRET` | (generated) | Fixed value ⇒ sessions survive restarts. **Required** if `UVICORN_WORKERS` > 1. |
| `SESSION_HTTPS_ONLY` | `false` | Set `true` if the app is only served over HTTPS. |
| `SESSION_SAME_SITE` | `lax` | Cookie SameSite: `lax`, `strict`, or `none` (use `none` only with HTTPS). |
| `CORS_ORIGINS` | (empty) | Comma-separated origins; empty often OK when the SPA is served by the same app. |
| `HEALTHCHECK_TIMEOUT` | `60` | Post-deploy health wait (seconds). |
| `COMMAND_TIMEOUT` | `300` | External command timeout (seconds). |
| `LOG_LOCALE` | `es` | Language for scheduled update logs and history entries (`es` or `en`). UI-triggered updates use `Accept-Language` instead. |
| `LOGIN_RATE_LIMIT_ENABLED` | `true` | In-memory login rate limit per IP. |
| `LOGIN_RATE_LIMIT_MAX` | `15` | Max attempts per window. |
| `LOGIN_RATE_LIMIT_WINDOW_SEC` | `300` | Window length (seconds). |
| `TRUST_X_FORWARDED_FOR` | `false` | Use `X-Forwarded-For` for rate limiting (trusted proxy only). |

### Advanced (copy into `.env` as needed)

```bash
# Production-style (example)
# ALLOW_NO_AUTH=false
# AUTH_USER=admin
# AUTH_PASS=your-secure-password
SESSION_HTTPS_ONLY=true
# SESSION_SAME_SITE=strict
# CORS_ORIGINS=https://pullpilot.example.com
# LOGIN_RATE_LIMIT_ENABLED=true
# LOGIN_RATE_LIMIT_MAX=15
# LOGIN_RATE_LIMIT_WINDOW_SEC=300
# HEALTHCHECK_TIMEOUT=60
# COMMAND_TIMEOUT=300
# TRUST_X_FORWARDED_FOR=true
```

---

<a name="español"></a>
# PullPilot

PullPilot es una aplicación pensada para desplegarse en homelabs y para uso personal. Permite gestionar actualizaciones de imágenes y servicios Docker (estado, logs, modos de despliegue) desde una sola interfaz.

## Instalación rápida

```bash
sudo mkdir -p /srv/docker-stacks
mkdir -p ~/pullpilot && cd ~/pullpilot
curl -fsSL -o docker-compose.yml https://raw.githubusercontent.com/KN990x/PullPilot/main/docker-compose.yml
curl -fsSL -o .env.example https://raw.githubusercontent.com/KN990x/PullPilot/main/.env.example
docker compose up -d
```

Abre **http://tu-servidor-ip:8000** (o el puerto del host definido en `PULLPILOT_PORT` en `.env`).

No hace falta `.env` si usas la ruta por defecto de stacks **`/srv/docker-stacks`**; usa **`.env.example`** como referencia y cópialo a **`.env`** cuando necesites personalizar. El `docker-compose.yml` oficial define **`ALLOW_NO_AUTH=true`** por defecto para que el inicio rápido funcione sin login en una LAN de confianza. Si la instancia es accesible más allá de eso, pon **`ALLOW_NO_AUTH=false`**, define **`AUTH_USER`** y **`AUTH_PASS`**, y un **`SESSION_SECRET`** fijo (véase [Variables de entorno (referencia)](#variables-de-entorno-referencia)). En local, `make dev-server` también define `ALLOW_NO_AUTH=true` por comodidad.

## Después del arranque

- **Otra ubicación de stacks:** crea la carpeta en el host y añade `.env` junto a `docker-compose.yml` con **`DOCKER_ROOT_PATH=/ruta/absoluta/a/stacks`** (misma ruta en host y contenedor). Tras cualquier cambio en `.env`, ejecuta `docker compose up -d` o `docker compose restart`.
- **Estructura:** cada proyecto es una **subcarpeta** bajo esa raíz con `docker-compose.yml` o `docker-compose.yaml` dentro. Cuando puedas, mantén la carpeta de compose de PullPilot **fuera** de ese árbol.

```
/srv/docker-stacks/          # DOCKER_ROOT_PATH por defecto
├── plex/
│   └── docker-compose.yml
└── ...
```

> Las carpetas llamadas `pullpilot`, `pullpilot-ui`, `docker-updater` y `data` se ignoran bajo la raíz de stacks.

**Repositorio clonado (desarrollo):** usa el [`docker-compose.yml`](./docker-compose.yml) del árbol; los overrides están documentados en [`.env.example`](./.env.example).

## Guía de uso

- **Dashboard:** tarjetas por proyecto; estado, actualización por proyecto, interruptores **Full stop** y **Excluir**.
- **Actualizar todo:** escanea proyectos no excluidos, `git pull` cuando aplique, recrea contenedores; resumen en **Historial**.
- **Programación:** actualización global diaria por defecto a las 04:00 (hora del contenedor).

## Desarrollo local (contribuidores)

```bash
git clone https://github.com/KN990x/PullPilot
cd PullPilot
docker compose -f docker-compose-build.yml up -d --build
```

Día a día: `make dev-server`, `make dev-web` (véase [`Makefile`](./Makefile)).

## Notas importantes

- **Imagen GHCR:** la imagen publicada es `ghcr.io/kn990x/pullpilot`. Si sigues usando `ghcr.io/kernel-nomad/pullpilot`, actualiza el compose o `docker pull` a la nueva ruta.
- **Socket de Docker:** trata PullPilot como acceso de nivel root; no expongas el puerto 8000 a internet pública sin TLS (proxy inverso), **`ALLOW_NO_AUTH=false`**, **`AUTH_USER` / `AUTH_PASS`** robustos y, si es posible, otra capa de autenticación (Authelia, Authentik, etc.).
- **Rutas de stacks:** las actualizaciones y tareas programadas solo se ejecutan bajo **`PROJECTS_ROOT`** (resuelto); las rutas en base de datos fuera de ese árbol se rechazan.
- **Un solo worker:** un worker de Uvicorn por instancia (scheduler y límite de intentos de login en memoria). Si alguna vez usas **`UVICORN_WORKERS` > 1**, **debes** definir **`SESSION_SECRET`** para que todos los workers compartan la misma clave de firma.
- **Autenticación:** con **`ALLOW_NO_AUTH=false`** (valor por defecto cuando no se usan los valores del compose oficial), la aplicación **no arranca** hasta que estén definidos **tanto** `AUTH_USER` como `AUTH_PASS`. Con **`ALLOW_NO_AUTH=true`**, la API queda abierta salvo que también definas credenciales (en ese caso el middleware exige login cuando ambas están definidas).
- **SESSION_SECRET:** sin definir ⇒ un secreto nuevo en cada reinicio ⇒ las sesiones se reinician; en producción define un valor aleatorio largo (`openssl rand -hex 32`).
- **HTTPS / cookies:** detrás de un proxy que termina TLS, define **`SESSION_HTTPS_ONLY=true`**. **`SESSION_SAME_SITE`** por defecto es `lax` (Starlette); usa `strict` para un comportamiento same-site más estricto, o `none` solo con HTTPS y requisitos cross-site (los navegadores exigen `Secure`).
- **PROJECTS_ROOT:** úsalo solo si la ruta *dentro* del contenedor debe diferir del bind mount; en caso contrario usa `DOCKER_ROOT_PATH`.
- **Proxy:** `TRUST_X_FORWARDED_FOR=true` solo detrás de un proxy en el que confíes (afecta la IP usada en el rate limit de login).

---

<a name="variables-de-entorno-referencia"></a>
## Variables de entorno (referencia)

Lista única para `.env` de Compose y tiempo de ejecución. Más detalle en [`.env.example`](./.env.example).

| Variable | Valor por defecto | Descripción |
|----------|-------------------|-------------|
| `DOCKER_ROOT_PATH` | `/srv/docker-stacks` | Misma ruta absoluta de stacks en host y contenedor (bind mount). |
| `PROJECTS_ROOT` | (desde `DOCKER_ROOT_PATH`) | Avanzado: ruta distinta *solo* dentro del contenedor. |
| `PULLPILOT_PORT` | `8000` | Puerto publicado en el host para la interfaz. |
| `TZ` | `UTC` | Zona horaria del contenedor. |
| `DATA_DIR` | `/app/data` | SQLite y datos en tiempo de ejecución (el compose oficial usa el volumen `pullpilot_data`). |
| `ALLOW_NO_AUTH` | `false`* | *El compose oficial usa `true` por sustitución. Si es `false`, **`AUTH_USER`** y **`AUTH_PASS`** son obligatorios o el arranque falla. |
| `AUTH_USER` / `AUTH_PASS` | (sin definir) | Obligatorios cuando `ALLOW_NO_AUTH=false`. Si ambos están definidos, el middleware exige sesión. |
| `SESSION_SECRET` | (generado) | Valor fijo ⇒ las sesiones sobreviven a reinicios. **Obligatorio** si `UVICORN_WORKERS` > 1. |
| `SESSION_HTTPS_ONLY` | `false` | Pon `true` si la app solo se sirve por HTTPS. |
| `SESSION_SAME_SITE` | `lax` | SameSite de la cookie: `lax`, `strict` o `none` (usa `none` solo con HTTPS). |
| `CORS_ORIGINS` | (vacío) | Orígenes separados por comas; vacío suele bastar cuando el SPA lo sirve la misma app. |
| `HEALTHCHECK_TIMEOUT` | `60` | Espera de salud tras despliegue (segundos). |
| `COMMAND_TIMEOUT` | `300` | Tiempo máximo de comandos externos (segundos). |
| `LOG_LOCALE` | `es` | Idioma de logs de actualizaciones programadas e historial (`es` o `en`). Las actualizaciones desde la UI usan `Accept-Language`. |
| `LOGIN_RATE_LIMIT_ENABLED` | `true` | Límite de intentos de login en memoria por IP. |
| `LOGIN_RATE_LIMIT_MAX` | `15` | Máximo de intentos por ventana. |
| `LOGIN_RATE_LIMIT_WINDOW_SEC` | `300` | Duración de la ventana (segundos). |
| `TRUST_X_FORWARDED_FOR` | `false` | Usar `X-Forwarded-For` para el rate limit (solo proxy de confianza). |

### Avanzado (copia en `.env` según necesites)

```bash
# Estilo producción (ejemplo)
# ALLOW_NO_AUTH=false
# AUTH_USER=admin
# AUTH_PASS=tu-contraseña-segura
SESSION_HTTPS_ONLY=true
# SESSION_SAME_SITE=strict
# CORS_ORIGINS=https://pullpilot.example.com
# LOGIN_RATE_LIMIT_ENABLED=true
# LOGIN_RATE_LIMIT_MAX=15
# LOGIN_RATE_LIMIT_WINDOW_SEC=300
# HEALTHCHECK_TIMEOUT=60
# COMMAND_TIMEOUT=300
# TRUST_X_FORWARDED_FOR=true
```
