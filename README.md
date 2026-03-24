<p align="center">
  <img src="./web/public/assets/logo.png" alt="pullpilot" width="200"/>
</p>

<div align="center">

<h3>
  <a href="#english">English</a> | <a href="#español">Español</a>
</h3>

<p align="center">
  <a href="https://github.com/Kernel-Nomad/PullPilot/stargazers">
    <img src="https://img.shields.io/github/stars/Kernel-Nomad/PullPilot?style=social" alt="GitHub stars"/>
  </a>
  &nbsp;
  <a href="https://github.com/Kernel-Nomad/PullPilot/issues">
    <img src="https://img.shields.io/github/issues/Kernel-Nomad/PullPilot" alt="GitHub issues"/>
  </a>
  &nbsp;
  <a href="./LICENSE">
    <img src="https://img.shields.io/github/license/Kernel-Nomad/PullPilot" alt="License"/>
  </a>
  &nbsp;
  <img src="https://img.shields.io/github/last-commit/Kernel-Nomad/PullPilot" alt="Last commit"/>
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

App to manage updates for your docker images and services (monitor status, view logs, and control deployment modes). All from a clean and responsive visual interface.

## Quick Installation (Docker Compose)

The recommended way to deploy PullPilot is using Docker Compose.

### 1. Required Directory Structure

PullPilot expects your projects to be organized in subfolders within a root folder on your server:


```

/home/user/docker/    <-- This is the folder you will mount
├── plex/
│   └── docker-compose.yml
├── pihole/
│   └── docker-compose.yml
└── ...

```

> :warning: Auto-exclusion Logic: Even if placed inside the root folder, the application is hardcoded to automatically ignore folders named: pullpilot, pullpilot-ui, docker-updater, and data.

#### Suggested structure:


```

/home/user/
├── my_projects/         <-- Root folder monitored by PullPilot
│   ├── plex/
│   │   └── docker-compose.yml
│   ├── pihole/
│   │   └── docker-compose.yml
│   └── ...
│
└── pullpilot/           <-- PullPilot installation folder (OUTSIDE the previous one)
└── docker-compose.yml

```

### 2. Prepare the environment

Create a folder for PullPilot and add a `.env` file. Copy [`.env.example`](./.env.example) as a starting point. **Minimum** for a typical deployment:

```bash
DOCKER_ROOT_PATH=/home/user/docker
TZ=Europe/Madrid

AUTH_USER=admin
AUTH_PASS=your_secure_password
SESSION_SECRET=your-long-random-string
```

The compose file bind-mounts `${DOCKER_ROOT_PATH}` to the **same absolute path** inside the container; the app uses that path to scan subfolders for `docker-compose.yml`. You can override with `PROJECTS_ROOT` in `.env` only if you need a different path than `DOCKER_ROOT_PATH`.

`SESSION_SECRET` keeps cookies valid across container restarts. If you omit it, a new secret is generated on every boot and users must sign in again. Optional: **`PULLPILOT_PORT`** (default `8000`).

`DATA_DIR` defaults to `/app/data` and is already covered by the named volume `pullpilot_data` in the official compose file; you normally do not need to set it.

#### Optional / advanced

```bash
SESSION_HTTPS_ONLY=true
# CORS_ORIGINS=https://pullpilot.example.com

# Login rate limit (in-memory, per IP); single uvicorn worker recommended
# LOGIN_RATE_LIMIT_ENABLED=true
# LOGIN_RATE_LIMIT_MAX=15
# LOGIN_RATE_LIMIT_WINDOW_SEC=300

# HEALTHCHECK_TIMEOUT=60
# COMMAND_TIMEOUT=300

# TRUST_X_FORWARDED_FOR=true   # only behind a trusted reverse proxy
```

### 3. docker-compose.yml

Use the **versioned** `docker-compose.yml` from this repository so it always matches the published image:

- **Clone** the repo into your PullPilot folder and keep the included `docker-compose.yml`, or
- **Download** it (replace `main` with your default branch if needed):

```bash
curl -fsSL -o docker-compose.yml https://raw.githubusercontent.com/Kernel-Nomad/PullPilot/main/docker-compose.yml
```

Do not paste a stale copy from a blog post; the file in the repo is the source of truth.

### 4. Start

```bash
docker compose up -d

```

Access the web interface at: [http://your-server-ip:8000](http://your-server-ip:8000)

## Usage Guide

### The Dashboard

Upon entering, you will see cards for each detected project:

* **Status:** The green dot indicates that all containers in the `docker-compose.yml` are running.
* **Update Button (Individual):** Forces a check and update only for that project.
* **Switches:**
* *Full Stop:* Enable if the service needs to be completely stopped to update.
* *Exclude:* Enable to protect the project from mass updates.



### Global Update

The **"Update All"** button in the header triggers the background process:

1. Scans all non-excluded projects.
2. Executes `git pull` (images).
3. Applies updates (recreates containers).
4. Generates a report in the History tab.

### Automatic Scheduling

By default, PullPilot runs a global update every day at 04:00 AM (container time).

## Local Development

If you want to contribute or modify the code:

1. Clone the repo:
```bash
git clone https://github.com/Kernel-Nomad/PullPilot
cd pullpilot

```


2. Build and start. The project includes a multi-stage Dockerfile that compiles the frontend (React) and prepares the backend (Python):
```bash
docker compose up --build

```



## ⚠️ Important Notes

* **Volumes:** Mount your stacks root with `${DOCKER_ROOT_PATH}:${DOCKER_ROOT_PATH}` so host and container share the same absolute path; that is where PullPilot looks for project folders. Override with env `PROJECTS_ROOT` only if you must use a different path inside the container.
* **Security:** PullPilot has access to the Docker socket. Do not expose port 8000 directly to the internet without an additional security layer (like Authelia, Authentik, or Basic Auth in a Reverse Proxy).
* **SESSION_SECRET:** Set a long, fixed random value in `.env` for real deployments. If it is unset, a new secret is generated on every process start and all sessions are invalidated on restart.
* **Project paths:** Each project scan (for example when loading the dashboard via `GET /api/projects`) reconciles the stored path in the database with the current `PROJECTS_ROOT` folder layout.
* **Process model:** Run a **single** API worker process per instance. The scheduler (APScheduler) and login rate limit store state in memory; multiple workers would not share jobs or rate-limit counters consistently.
* **Authentication:** Login is enabled only when **both** `AUTH_USER` and `AUTH_PASS` are set. If you set only one of them, the UI stays open without authentication.
* **Proxy IP:** With `TRUST_X_FORWARDED_FOR=true`, the first address in `X-Forwarded-For` is used for login rate limiting. Enable this only if a trusted proxy controls that header end-to-end (otherwise clients can spoof IPs and bypass limits).

---

<a name="español"></a>

# PullPilot

App para gestionar actualizaciones de tus imágenes y servicios docker (además de visualizar el estado, logs y controlar el modo de despliegue). Todo desde una interfaz visual limpia y responsiva.

## Instalación Rápida (Docker Compose)

La forma recomendada de desplegar PullPilot es usando Docker Compose.

### 1. Estructura de directorios requerida

PullPilot espera que tus proyectos estén organizados en subcarpetas dentro de una carpeta raíz en tu servidor:

```
/home/usuario/docker/    <-- ESTA es la carpeta que montarás
├── plex/
│   └── docker-compose.yml
├── pihole/
│   └── docker-compose.yml
└── ...

```

> :warning: Lógica de auto-exclusión: Incluso si se colocan dentro de la carpeta raíz, la aplicación está programada para ignorar automáticamente las carpetas con los nombres: pullpilot, pullpilot-ui, docker-updater y data.

#### Estructura sugerida:

```
/home/usuario/
├── mis_proyectos/       <-- Carpeta raíz que monitoreará PullPilot
│   ├── plex/
│   │   └── docker-compose.yml
│   ├── pihole/
│   │   └── docker-compose.yml
│   └── ...
│
└── pullpilot/           <-- Carpeta de instalación de PullPilot (FUERA de la anterior)
    └── docker-compose.yml

```

### 2. Prepara el entorno

Crea una carpeta para PullPilot y añade un `.env`. Puedes partir de [`.env.example`](./.env.example). **Mínimo** para un despliegue habitual:

```bash
DOCKER_ROOT_PATH=/home/usuario/docker
TZ=Europe/Madrid

AUTH_USER=admin
AUTH_PASS=tu_password_segura
SESSION_SECRET=tu-cadena-larga-aleatoria
```

El `docker-compose` monta `${DOCKER_ROOT_PATH}` en la **misma ruta absoluta** dentro del contenedor; la app usa esa ruta para buscar subcarpetas con `docker-compose.yml`. Solo necesitas `PROJECTS_ROOT` en `.env` si quieres otra ruta distinta de `DOCKER_ROOT_PATH`.

`SESSION_SECRET` mantiene las cookies válidas entre reinicios del contenedor. Si no lo defines, en cada arranque se genera un secreto nuevo y habrá que volver a iniciar sesión. Opcional: **`PULLPILOT_PORT`** (por defecto `8000`).

`DATA_DIR` por defecto es `/app/data` y el volumen nombrado `pullpilot_data` del compose oficial ya lo cubre; normalmente no hace falta definirlo.

#### Opcional / avanzado

```bash
SESSION_HTTPS_ONLY=true
# CORS_ORIGINS=https://pullpilot.ejemplo.com

# Rate limit de login (en memoria, por IP); recomendable un solo worker uvicorn
# LOGIN_RATE_LIMIT_ENABLED=true
# LOGIN_RATE_LIMIT_MAX=15
# LOGIN_RATE_LIMIT_WINDOW_SEC=300

# HEALTHCHECK_TIMEOUT=60
# COMMAND_TIMEOUT=300

# TRUST_X_FORWARDED_FOR=true   # solo tras reverse proxy de confianza
```

### 3. docker-compose.yml

Usa el `docker-compose.yml` **versionado** de este repositorio para que coincida con la imagen publicada:

- **Clona** el repo en tu carpeta de PullPilot y conserva el `docker-compose.yml` incluido, o
- **Descárgalo** (cambia `main` por tu rama por defecto si hace falta):

```bash
curl -fsSL -o docker-compose.yml https://raw.githubusercontent.com/Kernel-Nomad/PullPilot/main/docker-compose.yml
```

Evita pegar una copia antigua desde un tutorial; el archivo del repo es la referencia.

### 4. Iniciar

```bash
docker compose up -d

```

Accede a la interfaz web en: [http://tu-servidor-ip:8000](http://tu-servidor-ip:8000)

## Guía de Uso

### El Dashboard

Al entrar, verás tarjetas para cada proyecto detectado:

* **Estado:** El punto verde indica que todos los contenedores del `docker-compose.yml` están running.
* **Botón Actualizar (Individual):** Fuerza la comprobación y actualización solo de ese proyecto.
* **Switches:**
* *Full Stop:* Actívalo si el servicio necesita bajarse completamente para actualizarse.
* *Excluir:* Actívalo para proteger el proyecto de actualizaciones masivas.



### Actualización Global

El botón **"Actualizar Todo"** en la cabecera desencadena el proceso en segundo plano:

1. Escanea todos los proyectos no excluidos.
2. Ejecuta `git pull` (imágenes).
3. Aplica actualizaciones (recrea contenedores).
4. Genera un reporte en la pestaña Historial.

### Programación Automática

Por defecto, PullPilot ejecuta una actualización global todos los días a las 04:00 AM (hora del contenedor).

## Desarrollo Local

Si quieres contribuir o modificar el código:

1. Clona el repo:
```bash
git clone https://github.com/Kernel-Nomad/PullPilot
cd pullpilot

```


2. Construye y levanta. El proyecto incluye un Dockerfile multi-stage que compila el frontend (React) y prepara el backend (Python):
```bash
docker compose up --build

```



## ⚠️ Notas Importantes

* **Volúmenes:** Monta la carpeta de stacks con `${DOCKER_ROOT_PATH}:${DOCKER_ROOT_PATH}` para que host y contenedor compartan la misma ruta absoluta; ahí busca PullPilot las carpetas de proyecto. Usa la variable de entorno `PROJECTS_ROOT` solo si necesitas otra ruta dentro del contenedor.
* **Seguridad:** PullPilot tiene acceso al socket de Docker. No expongas el puerto 8000 directamente a internet sin una capa de seguridad adicional (como Authelia, Authentik o Basic Auth en un Reverse Proxy).
* **SESSION_SECRET:** En despliegue real define en `.env` un valor aleatorio largo y fijo. Si no se define, cada arranque del proceso genera un secreto nuevo y las sesiones caducan al reiniciar.
* **Rutas de proyectos:** Cada escaneo (por ejemplo al cargar el dashboard con `GET /api/projects`) actualiza en la base de datos la ruta almacenada si cambió `PROJECTS_ROOT` o la carpeta del proyecto.
* **Proceso único:** Usa **un solo** proceso worker de la API por instancia. El programador (APScheduler) y el rate limit de login guardan estado en memoria; varios workers no compartirían tareas ni contadores de forma coherente.
* **Autenticación:** El login solo se activa si están definidos **los dos**, `AUTH_USER` y `AUTH_PASS`. Si solo configuras uno, la interfaz queda sin autenticación.
* **IP tras proxy:** Con `TRUST_X_FORWARDED_FOR=true` se usa la primera dirección de `X-Forwarded-For` para el rate limit de login. Actívalo solo si un proxy de confianza controla esa cabecera de extremo a extremo; si no, un cliente podría falsear la IP y el límite pierde sentido.
