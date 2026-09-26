/**
 * NyayaPath AI Legal Engine & Client API Layer.
 * Supports:
 * 1. Provider-backed AI integration through the server API (Gemini/OpenAI)
 * 2. Safe browser fallback for demo use when no API is configured
 * 3. In-browser matter store for instant, zero-latency interactions
 */

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Matter {
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

export interface LegalDomain {
  code: string;
  name: string;
  confidence: number;
}

export interface LegalResponse {
  case_summary: string;
  direct_answer?: string;
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

export interface ActionPlan {
  next_best_action: string;
  known: string[];
  unknown: string[];
  options: { title: string; description: string; risk?: RiskLevel }[];
  lawyer_questions: string[];
  evidence_to_preserve: string[];
}

export interface TimelineEvent {
  id: string;
  event_date: string;
  title: string;
  description?: string;
  source: string;
  verification_status: "verified" | "partial" | "unverified";
  confidence: number;
}

export interface LawyerBrief {
  title: string;
  disclaimer: string;
  issue: string;
  jurisdiction: { state?: string; city?: string; status: string };
  timeline: TimelineEvent[];
  action_plan: ActionPlan | null;
  questions: string[];
}

export interface Message {
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
const timelineEvents: Map<string, TimelineEvent[]> = new Map();
const answerCache: Map<string, string> = new Map();
const externalAiEnabled = process.env.NEXT_PUBLIC_ENABLE_EXTERNAL_AI === "true";

function uuid(): string {
  return crypto.randomUUID();
}

// ── Domain classification heuristics ─────────────────────────────────
const DOMAIN_KEYWORDS: Record<string, { code: string; name: string; keywords: string[] }> = {
  tenancy: { code: "TENANCY", name: "Tenancy & Rent Control", keywords: ["landlord", "tenant", "rent", "deposit", "eviction", "lease", "flat", "apartment", "security deposit", "maintenance", "tenancy", "painting", "damage"] },
  property: { code: "PROPERTY", name: "Property & Land", keywords: ["land", "property", "registration", "deed", "encroachment", "mutation", "title", "builder", "possession", "rera"] },
  consumer: { code: "CONSUMER", name: "Consumer Protection", keywords: ["refund", "product", "defective", "warranty", "consumer", "purchase", "seller", "online", "delivery", "fraud", "e-commerce", "amazon", "flipkart"] },
  labour: { code: "LABOUR", name: "Labour & Employment", keywords: ["salary", "employer", "fired", "termination", "notice period", "pf", "gratuity", "workplace", "harassment", "job", "wages", "unpaid"] },
  cheque: { code: "BANKING", name: "Banking & Negotiable Instruments", keywords: ["cheque", "bounce", "dishonour", "138", "loan", "emi", "bank", "recovery agent", "debt"] },
  family: { code: "FAMILY", name: "Family & Matrimonial", keywords: ["divorce", "custody", "alimony", "marriage", "dowry", "domestic violence", "maintenance", "child", "spouse"] },
  criminal: { code: "CRIMINAL", name: "Criminal Law", keywords: ["theft", "assault", "threat", "police", "fir", "complaint", "bail", "arrest", "cheating", "criminal", "extortion", "420"] },
  cyber: { code: "CYBER", name: "Cyber & IT Law", keywords: ["hacking", "online fraud", "cybercrime", "data", "privacy", "phishing", "social media", "defamation online", "upi", "scam"] },
  motor: { code: "MOTOR", name: "Motor Vehicle & Accident", keywords: ["accident", "vehicle", "insurance claim", "hit and run", "compensation", "motor", "challan"] },
};

export function classifyDomains(text: string): LegalDomain[] {
  const lower = text.toLowerCase();
  const scored: { domain: typeof DOMAIN_KEYWORDS[string]; score: number }[] = [];
  for (const domain of Object.values(DOMAIN_KEYWORDS)) {
    const hits = domain.keywords.filter((kw) => lower.includes(kw)).length;
    if (hits > 0) scored.push({ domain, score: hits });
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) return [{ code: "GENERAL", name: "General Legal", confidence: 0.5 }];
  const total = scored.reduce((acc, s) => acc + s.score, 0);
  return scored.slice(0, 3).map((s) => ({ code: s.domain.code, name: s.domain.name, confidence: Math.round((s.score / total) * 100) / 100 }));
}

// ── Jurisdiction inference ───────────────────────────────────────────
const CITIES = ["hyderabad", "bangalore", "bengaluru", "mumbai", "delhi", "chennai", "kolkata", "pune", "ahmedabad", "jaipur", "lucknow", "chandigarh", "kochi", "goa", "visakhapatnam", "indore", "bhopal", "patna", "thiruvananthapuram", "coimbatore", "noida", "gurgaon", "gurugram", "secunderabad"];
const CITY_STATE: Record<string, string> = {
  hyderabad: "Telangana", secunderabad: "Telangana", bangalore: "Karnataka", bengaluru: "Karnataka",
  mumbai: "Maharashtra", delhi: "Delhi", chennai: "Tamil Nadu", kolkata: "West Bengal",
  pune: "Maharashtra", ahmedabad: "Gujarat", jaipur: "Rajasthan", lucknow: "Uttar Pradesh",
  chandigarh: "Chandigarh", kochi: "Kerala", goa: "Goa", visakhapatnam: "Andhra Pradesh",
  indore: "Madhya Pradesh", bhopal: "Madhya Pradesh", patna: "Bihar", thiruvananthapuram: "Kerala",
  coimbatore: "Tamil Nadu", noida: "Uttar Pradesh", gurgaon: "Haryana", gurugram: "Haryana"
};

export function inferJurisdiction(text: string, state?: string, city?: string) {
  const lower = text.toLowerCase();
  const foundCity = city || CITIES.find((c) => lower.includes(c));
  const foundState = state || (foundCity ? CITY_STATE[foundCity.toLowerCase()] : undefined);
  return {
    country: "India",
    state: foundState,
    city: foundCity ? foundCity.charAt(0).toUpperCase() + foundCity.slice(1) : undefined,
    status: foundCity ? "inferred" : "unknown"
  };
}

// ── Extract entities from prompt ─────────────────────────────────────
function extractEntities(text: string) {
  const amountMatch = text.match(/(?:rs\.?|inr|₹)\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:rupees|rs|lakh|thousand)/i);
  const timeMatch = text.match(/(\d+)\s*(days?|weeks?|months?|years?)/i);
  const cities = CITIES.filter((c) => text.toLowerCase().includes(c));
  return {
    amount: amountMatch ? amountMatch[0] : null,
    timeframe: timeMatch ? timeMatch[0] : null,
    city: cities.length > 0 ? cities[0].charAt(0).toUpperCase() + cities[0].slice(1) : null,
  };
}

// ── Live AI Agent Caller (Gemini / ChatGPT bridge with fast timeout) ──
async function tryCallExternalAIAgent(userPrompt: string, contextPrompt: string): Promise<string | null> {
  if (!externalAiEnabled) return null;
  const cacheKey = `${contextPrompt}::${userPrompt}`.toLowerCase().trim();
  const cached = answerCache.get(cacheKey);
  if (cached) return cached;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1800);

  try {
    const prompt = `System: You are NyayaPath, an Indian legal-information navigator. Explain uncertainty, do not invent statutes or citations, and provide structured preparation guidance rather than legal advice.\nContext: ${contextPrompt}\nUser Question: ${userPrompt}`;
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const text = await resp.text();
      if (text && text.trim().length > 40 && !text.includes("Error")) {
        const answer = text.trim();
        answerCache.set(cacheKey, answer);
        return answer;
      }
    }
  } catch {
    // Falls through to the automatic question-type legal reasoning engine
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

// ── Automatic Question-Type-Based Legal Intelligence Engine ─────────
export function generateQuestionSpecificAnswer(question: string, matter?: Matter | null): string {
  const q = question.toLowerCase();
  const entities = extractEntities(question + " " + (matter?.description || ""));
  const city = entities.city || matter?.city || "your city";
  const state = (matter?.city && CITY_STATE[matter.city.toLowerCase()]) || matter?.state || "India";
  const amountStr = entities.amount ? ` of ${entities.amount}` : "";
  const timeStr = entities.timeframe ? ` for ${entities.timeframe}` : "";

  // 1. DEDUCTIONS / PAINTING / WEAR & TEAR
  if (q.includes("paint") || q.includes("deduct") || q.includes("damage") || q.includes("wear and tear") || q.includes("cleaning charge")) {
    return `### Can the Landlord Deduct Painting or Maintenance Charges?

Under Indian tenancy law and customary rental practice:

1. **Normal Wear and Tear vs. Actual Damage**:
   - Under **Section 108 of the Transfer of Property Act, 1882**, a tenant is obliged to keep the property in reasonable condition, subject to reasonable wear and tear.
   - Landlords **cannot arbitrarily deduct painting costs** unless the rental agreement explicitly contains a mutually agreed painting clause or actual physical damage beyond normal usage is documented.

2. **Burden of Proof on Landlord**:
   - The landlord must produce valid, itemized bills and photographic proof of genuine damage to claim any lawful deduction.

3. **Recommended Actions**:
   - **Send a Written Rebuttal**: State clearly that ordinary weathering/fading is normal wear and tear. Demand an itemized breakdown with receipts.
   - **Reference the Lease Agreement**: Check whether clause requires tenant to repaint upon vacating.
   - **Issue a Formal Demand Notice**: Give the landlord 7 to 15 days to release the undisputed balance${amountStr}.`;
  }

  // 2. LEGAL NOTICE DRAFTING & PROCEDURE
  if (q.includes("legal notice") || q.includes("format") || q.includes("draft") || q.includes("how to send") || q.includes("notice period")) {
    return `### How to Draft and Serve a Formal Legal Notice

A legal notice serves as the final formal opportunity for the opposing party to resolve the dispute before litigation.

1. **Mandatory Ingredients of a Legal Notice**:
   - **Sender & Recipient Particulars**: Full legal names, current addresses, and contact details.
   - **Statement of Facts**: Clear chronological narration (agreement dates, payments made${amountStr}, handover date, and defaults).
   - **Cause of Action**: Specific breach (e.g. failure to return security deposit under tenancy agreement / non-payment of salary).
   - **Statutory Demand & Specific Relief**: Exact sum demanded plus reasonable interest (typically 9% to 18% p.a.).
   - **Cure Period (Deadline)**: A firm window of **15 days** from receipt to comply.
   - **Consequences**: Notice that failure will result in civil and criminal proceedings with costs.

2. **Mode of Dispatch**:
   - Must be dispatched via **Registered Post with Acknowledgment Due (RPAD)** or **Speed Post**.
   - Keep the original postal receipt and download the India Post tracking delivery confirmation. An email and WhatsApp copy can be sent simultaneously as secondary proof.`;
  }

  // 3. REQUIRED DOCUMENTS & EVIDENCE
  if (q.includes("document") || q.includes("proof") || q.includes("evidence") || q.includes("receipt") || q.includes("paperwork") || q.includes("organise") || q.includes("organize")) {
    return `### Essential Documents Checklist

To establish your legal claim and prepare for lawyer consultation in ${city}:

1. **Primary Contractual Evidence**:
   - Signed Rental / Lease Agreement (or Employment Offer Letter / Contract).
   - Security Deposit / Payment Receipts and Bank Account Statements showing transfer${amountStr}.

2. **Communication & Demand Records**:
   - WhatsApp conversations, text messages, and email threads requesting refund/action.
   - Notice of move-out / resignation submitted with proof of delivery or acknowledgment.

3. **Handover & Condition Proof**:
   - Key handover receipt, inspection sheet, or exit video/photographs showing premises condition.
   - Utility bill clearance receipts (electricity, water, maintenance dues).

4. **Digital Preservation Tip**:
   - Export WhatsApp chat with media as a text or zip backup. Preserve digital timestamps for admissibility under **Section 63 of Bharatiya Sakshya Adhiniyam, 2023 (BSA)** (formerly Section 65B of Indian Evidence Act).`;
  }

  // 4. PROCEDURAL / WHERE TO FILE / COURT OR POLICE
  if (q.includes("where to file") || q.includes("which court") || q.includes("how to file") || q.includes("process") || q.includes("steps") || q.includes("police or court") || q.includes("authority")) {
    return `### Procedural Roadmap & Appropriate Legal Forums

For disputes in **${city}, ${state}**, the primary legal avenues are:

1. **Step 1: Formal Legal Notice (Pre-Litigation)**:
   - A written notice may help create a clear record, but the outcome and appropriate forum depend on the facts and should be checked with a lawyer.

2. **Step 2: Consumer Disputes Redressal Commission (Consumer Court)**:
   - If the counterparty provided a commercial service (e.g. co-living operator, property management company, defective seller, builder), you can file online via the National Consumer Portal (**E-Daakhil** - edaakhil.nic.in).
   - Nominal filing fees and no mandatory requirement for a physical lawyer.

3. **Step 3: Rent Court / Rent Tribunal / Civil Court**:
   - Under the local Rent Control Act or Summary Suit under **Order 37 of the Civil Procedure Code (CPC)** for debt recovery based on written agreements.
   - The correct forum, procedure, and eligibility must be confirmed for the specific agreement and jurisdiction.

4. **Step 4: Police Complaint / FIR**:
   - If there is criminal breach of trust (**Section 316 BNS** / Section 405 IPC) or cheating with fraudulent intention from inception (**Section 318 BNS** / Section 420 IPC), a written complaint can be submitted to the local police station or online cybercrime/police portal.`;
  }

  // 5. LIMITATION PERIOD / TIME LIMITS / DEADLINES
  if (q.includes("limitation") || q.includes("deadline") || q.includes("time limit") || q.includes("how long") || q.includes("how many years") || q.includes("expired")) {
    return `### Limitation Periods & Critical Deadlines under Indian Law

Under the **Limitation Act, 1963**:

1. **Recovery of Money / Security Deposit / Unpaid Salary**:
   - A limitation period may apply, but the correct period depends on the cause of action, document, forum, and later events. Confirm the current provision and exact start date before relying on any deadline.

2. **Consumer Complaint (District Commission)**:
   - Consumer matters can have statutory time limits, but the current provision and any condonation rules must be checked against the facts and the current official source.

3. **Cheque Bounce (Section 138 NI Act)**:
   - Cheque-related timelines are strict and fact-dependent. Confirm the current notice and filing windows from an official source or qualified lawyer.

*Recommendation: Do not delay. Even though 3 years is allowed, serving a prompt legal notice within the first few weeks greatly increases settlement likelihood.*`;
  }

  // 6. SALARY / EMPLOYMENT ISSUES
  if (q.includes("salary") || q.includes("employer") || q.includes("wages") || q.includes("resignation") || q.includes("fired") || q.includes("pf") || q.includes("provident fund")) {
    return `### Legal Recourse for Unpaid Salary / Employment Disputes

Under Indian Labour & Employment regulations:

1. **Payment of Wages Act, 1936**:
   - Wages must be paid within 7 to 10 days of the wage period. Unlawful withholding of earned wages is illegal.
   - A complaint can be filed before the **Labour Commissioner** having jurisdiction over ${city}.

2. **Steps to Take**:
   - **Internal HR Escalation**: Send a formal demand email attaching timesheets, attendance records, and offer letter.
   - **Labour Commissioner Complaint**: File a summary claim under Section 15 of Payment of Wages Act or Industrial Disputes Act.
   - **Summary Suit (Order 37 CPC)**: For contractual salary recovery with interest.
   - **EPFO Portal**: If employer deducted PF but failed to deposit, file a grievance directly on epfigms.gov.in.`;
  }

  // 7. POLICE / FIR / ARREST / CRIMINAL
  if (q.includes("police") || q.includes("fir") || q.includes("arrest") || q.includes("threat") || q.includes("harass") || q.includes("bail") || q.includes("crime")) {
    return `### Police Complaints, FIR, and Rights under Criminal Law

1. **Cognizable vs. Non-Cognizable Offence**:
   - For cognizable offences (threat to life, assault, extortion), police are mandated to register an FIR immediately under **Section 173 BNSS** (formerly Section 154 CrPC).
   - Zero FIR can be lodged at any police station irrespective of jurisdictional boundaries.

2. **Protection Against Arbitrary Arrest**:
   - Under Supreme Court guidelines (*Arnesh Kumar v. State of Bihar*) and **Section 35 BNSS** (formerly Sec 41A CrPC), for offences punishable with imprisonment up to 7 years, arrest is not automatic; police must first issue a Notice of Appearance.

3. **Immediate Step**:
   - If in immediate physical danger, call **112** immediately.
   - Submit written complaint with acknowledged copy (GD Entry / CSR) at the local police station.`;
  }

  // 8. DEFAULT DYNAMIC LEGAL ANSWER
  return `### Legal Analysis & Recommended Next Steps

Regarding: **"${question}"** in **${city}**:

1. **Immediate Assessment**:
   - Under relevant Indian statutory provisions (including contract and dispute resolution procedures), you have lawful rights to claim remedy and restitution${amountStr}.
   - The key factor in establishing your position is securing contemporaneous documentation (written messages, bank transactions, and formal demands${timeStr}).

2. **Strategic Steps**:
   - **Step 1**: Send a concise, dated demand message setting a clear deadline of 7 days for resolution.
   - **Step 2**: If no resolution occurs, escalate to an Advocate-issued **Legal Notice via Speed Post**.
   - **Step 3**: Prepare an itemized factual chronology with all payment proofs and communication timestamps.
   - **Step 4**: Approach the appropriate jurisdictional forum in ${city} (Consumer Commission, Rent Authority, or Civil Court).

3. **Key Questions for a Legal Consultation**:
   - *What is the most cost-effective forum for this claim amount in ${city}?*
   - *Can pre-litigation mediation through the District Legal Services Authority (DLSA) be initiated?*`;
}

// ── Comprehensive Legal Response Builder ─────────────────────────────
export async function buildDynamicResponse(description: string, state?: string, city?: string, language?: string): Promise<LegalResponse> {
  const domains = classifyDomains(description);
  const jurisdiction = inferJurisdiction(description, state, city);
  const primaryDomain = domains[0]?.name || "General Legal";
  const entities = extractEntities(description);
  const targetCity = jurisdiction.city || entities.city || "your city";
  const amountStr = entities.amount ? ` involving ${entities.amount}` : "";
  const timeStr = entities.timeframe ? ` pending for ${entities.timeframe}` : "";

  // The browser fallback is intentionally deterministic. The real provider path
  // is the server-side Gemini/OpenAI router used when NEXT_PUBLIC_API_BASE_URL is set.
  const aiGeneratedText = await tryCallExternalAIAgent(description, `Matter in ${targetCity}, domain: ${primaryDomain}`);
  const directAnswer = aiGeneratedText || generateQuestionSpecificAnswer(description, null);

  const dynamicSummary = `This matter appears to involve ${primaryDomain.toLowerCase()}${amountStr} in ${targetCity}${timeStr}. This is an initial information review; the applicable law, forum, and deadlines still need source and professional verification.`;

  return {
    case_summary: dynamicSummary,
    direct_answer: directAnswer,
    legal_domains: domains,
    jurisdiction,
    important_facts: [
      `Factual inquiry: "${description.length > 140 ? description.slice(0, 140) + "…" : description}"`,
      `Classified Domain: ${primaryDomain}`,
      jurisdiction.city ? `Jurisdiction: ${jurisdiction.city}, ${jurisdiction.state || "India"}` : "Jurisdiction: India (City to confirm)",
      entities.amount ? `Monetary value identified: ${entities.amount}` : "Monetary value to be confirmed with transaction receipts",
      entities.timeframe ? `Duration reported: ${entities.timeframe}` : "Timeline to be established in chronological sequence",
      "Contemporaneous digital records and payment receipts should be preserved immediately",
    ],
    missing_facts: [
      { question: "What exact date was the payment made and when did the demand become due?", why_asking: "Dates help a qualified reviewer check any applicable deadline or limitation rule." },
      { question: "Is there a written and signed agreement or contract between the parties?", why_asking: "Determines whether a Summary Suit under Order 37 CPC or Consumer Court is preferred." },
      { question: "Have you sent any formal written communication or notice demanding resolution?", why_asking: "Required to establish notice of demand before initiating legal proceedings." },
      { question: "Do you have digital payment receipts, bank transaction IDs, or bank statements?", why_asking: "Original records help establish what happened and allow a professional to assess admissibility." },
    ],
    documents_needed: [
      "Signed Lease / Employment / Service Agreement with all schedules",
      "Bank transfer receipts, UTR numbers, or passbook statement",
      "Exported WhatsApp / Email communications with timestamps",
      "Notice of termination, move-out confirmation, or resignation letter",
      "Photographs / video proof of condition (if premises / product related)",
      "Identity and address proofs of both claimant and counterparty",
    ],
    possible_options: [
      { title: "Prepare a written request or lawyer-reviewed notice", description: `Organise the facts, agreement, amount, and requested remedy. A lawyer can confirm whether a formal notice and the proposed time window are appropriate in ${targetCity}.`, risk: "LOW" },
      { title: "Check mediation or legal-aid options", description: `Ask the relevant District Legal Services Authority or authorised forum in ${targetCity} whether mediation or legal aid is available for these facts.`, risk: "LOW" },
      { title: "Check the potential consumer or civil forum", description: "If the counterparty is a business or service provider, verify the correct forum, eligibility, filing route, and current official procedure before submitting anything.", risk: "MEDIUM" },
      { title: "Discuss formal proceedings with a lawyer", description: "A qualified lawyer should confirm the cause of action, evidence, limitation, jurisdiction, costs, and risks before any court or police filing.", risk: "HIGH" },
    ],
    risks: [
      { dimension: "Deadline uncertainty", level: "MEDIUM", explanation: "The relevant date and current limitation rule have not been verified from a source matched to this matter." },
      { dimension: "Evidence quality", level: "MEDIUM", explanation: "Original files, complete exports, payment records, and document context should be preserved for professional review." },
      { dimension: "Forum uncertainty", level: "MEDIUM", explanation: "The correct authority or court cannot be determined from the current facts alone." },
    ],
    next_steps: [
      { order: 1, title: "Build a factual chronology", description: "Collect agreements, receipts, messages, and notices with their original dates and sources.", owner: "You" },
      { order: 2, title: "Ask for missing records", description: "Request an itemized explanation and preserve the response without editing the original evidence.", owner: "You" },
      { order: 3, title: "Review the matter with a qualified professional", description: "Ask a lawyer to verify the current law, forum, deadline, costs, and any notice wording before relying on it.", owner: "You / Legal Counsel" },
      { order: 4, title: "Choose a verified next step", description: "Only after verification, decide whether to use negotiation, mediation, a complaint, or another formal route.", owner: "You / Legal Counsel" },
    ],
    citations: [],
    confidence: "low",
    risk_level: domains[0]?.code === "CRIMINAL" ? "HIGH" : "MEDIUM",
    handoff_recommended: true,
    disclaimer: "This is general legal information, not legal advice. Important claims, deadlines, sources, and forum choices must be verified with an official source or qualified lawyer.",
  };
}

// ── Mock API router ──────────────────────────────────────────────────
export async function mockFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();

  // Health check
  if (path === "/health") {
    return json({ status: "ok", app: "NyayaPath", environment: "demo", engine: "Safe browser fallback; provider-backed API when configured" });
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
    const response = await buildDynamicResponse(body.description, body.state, body.city, body.language);
    const matter: Matter = {
      id, title, description: body.description, language: body.language || "en",
      state: response.jurisdiction.state || body.state, city: response.jurisdiction.city || body.city,
      stage: "domain_classified", risk_level: response.risk_level,
      journey_progress: {
        problem: "complete", domain: "complete",
        jurisdiction: response.jurisdiction.status !== "unknown" ? "complete" : "in_progress",
        facts: "in_progress", documents: "in_progress"
      },
      created_at: now, updated_at: now,
    };
    matters.set(id, matter);
    timelineEvents.set(id, []);

    const initialAnswer = response.direct_answer || response.case_summary;
    messages.set(id, [
      { id: uuid(), sender: "user", content: body.description, created_at: now },
      { id: uuid(), sender: "ai", content: initialAnswer, structured: response, created_at: now },
    ]);
    return json({ matter, response });
  }

  // Get single matter
  const matterMatch = path.match(/^\/api\/v1\/matters\/([^/]+)$/);
  if (matterMatch && method === "GET") {
    const matter = matters.get(matterMatch[1]);
    if (!matter) return json({ error: "Not found" }, 404);
    return json({ matter, messages: messages.get(matter.id) || [], events: timelineEvents.get(matter.id) || [], action_plan: actionPlans.get(matter.id) || null });
  }

  // Send message / AI Chat
  const msgMatch = path.match(/^\/api\/v1\/matters\/([^/]+)\/messages$/);
  if (msgMatch && method === "POST") {
    const body = JSON.parse(options.body as string);
    const matter = matters.get(msgMatch[1]);
    if (!matter) return json({ error: "Not found" }, 404);

    // Call external AI agent or generate adaptive answer tailored to the specific question
    const externalAnswer = await tryCallExternalAIAgent(body.content, `Context: ${matter.description} in ${matter.city || "India"}`);
    const tailoredAnswer = externalAnswer || generateQuestionSpecificAnswer(body.content, matter);

    const response = await buildDynamicResponse(body.content, matter.state, matter.city, body.language);
    response.direct_answer = tailoredAnswer;

    matter.updated_at = new Date().toISOString();
    const list = messages.get(matter.id) || [];
    list.push({ id: uuid(), sender: "user", content: body.content, created_at: new Date().toISOString() });
    list.push({ id: uuid(), sender: "ai", content: tailoredAnswer, structured: response, created_at: new Date().toISOString() });
    messages.set(matter.id, list);
    return json(response);
  }

  const timelineMatch = path.match(/^\/api\/v1\/matters\/([^/]+)\/timeline$/);
  if (timelineMatch) {
    const matter = matters.get(timelineMatch[1]);
    if (!matter) return json({ error: "Not found" }, 404);
    if (method === "GET") return json(timelineEvents.get(matter.id) || []);
    if (method === "POST") {
      const body = JSON.parse(options.body as string);
      const event: TimelineEvent = {
        id: uuid(), event_date: body.event_date, title: body.title, description: body.description,
        source: "user", verification_status: "unverified", confidence: 1,
      };
      const events = timelineEvents.get(matter.id) || [];
      events.push(event);
      timelineEvents.set(matter.id, events);
      matter.journey_progress.timeline = "complete";
      return json(event, 201);
    }
  }

  // Generate action plan
  const planMatch = path.match(/^\/api\/v1\/matters\/([^/]+)\/action-plan$/);
  if (planMatch && method === "POST") {
    const matter = matters.get(planMatch[1]);
    if (!matter) return json({ error: "Not found" }, 404);
    const response = await buildDynamicResponse(matter.description, matter.state, matter.city, matter.language);
    const plan: ActionPlan = {
      next_best_action: `Confirm missing documentary records, dispatch a 15-day statutory legal notice via Speed Post, and preserve digital transaction IDs before filing in ${matter.city || "court"}.`,
      known: response.important_facts,
      unknown: response.missing_facts.map((f) => f.question),
      options: response.possible_options,
      lawyer_questions: [
        `What is the specific limitation cutoff date for this matter in ${matter.city || "our jurisdiction"}?`,
        "Should we initiate E-Daakhil consumer proceedings or a summary suit under Order 37 CPC?",
        "What electronic evidence certificate under Bharatiya Sakshya Adhiniyam, 2023 is required?",
        "Can we claim interest at 12-18% per annum along with litigation expenses?",
      ],
      evidence_to_preserve: [
        "Signed lease agreement / contractual letters and all annexures",
        "Bank transaction statements with UTR numbers and payment receipts",
        "Exported WhatsApp / SMS conversations with full header metadata",
        "India Post tracking delivery report for legal notice",
      ],
    };
    actionPlans.set(matter.id, plan);
    matter.journey_progress.options = "complete";
    matter.journey_progress.next_steps = "complete";
    matter.journey_progress.lawyer_prep = "in_progress";
    matter.stage = "action_plan_ready";
    return json(plan);
  }

  const briefMatch = path.match(/^\/api\/v1\/matters\/([^/]+)\/lawyer-brief$/);
  if (briefMatch && method === "POST") {
    const matter = matters.get(briefMatch[1]);
    if (!matter) return json({ error: "Not found" }, 404);
    const plan = actionPlans.get(matter.id) || null;
    return json({
      title: `Lawyer preparation brief - ${matter.title}`,
      disclaimer: "AI-generated preparation draft. Review with a qualified legal professional before use.",
      issue: matter.description,
      jurisdiction: { state: matter.state, city: matter.city, status: matter.state || matter.city ? "inferred" : "to be verified" },
      timeline: timelineEvents.get(matter.id) || [],
      action_plan: plan,
      questions: plan?.lawyer_questions || ["Which current law, forum, deadline, and evidence should be verified for this matter?"],
    });
  }

  // Document upload (mock)
  const docMatch = path.match(/^\/api\/v1\/matters\/([^/]+)\/documents$/);
  if (docMatch && method === "POST") {
    const id = uuid();
    return json({ id, filename: "Legal_Evidence_Document.pdf", status: "ready", sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" });
  }

  // Document status
  const statusMatch = path.match(/^\/api\/v1\/documents\/([^/]+)\/status$/);
  if (statusMatch) {
    return json({ status: "ready", id: statusMatch[1] });
  }

  // Document clauses
  const clauseMatch = path.match(/^\/api\/v1\/documents\/([^/]+)\/clauses$/);
  if (clauseMatch) {
    return json([
      { id: uuid(), text: "The security deposit shall be refunded within 15 days of peaceful handover of possession, subject to deduction of verified damages.", risk_color: "blue", risk_level: "LOW", category: "Deposit Refund" },
      { id: uuid(), text: "The lessor reserves the right to deduct painting and renovation charges regardless of length of tenancy.", risk_color: "red", risk_level: "HIGH", category: "Unfair Penalty Clause" },
      { id: uuid(), text: "Either party may terminate this agreement by providing one calendar month's notice in writing.", risk_color: "orange", risk_level: "MEDIUM", category: "Termination Clause" },
      { id: uuid(), text: "Any dispute arising hereunder shall be subject to the exclusive jurisdiction of civil courts in the city of the premises.", risk_color: "blue", risk_level: "LOW", category: "Jurisdiction" },
    ]);
  }

  return json({ error: "Not found" }, 404);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
