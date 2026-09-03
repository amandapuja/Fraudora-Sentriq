from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.services.events import publish
from app.services.serializers import serialize_alert


router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("")
def get_alerts(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status: str | None = Query(default=None),
    severity: str | None = Query(default=None),
):
    query = db.query(Alert)

    if status:
        query = query.filter(Alert.status == status)

    if severity:
        query = query.filter(Alert.severity == severity)

    total = query.count()

    alerts = (
        query
        .order_by(Alert.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [serialize_alert(alert) for alert in alerts],
    }


@router.get("/{alert_id}")
def get_alert_detail(
    alert_id: UUID,
    db: Session = Depends(get_db),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return serialize_alert(alert)


@router.patch("/{alert_id}/status")
def update_alert_status(
    alert_id: UUID,
    status: str = Query(..., description="open, investigating, resolved, dismissed"),
    actor: str = Query(default="Valen Yanto"),
    db: Session = Depends(get_db),
):
    allowed_statuses = {"open", "investigating", "resolved", "dismissed"}

    if status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed: {', '.join(sorted(allowed_statuses))}",
        )

    alert = db.query(Alert).filter(Alert.id == alert_id).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    old_status = alert.status
    alert.status = status

    if status in {"resolved", "dismissed"}:
        alert.resolved_at = datetime.utcnow()

    audit_log = AuditLog(
        actor=actor,
        action="update_alert_status",
        entity_type="alert",
        entity_id=str(alert.id),
        description=f"Changed alert status from {old_status} to {status}.",
    )

    db.add(audit_log)
    db.commit()
    db.refresh(alert)

    serialized = serialize_alert(alert)

    publish(
        "alert.updated",
        {
            "alert": serialized,
            "status": status,
            "previous_status": old_status,
            "actor": actor,
        },
    )
    publish(
        "audit.created",
        {
            "action": "update_alert_status",
            "entity_type": "alert",
            "entity_id": str(alert.id),
            "status": status,
            "actor": actor,
        },
    )

    return {
        "message": "Alert status updated successfully",
        "alert": serialized,
    }
