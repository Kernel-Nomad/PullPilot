import subprocess

from server.config import logger


def get_docker_compose_cmd() -> str:
    try:
        subprocess.run(
            ["docker", "compose", "version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        return "docker compose"
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "docker-compose"


COMPOSE_CMD = get_docker_compose_cmd()


def run_command(cmd: str, cwd: str | None = None) -> str:
    try:
        logger.info("Exec: %s en %s", cmd, cwd)
        result = subprocess.run(
            cmd,
            cwd=cwd,
            shell=True,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as exc:
        error_msg = f"Error command: {cmd}\nStderr: {exc.stderr}"
        logger.error(error_msg)
        raise RuntimeError(error_msg) from exc
