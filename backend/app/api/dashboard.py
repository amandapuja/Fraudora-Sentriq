from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from app.db.session import get_db
from app.models.transaction import Transaction
from app.models.alert import Alert
from app.models.account import Account
from app.models.device import Device
from app.models.merchant import Merchant
from app.models.audit_log import AuditLog
from app.services.serializers import serialize_alert, serialize_transaction


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    total_transactions = db.query(Transaction).count()
    total_accounts = db.query(Account).count()
    total_devices = db.query(Device).count()
    total_merchants = db.query(Merchant).count()

    total_alerts = db.query(Alert).count()
    open_alerts = db.query(Alert).filter(Alert.status == "open").count()
    investigating_alerts = (
        db.query(Alert).filter(Alert.status == "investigating").count()
    )
    high_risk_transactions = db.query(Transaction).filter(Transaction.risk_level == "high").count()
    medium_risk_transactions = db.query(Transaction).filter(Transaction.risk_level == "medium").count()
    low_risk_transactions = db.query(Transaction).filter(Transaction.risk_level == "low").count()
    blocked_transactions = db.query(Transaction).filter(Transaction.status == "blocked").count()

    avg_fraud_score = db.query(func.avg(Transaction.fraud_score)).scalar() or 0

    # Today (UTC calendar day, matching stored transaction_time).
    start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    transactions_today = (
        db.query(Transaction)
        .filter(Transaction.transaction_time >= start_of_day)
        .count()
    )

    cross_border_transactions = (
        db.query(Transaction)
        .filter(Transaction.source_country != Transaction.destination_country)
        .count()
    )

    cross_border_rate = 0
    if total_transactions > 0:
        cross_border_rate = cross_border_transactions / total_transactions

    risk_distribution = {
        "low": low_risk_transactions,
        "medium": medium_risk_transactions,
        "high": high_risk_transactions,
    }

    status_distribution = {
        "approved": db.query(Transaction).filter(Transaction.status == "approved").count(),
        "flagged": db.query(Transaction).filter(Transaction.status == "flagged").count(),
        "blocked": db.query(Transaction).filter(Transaction.status == "blocked").count(),
        "pending": db.query(Transaction).filter(Transaction.status == "pending").count(),
    }

    severity_distribution = {
        "low": db.query(Alert).filter(Alert.severity == "low").count(),
        "medium": db.query(Alert).filter(Alert.severity == "medium").count(),
        "high": db.query(Alert).filter(Alert.severity == "high").count(),
        "critical": db.query(Alert).filter(Alert.severity == "critical").count(),
    }

    return {
        "total_transactions": total_transactions,
        "total_accounts": total_accounts,
        "total_devices": total_devices,
        "total_merchants": total_merchants,
        "total_alerts": total_alerts,
        "open_alerts": open_alerts,
        "investigating_alerts": investigating_alerts,
        "high_risk_transactions": high_risk_transactions,
        "medium_risk_transactions": medium_risk_transactions,
        "low_risk_transactions": low_risk_transactions,
        "blocked_transactions": blocked_transactions,
        "transactions_today": transactions_today,
        "cross_border_transactions": cross_border_transactions,
        "cross_border_rate": round(cross_border_rate, 2),
        "average_fraud_score": round(float(avg_fraud_score), 2),
        "risk_distribution": risk_distribution,
        "status_distribution": status_distribution,
        "severity_distribution": severity_distribution,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/recent-alerts")
def get_recent_alerts(db: Session = Depends(get_db)):
    alerts = (
        db.query(Alert)
        .order_by(Alert.created_at.desc())
        .limit(10)
        .all()
    )

    return [serialize_alert(alert) for alert in alerts]


@router.get("/recent-transactions")
def get_recent_transactions(
    db: Session = Depends(get_db),
    limit: int = 6,
):
    transactions = (
        db.query(Transaction)
        .order_by(Transaction.transaction_time.desc())
        .limit(limit)
        .all()
    )

    return {
        "items": [serialize_transaction(transaction) for transaction in transactions],
    }


@router.get("/recent-activity")
def get_recent_activity(
    db: Session = Depends(get_db),
    limit: int = 8,
):
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )

    return {
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
