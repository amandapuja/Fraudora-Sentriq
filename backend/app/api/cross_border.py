from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.country import Country
from app.models.transaction import Transaction


router = APIRouter(prefix="/cross-border", tags=["Cross-Border Intelligence"])


@router.get("/summary")
def get_cross_border_summary(db: Session = Depends(get_db)):
    total_transactions = db.query(Transaction).count()

    cross_border_transactions = (
        db.query(Transaction)
        .filter(Transaction.source_country != Transaction.destination_country)
        .count()
    )

    domestic_transactions = total_transactions - cross_border_transactions

    high_risk_cross_border = (
        db.query(Transaction)
        .filter(Transaction.source_country != Transaction.destination_country)
        .filter(Transaction.risk_level == "high")
        .count()
    )

    avg_cross_border_score = (
        db.query(func.avg(Transaction.fraud_score))
        .filter(Transaction.source_country != Transaction.destination_country)
        .scalar()
        or 0
    )

    cross_border_rate = 0
    if total_transactions > 0:
        cross_border_rate = cross_border_transactions / total_transactions

    return {
        "total_transactions": total_transactions,
        "domestic_transactions": domestic_transactions,
        "cross_border_transactions": cross_border_transactions,
        "cross_border_rate": round(cross_border_rate, 2),
        "high_risk_cross_border": high_risk_cross_border,
        "average_cross_border_fraud_score": round(float(avg_cross_border_score), 2),
    }


@router.get("/routes")
def get_cross_border_routes(
    db: Session = Depends(get_db),
    limit: int = Query(default=10, ge=1, le=50),
):
    rows = (
        db.query(
            Transaction.source_country.label("source_country"),
            Transaction.destination_country.label("destination_country"),
            func.count(Transaction.id).label("transaction_count"),
            func.avg(Transaction.fraud_score).label("average_fraud_score"),
            func.sum(
                case(
                    (Transaction.risk_level == "high", 1),
                    else_=0,
                )
            ).label("high_risk_count"),
            func.sum(Transaction.amount).label("total_amount"),
        )
        .filter(Transaction.source_country != Transaction.destination_country)
        .group_by(Transaction.source_country, Transaction.destination_country)
        .order_by(func.avg(Transaction.fraud_score).desc())
        .limit(limit)
        .all()
    )

    return {
        "total": len(rows),
        "items": [
            {
                "route": f"{row.source_country} → {row.destination_country}",
                "source_country": row.source_country,
                "destination_country": row.destination_country,
                "transaction_count": int(row.transaction_count),
                "average_fraud_score": round(float(row.average_fraud_score or 0), 2),
                "high_risk_count": int(row.high_risk_count or 0),
                "total_amount": float(row.total_amount or 0),
            }
            for row in rows
        ],
    }


@router.get("/countries")
def get_country_risk_map(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
):
    rows = (
        db.query(
            Country.code.label("country_code"),
            Country.name.label("country_name"),
            Country.region.label("region"),
            Country.risk_level.label("base_risk_level"),
            Country.risk_score.label("base_risk_score"),
            func.count(Transaction.id).label("transaction_count"),
            func.avg(Transaction.fraud_score).label("average_fraud_score"),
            func.sum(
                case(
                    (Transaction.risk_level == "high", 1),
                    else_=0,
                )
            ).label("high_risk_count"),
        )
        .outerjoin(
            Transaction,
            (Country.code == Transaction.source_country)
            | (Country.code == Transaction.destination_country),
        )
        .group_by(
            Country.code,
            Country.name,
            Country.region,
            Country.risk_level,
            Country.risk_score,
        )
        # coalesce keeps ordering consistent across PostgreSQL and SQLite
        # (SQLite has no NULLS LAST support).
        .order_by(func.coalesce(func.avg(Transaction.fraud_score), 0).desc())
        .limit(limit)
        .all()
    )

    return {
        "total": len(rows),
        "items": [
            {
                "country_code": row.country_code,
                "country_name": row.country_name,
                "region": row.region,
                "base_risk_level": row.base_risk_level,
                "base_risk_score": row.base_risk_score,
                "transaction_count": int(row.transaction_count or 0),
                "average_fraud_score": round(float(row.average_fraud_score or 0), 2),
                "high_risk_count": int(row.high_risk_count or 0),
            }
            for row in rows
        ],
    }


@router.get("/high-risk-transactions")
def get_high_risk_cross_border_transactions(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
):
    transactions = (
        db.query(Transaction)
        .filter(Transaction.source_country != Transaction.destination_country)
        .filter(Transaction.risk_level.in_(["medium", "high"]))
        .order_by(Transaction.fraud_score.desc())
        .limit(limit)
        .all()
    )

    return {
        "total": len(transactions),
        "items": [
            {
                "id": str(transaction.id),
                "transaction_reference": transaction.transaction_reference,
                "amount": transaction.amount,
                "currency": transaction.currency,
                "route": f"{transaction.source_country} → {transaction.destination_country}",
                "source_country": transaction.source_country,
                "destination_country": transaction.destination_country,
                "fraud_score": transaction.fraud_score,
                "risk_level": transaction.risk_level,
                "status": transaction.status,
                "transaction_time": transaction.transaction_time,
                "sender_account": {
                    "id": str(transaction.sender_account.id),
                    "holder_name": transaction.sender_account.holder_name,
                    "account_number": transaction.sender_account.account_number,
                    "risk_level": transaction.sender_account.risk_level,
                }
                if transaction.sender_account
                else None,
                "receiver_account": {
                    "id": str(transaction.receiver_account.id),
                    "holder_name": transaction.receiver_account.holder_name,
                    "account_number": transaction.receiver_account.account_number,
                    "risk_level": transaction.receiver_account.risk_level,
                }
                if transaction.receiver_account
                else None,
            }
            for transaction in transactions
        ],
    }


@router.get("/timeline")
def get_cross_border_timeline(db: Session = Depends(get_db)):
    rows = (
        db.query(
            func.date(Transaction.transaction_time).label("date"),
            func.count(Transaction.id).label("transaction_count"),
            func.avg(Transaction.fraud_score).label("average_fraud_score"),
            func.sum(
                case(
                    (Transaction.risk_level == "high", 1),
                    else_=0,
                )
            ).label("high_risk_count"),
        )
        .filter(Transaction.source_country != Transaction.destination_country)
        .group_by(func.date(Transaction.transaction_time))
        .order_by(func.date(Transaction.transaction_time).asc())
        .all()
    )

    return {
        "items": [
            {
                "date": str(row.date),
                "transaction_count": int(row.transaction_count),
                "average_fraud_score": round(float(row.average_fraud_score or 0), 2),
                "high_risk_count": int(row.high_risk_count or 0),
            }
            for row in rows
        ],
    }