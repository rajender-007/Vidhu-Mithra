# NyayaPath build status

## Implemented in this workspace

- Phase 0 foundation: monorepo folders, environment template, Dockerfiles, Makefile, API and web entry points.
- Phase 1 vertical slice: matter creation, heuristic multi-label domain classification, jurisdiction inference, structured legal response, follow-up chat and journey tracker.
- Phase 2 safety boundary: citation-required policy, explicit refusal state for missing verified source passages, source registry and golden/adversarial seed data.
- Phase 3 document slice: PDF/DOCX/TXT extraction, upload limits, asynchronous processing status, clause segmentation, entity extraction and quality flags.
- Phase 4 viewer data: risk-coloured clause records and anchored comment metadata for the frontend review list.
- Phase 5 thin slice: timeline events derived from extracted dates and editable timeline endpoint.
- Phase 6 thin slice: explainable risk items, action plan and lawyer preparation brief payload, plus read-only share-link stub marked MOCK.
- Frontend workspace: Supabase email/password login, local demo mode, dashboard/sidebar navigation, matter workspace tabs, live API-backed AI chat, document upload/status/clauses and action-plan views.
- Alignment and reliability pass: usable evidence timeline and lawyer-preparation brief tabs, server-generated timeline IDs, verification-pending source labels, safer unverified fallback responses, opt-in external browser AI, and expanded API/document tests.
- GenAI alignment pass: reachable matter intake, follow-up chat, streamed chat, explanation, and action-plan routes now call the configured Gemini/OpenAI `LLMRouter` with structured JSON prompts. Model output is schema-validated, citation-gated, risk-preserving, and falls back to the deterministic safety response on missing credentials, timeout, invalid JSON, or validation failure.

## Current runtime mode

The demo uses an in-memory matter store so it can run immediately even before the Supabase migrations are applied. API keys are loaded from the project `.env`, but secrets are never returned to the browser. The browser uses only the Supabase public key for auth; the API provider router invokes Gemini or OpenAI when a server-side key is configured; legal responses remain verification-gated and do not accept free-form model citations. Static hosting defaults to the safe browser fallback when no API base URL is configured; external browser AI is disabled unless `NEXT_PUBLIC_ENABLE_EXTERNAL_AI=true` is explicitly configured.

## Next implementation sequence

1. Apply and test Supabase migrations, then replace the memory store with authenticated repository methods.
2. Build the official-source ingestion job and verified legal passage corpus.
3. Add persistent Storage uploads, signed URLs, realtime processing status and RLS integration tests.
4. Add the full PDF/DOCX split viewer, annotated exports, comparison/playbook engine, law-version scanner, multilingual evaluation and production handoff.
