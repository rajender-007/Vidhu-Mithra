from app.services.documents import build_comments, extract_entities, segment_clauses


def test_document_pipeline_extracts_entities_and_risk_comments():
    text = "Agreement signed 12 Jan 2026. Payment of Rs. 50,000 made on 15/01/2026. The tenant is liable for any and all damages."
    entities = extract_entities(text)
    clauses = segment_clauses(text)
    comments = build_comments(clauses)

    assert {item["type"] for item in entities} == {"amount", "date"}
    assert clauses
    assert any(clause["risk_level"] == "HIGH" for clause in clauses)
    assert any(comment["status"] == "active" for comment in comments)


def test_document_pipeline_does_not_create_clauses_from_empty_text():
    assert segment_clauses("") == []
    assert build_comments([]) == []
