"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { mockFetch, type LawyerBrief, type TimelineEvent } from "../lib/mockApi";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type View = "overview" | "matters" | "documents" | "action-plan" | "lawyer-prep" | "settings";
type Tab = "overview" | "chat" | "documents" | "timeline" | "action-plan" | "lawyer-prep";

type Matter = { id: string; title: string; description: string; language: string; state?: string; city?: string; stage: string; risk_level: RiskLevel; journey_progress: Record<string, string>; created_at: string; updated_at: string };
type LegalResponse = { case_summary: string; legal_domains: { code: string; name: string; confidence: number }[]; jurisdiction: { country: string; state?: string; city?: string; status: string }; important_facts: string[]; missing_facts: { question: string; why_asking: string }[]; documents_needed: string[]; possible_options: { title: string; description: string; risk: RiskLevel }[]; risks: { dimension: string; level: RiskLevel; explanation: string }[]; next_steps: { order: number; title: string; description: string; owner?: string }[]; citations: { title: string; verification: string; url?: string }[]; confidence: string; risk_level: RiskLevel; handoff_recommended: boolean; disclaimer: string };
type Message = { id: string; sender: "user" | "ai" | "system"; content: string; structured?: LegalResponse; created_at: string };
type DocumentItem = { id: string; filename: string; status: string; sha256: string };
type Clause = { id: string; text: string; risk_color: string; risk_level: RiskLevel; category: string };
type ActionPlan = { next_best_action: string; known: string[]; unknown: string[]; options: { title: string; description: string; risk?: RiskLevel }[]; lawyer_questions: string[]; evidence_to_preserve: string[] };

let useMockApi = !API || API === "";

async function apiFetch(path: string, options: RequestInit = {}, accessToken?: string) {
  if (useMockApi) {
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 180));
    return mockFetch(path, options);
  }
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 2500);
  try {
    const headers = new Headers(options.headers);
    if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return await fetch(`${API}${path}`, { ...options, headers, signal: controller.signal });
  } catch {
    // If the real API is unreachable, fall back to mock
    useMockApi = true;
    await new Promise((r) => setTimeout(r, 200));
    return mockFetch(path, options);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [view, setView] = useState<View>("overview");
  const [matters, setMatters] = useState<Matter[]>([]);
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [response, setResponse] = useState<LegalResponse | null>(null);
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [brief, setBrief] = useState<LawyerBrief | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [language, setLanguage] = useState("en");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setAuthReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (user || demoMode) void loadMatters(); }, [user, demoMode]);

  async function token() { if (!supabase) return undefined; const { data } = await supabase.auth.getSession(); return data.session?.access_token; }
  async function loadMatters() { const result = await apiFetch("/api/v1/matters", {}, await token()).then((res) => res.json()); setMatters(result); }

  async function openMatter(matter: Matter) {
    setSelectedMatter(matter); setView("matters"); setActiveTab("overview");
    const result = await apiFetch(`/api/v1/matters/${matter.id}`, {}, await token()).then((res) => res.json());
    setMessages(result.messages || []); setPlan(result.action_plan || null);
    setTimeline(result.events || []); setBrief(null);
    const last = [...(result.messages || [])].reverse().find((item: Message) => item.structured)?.structured;
    setResponse(last || null);
  }

  async function createMatter(event: FormEvent) {
    event.preventDefault(); if (!description.trim()) return; setLoading(true); setNotice("Understanding the problem and preparing your matter...");
    const result = await apiFetch("/api/v1/matters", { method: "POST", body: JSON.stringify({ description, language, city: description.toLowerCase().includes("hyderabad") ? "Hyderabad" : undefined }) }, await token()).then((res) => res.json());
    setDescription(""); setResponse(result.response); setMatters((current) => [result.matter, ...current.filter((item) => item.id !== result.matter.id)]); await openMatter(result.matter); setActiveTab("overview"); setNotice("Matter created. Review the questions before taking a next step."); setLoading(false);
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault(); if (!selectedMatter || !message.trim()) return; setLoading(true); const content = message; setMessage("");
    const result = await apiFetch(`/api/v1/matters/${selectedMatter.id}/messages`, { method: "POST", body: JSON.stringify({ content, language }) }, await token()).then((res) => res.json());
    setResponse(result); 
    const aiAnswer = result.direct_answer || result.case_summary;
    setMessages((current) => [...current, { id: crypto.randomUUID(), sender: "user", content, created_at: new Date().toISOString() }, { id: crypto.randomUUID(), sender: "ai", content: aiAnswer, structured: result, created_at: new Date().toISOString() }]); 
    setLoading(false);
  }

  async function makePlan() {
    if (!selectedMatter) return; setLoading(true); const result = await apiFetch(`/api/v1/matters/${selectedMatter.id}/action-plan`, { method: "POST" }, await token()).then((res) => res.json()); setPlan(result); setActiveTab("action-plan"); setNotice("Action plan generated from the current matter facts."); setLoading(false);
  }

  async function addTimelineEvent(event: Pick<TimelineEvent, "event_date" | "title" | "description">) {
    if (!selectedMatter) return;
    const result = await apiFetch(`/api/v1/matters/${selectedMatter.id}/timeline`, { method: "POST", body: JSON.stringify(event) }, await token()).then((res) => res.json());
    setTimeline((current) => [...current, result].sort((a, b) => a.event_date.localeCompare(b.event_date)));
    setNotice("Timeline event saved as user-provided information.");
  }

  async function generateBrief() {
    if (!selectedMatter) return;
    setLoading(true);
    const result = await apiFetch(`/api/v1/matters/${selectedMatter.id}/lawyer-brief`, { method: "POST" }, await token()).then((res) => res.json());
    setBrief(result); setActiveTab("lawyer-prep"); setNotice("Preparation brief generated for professional review."); setLoading(false);
  }

  async function uploadDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file || !selectedMatter) return; setLoading(true); const body = new FormData(); body.append("file", file);
    const result = await apiFetch(`/api/v1/matters/${selectedMatter.id}/documents`, { method: "POST", body }, await token()).then((res) => res.json()); setDocuments((current) => [...current, result]); setNotice("Document queued. NyayaPath is reading it for clauses, dates and quality flags."); setLoading(false); void pollDocument(result.id);
  }

  async function pollDocument(documentId: string) {
    for (let attempt = 0; attempt < 30; attempt += 1) { await new Promise((resolve) => window.setTimeout(resolve, 650)); const result = await apiFetch(`/api/v1/documents/${documentId}/status`).then((res) => res.json()); setDocuments((current) => current.map((item) => item.id === documentId ? { ...item, status: result.status } : item)); if (result.status === "ready") { setClauses(await apiFetch(`/api/v1/documents/${documentId}/clauses`).then((res) => res.json())); setNotice("Document analysis is ready. Review the highlighted clauses carefully."); return; } if (result.status === "failed") return; }
  }

  if (!authReady) return <div className="loading-screen" role="status" aria-live="polite">Loading NyayaPath…</div>;
  if (!user && !demoMode) return <LoginScreen onDemo={() => setDemoMode(true)} />;
  const displayName = user?.email?.split("@")[0] || "Demo user";
  const goOverview = () => { setView("overview"); setSelectedMatter(null); };
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="sidebar"><div className="brand"><span className="brand-mark">N</span><span>NyayaPath</span></div><div className="workspace-label">LEGAL NAVIGATOR</div><button type="button" className="new-matter-button" onClick={goOverview}>+ New matter</button><nav className="side-nav" aria-label="Main navigation"><SideNavItem icon="⌂" label="Overview" active={view === "overview"} onClick={goOverview} /><SideNavItem icon="◫" label="My matters" active={view === "matters"} onClick={() => setView("matters")} count={matters.length} /><SideNavItem icon="▣" label="Documents" active={view === "documents"} onClick={() => setView("documents")} /><SideNavItem icon="✓" label="Action plans" active={view === "action-plan"} onClick={() => setView("action-plan")} /><SideNavItem icon="↗" label="Lawyer prep" active={view === "lawyer-prep"} onClick={() => { if (matters[0]) void openMatter(matters[0]).then(() => setActiveTab("lawyer-prep")); else setView("matters"); }} /></nav><div className="sidebar-bottom"><SideNavItem icon="⚙" label="Privacy & settings" active={view === "settings"} onClick={() => setView("settings")} /><div className="profile-mini"><span>{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>{demoMode ? "Local demo" : "Personal workspace"}</small></div><button type="button" aria-label="Sign out" onClick={async () => { if (supabase) await supabase.auth.signOut(); setUser(null); setDemoMode(false); }}>↪</button></div></div></aside>
    <div className="main-area"><header className="app-header"><div><span className="mobile-brand" aria-hidden="true">N</span><span className="header-kicker">{view === "overview" ? "OVERVIEW" : selectedMatter ? selectedMatter.title : view.replace("-", " ").toUpperCase()}</span></div><div className="header-actions"><span className="privacy-note">Legal information, not legal advice</span><select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Language"><option value="en">English</option><option value="hi">हिन्दी</option><option value="te">తెలుగు</option></select><button type="button" className="avatar" aria-label={`Profile for ${displayName}`}>{displayName.slice(0, 1).toUpperCase()}</button></div></header><main id="main-content" className="content">
      {view === "overview" && <Dashboard name={displayName} matters={matters} onOpen={openMatter} onNew={() => setDescription("My landlord has not returned my security deposit for three months in Hyderabad.")} description={description} setDescription={setDescription} onCreate={createMatter} loading={loading} />}
      {view === "matters" && selectedMatter && <MatterWorkspace matter={selectedMatter} response={response} messages={messages} message={message} setMessage={setMessage} activeTab={activeTab} setActiveTab={setActiveTab} onSend={sendMessage} onPlan={makePlan} onUpload={uploadDocument} onAddTimelineEvent={addTimelineEvent} onGenerateBrief={generateBrief} documents={documents} clauses={clauses} timeline={timeline} brief={brief} plan={plan} loading={loading} notice={notice} />}
      {view === "matters" && !selectedMatter && <MatterList matters={matters} onOpen={openMatter} onNew={goOverview} />}
      {view === "documents" && <DocumentsView matters={matters} onOpen={openMatter} />}{view === "action-plan" && <PlansView matters={matters} onOpen={openMatter} />}{view === "lawyer-prep" && <LawyerLanding matters={matters} onOpen={openMatter} />}{view === "settings" && <PlaceholderView eyebrow="PRIVACY CENTRE" title="Your information stays in your control." body="Consent, export, deletion, share-link management and audit history will live here. The current workspace is running in local demo storage." action="Back to overview" onAction={goOverview} />}
    </main><footer className="app-footer">Keep original documents. Verify important claims. Consider discussing your situation with a qualified lawyer.</footer></div>
  </div>;
}

function LoginScreen({ onDemo }: { onDemo: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login"); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); if (!supabase) { setError("Supabase credentials are not available. Use local demo mode or configure the project .env."); setBusy(false); return; } const result = mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password }); if (result.error) setError(result.error.message); else if (mode === "signup" && !result.data.session) setError("Account created. Check your email to confirm the account, then sign in."); setBusy(false); }
  return <div className="auth-page"><section className="auth-story"><div className="brand"><span className="brand-mark">N</span><span>NyayaPath</span></div><div className="auth-story-content"><div className="eyebrow">LEGAL INFORMATION FOR THE NEXT STEP</div><h1>Understand the situation.<br /><em>Prepare with confidence.</em></h1><p>A calm legal navigator for people in India. Turn a difficult problem into organised facts, documents, questions and possible next steps.</p><div className="story-points"><span>◉ Explain documents in plain language</span><span>◉ Keep sources and uncertainty visible</span><span>◉ Prepare for a lawyer conversation</span></div></div><div className="auth-disclaimer">This service provides general legal information and assistance. It does not replace a qualified lawyer.</div></section><section className="auth-panel"><div className="auth-panel-inner"><div className="card-kicker">{mode === "login" ? "WELCOME BACK" : "CREATE YOUR WORKSPACE"}</div><h2>{mode === "login" ? "Sign in to your matters" : "Start your private workspace"}</h2><p className="muted">Your matters, questions and documents belong in one organised place.</p><form onSubmit={submit} className="auth-form"><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Password<input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></label>{error && <div className="error-box">{error}</div>}<button className="primary wide" disabled={busy}>{busy ? "Working…" : mode === "login" ? "Sign in →" : "Create account →"}</button></form><div className="auth-switch">{mode === "login" ? "New to NyayaPath?" : "Already have an account?"}<button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>{mode === "login" ? "Create account" : "Sign in"}</button></div><div className="divider"><span>or</span></div><button className="demo-button" onClick={onDemo}>Continue in local demo mode</button><small className="muted demo-note">Demo mode lets you explore the dashboard and AI workflow without creating an account. Data is held only in memory.</small></div></section></div>;
}

function SideNavItem({ icon, label, active, onClick, count }: { icon: string; label: string; active: boolean; onClick: () => void; count?: number }) { return <button type="button" className={`side-nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} onClick={onClick}><span className="nav-icon" aria-hidden="true">{icon}</span><span>{label}</span>{count !== undefined && <small aria-label={`${count} ${label.toLowerCase()}`}>{count}</small>}</button>; }

function Dashboard({ name, matters, onOpen, onNew, description, setDescription, onCreate, loading }: { name: string; matters: Matter[]; onOpen: (matter: Matter) => void; onNew: () => void; description: string; setDescription: (value: string) => void; onCreate: (event: FormEvent) => void; loading: boolean }) { return <><section className="welcome"><div><div className="eyebrow">GOOD TO SEE YOU, {name.toUpperCase()}</div><h1>What would you like<br /><em>to work through?</em></h1><p>Start with what happened. NyayaPath will help you organise the problem before you decide what comes next.</p></div><div className="welcome-orbit"><span>13</span><small>steps from<br />problem to prep</small></div></section><section className="dashboard-grid"><div className="dashboard-main"><form className="start-card" onSubmit={onCreate}><span className="start-icon">+</span><span className="start-copy"><strong>Start a new legal matter</strong><small>Describe a situation in your own words</small><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Example: My landlord has not returned my deposit..." rows={2} /></span><button className="start-submit" type="submit" disabled={loading}>→</button></form><div className="section-heading"><div><div className="card-kicker">YOUR WORKSPACE</div><h2>Recent matters</h2></div><span className="muted">{matters.length} total</span></div>{matters.length === 0 ? <div className="empty-card"><div className="empty-icon">◌</div><h3>Your matters will appear here</h3><p>Create your first matter to see the legal case journey, questions, documents and action plan in one place.</p><button className="secondary" type="button" onClick={onNew}>Use a sample matter</button></div> : <div className="matter-cards">{matters.slice(0, 4).map((matter) => <MatterCard key={matter.id} matter={matter} onClick={() => onOpen(matter)} />)}</div>}</div><aside className="dashboard-side"><div className="stat-card"><div className="card-kicker">AT A GLANCE</div><div className="stats"><div><strong>{matters.length}</strong><small>matters</small></div><div><strong>{matters.filter((matter) => matter.risk_level === "HIGH" || matter.risk_level === "CRITICAL").length}</strong><small>need attention</small></div></div></div><div className="side-message"><span className="message-mark">i</span><div><strong>Start in everyday language</strong><p>You do not need to know the legal term. Facts, dates and documents are a good place to begin.</p></div></div></aside></section></>; }

function MatterCard({ matter, onClick }: { matter: Matter; onClick: () => void }) { const completed = Object.values(matter.journey_progress).filter((item) => item === "complete").length; return <button className="matter-card" onClick={onClick}><div className="matter-card-top"><span className={`risk risk-${matter.risk_level.toLowerCase()}`}>{matter.risk_level} attention</span><span className="matter-arrow">↗</span></div><h3>{matter.title}</h3><p>{matter.description}</p><div className="matter-card-bottom"><span>{matter.city || "Location to verify"}</span><span>{completed}/13 steps</span></div></button>; }
function MatterList({ matters, onOpen, onNew }: { matters: Matter[]; onOpen: (matter: Matter) => void; onNew: () => void }) { return <section><div className="page-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>My matters</h1><p>Each matter keeps the conversation, evidence, timeline and next steps together.</p></div><button className="primary" onClick={onNew}>+ New matter</button></div><div className="matter-cards full">{matters.map((matter) => <MatterCard key={matter.id} matter={matter} onClick={() => onOpen(matter)} />)}</div></section>; }

function MatterWorkspace({
  matter, response, messages, message, setMessage, activeTab, setActiveTab, onSend, onPlan, onUpload,
  onAddTimelineEvent, onGenerateBrief, documents, clauses, timeline, brief, plan, loading, notice,
}: {
  matter: Matter; response: LegalResponse | null; messages: Message[]; message: string;
  setMessage: (value: string) => void; activeTab: Tab; setActiveTab: (value: Tab) => void;
  onSend: (event: FormEvent) => void; onPlan: () => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onAddTimelineEvent: (event: Pick<TimelineEvent, "event_date" | "title" | "description">) => Promise<void>;
  onGenerateBrief: () => Promise<void>; documents: DocumentItem[]; clauses: Clause[];
  timeline: TimelineEvent[]; brief: LawyerBrief | null; plan: ActionPlan | null; loading: boolean; notice: string;
}) {
  const tabs: [Tab, string][] = [
    ["overview", "Overview"], ["chat", "AI chat"], ["documents", "Documents"],
    ["timeline", "Timeline"], ["action-plan", "Action plan"], ["lawyer-prep", "Lawyer prep"],
  ];
  return (
    <section>
      <div className="matter-workspace-header">
        <div>
          <button type="button" className="back-button" onClick={() => setActiveTab("overview")}>← Matter overview</button>
          <div className="eyebrow">ACTIVE MATTER</div>
          <h1>{matter.title}</h1>
          <p aria-live="polite">{notice || "Keep the facts, documents and questions together."}</p>
        </div>
        <div className={`large-risk risk-${matter.risk_level.toLowerCase()}`} aria-label={`${matter.risk_level} attention level`}>
          <span>{matter.risk_level}</span><small>attention level</small>
        </div>
      </div>
      <div className="matter-tabs" role="tablist" aria-label="Matter workspace">
        {tabs.map(([value, label]) => (
          <button type="button" role="tab" aria-selected={activeTab === value} className={activeTab === value ? "active" : ""} key={value} onClick={() => setActiveTab(value)}>
            {label}
          </button>
        ))}
      </div>
      {activeTab === "overview" && <OverviewPanel response={response} matter={matter} onChat={() => setActiveTab("chat")} onDocuments={() => setActiveTab("documents")} />}
      {activeTab === "chat" && <ChatPanel response={response} messages={messages} message={message} setMessage={setMessage} onSend={onSend} loading={loading} />}
      {activeTab === "documents" && <DocumentsPanel documents={documents} clauses={clauses} onUpload={onUpload} />}
      {activeTab === "timeline" && <TimelinePanel events={timeline} onAdd={onAddTimelineEvent} />}
      {activeTab === "action-plan" && <PlanPanel plan={plan} onPlan={onPlan} loading={loading} />}
      {activeTab === "lawyer-prep" && <LawyerBriefPanel brief={brief} onGenerate={onGenerateBrief} loading={loading} />}
    </section>
  );
}

function OverviewPanel({ response, matter, onChat, onDocuments }: { response: LegalResponse | null; matter: Matter; onChat: () => void; onDocuments: () => void }) { const completed = Object.values(matter.journey_progress).filter((item) => item === "complete").length; return <div className="workspace-grid"><div className="dashboard-main"><section className="card insight-card"><div className="response-head"><div><div className="card-kicker">CASE SUMMARY</div><h2>{response?.case_summary || matter.description}</h2></div><span className="verified-pill">{response?.confidence || "low"} confidence</span></div><div className="chips">{response?.legal_domains?.map((domain) => <span className="chip" key={domain.code}>{domain.name} · {Math.round(domain.confidence * 100)}%</span>)}<span className="chip">{response?.jurisdiction?.city || matter.city || "City to verify"}</span></div><div className="overview-actions"><button className="primary" onClick={onChat}>Ask the AI a question</button><button className="secondary" onClick={onDocuments}>Upload evidence</button></div></section><section className="card"><div className="section-heading"><div><div className="card-kicker">JOURNEY PROGRESS</div><h2>From problem to preparation</h2></div><strong className="journey-count">{completed}/13</strong></div><div className="progress-track"><span style={{ width: `${Math.max(completed / 13 * 100, 8)}%` }} /></div><div className="journey-mini">{["Problem", "Domain", "Jurisdiction", "Facts", "Documents", "Timeline", "Concepts", "Risk", "Missing", "Options", "Next steps", "Checklists", "Lawyer prep"].map((step, index) => <span className={index < completed ? "done" : index === completed ? "current" : ""} key={step}><b>{index < completed ? "✓" : index + 1}</b>{step}</span>)}</div></section></div><aside className="side-column"><SafetyCard /><RiskCard response={response} /></aside></div>; }

function FormattedChatMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="message-bubble-body">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("### ")) {
          return <h4 key={idx}>{trimmed.replace("### ", "")}</h4>;
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="chat-bullet">
              <b>•</b>
              <span>{formatMarkdownBold(trimmed.slice(2))}</span>
            </div>
          );
        }
        const numberedMatch = trimmed.match(/^(\d+[\.\)])\s*(.*)/);
        if (numberedMatch) {
          return (
            <div key={idx} className="chat-numbered">
              <b>{numberedMatch[1]}</b>
              <span>{formatMarkdownBold(numberedMatch[2])}</span>
            </div>
          );
        }
        if (trimmed === "") {
          return <div key={idx} className="chat-space" />;
        }
        return <p key={idx}>{formatMarkdownBold(trimmed)}</p>;
      })}
    </div>
  );
}

function formatMarkdownBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function ChatPanel({ response, messages, message, setMessage, onSend, loading }: { response: LegalResponse | null; messages: Message[]; message: string; setMessage: (value: string) => void; onSend: (event: FormEvent) => void; loading: boolean }) {
  const promptSuggestions = [
    "Can landlord deduct painting charges?",
    "What documents are needed for a legal notice?",
    "What is the limitation period to recover my money?",
    "Where to file: Police or Consumer Court?",
    "What should be written in a formal legal notice?"
  ];

  return (
    <div className="chat-layout">
      <section className="card chat-panel">
        <div className="chat-panel-head">
          <div>
            <div className="card-kicker">AI LEGAL NAVIGATOR</div>
            <h2>Ask about your situation</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span className="live-dot">● Connected</span>
            <span className="agent-pill">⚡ Guided legal assistant</span>
          </div>
        </div>

        <div className="messages" aria-live="polite" aria-label="Matter conversation">
          {messages.length === 0 && (
            <div className="assistant-message">
              <strong>Tell me what you want to understand.</strong>
              <p>I can help analyse your legal situation, explain statutory provisions under Indian law, check document requirements, and prepare questions for legal counsel.</p>
            </div>
          )}
          {messages.map((item) => (
            <div className={`message ${item.sender}`} key={item.id}>
              <span className="message-avatar">{item.sender === "user" ? "You" : "N"}</span>
              <div>
                {item.sender === "ai" ? (
                  <div className="message-bubble" style={{ background: "#f1f4f3", color: "#34434e", borderRadius: 10, padding: "12px 14px" }}>
                    <FormattedChatMessage content={item.content} />
                  </div>
                ) : (
                  <p>{item.content}</p>
                )}
                {item.structured && (
                  <div className="structured-mini">
                    <span>{item.structured.legal_domains?.[0]?.name || "Matter review"}</span>
                    <span>{item.structured.risk_level || "Review"} attention</span>
                    <span>{item.structured.citations?.length ? "Sources attached" : "Source verification pending"}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="quick-prompts">
          {promptSuggestions.map((promptText) => (
            <button
              key={promptText}
              type="button"
              className="prompt-pill"
              onClick={() => setMessage(promptText)}
            >
              + {promptText}
            </button>
          ))}
        </div>

        <form className="chat-composer" onSubmit={onSend}>
          <textarea
            aria-label="Ask a legal information question"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask a specific question (e.g., 'Can my landlord deduct painting charges?', 'What is the limitation period?')..."
            rows={2}
          />
          <div>
            <small>AI responds specifically to your question type & facts under Indian law</small>
            <button className="primary" disabled={loading || !message.trim()}>
              {loading ? "Analyzing…" : "Send message →"}
            </button>
          </div>
        </form>
        <p className="disclaimer">
          {response?.disclaimer || "This is general legal information, not legal advice. Consider discussing your situation with a qualified lawyer."}
        </p>
      </section>

      <aside className="side-column">
        <SafetyCard />
        <div className="card source-card">
          <div className="card-kicker">SOURCE STATUS</div>
          <h3>{response?.citations?.length ? "Verified sources attached" : "Verification is visible"}</h3>
          <p>{response?.citations?.length ? "Open the source chip beside a claim to inspect its passage." : "No verified legal passage is loaded for this response. NyayaPath will not invent a citation."}</p>
        </div>
      </aside>
    </div>
  );
}

function DocumentsPanel({ documents, clauses, onUpload }: { documents: DocumentItem[]; clauses: Clause[]; onUpload: (event: ChangeEvent<HTMLInputElement>) => void }) { return <div className="workspace-grid"><section className="card document-panel"><div className="response-head"><div><div className="card-kicker">DOCUMENT INTELLIGENCE</div><h2>Review your evidence</h2><p>PDF, DOCX and text uploads are processed for dates, entities, clauses and quality flags.</p></div><label className="upload-button">+ Upload document<input aria-label="Upload a matter document" type="file" accept=".pdf,.docx,.txt,.eml,.json" onChange={onUpload} /></label></div>{documents.length === 0 && <div className="drop-zone"><strong>Drop an agreement, receipt or notice here</strong><span>or use the upload button above</span></div>}<div className="document-list">{documents.map((document) => <div className="document-row" key={document.id}><span className="file-icon" aria-hidden="true">▤</span><div><strong>{document.filename}</strong><small>Private matter document</small></div><span className={`status-badge ${document.status}`}>{document.status}</span></div>)}</div>{clauses.length > 0 && <><div className="section-heading inline"><div><div className="card-kicker">CLAUSE REVIEW</div><h2>Potential review points</h2></div><span className="muted">{clauses.length} found</span></div><div className="clause-list">{clauses.map((clause) => <article className={`clause clause-${clause.risk_color}`} key={clause.id}><span className="clause-label">{clause.risk_level} · {clause.category}</span><p>{clause.text}</p><small>Check the full agreement and discuss important wording with a lawyer.</small></article>)}</div></>}</section><aside className="side-column"><div className="card side-card"><div className="card-kicker">QUALITY FLAGS</div><h3>What to check</h3><p>Unreadable pages, missing signatures, low OCR confidence and incomplete context should be resolved before relying on an analysis.</p></div><div className="card side-card"><div className="card-kicker">COLOUR LEGEND</div><div className="legend"><span className="legend-dot red" />High risk</div><div className="legend"><span className="legend-dot orange" />Needs attention</div><div className="legend"><span className="legend-dot blue" />Reference</div></div></aside></div>; }

function TimelinePanel({ events, onAdd }: { events: TimelineEvent[]; onAdd: (event: Pick<TimelineEvent, "event_date" | "title" | "description">) => Promise<void> }) {
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!date || !title.trim()) return;
    await onAdd({ event_date: date, title: title.trim(), description: description.trim() });
    setDate(""); setTitle(""); setDescription("");
  }
  return <div className="workspace-grid"><section className="card timeline-panel"><div className="card-kicker">EVIDENCE TIMELINE</div><h2>What happened, and when?</h2><p className="muted">Add dates from your own records. User-provided events are clearly marked and should be checked against the original source.</p><form className="timeline-form" onSubmit={submit}><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label>Event title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Agreement signed" required /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What happened? Where is the evidence?" rows={2} /></label><button className="primary" type="submit">Add timeline event</button></form><div className="timeline-list">{events.length === 0 ? <div className="empty-card"><div className="empty-icon">◷</div><h3>No timeline events yet</h3><p>Upload a document or add the first dated event from your records.</p></div> : events.map((event) => <article className="timeline-item" key={event.id}><div className="timeline-date">{event.event_date}</div><div><strong>{event.title}</strong><p>{event.description || "No description added."}</p><small>{event.source} · {event.verification_status} · {Math.round(event.confidence * 100)}% confidence</small></div></article>)}</div></section><aside className="side-column"><SafetyCard /><div className="card side-card"><div className="card-kicker">TIMELINE CHECK</div><h3>Keep the original</h3><p>Do not edit screenshots, exports, receipts, or agreements. Keep the original file beside any notes you add here.</p></div></aside></div>;
}

function LawyerBriefPanel({ brief, onGenerate, loading }: { brief: LawyerBrief | null; onGenerate: () => Promise<void>; loading: boolean }) {
  return <div className="workspace-grid"><section className="card brief-panel"><div className="card-kicker">LAWYER PREPARATION</div><h2>Prepare a clearer first conversation</h2>{!brief ? <><p className="muted">NyayaPath can organise the current issue, timeline, action plan, and questions into a review-ready preparation brief.</p><button className="primary" type="button" onClick={() => void onGenerate()} disabled={loading}>{loading ? "Preparing…" : "Generate preparation brief →"}</button></> : <><div className="brief-header"><div><span className="eyebrow">DRAFT FOR PROFESSIONAL REVIEW</span><h3>{brief.title}</h3></div><span className="status-badge ready">Prepared</span></div><div className="brief-section"><strong>Issue</strong><p>{brief.issue}</p></div><div className="brief-section"><strong>Jurisdiction to verify</strong><p>{[brief.jurisdiction.city, brief.jurisdiction.state].filter(Boolean).join(", ") || "Location not confirmed"} · {brief.jurisdiction.status}</p></div><div className="brief-section"><strong>Timeline entries</strong><p>{brief.timeline.length ? `${brief.timeline.length} event${brief.timeline.length === 1 ? "" : "s"} recorded` : "No timeline events recorded yet"}</p></div><div className="lawyer-questions"><h3>Questions to take to a lawyer</h3>{brief.questions.map((question) => <p key={question}>“{question}”</p>)}</div><p className="disclaimer">{brief.disclaimer}</p></>}</section><aside className="side-column"><SafetyCard /><div className="card side-card"><div className="card-kicker">HANDOFF BOUNDARY</div><p>This brief organises information; it does not select a lawyer, file a case, or determine the correct legal strategy.</p></div></aside></div>;
}

function PlanPanel({ plan, onPlan, loading }: { plan: ActionPlan | null; onPlan: () => void; loading: boolean }) { return <div className="workspace-grid"><section className="card plan-panel"><div className="card-kicker">ACTION ENGINE</div><h2>What can you do next?</h2>{!plan ? <><p className="muted">Generate a structured plan from the facts, documents and questions currently in this matter.</p><button className="primary" type="button" onClick={onPlan} disabled={loading}>{loading ? "Generating…" : "Generate action plan →"}</button></> : <><div className="next-action"><span>NEXT BEST ACTION</span><strong>{plan.next_best_action}</strong></div><div className="plan-columns"><div><h3>Known</h3>{plan.known.map((item) => <p className="check-item" key={item}>✓ {item}</p>)}</div><div><h3>Still to clarify</h3>{plan.unknown.map((item) => <p className="question-item" key={item}>? {item}</p>)}</div></div><div className="section-heading inline"><div><div className="card-kicker">POTENTIAL OPTIONS</div><h2>Possible paths</h2></div></div>{plan.options.map((option) => <div className="plan-option" key={option.title}><strong>{option.title}</strong><p>{option.description}</p></div>)}<div className="lawyer-questions"><h3>Questions for a lawyer</h3>{plan.lawyer_questions.map((question) => <p key={question}>“{question}”</p>)}</div></>}</section><aside className="side-column"><SafetyCard /><div className="card side-card"><div className="card-kicker">RISK CAVEAT</div><p>This score reflects the information provided and is not a prediction of any court outcome.</p></div></aside></div>; }

function DocumentsView({ matters, onOpen }: { matters: Matter[]; onOpen: (matter: Matter) => void }) { return <PlaceholderView eyebrow="DOCUMENTS" title="Your evidence belongs with its matter." body={matters.length ? "Open a matter to upload agreements, receipts, messages and notices. Each document will keep its page and clause context." : "Create a matter first, then upload the documents that help establish the facts."} action={matters.length ? "Open latest matter" : "Go to overview"} onAction={() => { if (matters.length) onOpen(matters[0]); }} />; }
function PlansView({ matters, onOpen }: { matters: Matter[]; onOpen: (matter: Matter) => void }) { return <PlaceholderView eyebrow="ACTION PLANS" title="Move from understanding to preparation." body={matters.length ? "Open a matter to generate an explainable action plan with known facts, missing information, evidence to preserve and questions for a lawyer." : "Your generated action plans will appear here after you create a matter."} action={matters.length ? "Open latest matter" : "Go to overview"} onAction={() => { if (matters.length) onOpen(matters[0]); }} />; }
function LawyerLanding({ matters, onOpen }: { matters: Matter[]; onOpen: (matter: Matter) => void }) { return <section className="placeholder-page"><div className="card placeholder-card"><div className="empty-icon">↗</div><div className="eyebrow">LAWYER PREPARATION</div><h1>Prepare for a better first conversation.</h1><p>{matters.length ? "Open a matter to generate a structured brief with the issue, timeline, action plan, and questions for professional review." : "Create a matter first, then NyayaPath can organise the facts and questions you may want to take to a qualified lawyer."}</p><button className="primary" type="button" onClick={() => { if (matters.length) onOpen(matters[0]); }}>{matters.length ? "Open latest matter" : "Go to overview"} →</button></div></section>; }
function PlaceholderView({ eyebrow, title, body, action, onAction }: { eyebrow: string; title: string; body: string; action: string; onAction: () => void }) { return <section className="placeholder-page"><div className="card placeholder-card"><div className="empty-icon">◌</div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{body}</p><button className="primary" onClick={onAction}>{action} →</button></div></section>; }
function SafetyCard() { return <div className="card side-card safety-card"><div className="card-kicker">SAFETY BOUNDARY</div><h3>Information, not a lawyer</h3><p>NyayaPath explains and organises. It does not guarantee outcomes, file anything for you or replace qualified legal advice.</p><a href="https://112.gov.in/" target="_blank" rel="noreferrer">Immediate danger? Call 112 →</a></div>; }
function RiskCard({ response }: { response: LegalResponse | null }) { return <div className="card side-card"><div className="card-kicker">RISK LENS</div>{response?.risks.length ? response.risks.map((risk) => <div className="risk-item" key={risk.dimension}><div><strong>{risk.dimension}</strong><span className={`risk risk-${risk.level.toLowerCase()}`}>{risk.level}</span></div><p>{risk.explanation}</p></div>) : <p className="muted">Risk dimensions will appear after the matter is reviewed.</p>}</div>; }
