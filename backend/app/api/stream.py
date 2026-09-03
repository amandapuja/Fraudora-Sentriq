"""Server-Sent Events (SSE) stream endpoint for real-time dashboard updates.

The frontend subscribes to GET /api/v1/stream/events and receives domain
events pushed by the backend whenever a transaction is created, an alert
is generated/updated, a label is applied, or an audit log is written.

Authentication: the stream requires a valid JWT (Bearer header, or
``token`` query parameter for environments where headers are awkward).
The frontend consumes the stream with fetch() so it can send the
Authorization header; a native EventSource is not required.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any, AsyncIterator

from fastapi import APIRouter, HTTPException, Query, Request
from starlette.responses import StreamingResponse

from app.core.security import decode_access_token
from app.services.events import broker

router = APIRouter(prefix="/stream", tags=["Realtime"])


def _authorize(request: Request, token: str | None) -> None:
    auth_header = request.headers.get("Authorization", "")
    raw_token = token

    if auth_header.lower().startswith("bearer "):
        raw_token = auth_header[7:].strip()

    if not raw_token:
        raise HTTPException(status_code=401, detail="Missing token")

    payload = decode_access_token(raw_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@router.get("/events")
async def stream_events(
    request: Request,
    token: str | None = Query(default=None),
):
    _authorize(request, token)

    queue: asyncio.Queue[str | None] = await broker.subscribe()

    async def event_generator() -> AsyncIterator[str]:
        try:
            hello = json.dumps(
                {
                    "type": "stream.connected",
                    "data": {
                        "ts": time.time(),
                        "subscribers": broker.subscriber_count(),
                        "message": "Connected to TrustLens realtime stream",
                    },
                },
                default=str,
            )
            yield f"event: stream.connected\ndata: {hello}\n\n"

            while True:
                if await request.is_disconnected():
                    break

                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    continue

                if message is None:  # shutdown sentinel
                    break

                yield f"data: {message}\n\n"

        except asyncio.CancelledError:
            pass
        finally:
            await broker.unsubscribe(queue)

    return StreamingResponseWithHeaders(event_generator())


class StreamingResponseWithHeaders(StreamingResponse):
    """SSE response with headers that keep proxies/browsers happy."""

    def __init__(self, content: AsyncIterator[str]) -> None:
        super().__init__(
            content,
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
