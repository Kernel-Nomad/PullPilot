import datetime
import json
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from server.config import HEALTHCHECK_TIMEOUT, PROJECTS_ROOT, logger
from server.models.db import ProjectSettings
from server.services.docker import COMPOSE_CMD, run_command


IGNORED_PROJECT_NAMES = {"pullpilot", "pullpilot-ui", "docker-updater", "data"}


def _resolved_projects_root() -> Path:
    return PROJECTS_ROOT.resolve()


def resolve_allowed_project_workdir(raw: str) -> Path:
    """Resuelve la ruta del stack y comprueba que quede bajo PROJECTS_ROOT."""
    root = _resolved_projects_root()
    candidate = Path(raw).expanduser()
    try:
        resolved = candidate.resolve()
    except (OSError, RuntimeError) as exc:
        raise ValueError(f"No se pudo resolver la ruta del proyecto: {exc}") from exc
    try:
        resolved.relative_to(root)
    except ValueError:
        raise ValueError(
            "La ruta del proyecto no está bajo PROJECTS_ROOT (posible dato alterado en BD)."
        ) from None
    return resolved


def compose_stack_allowed(path: Path) -> bool:
    """True si el directorio es un stack compose válido y está bajo PROJECTS_ROOT."""
    try:
        resolved = path.expanduser().resolve()
        resolved.relative_to(_resolved_projects_root())
    except (OSError, RuntimeError, ValueError):
        return False
    return compose_project_path_ok(resolved)


def _dir_has_compose_file(path: Path) -> bool:
    return (path / "docker-compose.yml").exists() or (path / "docker-compose.yaml").exists()


def compose_project_path_ok(path: Path) -> bool:
    """Directorio existente con docker-compose.yml o .yaml (mismo criterio que el escaneo)."""
    return path.is_dir() and _dir_has_compose_file(path)


def _compose_ps_q_ids(project_path: str, *, log_exec: bool) -> list[str]:
    """Container IDs from `docker compose ps -q` (non-empty lines only)."""
    out = run_command(f"{COMPOSE_CMD} ps -q", cwd=project_path, log_exec=log_exec)
    return [line.strip() for line in out.splitlines() if line.strip()]


def _compose_ps_status(path_str: str) -> tuple[str, int]:
    try:
        ids = _compose_ps_q_ids(path_str, log_exec=False)
    except Exception:
        return "error", 0
    running_count = len(ids)
    status = "running" if running_count > 0 else "stopped"
    return status, running_count


def _wait_for_compose_healthy(
    project_path: str,
    log: Callable[..., None],
) -> None:
    start_time = time.time()
    while True:
        elapsed = time.time() - start_time
        if elapsed > HEALTHCHECK_TIMEOUT:
            raise RuntimeError(
                f"Timeout: Los servicios no iniciaron correctamente en {HEALTHCHECK_TIMEOUT}s."
            )

        try:
            container_ids = _compose_ps_q_ids(project_path, log_exec=True)
        except Exception:
            container_ids = []

        if not container_ids:
            if elapsed > 5:
                raise RuntimeError(
                    "No se detectaron contenedores activos tras el despliegue."
                )
            time.sleep(1)
            continue

        all_healthy = True
        for container_id in container_ids:
            inspect_raw = run_command(["docker", "inspect", container_id])
            data = json.loads(inspect_raw)[0]
            state = data.get("State", {})
            status = state.get("Status")
            health = state.get("Health", {}).get("Status")

            if status == "restarting":
                raise RuntimeError(
                    f"Contenedor {container_id[:12]} detectado en bucle de reinicio."
                )
            if status in {"exited", "dead"}:
                exit_code = state.get("ExitCode")
                if exit_code != 0:
                    raise RuntimeError(
                        f"Contenedor {container_id[:12]} finalizo con error (code: {exit_code})."
                    )

            if health == "unhealthy":
                raise RuntimeError(
                    f"Healthcheck fallido para {container_id[:12]} (unhealthy)."
                )

            if health == "starting":
                all_healthy = False
                continue

            if health is None and status != "running":
                all_healthy = False

        if all_healthy:
            log("Healthcheck superado: todos los servicios estables.", "SUCCESS")
            break

        time.sleep(2)


def scan_projects_logic(db: Session) -> list[dict]:
    if not PROJECTS_ROOT.exists():
        return []

    pending_db_write = False
    ordered: list[tuple[str, Path, ProjectSettings]] = []

    for path in PROJECTS_ROOT.iterdir():
        entry = path.name
        if entry.lower() in IGNORED_PROJECT_NAMES:
            continue

        if not compose_project_path_ok(path):
            continue

        proj = db.query(ProjectSettings).filter(ProjectSettings.name == entry).first()
        if not proj:
            proj = ProjectSettings(name=entry, path=str(path))
            db.add(proj)
            pending_db_write = True
        elif proj.path != str(path):
            proj.path = str(path)
            pending_db_write = True

        ordered.append((entry, path, proj))

    if pending_db_write:
        try:
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            logger.warning(
                "No se pudo persistir cambios del escaneo de proyectos (altas o rutas)."
            )

    status_by_entry: dict[str, tuple[str, int]] = {}
    if ordered:
        max_workers = min(8, len(ordered))
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            future_to_entry = {
                pool.submit(_compose_ps_status, str(path)): entry
                for entry, path, _ in ordered
            }
            for fut in as_completed(future_to_entry):
                entry = future_to_entry[fut]
                status_by_entry[entry] = fut.result()

    found: list[dict] = []
    for entry, path, proj in ordered:
        status, running_count = status_by_entry[entry]
        found.append(
            {
                "name": entry,
                "path": str(path),
                "status": status,
                "containers": running_count,
                "excluded": proj.excluded,
                "full_stop": proj.full_stop,
            }
        )

    return found


def update_single_project_logic(name: str, db: Session) -> tuple[bool, list[str]]:
    project = db.query(ProjectSettings).filter(ProjectSettings.name == name).first()
    if not project:
        return False, ["ERROR: Proyecto no encontrado en la base de datos."]

    logs: list[str] = []

    def log(message: str, level: str = "INFO") -> None:
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        prefix = "[OK]" if level == "SUCCESS" else "[ERR]" if level == "ERROR" else "[WARN]" if level == "WARN" else "[INFO]"
        logs.append(f"[{ts}] {prefix} {message}")

    log(f"=== ACTUALIZANDO: {name} ===")

    try:
        workdir = resolve_allowed_project_workdir(project.path)
    except ValueError as exc:
        return False, [f"ERROR: {exc}"]

    if not compose_project_path_ok(workdir):
        return False, ["ERROR: El directorio del proyecto no es un stack compose válido."]

    workdir_str = str(workdir)

    git_hash_before: str | None = None
    is_git_repo = (workdir / ".git").is_dir()

    if is_git_repo:
        try:
            git_hash_before = run_command("git rev-parse HEAD", cwd=workdir_str)
            log(f"Snapshot creado. Commit actual: {git_hash_before[:7]}")
        except Exception as exc:
            log(f"No se pudo guardar estado Git: {exc}", "WARN")

    try:
        if is_git_repo:
            log("Ejecutando git pull...")
            run_command("git pull", cwd=workdir_str)

        log("Descargando imagenes nuevas...")
        run_command(f"{COMPOSE_CMD} pull", cwd=workdir_str)

        if project.full_stop:
            log("Modo Full Stop: bajando servicios...")
            run_command(f"{COMPOSE_CMD} down", cwd=workdir_str)
        else:
            log("Deteniendo contenedores...")
            run_command(f"{COMPOSE_CMD} stop", cwd=workdir_str)

        log("Recreando contenedores...")
        run_command(f"{COMPOSE_CMD} up -d --build --remove-orphans", cwd=workdir_str)

        log(f"Verificando salud (timeout: {HEALTHCHECK_TIMEOUT}s)...")
        _wait_for_compose_healthy(workdir_str, log)

        logs.append("=== PROCESO COMPLETADO CORRECTAMENTE ===")
        return True, logs
    except Exception as exc:
        log(f"FALLO CRITICO DETECTADO: {exc}", "ERROR")

        if git_hash_before:
            log("INICIANDO ROLLBACK AUTOMATICO...", "WARN")
            try:
                run_command(["git", "reset", "--hard", git_hash_before], cwd=workdir_str)
                log(f"Codigo revertido a commit {git_hash_before[:7]}.")

                log("Forzando redespliegue de version anterior...")
                run_command(f"{COMPOSE_CMD} up -d --build --remove-orphans", cwd=workdir_str)
                log("Rollback exitoso. El sistema ha vuelto al estado previo.", "SUCCESS")
                logs.append(
                    "NOTA: Se ha realizado un rollback automatico para restaurar el servicio."
                )
            except Exception as rollback_exc:
                log(f"FATAL: El rollback tambien fallo: {rollback_exc}", "ERROR")
        else:
            log(
                "No es posible hacer rollback (no es un repo Git o no se guardo el estado).",
                "WARN",
            )

        return False, logs
