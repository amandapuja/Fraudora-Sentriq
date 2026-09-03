import time

from neo4j import GraphDatabase

from app.core.config import settings


class Neo4jConnection:
    def __init__(self):
        # Short timeouts so an unavailable Neo4j fails fast and the API can
        # fall back to the PostgreSQL-derived graph instead of stalling the
        # dashboard for ~30s (the driver's default connection timeout).
        self.driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
            connection_timeout=2.0,
            connection_acquisition_timeout=2.0,
            max_connection_lifetime=1800,
        )
        self._unavailable_until = 0.0  # circuit-breaker cooldown (seconds)

    def _raise_if_unavailable(self):
        if time.time() < self._unavailable_until:
            raise RuntimeError(
                "Neo4j is unavailable (recent connection failure; retry later)"
            )

    def close(self):
        if self.driver:
            self.driver.close()

    def execute_write(self, query: str, parameters: dict | None = None):
        self._raise_if_unavailable()
        try:
            with self.driver.session() as session:
                # session.run() (not execute_write) so a failed connection
                # raises immediately instead of being retried for ~30s.
                return list(session.run(query, parameters or {}))
        except Exception as exc:
            self._unavailable_until = time.time() + 60
            raise exc

    def execute_read(self, query: str, parameters: dict | None = None):
        self._raise_if_unavailable()
        try:
            with self.driver.session() as session:
                return list(session.run(query, parameters or {}))
        except Exception as exc:
            self._unavailable_until = time.time() + 60
            raise exc


neo4j_conn = Neo4jConnection()