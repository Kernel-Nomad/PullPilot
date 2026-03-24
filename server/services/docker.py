import shlex
import subprocess
from collections.abc import Sequence

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


def run_command(cmd: str | Sequence[str], cwd: str | None = None) -> str:
    if isinstance(cmd, str):
        cmd_args = shlex.split(cmd)
        cmd_display = cmd
    else:
        cmd_args = list(cmd)
        cmd_display = " ".join(cmd_args)

    try:
        logger.info("Exec: %s en %s", cmd_display, cwd)
        result = subprocess.run(
            cmd_args,
            cwd=cwd,
            shell=False,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=COMMAND_TIMEOUT,
        )
        return result.stdout.strip()
    except subprocess.TimeoutExpired as exc:
        error_msg = (
            f"Timeout command: {cmd_display}\n"
            f"Timeout configurado: {COMMAND_TIMEOUT}s\n"
            f"Stderr: {exc.stderr}"
        )
        logger.error(error_msg)
        raise RuntimeError(error_msg) from exc
    except subprocess.CalledProcessError as exc:
        error_msg = f"Error command: {cmd_display}\nStderr: {exc.stderr}"
        logger.error(error_msg)
        raise RuntimeError(error_msg) from exc
