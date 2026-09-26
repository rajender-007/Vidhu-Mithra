/**
 * Mock API layer for static demo deployment.
 * Simulates the FastAPI backend entirely in the browser using in-memory state.
 * This enables the Firebase-hosted demo to work without a live backend.
 */

import type { UUID } from "crypto";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface Matter {
  id: string;
  title: string;
  description: string;
  language: string;
  state?: string;
  city?: string;
  stage: string;
  risk_level: RiskLevel;
  journey_progress: Record<string, string>;
  created_at: string;
  updated_at: string;
}

interface LegalDomain {
  code: string;
  name: string;
  confidence: number;
}

interface LegalResponse {
  case_summary: string;
  legal_domains: LegalDomain[];
  jurisdiction: { country: string; state?: string; city?: string; status: string };
  important_facts: string[];
  missing_facts: { question: string; why_asking: string }[];
  documents_needed: string[];
  possible_options: { title: string; description: string; risk: RiskLevel }[];
  risks: { dimension: string; level: RiskLevel; explanation: string }[];
  next_steps: { order: number; title: string; description: string; owner?: string }[];
  citations: { title: string; verification: string; url?: string }[];
  confidence: string;
  risk_level: RiskLevel;
  handoff_recommended: boolean;
  disclaimer: string;
}

interface ActionPlan {
  next_best_action: string;
  known: string[];
  unknown: string[];
  options: { title: string; description: string; risk?: RiskLevel }[];
  lawyer_questions: string[];
  evidence_to_preserve: string[];
}

interface Message {
  id: string;
  sender: "user" | "ai" | "system";
  content: string;
  structured?: LegalResponse;
  created_at: string;
}

// ── In-memory store ──────────────────────────────────────────────────
const matters: Map<string, Matter> = new Map();
const messages: Map<string, Message[]> = new Map();
const actionPlans: Map<string, ActionPlan> = new Map();

function uuid(): string {
  return crypto.randomUUID();
}

// ── Domain classification heuristics ─────────────────────────────────
const DOMAIN_KEYWORDS: Record<string, { code: string; name: string; keywords: string[] }> = {
  tenancy: { code: "TENANCY", name: "Tenancy & Rent Control", keywords: ["landlord", "tenant", "rent", "deposit", "eviction", "lease", "flat", "apartment", "security deposit", "maintenance", "tenancy"] },
  property: { code: "PROPERTY", name: "Property & Land", keywords: ["land", "property", "registration", "deed", "encroachment", "mutation", "title"] },
  consumer: { code: "CONSUMER", name: "Consumer Protection", keywords: ["refund", "product", "defective", "warranty", "consumer", "purchase", "seller", "online", "delivery", "fraud"] },
  labour: { code: "LABOUR", name: "Labour & Employment", keywords: ["salary", "employer", "fired", "termination", "notice period", "pf", "gratuity", "workplace", "harassment", "job"] },
  family: { code: "FAMILY", name: "Family & Matrimonial", keywords: ["divorce", "custody", "alimony", "marriage", "dowry", "domestic violence", "maintenance", "child", "spouse"] },
  criminal: { code: "CRIMINAL", name: "Criminal Law", keywords: ["theft", "assault", "threat", "police", "fir", "complaint", "bail", "arrest", "cheating", "criminal"] },
  cyber: { code: "CYBER", name: "Cyber & IT Law", keywords: ["hacking", "online fraud", "cybercrime", "data", "privacy", "phishing", "social media", "defamation online"] },
  motor: { code: "MOTOR", name: "Motor Vehicle & Accident", keywords: ["accident", "vehicle", "insurance claim", "hit and run", "compensation", "motor"] },
};

function classifyDomains(text: string): LegalDomain[] {
  const lower = text.toLowerCase();
  const scored: { domain: typeof DOMAIN_KEYWORDS[string]; score: number }[] = [];
  for (const domain of Object.values(DOMAIN_KEYWORDS)) {
    const hits = domain.keywords.filter((kw) => lower.includes(kw)).length;
    if (hits > 0) scored.push({ domain, score: hits });
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) return [{ code: "GENERAL", name: "General Legal", confidence: 0.4 }];
  const total = scored.reduce((acc, s) => acc + s.score, 0);
  return scored.slice(0, 3).map((s) => ({ code: s.domain.code, name: s.domain.name, confidence: Math.round((s.score / total) * 100) / 100 }));
}

// ── Jurisdiction inference ───────────────────────────────────────────
const CITIES = ["hyderabad", "bangalore", "bengaluru", "mumbai", "delhi", "chennai", "kolkata", "pune", "ahmedabad", "jaipur", "lucknow", "chandigarh", "kochi", "goa", "visakhapatnam", "indore", "bhopal", "patna", "thiruvananthapuram", "coimbatore", "noida", "gurgaon", "gurugram"];
const CITY_STATE: Record<string, string> = { hyderabad: "Telangana", bangalore: "Karnataka", bengaluru: "Karnataka", mumbai: "Maharashtra", delhi: "Delhi", chennai: "Tamil Nadu", kolkata: "West Bengal", pune: "Maharashtra", ahmedabad: "Gujarat", jaipur: "Rajasthan", lucknow: "Uttar Pradesh", chandigarh: "Chandigarh", kochi: "Kerala", goa: "Goa", visakhapatnam: "Andhra Pradesh", indore: "Madhya Pradesh", bhopal: "Madhya Pradesh", patna: "Bihar", thiruvananthapuram: "Kerala", coimbatore: "Tamil Nadu", noida: "Uttar Pradesh", gurgaon: "Haryana", gurugram: "Haryana" };

function inferJurisdiction(text: string, state?: string, city?: string) {
  const lower = text.toLowerCase();
  const foundCity = city || CITIES.find((c) => lower.includes(c));
  const foundState = state || (foundCity ? CITY_STATE[foundCity.toLowerCase()] : undefined);
  return { country: "India", state: foundState, city: foundCity ? foundCity.charAt(0).toUpperCase() + foundCity.slice(1) : undefined, status: foundCity ? "inferred" : "unknown" };
}

// ── Response builder ─────────────────────────────────────────────────
function buildResponse(description: string, state?: string, city?: string, language?: string): LegalResponse {
  const domains = classifyDomains(description);
  const jurisdiction = inferJurisdiction(description, state, city);
  const primaryDomain = domains[0]?.name || "General Legal";

  const truncated = description.length > 200 ? description.slice(0, 200) + "…" : description;

  return {
    case_summary: `Based on the description provided, this matter appears to involve ${primaryDomain.toLowerCase()} issues${jurisdiction.city ? ` in ${jurisdiction.city}` : " in India"}. The situation described raises several important considerations that should be carefully evaluated with proper documentation and verified legal provisions.`,
    legal_domains: domains,
    jurisdiction,
    important_facts: [
      `The matter has been described as: "${truncated}"`,
      `Primary legal domain identified: ${primaryDomain}`,
      jurisdiction.city ? `Location identified: ${jurisdiction.city}, ${jurisdiction.state}` : "Location needs to be confirmed for jurisdiction-specific analysis",
      "The timeline of events should be documented with specific dates",
      "All communications and documents related to this matter should be preserved",
    ],
    missing_facts: [
      { question: "What are the specific dates when key events occurred?", why_asking: "A chronology is essential for understanding limitation periods and legal deadlines." },
      { question: "Do you have written agreements, receipts or communications related to this matter?", why_asking: "Documentary evidence strengthens any legal position significantly." },
      { question: "Have you already taken any formal steps such as a notice, complaint or report?", why_asking: "Prior actions may affect available remedies and timelines." },
      { question: "What is the approximate monetary value or impact involved?", why_asking: "This affects which forum or authority has jurisdiction over the matter." },
    ],
    documents_needed: [
      "Written agreements, contracts or lease documents",
      "Payment receipts, bank statements or transaction records",
      "Communications (emails, messages, letters) with the other party",
      "Identification documents and address proof",
      "Photographs or screenshots of relevant evidence",
      "Any prior complaints, notices or legal documents filed",
    ],
    possible_options: [
      { title: "Send a formal legal notice", description: "A lawyer-drafted notice can often resolve disputes without litigation. This creates a paper trail and demonstrates seriousness.", risk: "LOW" },
      { title: "File a complaint with the appropriate authority", description: `Depending on the nature of the matter, complaints can be filed with consumer forums, police, or regulatory bodies.`, risk: "MEDIUM" },
      { title: "Attempt mediation or settlement", description: "Many disputes can be resolved through negotiation or formal mediation, which is faster and less expensive than court proceedings.", risk: "LOW" },
      { title: "Initiate formal legal proceedings", description: "Filing a case in the appropriate court or tribunal. This should typically be considered after other options have been explored.", risk: "HIGH" },
    ],
    risks: [
      { dimension: "Limitation period", level: "MEDIUM", explanation: "Legal actions must be filed within specified time limits. The applicable limitation period should be verified for this type of matter." },
      { dimension: "Evidence preservation", level: "HIGH", explanation: "Original documents and communications must be preserved. Digital evidence should be saved with timestamps." },
      { dimension: "Financial exposure", level: "MEDIUM", explanation: "The potential financial impact should be assessed to determine the most cost-effective approach." },
    ],
    next_steps: [
      { order: 1, title: "Gather and organise all documents", description: "Collect agreements, receipts, communications and any other evidence in chronological order.", owner: "You" },
      { order: 2, title: "Prepare a written chronology", description: "Create a timeline of events with specific dates, amounts and parties involved.", owner: "You" },
      { order: 3, title: "Identify the applicable laws", description: "NyayaPath will help identify relevant legal provisions once more facts are provided.", owner: "NyayaPath" },
      { order: 4, title: "Consider consulting a local lawyer", description: `A lawyer practising in ${jurisdiction.city || "your jurisdiction"} can provide advice specific to your situation and local procedures.`, owner: "You" },
    ],
    citations: [],
    confidence: "low",
    risk_level: domains[0]?.code === "CRIMINAL" ? "HIGH" : "MEDIUM",
    handoff_recommended: false,
    disclaimer: "This is general legal information based on the facts provided, not legal advice. Laws and procedures vary by jurisdiction and circumstance. Consider discussing your specific situation with a qualified lawyer before taking any formal legal step.",
  };
}

// ── Mock API functions (drop-in replacements for fetch calls) ────────

export async function mockFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();

  // Health
  if (path === "/health") {
    return json({ status: "ok", app: "NyayaPath", environment: "demo", storage: "browser-memory" });
  }

  // List matters
  if (path === "/api/v1/matters" && method === "GET") {
    return json(Array.from(matters.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  }

  // Create matter
  if (path === "/api/v1/matters" && method === "POST") {
    const body = JSON.parse(options.body as string);
    const id = uuid();
    const now = new Date().toISOString();
    const title = body.title || (body.description.trim().split(".")[0].slice(0, 80) || "New legal matter");
    const response = buildResponse(body.description, body.state, body.city, body.language);
    const matter: Matter = {
      id, title, description: body.description, language: body.language || "en",
      state: body.state, city: body.city, stage: "domain_classified",
      risk_level: response.risk_level,
      journey_progress: { problem: "complete", domain: "complete", jurisdiction: response.jurisdiction.status !== "unknown" ? "complete" : "in_progress", facts: "in_progress" },
      created_at: now, updated_at: now,
    };
    matters.set(id, matter);
    messages.set(id, [
      { id: uuid(), sender: "user", content: body.description, created_at: now },
      { id: uuid(), sender: "ai", content: response.case_summary, structured: response, created_at: now },
    ]);
    return json({ matter, response });
  }

  // Get single matter
  const matterMatch = path.match(/^\/api\/v1\/matters\/([^/]+)$/);
  if (matterMatch && method === "GET") {
    const matter = matters.get(matterMatch[1]);
    if (!matter) return json({ error: "Not found" }, 404);
    return json({ matter, messages: messages.get(matter.id) || [], events: [], action_plan: actionPlans.get(matter.id) || null });
  }

  // Send message
  const msgMatch = path.match(/^\/api\/v1\/matters\/([^/]+)\/messages$/);
  if (msgMatch && method === "POST") {
    const body = JSON.parse(options.body as string);
    const matter = matters.get(msgMatch[1]);
    if (!matter) return json({ error: "Not found" }, 404);
    const response = buildResponse(body.content, matter.state, matter.city, body.language);
    matter.risk_level = response.risk_level;
    matter.updated_at = new Date().toISOString();
    const list = messages.get(matter.id) || [];
    list.push({ id: uuid(), sender: "user", content: body.content, created_at: new Date().toISOString() });
    list.push({ id: uuid(), sender: "ai", content: response.case_summary, structured: response, created_at: new Date().toISOString() });
    messages.set(matter.id, list);
    return json(response);
  }

  // Generate action plan
  const planMatch = path.match(/^\/api\/v1\/matters\/([^/]+)\/action-plan$/);
  if (planMatch && method === "POST") {
    const matter = matters.get(planMatch[1]);
    if (!matter) return json({ error: "Not found" }, 404);
    const response = buildResponse(matter.description, matter.state, matter.city, matter.language);
    const plan: ActionPlan = {
      next_best_action: "Confirm the missing facts, preserve the originals and prepare a factual chronology before relying on any formal step.",
      known: response.important_facts,
      unknown: response.missing_facts.map((f) => f.question),
      options: response.possible_options,
      lawyer_questions: [
        "What forum and current provisions should be checked?",
        "What facts or documents would change the assessment?",
        "Are there any upcoming deadlines or limitation periods I should be aware of?",
      ],
      evidence_to_preserve: [
        "Keep original documents and message exports",
        "Record dates and amounts with their source",
        "Preserve screenshots of any digital evidence",
      ],
    };
    actionPlans.set(matter.id, plan);
    matter.journey_progress.options = "complete";
    matter.journey_progress.next_steps = "complete";
    matter.journey_progress.lawyer_prep = "in_progress";
    matter.stage = "action_plan_ready";
    return json(plan);
  }

  // Document upload (mock)
  const docMatch = path.match(/^\/api\/v1\/matters\/([^/]+)\/documents$/);
  if (docMatch && method === "POST") {
    const id = uuid();
    return json({ id, filename: "uploaded-document.pdf", status: "ready", sha256: "demo" });
  }

  // Document status (mock)
  const statusMatch = path.match(/^\/api\/v1\/documents\/([^/]+)\/status$/);
  if (statusMatch) {
    return json({ status: "ready", id: statusMatch[1] });
  }

  // Document clauses (mock)
  const clauseMatch = path.match(/^\/api\/v1\/documents\/([^/]+)\/clauses$/);
  if (clauseMatch) {
    return json([
      { id: uuid(), text: "The tenant shall vacate the premises within 30 days of termination notice.", risk_color: "orange", risk_level: "MEDIUM", category: "Termination" },
      { id: uuid(), text: "Security deposit shall be refunded within 60 days after deducting lawful charges.", risk_color: "blue", risk_level: "LOW", category: "Financial" },
      { id: uuid(), text: "Any dispute shall be subject to the exclusive jurisdiction of courts in the city of the property.", risk_color: "red", risk_level: "HIGH", category: "Jurisdiction" },
    ]);
  }

  // Fallback
  return json({ error: "Not found" }, 404);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
