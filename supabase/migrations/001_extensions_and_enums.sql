-- ============================================================
-- Migration 001: Extensions and Enums
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('citizen', 'lawyer', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE reading_level AS ENUM ('simple', 'normal', 'detailed', 'professional');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE matter_status AS ENUM ('active', 'pending', 'resolved', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE matter_stage AS ENUM (
        'intake', 'domain_classified', 'facts_collected', 'documents_analyzed',
        'law_identified', 'risks_assessed', 'action_plan_ready', 'lawyer_prep_ready', 'completed'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE participant_role AS ENUM ('owner', 'viewer', 'lawyer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE message_sender AS ENUM ('user', 'ai', 'system');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE document_status AS ENUM ('queued', 'ocr', 'segmenting', 'analysing', 'ready', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE clause_risk_color AS ENUM ('red', 'orange', 'yellow', 'blue', 'green');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE comment_author_type AS ENUM ('ai', 'user', 'lawyer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE comment_status AS ENUM ('active', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE date_precision AS ENUM ('exact', 'month', 'approximate');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM ('verified', 'partial', 'unverified');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE deadline_type AS ENUM ('confirmed', 'extracted', 'user_provided', 'potential');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE consent_type AS ENUM ('processing', 'storage', 'lawyer_share', 'marketing');
EXCEPTION WHEN duplicate_object THEN null; END $$;
