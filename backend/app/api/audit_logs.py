from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.audit_log import AuditLog


router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("")
def get_audit_logs(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    action: str | None = Query(default=None),
    actor: str | None = Query(default=None),
):
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action == action)

    if actor:
        query = query.filter(AuditLog.actor.ilike(f"%{actor}%"))

    total = query.count()

    logs = (
        query
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [
            {
                "id": str(log.id),
                "actor": log.actor,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "description": log.description,
                "created_at": log.created_at,
            }
            for log in logs
        ],
    }
