from __future__ import annotations

import asyncio
import json
import secrets
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import PROJECT_ROOT, get_settings
from .schemas import ActionPlan, ExplainRequest, MatterCreate, MessageRequest, TimelineEvent
from .services.documents import build_comments, extract_entities, extract_text, segment_clauses
from .services.legal import build_response, explain
from .services.llm import LLMRouter
from .store import MemoryStore


settings = get_settings()
store = MemoryStore(PROJECT_ROOT / "data" / "uploads")
llm = LLMRouter(settings)
SOURCE_REGISTRY_PATH = PROJECT_ROOT / "corpus" / "sources.json"

app = FastAPI(title=settings.app_name, version="0.1.0", description="India-focused legal information and document navigation API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _matter_or_404(matter_id: UUID):
    try:
        return store.get_matter(matter_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Matter not found") from exc


def _document_or_404(document_id: UUID):
    document = store.documents.get(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.app_env,
        "storage": "memory-demo",
        "supabase_configured": bool(settings.effective_supabase_url and settings.supabase_service_role_key),
        "llm_configured": bool(settings.gemini_api_key or settings.openai_api_key),
        "voice_configured": bool(settings.sarvam_api_key),
        "verification_policy": "citation-required; unverified claims are refused",
    }


@app.get("/api/v1/config")
async def public_config() -> dict[str, Any]:
    return {"app_name": settings.app_name, "languages": ["en", "hi", "te"], "features": {"voice": settings.enable_voice_input, "document_upload": True, "verified_citations": True}}


@app.get("/api/v1/research/search")
async def search_sources(query: str = Query(min_length=1), jurisdiction: str | None = None):
    registry = json.loads(SOURCE_REGISTRY_PATH.read_text(encoding="utf-8")) if SOURCE_REGISTRY_PATH.exists() else []
    results = [source for source in registry if not jurisdiction or jurisdiction.lower() in source.get("jurisdiction", "").lower()]
    return {"query": query, "results": results, "verification": "registry_only", "message": "These are registered sources, not verified passages. No legal claim should be generated from this response alone."}


@app.get("/api/v1/laws/{instrument}/versions")
async def law_versions(instrument: str):
    versions = {
        "IPC": {"title": "Indian Penal Code", "current_reference": "BNS", "status": "requires_source_verification", "effective_from": "2024-07-01"},
        "CRPC": {"title": "Code of Criminal Procedure", "current_reference": "BNSS", "status": "requires_source_verification", "effective_from": "2024-07-01"},
        "IEA": {"title": "Indian Evidence Act", "current_reference": "BSA", "status": "requires_source_verification", "effective_from": "2024-07-01"},
    }
    return {"instrument": instrument.upper(), "timeline": versions.get(instrument.upper(), {"status": "not_loaded", "message": "No verified instrument timeline has been loaded."})}


@app.get("/api/v1/matters", response_model=list)
async def list_matters():
    return store.list_matters()


@app.post("/api/v1/matters", response_model=dict)
async def create_matter(payload: MatterCreate):
    title = payload.title or (payload.description.strip().split(".")[0][:80] or "New legal matter")
    matter = store.create_matter(title, payload.description, payload.language, payload.state, payload.city)
    response = build_response(payload.description, payload.state, payload.city, payload.language)
    response_data = response.model_dump(mode="json")
    store.add_message(matter.id, "user", payload.description)
    store.add_message(matter.id, "ai", response.case_summary, response_data)
    matter.journey_progress.update({"domain": "complete", "jurisdiction": "complete" if response.jurisdiction.status != "unknown" else "in_progress", "facts": "in_progress"})
    matter.risk_level = response.risk_level
    matter.stage = "domain_classified"
    return {"matter": matter, "response": response}


@app.get("/api/v1/matters/{matter_id}")
async def get_matter(matter_id: UUID):
    matter = _matter_or_404(matter_id)
    return {"matter": matter, "messages": store.messages.get(matter_id, []), "events": store.events.get(matter_id, []), "action_plan": store.action_plans.get(matter_id)}


@app.get("/api/v1/matters/{matter_id}/messages")
async def get_messages(matter_id: UUID):
    _matter_or_404(matter_id)
    return store.messages.get(matter_id, [])


@app.post("/api/v1/matters/{matter_id}/messages")
async def send_message(matter_id: UUID, payload: MessageRequest):
    matter = _matter_or_404(matter_id)
    store.add_message(matter_id, "user", payload.content)
    response = build_response(payload.content, matter.state, matter.city, payload.language)
    store.add_message(matter_id, "ai", response.case_summary, response.model_dump(mode="json"))
    matter.updated_at = datetime.now(UTC)
    matter.risk_level = response.risk_level
    return response


@app.post("/api/v1/matters/{matter_id}/messages/stream")
async def stream_message(matter_id: UUID, payload: MessageRequest):
    matter = _matter_or_404(matter_id)
    store.add_message(matter_id, "user", payload.content)
    response = build_response(payload.content, matter.state, matter.city, payload.language)
    store.add_message(matter_id, "ai", response.case_summary, response.model_dump(mode="json"))
    matter.updated_at = datetime.now(UTC)

    async def events():
        for status in ("classifying", "checking jurisdiction", "checking verified sources", "preparing structured response"):
            yield f"event: progress\ndata: {json.dumps({'status': status})}\n\n"
            await asyncio.sleep(0.03)
        yield f"event: response\ndata: {response.model_dump_json()}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


async def _process_document(document_id: UUID):
    document = store.documents[document_id]
    try:
        document["status"] = "analysing"
        text, page_count, flags = extract_text(document["path"], document["mime"])
        document["page_count"] = page_count
        document["text"] = text
        document["quality_flags"] = flags
        clauses = segment_clauses(text)
        comments = build_comments(clauses)
        document["entities"] = extract_entities(text)
        document["status"] = "ready"
        document["summary"] = (text.strip().replace("\n", " ")[:420] or "No text was extracted.")
        store.clauses[document_id] = clauses
        store.comments[document_id] = comments
        matter_id = document["matter_id"]
        # A small evidence timeline is derived only from dates found in the uploaded text.
        for entity in document["entities"]:
            if entity["type"] != "date":
                continue
            parsed = _parse_date(entity["value"])
            if parsed:
                store.events[matter_id].append(TimelineEvent(id=uuid4(), event_date=parsed, title="Date found in uploaded document", description=entity["value"], source=document["filename"], verification_status="partial", confidence=entity["confidence"]))
    except Exception as exc:  # keep the async status visible to the UI
        document["status"] = "failed"
        document["quality_flags"] = [f"Processing failed: {type(exc).__name__}"]


def _parse_date(value: str) -> date | None:
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


@app.post("/api/v1/matters/{matter_id}/documents")
async def upload_document(matter_id: UUID, background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    _matter_or_404(matter_id)
    data = await file.read()
    if len(data) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_size_mb} MB limit")
    if not file.filename:
        raise HTTPException(status_code=400, detail="A filename is required")
    document = store.save_upload(matter_id, file.filename, data, file.content_type or "application/octet-stream")
    background_tasks.add_task(_process_document, document["id"])
    return {"id": str(document["id"]), "filename": document["filename"], "status": document["status"], "sha256": document["sha256"]}


@app.get("/api/v1/documents/{document_id}/status")
async def document_status(document_id: UUID):
    document = _document_or_404(document_id)
    return {key: value for key, value in document.items() if key not in {"path", "text"}}


@app.get("/api/v1/documents/{document_id}/clauses")
async def document_clauses(document_id: UUID):
    _document_or_404(document_id)
    return store.clauses.get(document_id, [])


@app.get("/api/v1/documents/{document_id}/comments")
async def document_comments(document_id: UUID):
    _document_or_404(document_id)
    return store.comments.get(document_id, [])


@app.post("/api/v1/explain")
async def explain_text(payload: ExplainRequest):
    return explain(payload.text, payload.level, payload.language)


@app.get("/api/v1/matters/{matter_id}/timeline")
async def get_timeline(matter_id: UUID):
    _matter_or_404(matter_id)
    return sorted(store.events.get(matter_id, []), key=lambda event: event.event_date)


@app.post("/api/v1/matters/{matter_id}/timeline")
async def add_timeline_event(matter_id: UUID, event: TimelineEvent):
    _matter_or_404(matter_id)
    store.events.setdefault(matter_id, []).append(event)
    return event


@app.get("/api/v1/matters/{matter_id}/action-plan")
async def get_action_plan(matter_id: UUID):
    _matter_or_404(matter_id)
    return store.action_plans.get(matter_id)


@app.post("/api/v1/matters/{matter_id}/action-plan")
async def generate_action_plan(matter_id: UUID):
    matter = _matter_or_404(matter_id)
    response = build_response(matter.description, matter.state, matter.city, matter.language)
    plan = ActionPlan(version=1, current_situation=response.case_summary, known=response.important_facts, unknown=[item.question for item in response.missing_facts], options=response.possible_options, documents_required=response.documents_needed, evidence_to_preserve=["Keep original documents and message exports", "Record dates and amounts with their source"], risks=response.risks, lawyer_questions=["What forum and current provisions should be checked?", "What facts or documents would change the assessment?"], next_best_action="Confirm the missing facts, preserve the originals and ask a qualified professional to verify the current law, forum, deadlines, and any formal step.")
    store.action_plans[matter_id] = plan
    matter.journey_progress["options"] = "complete"
    matter.journey_progress["next_steps"] = "complete"
    matter.journey_progress["lawyer_prep"] = "in_progress"
    matter.stage = "action_plan_ready"
    return plan


@app.post("/api/v1/matters/{matter_id}/lawyer-brief")
async def lawyer_brief(matter_id: UUID):
    matter = _matter_or_404(matter_id)
    plan = store.action_plans.get(matter_id)
    brief = {
        "title": f"Lawyer preparation brief - {matter.title}",
        "disclaimer": "AI-generated draft — review by a qualified legal professional before use.",
        "issue": matter.description,
        "jurisdiction": {"state": matter.state, "city": matter.city, "status": "to be verified"},
        "timeline": [event.model_dump(mode="json") for event in store.events.get(matter_id, [])],
        "action_plan": plan.model_dump(mode="json") if plan else None,
        "questions": plan.lawyer_questions if plan else ["What should be verified before taking a formal step?"],
    }
    return brief


@app.post("/api/v1/matters/{matter_id}/share")
async def create_share_link(matter_id: UUID, expires_in_hours: int = Query(72, ge=1, le=720)):
    _matter_or_404(matter_id)
    token = secrets.token_urlsafe(24)
    return {"token": token, "url": f"{settings.web_base_url}/share/{token}", "expires_at": (datetime.now(UTC) + timedelta(hours=expires_in_hours)).isoformat(), "read_only": True, "mock": True}
