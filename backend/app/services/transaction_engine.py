"""Core transaction pipeline: create -> score -> alert -> audit -> graph sync.

This module is the single code path used by:
- POST /api/v1/transactions          (normal API creation)
- POST /api/v1/transactions/demo/generate (controlled demo generator)

Both flows therefore run through the exact same scoring, alerting,
audit and graph-sync logic. After a successful commit the module
publishes realtime events so connected dashboards update live.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.device import Device
from app.models.merchant import Merchant
from app.models.transaction import Transaction
from app.services.events import publish
from app.services.fraud_scoring import (
    calculate_fraud_score,
    get_alert_severity,
    get_risk_level,
    get_transaction_status,
)
from app.services.graph_sync import sync_transaction_to_graph
from app.services.serializers import serialize_alert, serialize_transaction
from app.ml.inference.internal_scorer import (
    build_trustlens_internal_features,
    score_with_internal_adaptive_model,
)
from app.ml.inference.tabular_scorer import (
    build_paysim_like_features,
    score_with_active_tabular_model,
)


def _write_audit(db: Session, actor: str, action: str, entity_type: str,
                 entity_id: str | None, description: str) -> AuditLog:
    log = AuditLog(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
    )
    db.add(log)
    return log


def create_scored_transaction(
    db: Session,
    *,
    sender_account_id: str,
    receiver_account_id: str,
    amount: float,
    currency: str,
    channel: str,
    source_country: str,
    destination_country: str,
    device_id: str | None = None,
    merchant_id: str | None = None,
    ip_address: str | None = None,
    actor: str = "system",
    source: str = "api",
) -> dict[str, Any]:
    """Create, score, alert, audit and publish a transaction.

    Returns a dict with the serialized transaction, the created alert
    (if any) and model-contribution details. Raises HTTPException-style
    errors through ValueError with HTTP-compatible messages for the
    caller to translate.
    """
    # IDs can arrive as strings from the API layer; SQLite's UUID binding
    # requires real uuid.UUID objects (PostgreSQL coerces automatically).
    def _as_uuid(value: str | uuid.UUID | None) -> uuid.UUID | None:
        if value is None:
            return None
        return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))

    sender_account_id = _as_uuid(sender_account_id)
    receiver_account_id = _as_uuid(receiver_account_id)
    device_id = _as_uuid(device_id)
    merchant_id = _as_uuid(merchant_id)

    sender_account = db.query(Account).filter(Account.id == sender_account_id).first()
    if not sender_account:
        raise ValueError("Sender account not found")

    receiver_account = db.query(Account).filter(Account.id == receiver_account_id).first()
    if not receiver_account:
        raise ValueError("Receiver account not found")

    if sender_account.id == receiver_account.id:
        raise ValueError("Sender and receiver account cannot be the same")

    device = None
    if device_id:
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device:
            raise ValueError("Device not found")

    merchant = None
    if merchant_id:
        merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
        if not merchant:
            raise ValueError("Merchant not found")

    # 1) Rule-based score (always active, deterministic).
    rule_score, reasons = calculate_fraud_score(
        amount=amount,
        source_country=source_country,
        destination_country=destination_country,
        sender_account=sender_account,
        receiver_account=receiver_account,
        device=device,
        merchant=merchant,
    )

    # 2) Optional ML contributions (only if a trained artifact exists).
    tabular_features = build_paysim_like_features(
        amount=amount,
        channel=channel,
        source_country=source_country,
        destination_country=destination_country,
        sender_risk_level=sender_account.risk_level,
        receiver_risk_level=receiver_account.risk_level,
        device_risk_level=device.risk_level if device else "low",
        device_is_blacklisted=device.is_blacklisted if device else False,
        merchant_risk_level=merchant.risk_level if merchant else "low",
        merchant_is_blacklisted=merchant.is_blacklisted if merchant else False,
    )
    tabular_result = score_with_active_tabular_model(tabular_features)

    preliminary_status = get_transaction_status(rule_score)

    internal_features = build_trustlens_internal_features(
        amount=amount,
        currency=currency,
        channel=channel,
        source_country=source_country,
        destination_country=destination_country,
        rule_fraud_score=rule_score,
        transaction_status=preliminary_status,
        sender_risk_level=sender_account.risk_level,
        receiver_risk_level=receiver_account.risk_level,
        device_risk_level=device.risk_level if device else "low",
        device_is_blacklisted=device.is_blacklisted if device else False,
        merchant_risk_level=merchant.risk_level if merchant else "low",
        merchant_is_blacklisted=merchant.is_blacklisted if merchant else False,
    )
    internal_result = score_with_internal_adaptive_model(internal_features)

    # 3) Risk-aware ensemble guard: max(rule, weighted blend).
    score_candidates = [rule_score]
    weighted_parts = [rule_score * 0.50]

    if tabular_result.used_model:
        score_candidates.append(tabular_result.tabular_ml_score)
        weighted_parts.append(tabular_result.tabular_ml_score * 0.30)
        reasons.append(
            f"PaySim XGBoost model contributed score {tabular_result.tabular_ml_score}"
        )
    else:
        reasons.append("No active PaySim model available")

    if internal_result.used_model:
        score_candidates.append(internal_result.internal_ml_score)
        weighted_parts.append(internal_result.internal_ml_score * 0.20)
        reasons.append(
            f"TrustLens internal adaptive model contributed score {internal_result.internal_ml_score}"
        )
    else:
        reasons.append("No TrustLens internal adaptive model available")

    blended_score = round(sum(weighted_parts), 2)
    fraud_score = round(max(rule_score, blended_score, *score_candidates), 2)
    reasons.append(
        f"Final score selected using ensemble guard: max(rule={rule_score}, blend={blended_score})"
    )

    risk_level = get_risk_level(fraud_score)
    status = get_transaction_status(fraud_score)

    transaction = Transaction(
        transaction_reference=f"TRX-{uuid.uuid4().hex[:12].upper()}",
        sender_account_id=sender_account.id,
        receiver_account_id=receiver_account.id,
        device_id=device.id if device else None,
        merchant_id=merchant.id if merchant else None,
        amount=amount,
        currency=currency,
        channel=channel,
        source_country=source_country,
        destination_country=destination_country,
        ip_address=ip_address or (device.ip_address if device else None),
        status=status,
        fraud_score=fraud_score,
        risk_level=risk_level,
    )

    db.add(transaction)
    db.flush()

    alert = None
    if fraud_score >= 0.50:
        alert = Alert(
            transaction_id=transaction.id,
            alert_type="fraud_risk",
            severity=get_alert_severity(fraud_score),
            risk_score=fraud_score,
            reason="; ".join(reasons),
            status="open",
            assigned_to=None,
        )
        db.add(alert)

    _write_audit(
        db,
        actor=actor,
        action="create_transaction",
        entity_type="transaction",
        entity_id=str(transaction.id),
        description=(
            f"Created transaction {transaction.transaction_reference} "
            f"with fraud score {fraud_score} and risk level {risk_level} "
            f"(source: {source})."
        ),
    )

    db.commit()
    db.refresh(transaction)

    # Neo4j sync is best-effort: a missing graph database must not break
    # the transaction pipeline (the frontend falls back to Postgres data).
    try:
        sync_transaction_to_graph(transaction)
    except Exception as exc:  # pragma: no cover - environment dependent
        print(f"[Neo4j Sync Warning] {exc}")

    serialized_tx = serialize_transaction(transaction)

    # 4) Realtime push.
    publish(
        "transaction.created",
        {
            "transaction": serialized_tx,
            "alert_created": alert is not None,
            "source": source,
        },
    )

    if alert is not None:
        db.refresh(alert)
        publish(
            "alert.created",
            {
                "alert": serialize_alert(alert),
                "transaction": serialized_tx,
                "source": source,
            },
        )

    publish(
        "audit.created",
        {
            "action": "create_transaction",
            "entity_type": "transaction",
            "entity_id": str(transaction.id),
            "transaction_reference": transaction.transaction_reference,
        },
    )

    return {
        "transaction": serialized_tx,
        "alert": serialize_alert(alert) if alert else None,
        "alert_created": alert is not None,
        "fraud_score": transaction.fraud_score,
        "risk_level": transaction.risk_level,
        "status": transaction.status,
        "ml_model_used": tabular_result.used_model or internal_result.used_model,
        "ml_score": tabular_result.tabular_ml_score if tabular_result.used_model else None,
        "tabular_ml_model_used": tabular_result.used_model,
        "tabular_ml_score": tabular_result.tabular_ml_score if tabular_result.used_model else None,
        "tabular_model_version": tabular_result.model_version,
        "internal_ml_model_used": internal_result.used_model,
        "internal_ml_score": internal_result.internal_ml_score if internal_result.used_model else None,
        "internal_model_version": internal_result.model_version,
        "ensemble_mode": "risk_aware_max_guard",
        "source": source,
    }
