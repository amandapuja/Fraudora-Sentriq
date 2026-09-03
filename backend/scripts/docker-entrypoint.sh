#!/usr/bin/env bash
set -e

echo "Menunggu PostgreSQL..."
python - <<'PY'
import os
import time

import psycopg2

deadline = time.time() + 120
last_error = None

while time.time() < deadline:
    try:
        conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "postgres"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            dbname=os.getenv("POSTGRES_DB", "trustlens"),
            user=os.getenv("POSTGRES_USER", "trustlens"),
            password=os.getenv("POSTGRES_PASSWORD", "trustlens_password"),
        )
        conn.close()
        print("PostgreSQL siap.")
        break
    except Exception as exc:
        last_error = exc
        time.sleep(2)
else:
    raise SystemExit(f"PostgreSQL tidak siap: {last_error}")
PY

echo "Menunggu Neo4j..."
python - <<'PY'
import os
import time

from neo4j import GraphDatabase

deadline = time.time() + 120
last_error = None
uri = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
auth = (
    os.getenv("NEO4J_USER", "neo4j"),
    os.getenv("NEO4J_PASSWORD", "trustlens_neo4j_password"),
)

while time.time() < deadline:
    try:
        driver = GraphDatabase.driver(uri, auth=auth)
        with driver.session() as session:
            session.run("RETURN 1").single()
        driver.close()
        print("Neo4j siap.")
        break
    except Exception as exc:
        last_error = exc
        time.sleep(3)
else:
    print(f"Neo4j belum siap, backend tetap dijalankan dengan mode graceful: {last_error}")
PY

if [ "${AUTO_MIGRATE:-true}" = "true" ]; then
    echo "Menjalankan migrasi Alembic..."
    alembic upgrade head
else
    echo "AUTO_MIGRATE=false, migrasi Alembic dilewati."
fi

if [ "${AUTO_SEED:-true}" = "true" ]; then
    echo "Menjalankan seed data demo..."
    python -m app.db.seeds.seed
else
    echo "AUTO_SEED=false, seed data demo dilewati."
fi

echo "Menjalankan backend..."
exec "$@"
