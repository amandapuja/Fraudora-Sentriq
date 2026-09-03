import random
import uuid
from datetime import datetime, timedelta

from app.db.session import SessionLocal
from app.models.account import Account
from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.country import Country
from app.models.device import Device
from app.models.label import Label
from app.models.merchant import Merchant
from app.models.transaction import Transaction
from app.models.user import User
from app.core.security import hash_password

def risk_level_from_score(score: float) -> str:
    if score >= 0.75:
        return "high"
    if score >= 0.45:
        return "medium"
    return "low"


def transaction_status_from_score(score: float) -> str:
    if score >= 0.85:
        return "blocked"
    if score >= 0.60:
        return "flagged"
    return "approved"


def alert_severity_from_score(score: float) -> str:
    if score >= 0.85:
        return "critical"
    if score >= 0.70:
        return "high"
    if score >= 0.50:
        return "medium"
    return "low"


def clear_existing_data(db):
    db.query(Label).delete()
    db.query(Alert).delete()
    db.query(Transaction).delete()
    db.query(AuditLog).delete()
    db.query(Device).delete()
    db.query(Merchant).delete()
    db.query(Account).delete()
    db.query(Country).delete()
    db.query(User).delete()
    db.commit()


def seed_users(db):
    """Buat/refresh akun demo secara idempotent.

    Ini sengaja dijalankan setiap AUTO_SEED agar hasil clone selalu punya akun
    yang dapat dipakai login, walaupun database/volume sudah berisi data lain.
    """
    demo_users = [
        {
            "full_name": "Valen Yanto",
            "email": "valen@trustlens.dev",
            "password": "password123",
            "role": "ADMIN",
            "institution_name": "TrustLens Lab",
        },
        {
            "full_name": "Fraud Analyst",
            "email": "analyst@trustlens.dev",
            "password": "password123",
            "role": "ANALYST",
            "institution_name": "Bank Nusantara",
        },
        {
            "full_name": "Institution Operator",
            "email": "operator@trustlens.dev",
            "password": "password123",
            "role": "INSTITUTION",
            "institution_name": "FinPay Indonesia",
        },
    ]

    users = []
    for item in demo_users:
        user = db.query(User).filter(User.email == item["email"]).first()
        if user is None:
            user = User(email=item["email"])
            db.add(user)

        user.full_name = item["full_name"]
        user.hashed_password = hash_password(item["password"])
        user.role = item["role"]
        user.institution_name = item["institution_name"]
        users.append(user)

    db.commit()
    for user in users:
        db.refresh(user)
    return users


def seed_countries(db):
    countries = [
        Country(code="ID", name="Indonesia", region="Southeast Asia", risk_level="low", risk_score=0.18),
        Country(code="SG", name="Singapore", region="Southeast Asia", risk_level="low", risk_score=0.22),
        Country(code="MY", name="Malaysia", region="Southeast Asia", risk_level="medium", risk_score=0.41),
        Country(code="PH", name="Philippines", region="Southeast Asia", risk_level="medium", risk_score=0.46),
        Country(code="VN", name="Vietnam", region="Southeast Asia", risk_level="medium", risk_score=0.50),
        Country(code="RU", name="Russia", region="Eastern Europe", risk_level="high", risk_score=0.82),
        Country(code="NG", name="Nigeria", region="West Africa", risk_level="high", risk_score=0.78),
        Country(code="US", name="United States", region="North America", risk_level="medium", risk_score=0.38),
    ]

    db.add_all(countries)
    db.commit()
    return countries


def seed_accounts(db):
    names = [
        "Amanda Puja",
        "Jafar Shodiq",
        "Anas Nasuha",
        "Valentino Yanto",
        "Budi Santoso",
        "Siti Rahma",
        "Dewi Lestari",
        "Andi Pratama",
        "Rizky Maulana",
        "Maya Putri",
        "Raka Wijaya",
        "Nadia Kirana",
    ]

    accounts = []
    for idx, name in enumerate(names, start=1):
        risk_level = random.choice(["low", "low", "low", "medium", "high"])
        accounts.append(
            Account(
                account_number=f"TL-{idx:06d}",
                holder_name=name,
                email=f"{name.lower().replace(' ', '.')}@example.com",
                phone_number=f"+62812{random.randint(10000000, 99999999)}",
                account_type=random.choice(["personal", "business"]),
                risk_level=risk_level,
                balance=random.randint(500_000, 250_000_000),
                is_active=True,
            )
        )

    db.add_all(accounts)
    db.commit()
    return accounts


def seed_devices(db):
    devices = [
        Device(
            device_fingerprint="dev-id-iphone-15-jakarta-001",
            device_type="mobile",
            os="iOS",
            browser="Safari",
            ip_address="103.22.248.12",
            risk_level="low",
            is_blacklisted=False,
        ),
        Device(
            device_fingerprint="dev-id-android-bandung-002",
            device_type="mobile",
            os="Android",
            browser="Chrome",
            ip_address="114.10.55.71",
            risk_level="low",
            is_blacklisted=False,
        ),
        Device(
            device_fingerprint="dev-id-windows-shared-003",
            device_type="desktop",
            os="Windows",
            browser="Chrome",
            ip_address="36.77.91.10",
            risk_level="medium",
            is_blacklisted=False,
        ),
        Device(
            device_fingerprint="dev-id-linux-vpn-004",
            device_type="desktop",
            os="Linux",
            browser="Firefox",
            ip_address="185.220.101.44",
            risk_level="high",
            is_blacklisted=True,
        ),
        Device(
            device_fingerprint="dev-id-unknown-proxy-005",
            device_type="unknown",
            os="Unknown",
            browser="Unknown",
            ip_address="45.155.205.91",
            risk_level="high",
            is_blacklisted=True,
        ),
    ]

    db.add_all(devices)
    db.commit()
    return devices


def seed_merchants(db):
    merchants = [
        Merchant(name="Tokopedia Digital", category="e-commerce", country_code="ID", risk_level="low"),
        Merchant(name="ShopeePay Merchant", category="payment", country_code="SG", risk_level="low"),
        Merchant(name="Travel Global Hub", category="travel", country_code="MY", risk_level="medium"),
        Merchant(name="Crypto OTC Express", category="crypto", country_code="US", risk_level="high"),
        Merchant(name="Offshore Gaming Ltd", category="gaming", country_code="PH", risk_level="high"),
        Merchant(name="RemitNow Global", category="remittance", country_code="SG", risk_level="medium"),
    ]

    db.add_all(merchants)
    db.commit()
    return merchants


def calculate_demo_fraud_score(amount, source_country, destination_country, device, merchant):
    score = 0.10

    if amount > 50_000_000:
        score += 0.30
    elif amount > 10_000_000:
        score += 0.15

    if source_country != destination_country:
        score += 0.18

    if device.risk_level == "high" or device.is_blacklisted:
        score += 0.30
    elif device.risk_level == "medium":
        score += 0.12

    if merchant.risk_level == "high" or merchant.is_blacklisted:
        score += 0.25
    elif merchant.risk_level == "medium":
        score += 0.10

    score += random.uniform(-0.05, 0.08)

    return max(0.01, min(round(score, 2), 0.99))


def seed_transactions_alerts_labels(db, accounts, devices, merchants):
    transactions = []
    alerts = []
    labels = []

    country_pairs = [
        ("ID", "ID"),
        ("ID", "SG"),
        ("ID", "MY"),
        ("SG", "ID"),
        ("ID", "US"),
        ("ID", "NG"),
        ("ID", "RU"),
        ("MY", "ID"),
    ]

    for idx in range(1, 41):
        sender = random.choice(accounts)
        receiver = random.choice([acc for acc in accounts if acc.id != sender.id])
        device = random.choice(devices)
        merchant = random.choice(merchants)
        source_country, destination_country = random.choice(country_pairs)

        amount = random.choice([
            random.randint(50_000, 900_000),
            random.randint(1_000_000, 9_000_000),
            random.randint(10_000_000, 40_000_000),
            random.randint(50_000_000, 180_000_000),
        ])

        fraud_score = calculate_demo_fraud_score(
            amount=amount,
            source_country=source_country,
            destination_country=destination_country,
            device=device,
            merchant=merchant,
        )

        risk_level = risk_level_from_score(fraud_score)
        status = transaction_status_from_score(fraud_score)

        trx = Transaction(
            transaction_reference=f"TRX-{uuid.uuid4().hex[:12].upper()}",
            sender_account_id=sender.id,
            receiver_account_id=receiver.id,
            device_id=device.id,
            merchant_id=merchant.id,
            amount=float(amount),
            currency="IDR",
            channel=random.choice(["mobile_banking", "internet_banking", "payment_gateway", "atm", "e_wallet"]),
            source_country=source_country,
            destination_country=destination_country,
            ip_address=device.ip_address,
            status=status,
            fraud_score=fraud_score,
            risk_level=risk_level,
            transaction_time=datetime.utcnow() - timedelta(hours=random.randint(1, 168)),
        )
        transactions.append(trx)

    db.add_all(transactions)
    db.commit()

    for trx in transactions:
        if trx.fraud_score >= 0.50:
            reason_parts = []

            if trx.amount > 50_000_000:
                reason_parts.append("Large transaction amount detected")
            if trx.source_country != trx.destination_country:
                reason_parts.append("Cross-border transaction pattern")
            if trx.risk_level == "high":
                reason_parts.append("High-risk fraud score generated by demo model")

            reason = "; ".join(reason_parts) or "Suspicious transaction behavior"

            alert = Alert(
                transaction_id=trx.id,
                alert_type="fraud_risk",
                severity=alert_severity_from_score(trx.fraud_score),
                risk_score=trx.fraud_score,
                reason=reason,
                status=random.choice(["open", "open", "investigating", "resolved"]),
                assigned_to=random.choice(["Valen Yanto", "Fraud Analyst", None]),
            )
            alerts.append(alert)

            label = Label(
                transaction_id=trx.id,
                label="fraud" if trx.fraud_score >= 0.75 else random.choice(["fraud", "legitimate", "suspicious"]),
                labelled_by=random.choice(["Valen Yanto", "Fraud Analyst"]),
                notes="Demo label generated for prototype validation.",
            )
            labels.append(label)

    db.add_all(alerts)
    db.add_all(labels)
    db.commit()

    return transactions, alerts, labels


def seed_audit_logs(db):
    logs = [
        AuditLog(
            actor="Valen Yanto",
            action="seed_database",
            entity_type="system",
            entity_id=None,
            description="Initialized TrustLens demo dataset.",
        ),
        AuditLog(
            actor="Fraud Analyst",
            action="review_alert",
            entity_type="alert",
            entity_id=None,
            description="Reviewed high-risk transaction alert.",
        ),
        AuditLog(
            actor="Institution Operator",
            action="update_risk_configuration",
            entity_type="risk_config",
            entity_id=None,
            description="Updated demo threshold for fraud alerting.",
        ),
    ]

    db.add_all(logs)
    db.commit()
    return logs


def run_seed():
    db = SessionLocal()

    try:
        print("[+] Ensuring demo login users...")
        users = seed_users(db)

        dataset_counts = {
            "Countries": db.query(Country).count(),
            "Accounts": db.query(Account).count(),
            "Devices": db.query(Device).count(),
            "Merchants": db.query(Merchant).count(),
            "Transactions": db.query(Transaction).count(),
        }

        if any(dataset_counts.values()):
            print("[✓] Demo users ready; dataset seed skipped because data already exists.")
            print(f"    Users        : {db.query(User).count()}")
            for label, count in dataset_counts.items():
                print(f"    {label:<13}: {count}")
            return

        print("[+] Seeding countries...")
        countries = seed_countries(db)

        print("[+] Seeding accounts...")
        accounts = seed_accounts(db)

        print("[+] Seeding devices...")
        devices = seed_devices(db)

        print("[+] Seeding merchants...")
        merchants = seed_merchants(db)

        print("[+] Seeding transactions, alerts, and labels...")
        transactions, alerts, labels = seed_transactions_alerts_labels(
            db=db,
            accounts=accounts,
            devices=devices,
            merchants=merchants,
        )

        print("[+] Seeding audit logs...")
        audit_logs = seed_audit_logs(db)

        print("[✓] Seed completed.")
        print(f"    Users        : {len(users)}")
        print(f"    Countries    : {len(countries)}")
        print(f"    Accounts     : {len(accounts)}")
        print(f"    Devices      : {len(devices)}")
        print(f"    Merchants    : {len(merchants)}")
        print(f"    Transactions : {len(transactions)}")
        print(f"    Alerts       : {len(alerts)}")
        print(f"    Labels       : {len(labels)}")
        print(f"    Audit Logs   : {len(audit_logs)}")

    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
