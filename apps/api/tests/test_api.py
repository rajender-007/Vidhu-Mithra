import json

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.main import app, store


client = TestClient(app)


@pytest.fixture(autouse=True)
def disable_external_llm(monkeypatch):
    monkeypatch.setattr(main.settings, "gemini_api_key", "")
    monkeypatch.setattr(main.settings, "openai_api_key", "")


def clear_demo_store():
    store.matters.clear()
    store.messages.clear()
    store.documents.clear()
    store.clauses.clear()
    store.comments.clear()
    store.events.clear()
    store.action_plans.clear()


def setup_function():
    clear_demo_store()


def teardown_function():
    clear_demo_store()


def create_matter():
    response = client.post("/api/v1/matters", json={"description": "My landlord has not returned my security deposit in Hyderabad", "language": "en"})
    assert response.status_code == 200
    return response.json()


def test_health_exposes_safe_runtime_status():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["verification_policy"].startswith("citation-required")
    assert "service_role_key" not in response.text


def test_matter_message_plan_timeline_and_brief_flow():
    created = create_matter()
    matter_id = created["matter"]["id"]
    assert created["response"]["citations"] == []

    message = client.post(f"/api/v1/matters/{matter_id}/messages", json={"content": "What documents should I preserve?", "language": "en"})
    assert message.status_code == 200
    assert message.json()["disclaimer"].startswith("This is general legal information")

    event = client.post(f"/api/v1/matters/{matter_id}/timeline", json={"event_date": "2026-01-15", "title": "Payment made", "description": "Bank transfer receipt saved"})
    assert event.status_code == 200
    assert event.json()["verification_status"] == "unverified"

    plan = client.post(f"/api/v1/matters/{matter_id}/action-plan")
    assert plan.status_code == 200
    assert plan.json()["next_best_action"]

    brief = client.post(f"/api/v1/matters/{matter_id}/lawyer-brief")
    assert brief.status_code == 200
    assert brief.json()["timeline"]
    assert "qualified legal professional" in brief.json()["disclaimer"]


def test_streaming_message_returns_progress_and_response_events():
    matter_id = create_matter()["matter"]["id"]
    response = client.post(f"/api/v1/matters/{matter_id}/messages/stream", json={"content": "What should I verify next?", "language": "en"})
    assert response.status_code == 200
    assert "event: progress" in response.text
    assert "event: response" in response.text
    assert "event: done" in response.text


def test_configured_provider_response_is_used_on_reachable_routes(monkeypatch):
    calls = []

    async def fake_complete(system, user, json_mode=False):
        calls.append({"system": system, "user": user, "json_mode": json_mode})
        return json.dumps({"case_summary": "Provider-refined summary", "important_facts": ["The user supplied a matter description."]})

    monkeypatch.setattr(main.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(main.llm, "complete", fake_complete)

    created = create_matter()
    assert created["response"]["case_summary"] == "Provider-refined summary"

    matter_id = created["matter"]["id"]
    message = client.post(f"/api/v1/matters/{matter_id}/messages", json={"content": "What should I preserve?", "language": "en"})
    assert message.status_code == 200
    assert message.json()["case_summary"] == "Provider-refined summary"
    assert len(calls) == 2
    assert all(call["json_mode"] for call in calls)
    assert "untrusted data" in calls[0]["system"]
