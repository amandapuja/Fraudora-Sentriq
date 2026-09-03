"""In-process real-time event broker (SSE push).

A lightweight, thread-safe pub/sub used to push domain events
("transaction.created", "alert.created", "alert.updated",
"audit.created", ...) to connected SSE clients.

Design notes (hackathon prototype):
- In-memory only: events are delivered to clients connected to this
  single uvicorn process. It is NOT multi-worker safe and does not
  persist events. That is intentional and documented for the demo.
- FastAPI sync endpoints run in a threadpool, so ``publish`` is a
  plain thread-safe method that hands messages to the main event
  loop via ``call_soon_threadsafe``.
"""

from __future__ import annotations

import asyncio
import json
import threading
from typing import Any


class EventBroker:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[str | None]] = set()
        self._lock = threading.Lock()
        self._main_loop: asyncio.AbstractEventLoop | None = None

    async def subscribe(self) -> asyncio.Queue[str | None]:
        """Register a new SSE subscriber queue and return it."""
        queue: asyncio.Queue[str | None] = asyncio.Queue()
        with self._lock:
            self._subscribers.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue[str | None]) -> None:
        """Remove a subscriber queue (called when the stream disconnects)."""
        with self._lock:
            self._subscribers.discard(queue)

    def attach_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Called once at app startup with the running event loop."""
        self._main_loop = loop

    def shutdown(self) -> None:
        """Drain subscribers at shutdown so pending awaits get released."""
        with self._lock:
            queues = list(self._subscribers)
            self._subscribers.clear()
        for queue in queues:
            queue.put_nowait(None)  # type: ignore[arg-type]  # sentinel

    def publish(self, event_type: str, payload: dict[str, Any]) -> None:
        message = json.dumps(
            {"type": event_type, "data": payload},
            default=str,
            ensure_ascii=False,
        )
        with self._lock:
            queues = list(self._subscribers)
        if self._main_loop is not None and queues:
            for queue in queues:
                self._main_loop.call_soon_threadsafe(queue.put_nowait, message)

    def subscriber_count(self) -> int:
        with self._lock:
            return len(self._subscribers)


broker = EventBroker()


def publish(event_type: str, payload: dict[str, Any]) -> None:
    """Thread-safe fire-and-forget publish (works from sync + async code)."""
    broker.publish(event_type, payload)
