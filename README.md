<div align="center">

# NyayaPath

### AI Legal Navigator for India

**Understand the problem. Organise the evidence. Prepare the next conversation.**

[![Live demo](https://img.shields.io/badge/Live_demo-Firebase-FFCA28?logo=firebase&logoColor=111827)](https://solution-challange-3897c.web.app/)
[![Next.js](https://img.shields.io/badge/Next.js-15.4.6-111827?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Supabase-ready-3ECF8E?logo=supabase&logoColor=111827)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

An India-focused LegalTech prototype that turns a plain-language legal problem into a structured Matter: a guided case journey containing the situation, legal domain signals, jurisdiction, missing facts, documents, risks, options, next steps, and lawyer questions.

**[Open the live demo](https://solution-challange-3897c.web.app/)** · **[Run locally](#quick-start)** · **[Explore the API](#api-reference)** · **[See the roadmap](#implementation-status)**

</div>

> **Important:** NyayaPath provides general legal information and organisational assistance. It is not a law firm, does not replace a qualified lawyer, does not guarantee an outcome, and must not be relied on as a substitute for professional legal advice.

## Table of contents

- [What NyayaPath does](#what-nyayapath-does)
- [Product journey](#product-journey)
- [Feature overview](#feature-overview)
- [Architecture](#architecture)
- [Technology](#technology)
- [Repository map](#repository-map)
- [Quick start](#quick-start)
- [Environment configuration](#environment-configuration)
- [Using the demo](#using-the-demo)
- [API reference](#api-reference)
- [Database and security model](#database-and-security-model)
- [Safety and responsible AI](#safety-and-responsible-ai)
- [Testing and quality checks](#testing-and-quality-checks)
- [Deployment](#deployment)
- [Implementation status](#implementation-status)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## What NyayaPath does

Legal information is often difficult to find, difficult to interpret, and difficult to turn into a sensible next step. NyayaPath is designed as a legal navigation system, not a generic chat screen.

The user can describe a situation in ordinary language—for example, “my landlord has not returned my deposit”—and the product organises the conversation into a guided workflow:

| User need | NyayaPath response |
| --- | --- |
| What kind of problem is this? | Multi-label legal-domain signals such as Property, Consumer, Employment, Cyber, Business, or Family. |
| What facts matter? | A structured case summary, important facts, missing facts, and explanations of why questions are being asked. |
| What should I collect? | A document checklist and an upload flow for agreements, notices, receipts, messages, and other evidence. |
| What should I do next? | Explainable risks, potential options, evidence-preservation guidance, an action plan, and lawyer questions. |
| How do I prepare for a lawyer? | A structured brief payload containing the issue, jurisdiction status, timeline, action plan, and questions. |
| Can I trust this legal claim? | Verification-aware response fields and an explicit refusal path when a claim cannot be verified from the available source material. |

## Product journey

Every interaction becomes a Matter. A Matter is the central object that connects the conversation, documents, timeline, risk, action plan, and lawyer preparation.

~~~mermaid
flowchart LR
    A[Real-life problem] --> B[Understand the problem]
    B --> C[Classify legal domain]
    C --> D[Infer jurisdiction]
    D --> E[Collect facts]
    E --> F[Upload evidence]
    F --> G[Extract dates and clauses]
    G --> H[Explain risks and options]
    H --> I[Prepare an action plan]
    I --> J[Prepare lawyer questions]
~~~

The intended long-term journey also includes verified legal retrieval, clause-level document comments, contradictions, deadlines, law-version change detection, multilingual assistance, consent-based sharing, and human-lawyer handoff.

## Feature overview

### Working in the current MVP

| Surface | What is available now |
| --- | --- |
| Authentication | Supabase email/password login and sign-up when configured, plus local demo mode. |
| Dashboard | Matter list, overview cards, sidebar navigation, progress indicators, risk lens, and new-matter intake. |
| Matter intake | Plain-language description, title generation, heuristic domain classification, jurisdiction inference, structured response, and journey progress. |
| AI Legal Chat | Follow-up questions, structured legal response fields, suggested prompts, simple formatting, risk and source-status panels, and a legal-information disclaimer. |
| Document intelligence | PDF, DOCX, TXT, CSV, EML, and JSON extraction; upload limits; asynchronous status; date and amount extraction; clause segmentation; risk-coloured review records; comment metadata. |
| Timeline | Dates extracted from uploaded documents become partial-confidence timeline events; users can add events through the API. |
| Action plan | Known facts, unknown facts, potential options, documents required, evidence to preserve, risks, next-best action, and lawyer questions. |
| Lawyer preparation | A structured brief payload with issue, jurisdiction status, timeline, action plan, questions, and a mandatory generated-draft disclaimer. |
| Safety boundary | No guarantees, no invented citation objects, visible uncertainty, emergency link, and repeated legal-information disclaimers. |
| Hosting | Static Next.js export configured for Firebase Hosting. |

### Planned or not yet production-wired

| Capability | Current state |
| --- | --- |
| Persistent application data | Supabase migrations and RLS policies are prepared; the running API currently uses an in-memory MemoryStore. |
| Verified RAG | corpus/sources.json is a source registry only. Official passages still need ingestion, checksums, section-aware chunking, retrieval, and citation verification. |
| OCR | Native PDF/DOCX/text extraction is implemented. Image and scanned-document OCR is a planned extension. |
| Full document viewer | Clause and comment records are available; a PDF/DOCX split viewer with anchored highlights and annotated export is planned. |
| Contract comparison | Database schema groundwork exists; two-document semantic diff and playbook comparison are planned. |
| Deadlines and reminders | Schema groundwork exists; the complete deadline centre, reminders, and .ics export are planned. |
| Law-change detection | A small IPC/CrPC/IEA-to-current-reference response exists; official version timelines and mappings still require verified ingestion. |
| Voice and translation | Configuration flags and language selection exist; production speech, glossary-preserving translation, and evaluation are planned. |
| Lawyer marketplace | Intentionally not implemented. Any future directory or marketplace must remain clearly marked MOCK until separately designed and verified. |

## Architecture

### Current runtime

~~~mermaid
flowchart TB
    U[User browser]
    W[Next.js static web app]
    A[FastAPI API]
    S[MemoryStore]
    L[Heuristic legal engine]
    D[Document services]
    R[LLM router]
    AUTH[Supabase Auth optional]
    CORPUS[Source registry]

    U --> W
    W -->|REST or SSE| A
    W -->|fallback| W
    W --> AUTH
    A --> S
    A --> L
    A --> D
    A -. optional provider path .-> R
    A --> CORPUS
~~~

The web client has a browser-safe fallback in `apps/web/lib/mockApi.ts`, which makes the static demo usable when the API is not running. When the API is configured, matter intake, follow-up chat, streaming chat, explanations, and action plans call the server-side Gemini/OpenAI router with structured JSON output. Responses are schema-validated and remain verification-gated: model output cannot add free-form citations or downgrade a critical risk. The fallback is intentionally labelled as local reasoning and is used only when the API or provider is unavailable. The product should not be described as a production RAG system until corpus ingestion, verified passage retrieval, authenticated persistence, and access controls are connected.

### Target production direction

~~~mermaid
flowchart LR
    UI[Next.js web app] --> AUTH[Supabase Auth]
    UI --> API[FastAPI application]
    API --> DB[(Supabase Postgres plus pgvector)]
    API --> STORE[Private object storage]
    API --> QUEUE[Worker queue]
    QUEUE --> DOCS[OCR and extraction]
    QUEUE --> RAG[Official-source ingestion]
    RAG --> VERIFY[Citation verification]
    API --> VERIFY
    API --> OBS[Audit logs and monitoring]
~~~

## Technology

| Layer | Technology | Role |
| --- | --- | --- |
| Web | Next.js 15.4.6, React 19.1.0, TypeScript 5.8 | Static export, auth screens, dashboard, workspace, chat, documents, action plan, and lawyer-prep UI. |
| Styling | CSS design tokens in apps/web/app/globals.css | Editorial visual system, responsive layout, cards, risk labels, navigation, and mobile behaviour. |
| API | FastAPI 0.115, Uvicorn, Pydantic | Health/config, matter flow, chat, SSE progress, uploads, explanations, timeline, action plan, brief, and share stub. |
| Legal reasoning | Python rule-based services | Domain classification, jurisdiction inference, missing-fact questions, risk items, options, and next steps. |
| Documents | PyMuPDF, python-docx, regex extraction | Native PDF/DOCX/text extraction, dates, amounts, clauses, quality flags, and comments. |
| Auth and data model | Supabase Auth, PostgreSQL, pgvector, RLS SQL | Auth client and production-oriented schema/security foundation. Runtime persistence is the next integration step. |
| Model integrations | Configurable Gemini/OpenAI router | Reachable server-side provider path for matter intake, chat, streaming chat, explanations, and action plans; provider/model names come from environment variables. |
| Deployment | Firebase Hosting, Docker Compose | Static web hosting and local full-stack container workflow. |
| Quality | Pytest, Ruff, TypeScript build | API unit tests, Python linting, and production web build validation. |

## Repository map

~~~text
legal-navigator/
├── apps/
│   ├── api/
│   │   ├── app/
│   │   │   ├── main.py              # FastAPI routes and document task
│   │   │   ├── schemas.py            # Pydantic contracts
│   │   │   ├── store.py              # Demo MemoryStore
│   │   │   ├── config.py             # Environment settings
│   │   │   └── services/
│   │   │       ├── legal.py          # Domain and response engine
│   │   │       ├── documents.py      # Extraction and review metadata
│   │   │       └── llm.py            # Gemini/OpenAI router
│   │   ├── tests/test_legal.py
│   │   └── requirements.txt
│   └── web/
│       ├── app/page.tsx              # Login, dashboard, workspace and panels
│       ├── app/globals.css           # Product visual system
│       ├── lib/mockApi.ts             # Static demo fallback
│       ├── lib/supabase.ts            # Optional browser client
│       └── next.config.mjs            # Static export and public env
├── corpus/                            # Source registry and ingestion contract
├── supabase/migrations/               # Schema, RLS, seed, hardening
├── docs/BUILD_STATUS.md               # Implementation audit
├── evals/golden.json                  # Seed evaluation cases
├── docker-compose.yml                 # Web plus API containers
├── firebase.json                      # Firebase Hosting config
├── Makefile                           # Development shortcuts
├── .env.example                       # Safe configuration template
└── LICENSE                            # GPL-3.0
~~~

## Quick start

### Prerequisites

- Node.js 20 or newer
- npm
- Python 3.12 or newer
- Git
- Docker Desktop (optional)
- A Supabase project (optional for local demo mode; required for real email/password auth)

### 1. Clone and configure

~~~bash
git clone https://github.com/rajender-007/Vidhu-Mithra.git
cd Vidhu-Mithra/legal-navigator
~~~

Copy the environment template:

~~~powershell
Copy-Item .env.example .env
~~~

macOS/Linux:

~~~bash
cp .env.example .env
~~~

Fill in the values described in Environment configuration. Never commit .env or any API-key file.

### 2. Start the API

~~~powershell
cd apps/api
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
~~~

macOS/Linux activation:

~~~bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
~~~

Verify it at http://localhost:8000/health.

### 3. Start the web app

Open a second terminal:

~~~powershell
cd apps/web
npm install
npm run dev
~~~

Open http://localhost:3000.

If Supabase is not configured, choose Local demo mode. If the API is unavailable, the browser falls back to the in-memory demo adapter.

### 4. One-command or Docker workflows

If GNU Make is available:

~~~bash
make install
make dev
~~~

With Docker Desktop:

~~~bash
docker compose up --build
~~~

The web app is exposed on port 3000 and the API on port 8000 by default.

## Environment configuration

The root .env.example is the canonical template. The API reads the root .env through pydantic-settings; the Next.js build exposes only NEXT_PUBLIC_* values to the browser.

| Variable group | Variables | Required for |
| --- | --- | --- |
| Supabase public client | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY | Email/password login and browser auth session. |
| Supabase server | SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, SUPABASE_URL | Future authenticated persistence and privileged processing. Keep server-only. |
| Model providers | GEMINI_API_KEY, OPENAI_API_KEY, provider/model variables | Optional provider calls through the API router. |
| Static demo AI | NEXT_PUBLIC_ENABLE_EXTERNAL_AI | Keep false by default; enables an external browser fallback only when explicitly configured. |
| Indic language/voice | SARVAM_API_KEY, ENABLE_VOICE_INPUT | Future speech and language workflows. |
| App and networking | APP_ENV, APP_DEBUG, ports, CORS_ORIGINS | Runtime and local networking. |
| Limits and privacy | MAX_UPLOAD_SIZE_MB, ENABLE_PII_REDACTION, ENABLE_TELEMETRY | Upload and operational policy. |

Recommended local defaults:

~~~dotenv
APP_ENV=development
APP_DEBUG=true
API_PORT=8000
WEB_PORT=3000
API_BASE_URL=http://localhost:8000
WEB_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:3000
~~~

## Using the demo

The clearest demonstration scenario is a security-deposit dispute:

1. Open the live demo or local web app.
2. Choose Local demo mode if Supabase is not configured.
3. Start a matter with: My landlord has not returned my security deposit for three months in Hyderabad.
4. Review the detected Property & Real Estate domain and Telangana/Hyderabad jurisdiction signal.
5. Ask a follow-up question in the chat.
6. Upload a PDF, DOCX, or TXT file containing dates, amounts, agreement terms, or communications.
7. Review processing status, extracted clauses, risk colour, and comments.
8. Generate an action plan and review missing facts, evidence, options, and lawyer questions.

Other useful scenarios include employment termination, consumer refund, UPI/cyber fraud, startup NDA review, and family-related information requests. The current implementation uses deterministic heuristic logic; a keyword match is not a verified legal conclusion.

## API reference

The default API base URL is http://localhost:8000. Interactive FastAPI documentation is available at /docs.

### Health and discovery

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /health | Runtime health, storage mode, integrations, and verification policy. |
| GET | /api/v1/config | Public application name, languages, and feature flags. |
| GET | /api/v1/research/search?query=... | Source registry lookup; not verified legal passages. |
| GET | /api/v1/laws/{instrument}/versions | Placeholder law-version response requiring official verification. |

### Matter and conversation

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/v1/matters | List in-memory matters. |
| POST | /api/v1/matters | Create a matter and first structured response. |
| GET | /api/v1/matters/{matter_id} | Matter, messages, events, and action plan. |
| GET | /api/v1/matters/{matter_id}/messages | Conversation history. |
| POST | /api/v1/matters/{matter_id}/messages | Follow-up message and structured response. |
| POST | /api/v1/matters/{matter_id}/messages/stream | SSE progress and response events. |
| POST | /api/v1/explain | Explain text at level 1–4 and selected language. |

### Documents and evidence

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/v1/matters/{matter_id}/documents | Upload and queue a supported file. |
| GET | /api/v1/documents/{document_id}/status | Processing status, metadata, and quality flags. |
| GET | /api/v1/documents/{document_id}/clauses | Segmented clauses and risk labels. |
| GET | /api/v1/documents/{document_id}/comments | Generated clause-review comments. |
| GET | /api/v1/matters/{matter_id}/timeline | Date-derived and user-added events. |
| POST | /api/v1/matters/{matter_id}/timeline | Add a timeline event. |

### Preparation and sharing

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/v1/matters/{matter_id}/action-plan | Read the current action plan. |
| POST | /api/v1/matters/{matter_id}/action-plan | Generate an action plan. |
| POST | /api/v1/matters/{matter_id}/lawyer-brief | Generate a lawyer-preparation payload. |
| POST | /api/v1/matters/{matter_id}/share | Expiring read-only share-link stub, explicitly marked mock: true. |

## Database and security model

The SQL migrations describe the production-oriented data model even though the current demo API uses memory storage.

| Migration | Responsibility |
| --- | --- |
| 001_extensions_and_enums.sql | UUID/pgvector extensions and status, risk, comment, verification, and deadline enums. |
| 002_core_tables.sql | Profiles, matters, messages, documents, pages, chunks, entities, clauses, comments, evidence, events, sources, citations, plans, deadlines, briefs, consents, audit logs, model runs, comparisons, and share links. |
| 003_rls_policies.sql | Row Level Security, profile trigger, matter membership checks, and access policies. |
| 004_seed_data.sql | Seed taxonomy and reference data. |
| 005_hardening.sql | updated_at triggers, least-privilege grants, and operational indexes. |

Privacy principles represented in the project:

- .env, API keys, build output, dependencies, and user-uploaded documents are excluded from Git.
- The service-role key is server-only and must never be placed in a NEXT_PUBLIC_* variable.
- Matter access is designed around owner and participant membership checks.
- User data tables are revoked from anonymous Data API access in the hardening migration.
- Upload processing stores SHA-256 metadata and enforces a configurable size limit.
- Share links are intended to be read-only and expiring; the current endpoint is a labelled mock stub.
- The legal source registry explicitly says that registered URLs are not verified passages.

## Safety and responsible AI

NyayaPath is designed around a conservative legal-information boundary:

1. **No fabricated authorities:** empty or unverified citation arrays are preferable to invented sections, judgments, URLs, or quotations.
2. **Uncertainty is visible:** jurisdiction may be confirmed, inferred, or unknown; confidence and risk are explicit.
3. **Potential options are not instructions:** action-plan options include verification questions and evidence requirements.
4. **No outcome guarantees:** risk is an explainable information-state signal, not a prediction of a court result.
5. **Safety escalation:** urgent safety language produces a critical safety item and points users toward appropriate emergency support.
6. **Prompt-injection awareness:** uploaded documents are evidence, not system instructions; ingestion must treat their contents as untrusted data.
7. **Human review:** generated drafts and lawyer briefs carry a professional-review disclaimer.

### Demo-mode data warning

The current demo stores matters in process memory and may use the browser fallback when the API is not reachable. Do not enter real sensitive legal documents, personal identifiers, financial information, or confidential client material into the public demo. A production deployment must connect authenticated persistence, private storage, access controls, retention rules, and a reviewed model/data-processing policy before accepting real cases.

## Testing and quality checks

Run API tests and linting:

~~~bash
cd apps/api
python -m pytest tests/ -v
python -m ruff check .
~~~

Build the web application:

~~~bash
cd apps/web
npm install
npm run build
~~~

Or use the root shortcuts:

~~~bash
make test
make lint
make build
~~~

The API tests cover rental/deposit domain classification, absence of fabricated citations for unsupported claims, and multi-label classification. Before production, add RLS integration tests, official-source citation tests, OCR fixtures, prompt-injection tests, accessibility checks, browser end-to-end tests, load tests, and a reviewed legal evaluation set.

## Deployment

### Firebase Hosting

The web application is configured as a static Next.js export in apps/web/next.config.mjs. Firebase serves apps/web/out using firebase.json.

~~~bash
cd apps/web
npm install
npm run build
cd ../..
firebase use solution-challange-3897c
firebase deploy --only hosting --project solution-challange-3897c
~~~

If the frontend should call a hosted API, set NEXT_PUBLIC_API_BASE_URL before the build. Static hosting does not run FastAPI; deploy the API separately and configure CORS for the deployed origin.

### Docker Compose

~~~bash
docker compose up --build
~~~

This starts web and API containers using the root .env. It is a local/demo orchestration layer, not a complete production deployment platform.

### Production hardening checklist

- Apply and verify all Supabase migrations in a non-production environment first.
- Replace MemoryStore with authenticated repository methods and private object storage.
- Add worker-backed document processing with retry, timeout, and antivirus controls.
- Ingest only approved official sources with retrieval dates, checksums, versions, and licences.
- Verify every citation against a stored passage and jurisdiction/version filter.
- Add rate limiting, structured logs, audit review, secrets management, backups, and monitoring.
- Complete accessibility, privacy, threat-model, prompt-injection, and legal-domain evaluation reviews.
- Re-check emergency contacts and every public legal resource before launch.

## Implementation status

The repository intentionally records an MVP rather than claiming the complete master specification is production-finished.

~~~text
Phase 0  Foundations                         ████████████████████  MVP slice
Phase 1  Matter intake and chat              ████████████████████  MVP slice
Phase 2  Corpus, RAG and citations            ████████░░░░░░░░░░░░  Foundation only
Phase 3  Document pipeline                    ████████████████░░░░  Thin working slice
Phase 4  Viewer and clause comments           ████████░░░░░░░░░░░░  Data/UI slice
Phase 5  Timeline, evidence, contradictions   ████████░░░░░░░░░░░░  Timeline slice
Phase 6  Risk, plans and lawyer brief         ████████████░░░░░░░░  Thin working slice
Phase 7  Comparison and playbook              ██░░░░░░░░░░░░░░░░░░  Schema groundwork
Phase 8  Law-change detection                 ████░░░░░░░░░░░░░░░░  Placeholder response
Phase 9  Multilingual and voice               ██░░░░░░░░░░░░░░░░░░  Configuration only
Phase 10 Handoff, hardening and demo          ██████░░░░░░░░░░░░░░  Demo deployment
~~~

The authoritative implementation notes live in [docs/BUILD_STATUS.md](docs/BUILD_STATUS.md). When a feature is simulated, the code and documentation label it as a demo, fallback, registry, placeholder, or mock.

## Roadmap

1. Connect authenticated matters, messages, documents, and plans to Supabase with RLS tests.
2. Build the official-source ingestion job and verified section-level corpus.
3. Add private storage, signed URLs, OCR fallback, page provenance, and a worker queue.
4. Build the split document viewer, anchored comments, filters, replies, and annotated export.
5. Add contradictions, deadlines, reminders, calendar export, and explainable risk persistence.
6. Implement two-document comparison, playbook deviations, law-version mappings, multilingual evaluation, and consent-based handoff.
7. Add observability, cost tracking, accessibility testing, adversarial evaluation, and production deployment controls.

## Contributing

1. Create a branch from main.
2. Keep secrets and real user documents out of Git.
3. Add or update tests for behaviour changes.
4. Run API tests, Ruff, and the web production build before opening a pull request.
5. Keep legal claims source-aware and mark every mock or placeholder clearly.

## License

NyayaPath is distributed under the [GNU General Public License v3.0](LICENSE).

## Disclaimer

NyayaPath is an educational and organisational software project for legal information. It does not provide legal advice, create an advocate-client relationship, file complaints or cases, guarantee outcomes, or determine the correct forum for a matter. Always verify current law, jurisdiction, deadlines, emergency contacts, and important documents with an appropriately qualified professional.
