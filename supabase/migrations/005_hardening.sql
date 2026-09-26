-- Migration 005: least-privilege defaults and updated_at triggers.
-- Apply only after 001-004 have been applied.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS matters_set_updated_at ON public.matters;
CREATE TRIGGER matters_set_updated_at BEFORE UPDATE ON public.matters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS documents_set_updated_at ON public.documents;
CREATE TRIGGER documents_set_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- User data is never anonymously readable through the exposed Data API.
REVOKE ALL ON TABLE profiles, matters, matter_participants, messages, documents,
  document_pages, document_chunks, document_entities, document_clauses,
  document_comments, evidence, case_events, research_queries, risk_assessments,
  action_plans, deadlines, generated_documents, lawyer_briefs, consents,
  audit_logs, model_runs, feedback, contract_comparisons, share_links FROM anon;

-- The server uses service_role for privileged processing. Authenticated clients
-- receive only the access that RLS policies allow.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

CREATE INDEX IF NOT EXISTS idx_source_chunks_effective ON public.legal_source_chunks (instrument, effective_from, effective_to, status);
CREATE INDEX IF NOT EXISTS idx_case_events_matter_date ON public.case_events (matter_id, event_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_matter_date ON public.deadlines (matter_id, due_date);
