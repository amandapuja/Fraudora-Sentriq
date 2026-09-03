"""Shared JSON serializers for API responses and realtime events."""

from __future__ import annotations

from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.transaction import Transaction


def serialize_transaction(transaction: Transaction) -> dict:
    return {
        "id": str(transaction.id),
        "transaction_reference": transaction.transaction_reference,
        "sender_account_id": str(transaction.sender_account_id),
        "receiver_account_id": str(transaction.receiver_account_id),
        "device_id": str(transaction.device_id) if transaction.device_id else None,
        "merchant_id": str(transaction.merchant_id) if transaction.merchant_id else None,
        "amount": transaction.amount,
        "currency": transaction.currency,
        "channel": transaction.channel,
        "source_country": transaction.source_country,
        "destination_country": transaction.destination_country,
        "ip_address": transaction.ip_address,
        "status": transaction.status,
        "fraud_score": transaction.fraud_score,
        "risk_level": transaction.risk_level,
        "transaction_time": transaction.transaction_time,
        "created_at": transaction.created_at,
        "sender_account": {
            "id": str(transaction.sender_account.id),
            "account_number": transaction.sender_account.account_number,
            "holder_name": transaction.sender_account.holder_name,
            "risk_level": transaction.sender_account.risk_level,
        }
        if transaction.sender_account
        else None,
        "receiver_account": {
            "id": str(transaction.receiver_account.id),
            "account_number": transaction.receiver_account.account_number,
            "holder_name": transaction.receiver_account.holder_name,
            "risk_level": transaction.receiver_account.risk_level,
        }
        if transaction.receiver_account
        else None,
        "device": {
            "id": str(transaction.device.id),
            "device_fingerprint": transaction.device.device_fingerprint,
            "device_type": transaction.device.device_type,
            "os": transaction.device.os,
            "browser": transaction.device.browser,
            "ip_address": transaction.device.ip_address,
            "risk_level": transaction.device.risk_level,
            "is_blacklisted": transaction.device.is_blacklisted,
        }
        if transaction.device
        else None,
        "merchant": {
            "id": str(transaction.merchant.id),
            "name": transaction.merchant.name,
            "category": transaction.merchant.category,
            "country_code": transaction.merchant.country_code,
            "risk_level": transaction.merchant.risk_level,
            "is_blacklisted": transaction.merchant.is_blacklisted,
        }
        if transaction.merchant
        else None,
    }


def serialize_alert(alert: Alert) -> dict:
    return {
        "id": str(alert.id),
        "transaction_id": str(alert.transaction_id),
        "alert_type": alert.alert_type,
        "severity": alert.severity,
        "risk_score": alert.risk_score,
        "reason": alert.reason,
        "status": alert.status,
        "assigned_to": alert.assigned_to,
        "created_at": alert.created_at,
        "resolved_at": alert.resolved_at,
        "transaction": {
            "id": str(alert.transaction.id),
            "transaction_reference": alert.transaction.transaction_reference,
            "amount": alert.transaction.amount,
            "currency": alert.transaction.currency,
            "source_country": alert.transaction.source_country,
            "destination_country": alert.transaction.destination_country,
            "status": alert.transaction.status,
            "fraud_score": alert.transaction.fraud_score,
            "risk_level": alert.transaction.risk_level,
        }
        if alert.transaction
        else None,
    }


def serialize_audit_log(log: AuditLog) -> dict:
    return {
        "id": str(log.id),
        "actor": log.actor,
        "action": log.action,
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "description": log.description,
        "created_at": log.created_at,
    }
