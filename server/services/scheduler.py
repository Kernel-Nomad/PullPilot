import json
import time

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger

from server.config import logger
from server.database import SessionLocal
from server.models.db import ProjectSettings, ScheduledTask, UpdateLog
from server.services.docker import run_command
from server.services.projects import update_single_project_logic


global_update_status = {
    "is_running": False,
    "total": 0,
    "current": 0,
    "current_project": "",
    "processed": [],
}

scheduler = BackgroundScheduler()


def global_update_job() -> None:
    if global_update_status["is_running"]:
        logger.warning("Actualizacion global ya en curso. Omitiendo tarea.")
        return

    global_update_status["is_running"] = True
    global_update_status["processed"] = []
    db = SessionLocal()
    try:
        logger.info("Iniciando tarea programada: Actualizacion Global Segura")

        projects = db.query(ProjectSettings).filter(ProjectSettings.excluded.is_(False)).all()
        global_update_status["total"] = len(projects)
        global_update_status["current"] = 0

        global_logs: dict[str, list[str] | str] = {}
        success_count = 0
        error_count = 0

        for index, project in enumerate(projects):
            global_update_status["current"] = index + 1
            global_update_status["current_project"] = project.name

            if index > 0:
                time.sleep(2)

            try:
                success, logs = update_single_project_logic(project.name, db)
            except Exception as exc:
                success = False
                logs = [f"[ERR] Error interno en el bucle principal: {exc}"]

            global_logs[project.name] = logs
            global_update_status["processed"].append(
                {"name": project.name, "status": "OK" if success else "ERROR"}
            )

            if success:
                success_count += 1
            else:
                error_count += 1

        if error_count == 0:
            global_update_status["current_project"] = "Limpiando sistema (safe prune)..."
            try:
                logger.info("Iniciando espera de seguridad de 5s antes del prune...")
                time.sleep(5)
                prune_out = run_command("docker image prune -f")
                message = "Limpieza de imagenes obsoletas completada (safe mode)."
                if prune_out:
                    message += f"\nOutput Docker:\n{prune_out}"
                global_logs["safe_cleanup"] = message
            except Exception as exc:
                global_logs["safe_cleanup"] = f"Error en limpieza de imagenes: {exc}"
        else:
            warning_msg = (
                f"[WARN] LIMPIEZA OMITIDA: Se detectaron {error_count} errores durante la "
                "actualizacion. No se ejecutara prune para facilitar la depuracion."
            )
            logger.warning(warning_msg)
            global_logs["safe_cleanup"] = warning_msg

        summary = f"Global Update: {success_count} OK, {error_count} Errores"
        status = "SUCCESS" if error_count == 0 else "ERROR"

        new_log = UpdateLog(
            status=status,
            summary=summary,
            details=json.dumps(global_logs),
        )
        db.add(new_log)
        db.commit()
    finally:
        db.close()
        global_update_status["is_running"] = False
        global_update_status["current_project"] = ""


def job_wrapper(target: str) -> None:
    if target == "GLOBAL":
        logger.info("Ejecutando tarea programada: GLOBAL")
        global_update_job()
        return

    db = SessionLocal()
    try:
        logger.info("Ejecutando tarea programada: %s", target)
        success, logs = update_single_project_logic(target, db)

        summary = f"[Scheduled] {target}: {'OK' if success else 'ERROR'}"
        new_log = UpdateLog(
            status="SUCCESS" if success else "ERROR",
            summary=summary,
            details=json.dumps({target: logs}),
        )
        db.add(new_log)
        db.commit()
    except Exception as exc:
        logger.error("Error en tarea programada %s: %s", target, exc)
    finally:
        db.close()


def refresh_scheduler_jobs() -> None:
    scheduler.remove_all_jobs()

    db = SessionLocal()
    count = 0
    try:
        tasks = db.query(ScheduledTask).filter(ScheduledTask.active.is_(True)).all()

        for task in tasks:
            try:
                trigger = None
                job_id = f"job_{task.id}"

                if task.task_type == "cron":
                    parts = task.expression.split()
                    if len(parts) >= 5:
                        trigger = CronTrigger(
                            minute=parts[0],
                            hour=parts[1],
                            day=parts[2],
                            month=parts[3],
                            day_of_week=parts[4],
                        )
                elif task.task_type == "date":
                    trigger = DateTrigger(run_date=task.expression)

                if trigger:
                    scheduler.add_job(
                        job_wrapper,
                        trigger,
                        args=[task.target],
                        id=job_id,
                        replace_existing=True,
                    )
                    count += 1
            except Exception as exc:
                logger.error("Error cargando tarea %s: %s", task.id, exc)
    finally:
        db.close()

    logger.info("Scheduler refrescado: %s tareas activas.", count)


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()
    refresh_scheduler_jobs()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
