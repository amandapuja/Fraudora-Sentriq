from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.ml.baseline_model import FraudBaselineModel, get_model_status
from app.ml.registry.model_registry import get_active_metrics, list_model_artifacts
from app.models.transaction import Transaction


router = APIRouter(prefix="/ml", tags=["Machine Learning"])


@router.get("/status")
def ml_status(db: Session = Depends(get_db)):
    active_metrics = get_active_metrics()
    baseline = get_model_status()

    from app.ml.continual.adaptive_trainer import get_adaptive_learning_status

    adaptive = get_adaptive_learning_status(db)

    total = db.query(Transaction).count()

    risk_distribution = {
        "low": db.query(Transaction).filter(Transaction.risk_level == "low").count(),
        "medium": db.query(Transaction).filter(Transaction.risk_level == "medium").count(),
        "high": db.query(Transaction).filter(Transaction.risk_level == "high").count(),
    }

    status_distribution = {
        "approved": db.query(Transaction).filter(Transaction.status == "approved").count(),
        "flagged": db.query(Transaction).filter(Transaction.status == "flagged").count(),
        "blocked": db.query(Transaction).filter(Transaction.status == "blocked").count(),
        "pending": db.query(Transaction).filter(Transaction.status == "pending").count(),
    }

    latest_transactions = (
        db.query(Transaction)
        .order_by(Transaction.transaction_time.desc())
        .limit(10)
        .all()
    )

    latest_scoring_events = [
        {
            "transaction_id": str(tx.id),
            "transaction_reference": tx.transaction_reference,
            "fraud_score": tx.fraud_score,
            "risk_level": tx.risk_level,
            "status": tx.status,
            "amount": tx.amount,
            "currency": tx.currency,
            "source_country": tx.source_country,
            "destination_country": tx.destination_country,
            "transaction_time": tx.transaction_time,
        }
        for tx in latest_transactions
    ]

    models_available = bool(active_metrics) or baseline.get("model_available", False)

    return {
        "scoring_engine": {
            "name": "Risk-Aware Rule Ensemble",
            "mode": "rule_based_ensemble",
            "description": (
                "Rule-based fraud scoring (always active) combined with "
                "optional ML model contributions when trained artifacts exist. "
                "Final score uses a risk-aware max guard."
            ),
            "ml_models_loaded": models_available,
        },
        "baseline_model": baseline,
        "active_tabular_model": active_metrics,
        "adaptive_learning": adaptive,
        "processed_transactions": total,
        "risk_distribution": risk_distribution,
        "status_distribution": status_distribution,
        "latest_scoring_events": latest_scoring_events,
        "model_artifacts_count": len(list_model_artifacts()),
        "last_updated": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/metrics")
def get_ml_metrics():
    active_metrics = get_active_metrics()

    if not active_metrics:
        return {
            "model_available": False,
            "message": "No trained tabular model available yet.",
        }

    return {
        "model_available": True,
        "active_model": active_metrics,
    }


@router.get("/models")
def get_ml_models():
    return {
        "items": list_model_artifacts(),
    }


@router.post("/train-baseline")
def train_baseline_model(db: Session = Depends(get_db)):
    transactions = (
        db.query(Transaction)
        .order_by(Transaction.transaction_time.desc())
        .limit(1000)
        .all()
    )

    try:
        model = FraudBaselineModel()
        result = model.train(transactions)
        return result

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/train/paysim")
def train_paysim_model(
    model: str = Query(default="xgboost", pattern="^(xgboost|logistic)$"),
    limit_rows: int | None = Query(default=None, ge=10000),
):
    from app.ml.training.train_paysim import train_paysim_logistic, train_paysim_xgboost

    try:
        if model == "logistic":
            result = train_paysim_logistic(limit_rows=limit_rows)
        else:
            result = train_paysim_xgboost(limit_rows=limit_rows)

        return {
            "message": "PaySim model trained successfully",
            "result": result,
        }

    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/adaptive/status")
def adaptive_learning_status(db: Session = Depends(get_db)):
    from app.ml.continual.adaptive_trainer import get_adaptive_learning_status

    return get_adaptive_learning_status(db)


@router.post("/adaptive/retrain")
def adaptive_retrain(
    force: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    from app.ml.continual.adaptive_trainer import run_adaptive_retraining

    try:
        return run_adaptive_retraining(db=db, force=force)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/train/trustlens")
def train_trustlens_model(
    min_samples: int = Query(default=10, ge=2),
    db: Session = Depends(get_db),
):
    from app.ml.training.train_trustlens import train_trustlens_adaptive_model

    try:
        result = train_trustlens_adaptive_model(
            db=db,
            min_samples=min_samples,
        )

        return {
            "message": "TrustLens internal adaptive model trained successfully",
            "result": result,
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/train/elliptic-graphsage")
def train_elliptic_graphsage_model(
    limit_nodes: int | None = Query(default=20000, ge=1000),
    epochs: int = Query(default=5, ge=1, le=100),
):
    # Imported lazily: torch is only required when this heavy training
    # job is explicitly triggered, keeping the backend startable without
    # a GPU / platform-specific torch build.
    from app.ml.training.train_elliptic_graphsage import train_elliptic_graphsage

    try:
        result = train_elliptic_graphsage(
            limit_nodes=limit_nodes,
            epochs=epochs,
        )

        return {
            "message": "Elliptic GraphSAGE model trained successfully",
            "result": result,
        }

    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
