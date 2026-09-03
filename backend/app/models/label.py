import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, ForeignKey
from sqlalchemy import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Label(Base):
    __tablename__ = "labels"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id"),
        nullable=False,
    )

    label: Mapped[str] = mapped_column(String(30), nullable=False)
    labelled_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    transaction = relationship("Transaction")
