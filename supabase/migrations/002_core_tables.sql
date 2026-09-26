-- ============================================================
-- Migration 002: Core Tables
-- ============================================================

-- 1. profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role user_role DEFAULT 'citizen',
    preferred_language TEXT DEFAULT 'en',
    state TEXT,
    city TEXT,
    reading_level reading_level DEFAULT 'normal',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. legal_domains
CREATE TABLE IF NOT EXISTS legal_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES legal_domains(id) ON DELETE SET NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    sub_areas TEXT[] DEFAULT '{}',
    intake_schema JSONB DEFAULT '{}'::jsonb,
    checklist_templates JSONB DEFAULT '[]'::jsonb,
    trusted_sources JSONB DEFAULT '[]'::jsonb,
    risk_rubric JSONB DEFAULT '{}'::jsonb,
    handoff_triggers JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. jurisdictions
CREATE TABLE IF NOT EXISTS jurisdictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES jurisdictions(id) ON DELETE SET NULL,
    country TEXT NOT NULL DEFAULT 'India',
    state TEXT,
    district TEXT,
    city TEXT,
    court_authority TEXT,
    level TEXT NOT NULL DEFAULT 'state',
    code TEXT UNIQUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. matters
CREATE TABLE IF NOT EXISTS matters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status matter_status DEFAULT 'active',
    primary_domain_id UUID REFERENCES legal_domains(id) ON DELETE SET NULL,
    secondary_domains JSONB DEFAULT '[]'::jsonb,
    jurisdiction_id UUID REFERENCES jurisdictions(id) ON DELETE SET NULL,
    stage matter_stage DEFAULT 'intake',
    risk_level risk_level DEFAULT 'LOW',
    desired_outcome TEXT,
    journey_progress JSONB DEFAULT '{"1_problem": "in_progress", "2_domain": "not_started", "3_jurisdiction": "not_started", "4_facts": "not_started", "5_documents": "not_started", "6_timeline": "not_started", "7_concepts": "not_started", "8_risk": "not_started", "9_missing": "not_started", "10_options": "not_started", "11_next_steps": "not_started", "12_checklists": "not_started", "13_lawyer_prep": "not_started"}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_matters_owner_status ON matters(owner_id, status);

-- 5. matter_participants
CREATE TABLE IF NOT EXISTS matter_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role participant_role NOT NULL DEFAULT 'viewer',
    invited_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(matter_id, user_id)
);

-- 6. messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    sender message_sender NOT NULL,
    content TEXT NOT NULL,
    language TEXT DEFAULT 'en',
    structured JSONB DEFAULT '{}'::jsonb,
    model_run_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_matter_created ON messages(matter_id, created_at);

-- 7. documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    mime TEXT NOT NULL,
    doc_type TEXT,
    status document_status DEFAULT 'queued',
    page_count INT DEFAULT 0,
    language TEXT DEFAULT 'en',
    ocr_confidence NUMERIC(5,2),
    summary TEXT,
    quality_flags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(matter_id, sha256)
);

-- 8. document_pages
CREATE TABLE IF NOT EXISTS document_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_no INT NOT NULL,
    text TEXT,
    ocr_confidence NUMERIC(5,2),
    image_path TEXT,
    layout JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. document_chunks
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    page_no INT,
    chunk_index INT NOT NULL,
    text TEXT NOT NULL,
    embedding vector(768),
    tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
    bbox JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_tsv ON document_chunks USING GIN(tsv);

-- 10. document_entities
CREATE TABLE IF NOT EXISTS document_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    normalized_value TEXT,
    page_no INT,
    bbox JSONB,
    confidence NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. document_clauses
CREATE TABLE IF NOT EXISTS document_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    clause_no TEXT,
    heading TEXT,
    text TEXT NOT NULL,
    category TEXT,
    offsets JSONB,
    page_no INT,
    bbox JSONB,
    risk_color clause_risk_color DEFAULT 'blue',
    risk_level risk_level DEFAULT 'LOW',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. document_comments
CREATE TABLE IF NOT EXISTS document_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clause_id UUID REFERENCES document_clauses(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    matter_id UUID REFERENCES matters(id) ON DELETE CASCADE,
    author_type comment_author_type NOT NULL DEFAULT 'ai',
    user_id UUID REFERENCES auth.users(id),
    color clause_risk_color NOT NULL DEFAULT 'blue',
    risk_level risk_level NOT NULL DEFAULT 'LOW',
    body TEXT NOT NULL,
    why_it_matters TEXT,
    checks JSONB DEFAULT '[]'::jsonb,
    lawyer_question TEXT,
    status comment_status DEFAULT 'active',
    parent_id UUID REFERENCES document_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. evidence
CREATE TABLE IF NOT EXISTS evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    source TEXT,
    captured_at TIMESTAMPTZ,
    sha256 TEXT,
    reliability TEXT DEFAULT 'medium',
    duplicate_of UUID REFERENCES evidence(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. case_events
CREATE TABLE IF NOT EXISTS case_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    event_date DATE NOT NULL,
    date_precision date_precision DEFAULT 'exact',
    title TEXT NOT NULL,
    description TEXT,
    source_type TEXT NOT NULL,
    source_ref TEXT,
    verification_status verification_status DEFAULT 'unverified',
    confidence NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. legal_sources
CREATE TABLE IF NOT EXISTS legal_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL,
    title TEXT NOT NULL,
    authority TEXT NOT NULL,
    jurisdiction_id UUID REFERENCES jurisdictions(id) ON DELETE SET NULL,
    url TEXT,
    published_date DATE,
    effective_from DATE,
    effective_to DATE,
    version TEXT,
    status TEXT DEFAULT 'active',
    checksum TEXT,
    license TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. legal_source_chunks
CREATE TABLE IF NOT EXISTS legal_source_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES legal_sources(id) ON DELETE CASCADE,
    instrument TEXT NOT NULL,
    section_ref TEXT,
    text TEXT NOT NULL,
    embedding vector(768),
    tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
    authority_level INT DEFAULT 1,
    effective_from DATE,
    effective_to DATE,
    status TEXT DEFAULT 'in_force',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_source_chunks_tsv ON legal_source_chunks USING GIN(tsv);

-- 17. citations
CREATE TABLE IF NOT EXISTS citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES legal_sources(id) ON DELETE SET NULL,
    section_ref TEXT,
    quote TEXT,
    verification_status verification_status DEFAULT 'unverified',
    verified_at TIMESTAMPTZ,
    confidence NUMERIC(5,2),
    used_in JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. research_queries
CREATE TABLE IF NOT EXISTS research_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID REFERENCES matters(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    filters JSONB DEFAULT '{}'::jsonb,
    retrieved JSONB DEFAULT '[]'::jsonb,
    reranked JSONB DEFAULT '[]'::jsonb,
    latency_ms INT,
    model_run_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. risk_assessments
CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    overall_level risk_level NOT NULL DEFAULT 'LOW',
    dimension_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    rationale TEXT,
    mitigations JSONB DEFAULT '[]'::jsonb,
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. action_plans
CREATE TABLE IF NOT EXISTS action_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    version INT DEFAULT 1,
    current_situation TEXT NOT NULL,
    known JSONB DEFAULT '[]'::jsonb,
    unknown JSONB DEFAULT '[]'::jsonb,
    options JSONB DEFAULT '[]'::jsonb,
    documents_required JSONB DEFAULT '[]'::jsonb,
    evidence_to_preserve JSONB DEFAULT '[]'::jsonb,
    risks JSONB DEFAULT '[]'::jsonb,
    lawyer_questions JSONB DEFAULT '[]'::jsonb,
    next_best_action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. deadlines
CREATE TABLE IF NOT EXISTS deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    type deadline_type NOT NULL DEFAULT 'extracted',
    title TEXT NOT NULL,
    why_it_matters TEXT,
    citation_id UUID REFERENCES citations(id) ON DELETE SET NULL,
    verify_note TEXT,
    status TEXT DEFAULT 'pending',
    reminder_offsets INT[] DEFAULT '{1, 3, 7}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. generated_documents
CREATE TABLE IF NOT EXISTS generated_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content_md TEXT NOT NULL,
    storage_path TEXT,
    disclaimer_included BOOLEAN NOT NULL DEFAULT true,
    version INT DEFAULT 1,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. lawyer_briefs
CREATE TABLE IF NOT EXISTS lawyer_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    content JSONB NOT NULL,
    pdf_path TEXT,
    share_token_hash TEXT,
    share_expires_at TIMESTAMPTZ,
    shared_with TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24. consents
CREATE TABLE IF NOT EXISTS consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_type consent_type NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    granted BOOLEAN NOT NULL DEFAULT true,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    text_hash TEXT
);

-- 25. audit_logs (append-only)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    matter_id UUID REFERENCES matters(id) ON DELETE SET NULL,
    ip TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 26. model_runs
CREATE TABLE IF NOT EXISTS model_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID REFERENCES matters(id) ON DELETE SET NULL,
    agent_name TEXT NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    prompt_version TEXT,
    input_tokens INT,
    output_tokens INT,
    cost NUMERIC(10,6),
    latency_ms INT,
    status TEXT DEFAULT 'success',
    error TEXT,
    trace_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 27. feedback
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    target_type TEXT NOT NULL,
    target_id UUID NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    tags TEXT[] DEFAULT '{}',
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 28. legal_instruments & versions & repeal map (Law Change Detection)
CREATE TABLE IF NOT EXISTS legal_instruments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    jurisdiction_id UUID REFERENCES jurisdictions(id) ON DELETE SET NULL,
    enacted_year INT,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legal_instrument_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_id UUID NOT NULL REFERENCES legal_instruments(id) ON DELETE CASCADE,
    version_label TEXT NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_current BOOLEAN DEFAULT true,
    gazette_notification_ref TEXT,
    summary_of_changes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repeal_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    old_instrument_id UUID NOT NULL REFERENCES legal_instruments(id) ON DELETE CASCADE,
    old_section_ref TEXT NOT NULL,
    new_instrument_id UUID NOT NULL REFERENCES legal_instruments(id) ON DELETE CASCADE,
    new_section_ref TEXT NOT NULL,
    nature_of_change TEXT DEFAULT 'replaced',
    transitional_notes TEXT,
    effective_date DATE NOT NULL DEFAULT '2024-07-01',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 29. contract_comparisons & playbooks
CREATE TABLE IF NOT EXISTS playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    domain_id UUID REFERENCES legal_domains(id) ON DELETE SET NULL,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    doc_a_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    doc_b_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL,
    diff_summary JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 30. share_links
CREATE TABLE IF NOT EXISTS share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    permissions JSONB DEFAULT '{"read_only": true, "include_documents": true, "include_chat": false}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    accessed_at TIMESTAMPTZ,
    access_count INT DEFAULT 0,
    revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
