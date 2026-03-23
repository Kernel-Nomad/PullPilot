import subprocess

from server.config import COMMAND_TIMEOUT, logger


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
            timeout=COMMAND_TIMEOUT,
        )
        return result.stdout.strip()
    except subprocess.TimeoutExpired as exc:
        error_msg = (
            f"Timeout command: {cmd}\n"
            f"Timeout configurado: {COMMAND_TIMEOUT}s\n"
            f"Stderr: {exc.stderr}"
        )
        logger.error(error_msg)
        raise RuntimeError(error_msg) from exc
    except subprocess.CalledProcessError as exc:
        error_msg = f"Error command: {cmd}\nStderr: {exc.stderr}"
        logger.error(error_msg)
        raise RuntimeError(error_msg) from exc
