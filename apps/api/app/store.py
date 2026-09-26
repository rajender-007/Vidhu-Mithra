from __future__ import annotations

import hashlib
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from .schemas import ActionPlan, Matter, TimelineEvent


JOURNEY_STEPS = [
    "problem", "domain", "jurisdiction", "facts", "documents", "timeline",
    "concepts", "risk", "missing", "options", "next_steps", "checklists", "lawyer_prep",
]


class MemoryStore:
    """In-memory fallback so the demo runs before Supabase migrations are applied."""

    def __init__(self, upload_root: Path):
        self.matters: dict[UUID, Matter] = {}
        self.messages: dict[UUID, list[dict[str, Any]]] = {}
        self.documents: dict[UUID, dict[str, Any]] = {}
        self.clauses: dict[UUID, list[dict[str, Any]]] = {}
        self.comments: dict[UUID, list[dict[str, Any]]] = {}
        self.events: dict[UUID, list[TimelineEvent]] = {}
        self.action_plans: dict[UUID, ActionPlan] = {}
        self.upload_root = upload_root
        self.upload_root.mkdir(parents=True, exist_ok=True)

    def create_matter(self, title: str, description: str, language: str, state: str | None, city: str | None) -> Matter:
        now = datetime.now(UTC)
        matter = Matter(
            id=uuid4(), title=title, description=description, language=language,
            state=state, city=city, journey_progress={step: "not_started" for step in JOURNEY_STEPS},
            created_at=now, updated_at=now,
        )
        matter.journey_progress["problem"] = "complete"
        self.matters[matter.id] = matter
        self.messages[matter.id] = []
        self.events[matter.id] = []
        return matter

    def list_matters(self) -> list[Matter]:
        return sorted(self.matters.values(), key=lambda item: item.updated_at, reverse=True)

    def get_matter(self, matter_id: UUID) -> Matter:
        if matter_id not in self.matters:
            raise KeyError("Matter not found")
        return self.matters[matter_id]

    def add_message(self, matter_id: UUID, sender: str, content: str, structured: dict[str, Any] | None = None) -> dict[str, Any]:
        message = {"id": str(uuid4()), "sender": sender, "content": content, "structured": structured or {}, "created_at": datetime.now(UTC).isoformat()}
        self.messages.setdefault(matter_id, []).append(message)
        return message

    def save_upload(self, matter_id: UUID, filename: str, data: bytes, mime: str) -> dict[str, Any]:
        document_id = uuid4()
        digest = hashlib.sha256(data).hexdigest()
        safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", filename)
        path = self.upload_root / f"{document_id}_{safe_name}"
        path.write_bytes(data)
        document = {"id": document_id, "matter_id": matter_id, "filename": filename, "path": path, "mime": mime, "sha256": digest, "status": "queued", "page_count": 0, "quality_flags": []}
        self.documents[document_id] = document
        return document
