from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.transaction import Transaction
from app.services.graph_sync import clear_graph, get_graph_data, sync_transaction_to_graph


router = APIRouter(prefix="/graph", tags=["Graph Explorer"])


def _build_graph_from_postgres(
    db: Session,
    limit: int = 50,
    risk_level: str | None = None,
) -> dict:
    """Postgres fallback graph when Neo4j is unavailable.

    Builds the same node/edge model (Account -> Transaction -> Account,
    plus Device / Merchant / Country where present) directly from the
    relational database.
    """
    query = (
        db.query(Transaction)
        .order_by(Transaction.transaction_time.desc())
    )
    if risk_level:
        query = query.filter(Transaction.risk_level == risk_level)
    transactions = query.limit(limit).all()

    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    def add_node(node_id: str, label: str, data: dict):
        if node_id not in nodes:
            nodes[node_id] = {"id": node_id, "label": label, **data}

    def add_edge(source: str, target: str, label: str):
        edges.append({
            "id": f"{source}-{label}-{target}",
            "source": source,
            "target": target,
            "label": label,
        })

    for transaction in transactions:
        sender = transaction.sender_account
        receiver = transaction.receiver_account
        device = transaction.device
        merchant = transaction.merchant

        if not sender or not receiver:
            continue

        sender_id = f"account-{sender.id}"
        trx_id = f"transaction-{transaction.id}"
        receiver_id = f"account-{receiver.id}"

        add_node(sender_id, "Account", {
            "title": sender.holder_name,
            "risk_level": sender.risk_level,
            "account_number": sender.account_number,
        })
        add_node(receiver_id, "Account", {
            "title": receiver.holder_name,
            "risk_level": receiver.risk_level,
            "account_number": receiver.account_number,
        })
        add_node(trx_id, "Transaction", {
            "title": transaction.transaction_reference,
            "amount": transaction.amount,
            "currency": transaction.currency,
            "fraud_score": transaction.fraud_score,
            "risk_level": transaction.risk_level,
            "status": transaction.status,
        })

        add_edge(sender_id, trx_id, "SENT")
        add_edge(trx_id, receiver_id, "RECEIVED_BY")

        if device:
            device_id = f"device-{device.id}"
            add_node(device_id, "Device", {
                "title": device.device_fingerprint,
                "risk_level": device.risk_level,
                "is_blacklisted": device.is_blacklisted,
                "ip_address": device.ip_address,
            })
            add_edge(trx_id, device_id, "USED_DEVICE")

        if merchant:
            merchant_id = f"merchant-{merchant.id}"
            add_node(merchant_id, "Merchant", {
                "title": merchant.name,
                "risk_level": merchant.risk_level,
                "category": merchant.category,
                "country_code": merchant.country_code,
            })
            add_edge(trx_id, merchant_id, "PAID_TO")

        source_country_id = f"country-{transaction.source_country}"
        add_node(source_country_id, "Country", {
            "title": transaction.source_country,
            "code": transaction.source_country,
        })
        add_edge(trx_id, source_country_id, "FROM_COUNTRY")

        destination_country_id = f"country-{transaction.destination_country}"
        add_node(destination_country_id, "Country", {
            "title": transaction.destination_country,
            "code": transaction.destination_country,
        })
        add_edge(trx_id, destination_country_id, "TO_COUNTRY")

    return {
        "nodes": list(nodes.values()),
        "edges": edges,
    }


@router.post("/sync")
def sync_graph_from_postgres(db: Session = Depends(get_db)):
    transactions = (
        db.query(Transaction)
        .order_by(Transaction.transaction_time.desc())
        .limit(200)
        .all()
    )

    try:
        clear_graph()

        for transaction in transactions:
            sync_transaction_to_graph(transaction)

    except Exception as exc:
        return {
            "message": "Graph sync failed (Neo4j may be unavailable)",
            "error": str(exc),
            "synced_transactions": 0,
        }

    return {
        "message": "Graph synced successfully",
        "synced_transactions": len(transactions),
    }


@router.get("")
def get_graph(
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
    risk_level: str | None = Query(default=None),
):
    # Primary path: Neo4j graph.
    try:
        data = get_graph_data(limit=limit, risk_level=risk_level)
        data["source"] = "neo4j"
        data["available"] = True
        return data
    except Exception as exc:
        # Fallback path: derive the same graph from Postgres so the
        # analyst workflow still works without a running Neo4j.
        data = _build_graph_from_postgres(db, limit=limit, risk_level=risk_level)
        data["source"] = "postgres_fallback"
        data["available"] = True
        data["notice"] = (
            "Neo4j is unavailable; showing a graph derived from PostgreSQL data."
        )
        data["neo4j_error"] = str(exc)
        return data
