from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.label import Label
from app.models.transaction import Transaction
from app.schemas.label import LabelCreate, LabelResponse
from app.ml.continual.adaptive_trainer import get_adaptive_learning_status
from app.services.events import publish
from app.services.serializers import serialize_alert, serialize_transaction

router = APIRouter(prefix="/labels", tags=["Labeling"])


def serialize_label(label: Label):
    return {
        "id": str(label.id),
        "transaction_id": str(label.transaction_id),
        "label": label.label,
        "labelled_by": label.labelled_by,
        "notes": label.notes,
        "created_at": label.created_at,
        "transaction": {
            "id": str(label.transaction.id),
            "transaction_reference": label.transaction.transaction_reference,
            "amount": label.transaction.amount,
            "currency": label.transaction.currency,
            "fraud_score": label.transaction.fraud_score,
            "risk_level": label.transaction.risk_level,
            "status": label.transaction.status,
        } if label.transaction else None,
    }


@router.get("")
def get_labels(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    label: str | None = Query(default=None),
):
    query = db.query(Label)

    if label:
        query = query.filter(Label.label == label)

    total = query.count()

    labels = (
        query.order_by(Label.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [serialize_label(item) for item in labels],
    }


@router.post("", response_model=LabelResponse)
def create_label(
    payload: LabelCreate,
    db: Session = Depends(get_db),
):
    allowed_labels = {"fraud", "legitimate", "suspicious"}

    if payload.label not in allowed_labels:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid label. Allowed: {', '.join(sorted(allowed_labels))}",
        )

    transaction = (
        db.query(Transaction)
        .filter(Transaction.id == payload.transaction_id)
        .first()
    )

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    label = Label(
        transaction_id=payload.transaction_id,
        label=payload.label,
        labelled_by=payload.labelled_by,
        notes=payload.notes,
    )

    db.add(label)

    alert_updated = False

    alert = (
        db.query(Alert)
        .filter(Alert.transaction_id == payload.transaction_id)
        .order_by(Alert.created_at.desc())
        .first()
    )

    if alert:
        if payload.label == "fraud":
            alert.status = "resolved"
            alert.resolved_at = datetime.utcnow()
            transaction.status = "blocked"
        elif payload.label == "legitimate":
            alert.status = "dismissed"
            alert.resolved_at = datetime.utcnow()
            transaction.status = "approved"
        elif payload.label == "suspicious":
            alert.status = "investigating"
            transaction.status = "flagged"

        alert_updated = True

    audit_log = AuditLog(
        actor=payload.labelled_by,
        action="create_transaction_label",
        entity_type="transaction",
        entity_id=str(transaction.id),
        description=(
            f"Labelled transaction {transaction.transaction_reference} "
            f"as {payload.label}."
        ),
    )

    db.add(audit_log)
    db.commit()
    db.refresh(label)

    db.refresh(transaction)
    if alert:
        db.refresh(alert)
        publish(
            "alert.updated",
            {"alert": serialize_alert(alert), "label": payload.label},
        )
    publish(
        "transaction.updated",
        {"transaction": serialize_transaction(transaction), "label": payload.label},
    )
    publish(
        "audit.created",
        {
            "action": "create_transaction_label",
            "entity_type": "transaction",
            "entity_id": str(transaction.id),
            "label": payload.label,
            "actor": payload.labelled_by,
        },
    )

    adaptive_status = get_adaptive_learning_status(db)

    return {
        "message": "Label created successfully",
        "label_id": str(label.id),
        "transaction_id": str(transaction.id),
        "label": label.label,
        "alert_updated": alert_updated,
        "adaptive_learning": adaptive_status,
    }


@router.get("/{label_id}")
def get_label_detail(
    label_id: UUID,
    db: Session = Depends(get_db),
):
    label = db.query(Label).filter(Label.id == label_id).first()

    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    return serialize_label(label)