from app.services.legal import build_response, classify


def test_rental_problem_gets_property_domain_and_questions():
    response = build_response("My landlord has not returned my deposit in Hyderabad", city="Hyderabad")
    assert response.legal_domains[0].code == "PROPERTY"
    assert response.jurisdiction.state == "Telangana"
    assert response.missing_facts
    assert response.disclaimer.startswith("This is general legal information")


def test_unknown_claims_have_no_fabricated_citations():
    response = build_response("Can I definitely win this case?")
    assert response.citations == []
    assert response.confidence in {"low", "medium"}


def test_classifier_supports_multiple_domains():
    domains = classify("My employer terminated me after a UPI fraud incident")
    assert {domain.code for domain in domains} >= {"EMPLOYMENT", "CYBER"}
