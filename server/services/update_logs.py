import json

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from server.models.db import UpdateLog


def persist_update_log(
    db: Session,
    *,
    status: str,
    summary: str,
    details: dict,
) -> None:
    """Persist one history row. Rolls back the session on failure and re-raises."""
    row = UpdateLog(status=status, summary=summary, details=json.dumps(details))
    db.add(row)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise
