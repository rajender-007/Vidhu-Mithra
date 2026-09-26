from __future__ import annotations

from ..schemas import (
    Citation, DomainLabel, JurisdictionGuess, LegalResponse, MissingFact, NextStep,
    Option, RiskItem,
)


DISCLAIMER = "This is general legal information, not legal advice. Consider discussing your situation with a qualified lawyer."
UNVERIFIED = "I could not verify this sufficiently from the available sources."

DOMAIN_RULES = [
    ("PROPERTY", "Property & Real Estate", ["rent", "rental", "landlord", "tenant", "deposit", "lease", "flat", "house"]),
    ("CONSUMER", "Consumer", ["refund", "warranty", "consumer", "product", "seller", "invoice"]),
    ("EMPLOYMENT", "Employment", ["job", "salary", "employee", "employer", "termination", "notice period", "offer letter"]),
    ("CYBER", "Cyber & Digital", ["upi", "fraud", "hacked", "cyber", "online", "scam", "otp"]),
    ("BUSINESS", "Business & Startup", ["nda", "vendor", "founder", "startup", "company", "contract"]),
    ("FAMILY", "Family & Marriage", ["marriage", "divorce", "custody", "maintenance", "domestic violence"]),
]


def classify(text: str) -> list[DomainLabel]:
    lower = text.lower()
    matches: list[DomainLabel] = []
    for code, name, keywords in DOMAIN_RULES:
        hits = sum(1 for keyword in keywords if keyword in lower)
        if hits:
            matches.append(DomainLabel(code=code, name=name, confidence=min(0.55 + hits * 0.1, 0.95)))
    if not matches:
        matches.append(DomainLabel(code="CIVIL", name="Civil", confidence=0.42))
    return sorted(matches, key=lambda item: item.confidence, reverse=True)[:3]


def jurisdiction(text: str, state: str | None = None, city: str | None = None) -> JurisdictionGuess:
    lower = text.lower()
    detected_state = state
    detected_city = city
    if not detected_state and "telangana" in lower:
        detected_state = "Telangana"
    if not detected_city and "hyderabad" in lower:
        detected_city = "Hyderabad"
    if not detected_state and detected_city == "Hyderabad":
        detected_state = "Telangana"
    status = "confirmed" if state or city else ("inferred" if detected_state or detected_city else "unknown")
    return JurisdictionGuess(state=detected_state, city=detected_city, status=status)


def _missing_facts(domains: list[DomainLabel], text: str) -> list[MissingFact]:
    lower = text.lower()
    questions: list[MissingFact] = []
    if not any(word in lower for word in ("telangana", "hyderabad", "mumbai", "delhi", "karnataka", "india")):
        questions.append(MissingFact(question="Which Indian state and city is this matter connected to?", why_asking="The applicable procedure and state-specific rules can differ by location."))
    if any(d.code == "PROPERTY" for d in domains):
        questions.extend([
            MissingFact(question="Was there a written rental or sale agreement?", why_asking="The wording and dates in the agreement may affect what needs to be checked."),
            MissingFact(question="What payment proof and communications do you have?", why_asking="Documents help establish the timeline and the facts that can be verified."),
        ])
    elif any(d.code == "EMPLOYMENT" for d in domains):
        questions.append(MissingFact(question="What do the offer or employment documents say about notice and termination?", why_asking="The exact wording and version of the document matter."))
    elif any(d.code == "CYBER" for d in domains):
        questions.append(MissingFact(question="When did you first notice the transaction or account access, and what have you reported already?", why_asking="Timing can affect which reporting steps should be checked."))
    return questions[:6]


def build_response(text: str, state: str | None = None, city: str | None = None, language: str = "en") -> LegalResponse:
    domains = classify(text)
    jurisdiction_guess = jurisdiction(text, state, city)
    lower = text.lower()
    important = [text.strip()]
    docs = ["Any written agreement or notice", "Proof of payment or transaction", "Relevant messages, emails or screenshots"]
    options = [
        Option(title="Organise and preserve the evidence", description="Collect the relevant documents and create a dated chronology before deciding on a formal step.", prerequisites=["Keep original files unchanged"], evidence_needed=docs, risk="LOW"),
        Option(title="Prepare a factual written request", description="Consider preparing a clear, non-threatening request that states the facts and asks for a response by a date you choose to verify.", prerequisites=["Confirm the recipient and relevant agreement"], evidence_needed=docs, risk="MEDIUM"),
    ]
    risks = [RiskItem(dimension="Missing information", level="MEDIUM", explanation="Important facts and source documents are still missing, so the position cannot be assessed confidently.", what_would_lower_it=["Answer the clarifying questions", "Upload the relevant documents"])]
    if jurisdiction_guess.status == "unknown":
        risks.append(RiskItem(dimension="Jurisdiction uncertainty", level="MEDIUM", explanation="The state or city has not been confirmed.", what_would_lower_it=["Confirm the location connected to the matter"]))
    if any(word in lower for word in ("threat", "violence", "danger", "urgent", "self harm")):
        risks.append(RiskItem(dimension="Safety", level="CRITICAL", explanation="The message may involve immediate safety concerns. Prioritise personal safety and professional or emergency support.", what_would_lower_it=["Contact a trusted person or appropriate emergency support"]))
    overall = "CRITICAL" if any(r.level == "CRITICAL" for r in risks) else "MEDIUM"
    handoff = overall in ("HIGH", "CRITICAL") or jurisdiction_guess.status == "unknown"
    return LegalResponse(
        case_summary="You described: " + text.strip(),
        legal_domains=domains,
        jurisdiction=jurisdiction_guess,
        important_facts=important,
        missing_facts=_missing_facts(domains, text),
        documents_needed=docs,
        possible_options=options,
        risks=risks,
        next_steps=[
            NextStep(order=1, title="Confirm the location and key dates", description="Write down the state, city, agreement date, payment date and the date the problem started."),
            NextStep(order=2, title="Preserve original evidence", description="Keep original documents, messages and receipts, and work from copies when annotating them."),
            NextStep(order=3, title="Consider discussing the matter with a lawyer", description="A qualified lawyer can assess the facts, forum and current law before you rely on a legal step.", owner="lawyer"),
        ],
        citations=[], confidence="low" if not domains or jurisdiction_guess.status == "unknown" else "medium",
        risk_level=overall, handoff_recommended=handoff, disclaimer=DISCLAIMER,
    )


def explain(text: str, level: int, language: str) -> dict[str, str | int | list[Citation]]:
    prefix = {1: "In simple terms", 2: "Plain-language explanation", 3: "Detailed explanation", 4: "Professional explanation"}[level]
    return {
        "original": text,
        "level": level,
        "language": language,
        "explanation": f"{prefix}: this text should be read together with the surrounding clauses and the facts of the matter. {UNVERIFIED}",
        "what_it_means": "The exact effect depends on the full document and applicable law.",
        "why_it_matters": "A small wording difference can change obligations, timing or risk.",
        "who_is_affected": "The people or organisations identified in the document.",
        "potential_risk": "The available source passage has not been verified in the legal corpus.",
        "what_to_check": "Check definitions, exceptions, dates, limits, notice provisions and governing-law wording.",
        "question_to_ask_lawyer": "How does this wording apply to the facts and jurisdiction of my matter?",
        "citations": [],
    }
