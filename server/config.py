import logging
import os
import secrets
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))
# Compose users set DOCKER_ROOT_PATH (same path as the bind mount); PROJECTS_ROOT overrides if set.
PROJECTS_ROOT = Path(
    os.getenv("PROJECTS_ROOT") or os.getenv("DOCKER_ROOT_PATH", "/app/projects")
)
DB_PATH = DATA_DIR / "pullpilot.db"
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

HEALTHCHECK_TIMEOUT = int(os.getenv("HEALTHCHECK_TIMEOUT", "60"))
COMMAND_TIMEOUT = int(os.getenv("COMMAND_TIMEOUT", "300"))

AUTH_USER = os.getenv("AUTH_USER")
AUTH_PASS = os.getenv("AUTH_PASS")
SESSION_SECRET = os.getenv("SESSION_SECRET", secrets.token_hex(32))
SESSION_HTTPS_ONLY = os.getenv("SESSION_HTTPS_ONLY", "false").lower() == "true"

# Coma-separado; vacío = permitir cualquier origen (misma SPA servida por FastAPI suele no necesitar CORS).
_raw_cors = os.getenv("CORS_ORIGINS", "").strip()
CORS_ORIGINS: list[str] = (
    ["*"]
    if not _raw_cors
    else [o.strip() for o in _raw_cors.split(",") if o.strip()]
)

LOGIN_RATE_LIMIT_ENABLED = os.getenv("LOGIN_RATE_LIMIT_ENABLED", "true").lower() == "true"
LOGIN_RATE_LIMIT_MAX = int(os.getenv("LOGIN_RATE_LIMIT_MAX", "15"))
LOGIN_RATE_LIMIT_WINDOW_SEC = int(os.getenv("LOGIN_RATE_LIMIT_WINDOW_SEC", "300"))

# Tras reverse proxy de confianza: usar la primera IP de X-Forwarded-For para rate limit de login.
TRUST_X_FORWARDED_FOR = os.getenv("TRUST_X_FORWARDED_FOR", "false").lower() == "true"

os.environ.setdefault("TZ", "UTC")
DATA_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("pullpilot")
