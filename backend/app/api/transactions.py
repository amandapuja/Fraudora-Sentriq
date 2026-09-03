import random
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.account import Account
from app.models.audit_log import AuditLog
from app.models.device import Device
from app.models.merchant import Merchant
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionCreateResponse
from app.services.events import publish
from app.services.serializers import serialize_transaction
from app.services.transaction_engine import create_scored_transaction

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def serialize_transaction_public(transaction: Transaction):
    return serialize_transaction(transaction)


@router.get("")
def get_transactions(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    risk_level: str | None = Query(default=None),
    status: str | None = Query(default=None),
):
    query = db.query(Transaction)

    if risk_level:
        query = query.filter(Transaction.risk_level == risk_level)

    if status:
        query = query.filter(Transaction.status == status)

    total = query.count()

    transactions = (
        query.order_by(Transaction.transaction_time.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [serialize_transaction(transaction) for transaction in transactions],
    }


@router.post("", response_model=TransactionCreateResponse)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
):
    try:
        result = create_scored_transaction(
            db,
            sender_account_id=payload.sender_account_id,
            receiver_account_id=payload.receiver_account_id,
            device_id=payload.device_id,
            merchant_id=payload.merchant_id,
            amount=payload.amount,
            currency=payload.currency,
            channel=payload.channel,
            source_country=payload.source_country,
            destination_country=payload.destination_country,
            ip_address=payload.ip_address,
            actor="system",
            source="api",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    transaction = result["transaction"]

    return TransactionCreateResponse(
        message="Transaction created and scored successfully",
        transaction_id=str(transaction["id"]),
        transaction_reference=transaction["transaction_reference"],
        fraud_score=transaction["fraud_score"],
        risk_level=transaction["risk_level"],
        status=transaction["status"],
        alert_created=result["alert_created"],
        ml_model_used=result["ml_model_used"],
        ml_score=result["ml_score"],
        tabular_ml_model_used=result["tabular_ml_model_used"],
        tabular_ml_score=result["tabular_ml_score"],
        tabular_model_version=result["tabular_model_version"],
        internal_ml_model_used=result["internal_ml_model_used"],
        internal_ml_score=result["internal_ml_score"],
        internal_model_version=result["internal_model_version"],
        ensemble_mode=result["ensemble_mode"],
    )


@router.get("/demo/options")
def get_demo_transaction_options(db: Session = Depends(get_db)):
    accounts = db.query(Account).limit(10).all()
    devices = db.query(Device).limit(10).all()
    merchants = db.query(Merchant).limit(10).all()

    return {
        "accounts": [
            {
                "id": str(account.id),
                "account_number": account.account_number,
                "holder_name": account.holder_name,
                "risk_level": account.risk_level,
            }
            for account in accounts
        ],
        "devices": [
            {
                "id": str(device.id),
                "device_fingerprint": device.device_fingerprint,
                "risk_level": device.risk_level,
                "is_blacklisted": device.is_blacklisted,
            }
            for device in devices
        ],
        "merchants": [
            {
                "id": str(merchant.id),
                "name": merchant.name,
                "category": merchant.category,
                "risk_level": merchant.risk_level,
                "is_blacklisted": merchant.is_blacklisted,
            }
            for merchant in merchants
        ],
    }


@router.post("/demo/generate")
def generate_demo_transactions(
    count: int = Query(default=1, ge=1, le=10),
    scenario: str = Query(
        default="random",
        pattern="^(random|cross_border_high|large_amount|blacklisted_device)$",
    ),
    db: Session = Depends(get_db),
):
    """Controlled demo transaction generator.

    Creates transactions through the normal backend pipeline
    (scoring -> alert -> audit -> graph sync) so the UI updates in
    real time. The generated rows are clearly marked as demo data.
    """
    accounts = db.query(Account).filter(Account.is_active.is_(True)).all()
    devices = db.query(Device).all()
    merchants = db.query(Merchant).all()

    if len(accounts) < 2:
        raise HTTPException(
            status_code=400,
            detail="Not enough accounts in database. Run the seed first.",
        )

    high_risk_countries = ["NG", "RU", "PH", "VN", "US", "MY", "SG", "ID"]

    created = []
    alert_count = 0
    high_risk_count = 0

    for _ in range(count):
        sender = random.choice(accounts)
        receiver = random.choice([acc for acc in accounts if acc.id != sender.id])
        device = random.choice(devices)
        merchant = random.choice(merchants)

        if scenario == "cross_border_high":
            source_country = "ID"
            destination_country = random.choice(["NG", "RU", "US", "PH", "MY", "SG"])
            amount = random.choice([
                random.randint(10_000_000, 90_000_000),
                random.randint(90_000_000, 220_000_000),
            ])
        elif scenario == "large_amount":
            source_country = random.choice(["ID", "SG", "MY"])
            destination_country = random.choice(["ID", "SG", "MY", "US"])
            amount = random.randint(60_000_000, 250_000_000)
        elif scenario == "blacklisted_device":
            blacklisted = [d for d in devices if d.is_blacklisted]
            if blacklisted:
                device = random.choice(blacklisted)
            source_country = "ID"
            destination_country = random.choice(["NG", "RU", "PH", "US"])
            amount = random.choice([
                random.randint(5_000_000, 50_000_000),
                random.randint(50_000_000, 200_000_000),
            ])
        else:  # random
            source_country = random.choice(high_risk_countries)
            destination_country = random.choice(high_risk_countries)
            amount = random.choice([
                random.randint(50_000, 900_000),
                random.randint(1_000_000, 9_000_000),
                random.randint(10_000_000, 90_000_000),
                random.randint(90_000_000, 220_000_000),
            ])

        try:
            result = create_scored_transaction(
                db,
                sender_account_id=str(sender.id),
                receiver_account_id=str(receiver.id),
                device_id=str(device.id) if device else None,
                merchant_id=str(merchant.id) if merchant else None,
                amount=float(amount),
                currency="IDR",
                channel=random.choice(
                    ["mobile_banking", "internet_banking", "payment_gateway", "atm", "e_wallet"]
                ),
                source_country=source_country,
                destination_country=destination_country,
                ip_address=device.ip_address if device else None,
                actor="system",
                source="demo_generator",
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        created.append(result)
        if result["alert_created"]:
            alert_count += 1
        if result["transaction"]["risk_level"] == "high":
            high_risk_count += 1

    audit_log = AuditLog(
        actor="system",
        action="demo_transactions_generated",
        entity_type="system",
        entity_id=None,
        description=(
            f"Demo generator created {len(created)} transaction(s) "
            f"(scenario={scenario}) -> {alert_count} alert(s), "
            f"{high_risk_count} high-risk."
        ),
    )
    db.add(audit_log)
    db.commit()

    publish(
        "audit.created",
        {
            "action": "demo_transactions_generated",
            "entity_type": "system",
            "entity_id": None,
            "count": len(created),
        },
    )

    return {
        "message": "Demo transactions generated through the real scoring pipeline",
        "scenario": scenario,
        "count": len(created),
        "alerts_created": alert_count,
        "high_risk_count": high_risk_count,
        "is_demo_data": True,
        "items": [
            {
                "transaction": item["transaction"],
                "alert": item["alert"],
                "alert_created": item["alert_created"],
            }
            for item in created
        ],
    }


@router.get("/{transaction_id}")
def get_transaction_detail(
    transaction_id: UUID,
    db: Session = Depends(get_db),
):
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return serialize_transaction(transaction)
