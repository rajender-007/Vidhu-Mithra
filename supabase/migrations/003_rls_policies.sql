-- ============================================================
-- Migration 003: Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE matter_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_source_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyer_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_instrument_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE repeal_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- 1. Profiles trigger on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, preferred_language)
    VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'Citizen User'), COALESCE(new.raw_user_meta_data->>'preferred_language', 'en'));
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles RLS
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Reference tables (read-only for all)
CREATE POLICY "Public read domains" ON legal_domains FOR SELECT USING (true);
CREATE POLICY "Public read jurisdictions" ON jurisdictions FOR SELECT USING (true);
CREATE POLICY "Public read sources" ON legal_sources FOR SELECT USING (true);
CREATE POLICY "Public read source chunks" ON legal_source_chunks FOR SELECT USING (true);
CREATE POLICY "Public read instruments" ON legal_instruments FOR SELECT USING (true);
CREATE POLICY "Public read instrument versions" ON legal_instrument_versions FOR SELECT USING (true);
CREATE POLICY "Public read repeal map" ON repeal_map FOR SELECT USING (true);
CREATE POLICY "Public read playbooks" ON playbooks FOR SELECT USING (true);

-- Matters RLS
CREATE POLICY "Owners have full access to matters" ON matters
    FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Participants can view matters" ON matters
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM matter_participants
            WHERE matter_participants.matter_id = matters.id
            AND matter_participants.user_id = auth.uid()
            AND (matter_participants.expires_at IS NULL OR matter_participants.expires_at > NOW())
        )
    );

-- Matter Participants RLS
CREATE POLICY "Matter owners manage participants" ON matter_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM matters
            WHERE matters.id = matter_participants.matter_id
            AND matters.owner_id = auth.uid()
        )
    );

CREATE POLICY "Participants can view their participation" ON matter_participants
    FOR SELECT USING (user_id = auth.uid());

-- Helper function to check matter access
CREATE OR REPLACE FUNCTION public.can_access_matter(m_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM matters WHERE id = m_id AND owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM matter_participants
        WHERE matter_id = m_id
        AND user_id = auth.uid()
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Messages RLS
CREATE POLICY "Matter members can access messages" ON messages
    FOR ALL USING (public.can_access_matter(matter_id));

-- Documents RLS
CREATE POLICY "Matter members can access documents" ON documents
    FOR ALL USING (public.can_access_matter(matter_id));

-- Document sub-tables
CREATE POLICY "Matter members can access doc pages" ON document_pages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM documents WHERE documents.id = document_pages.document_id AND public.can_access_matter(documents.matter_id))
    );

CREATE POLICY "Matter members can access doc chunks" ON document_chunks
    FOR ALL USING (public.can_access_matter(matter_id));

-- Document entities
CREATE POLICY "Matter members can access doc entities" ON document_entities
    FOR ALL USING (
        EXISTS (SELECT 1 FROM documents WHERE documents.id = document_entities.document_id AND public.can_access_matter(documents.matter_id))
    );

-- Document clauses
CREATE POLICY "Matter members can access doc clauses" ON document_clauses
    FOR ALL USING (
        EXISTS (SELECT 1 FROM documents WHERE documents.id = document_clauses.document_id AND public.can_access_matter(documents.matter_id))
    );

-- Document comments
CREATE POLICY "Matter members can access doc comments" ON document_comments
    FOR ALL USING (public.can_access_matter(matter_id));

-- Evidence RLS
CREATE POLICY "Matter members can access evidence" ON evidence
    FOR ALL USING (public.can_access_matter(matter_id));

-- Case Events RLS
CREATE POLICY "Matter members can access case events" ON case_events
    FOR ALL USING (public.can_access_matter(matter_id));

-- Citations RLS
CREATE POLICY "Public read citations" ON citations FOR SELECT USING (true);
CREATE POLICY "Authenticated create citations" ON citations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Research queries
CREATE POLICY "Matter members can access research queries" ON research_queries
    FOR ALL USING (public.can_access_matter(matter_id));

-- Risk assessments
CREATE POLICY "Matter members can access risk assessments" ON risk_assessments
    FOR ALL USING (public.can_access_matter(matter_id));

-- Action plans
CREATE POLICY "Matter members can access action plans" ON action_plans
    FOR ALL USING (public.can_access_matter(matter_id));

-- Deadlines
CREATE POLICY "Matter members can access deadlines" ON deadlines
    FOR ALL USING (public.can_access_matter(matter_id));

-- Generated documents
CREATE POLICY "Matter members can access generated documents" ON generated_documents
    FOR ALL USING (public.can_access_matter(matter_id));

-- Lawyer briefs
CREATE POLICY "Matter members can access lawyer briefs" ON lawyer_briefs
    FOR ALL USING (public.can_access_matter(matter_id));

-- Consents
CREATE POLICY "Users can access their consents" ON consents
    FOR ALL USING (auth.uid() = user_id);

-- Audit logs: append-only for authenticated, viewable by user if actor
CREATE POLICY "Authenticated users can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (auth.uid() = actor_id OR auth.uid() IS NULL);

CREATE POLICY "Users can view their audit logs" ON audit_logs
    FOR SELECT USING (auth.uid() = actor_id);

-- Model runs
CREATE POLICY "Matter members can view model runs" ON model_runs
    FOR SELECT USING (matter_id IS NULL OR public.can_access_matter(matter_id));

CREATE POLICY "Authenticated can insert model runs" ON model_runs
    FOR INSERT WITH CHECK (true);

-- Feedback
CREATE POLICY "Users can manage their feedback" ON feedback
    FOR ALL USING (auth.uid() = user_id);

-- Comparisons
CREATE POLICY "Matter members can access comparisons" ON contract_comparisons
    FOR ALL USING (public.can_access_matter(matter_id));

-- Share links
CREATE POLICY "Matter owners manage share links" ON share_links
    FOR ALL USING (
        EXISTS (SELECT 1 FROM matters WHERE matters.id = share_links.matter_id AND matters.owner_id = auth.uid())
    );
