-- ============================================================================
-- NEURON MIGRATION: Academic Intelligence, Concept Nodes & Sync Outbox
-- Timestamp: 2026-11-05 00:00:01
-- ============================================================================

-- 1. Concepts Table (Global Knowledge Concepts)
CREATE TABLE IF NOT EXISTS public.concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_concept_slug UNIQUE (user_id, slug)
);

-- 2. Course Concepts Junction Table
CREATE TABLE IF NOT EXISTS public.course_concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    relevance_score NUMERIC(3,2) DEFAULT 1.00 CHECK (relevance_score >= 0.00 AND relevance_score <= 1.00),
    source_type TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source_type IN ('MANUAL', 'EXTRACTED_SYLLABUS', 'EXTRACTED_DOCUMENT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_course_concept UNIQUE (course_id, concept_id)
);

-- 3. Document AI Summaries Table
-- Composite unique constraint (user_id, document_id) eliminates cross-tenant DoS
CREATE TABLE IF NOT EXISTS public.document_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    executive_summary TEXT NOT NULL,
    key_takeaways JSONB NOT NULL DEFAULT '[]',
    extracted_formulas JSONB NOT NULL DEFAULT '[]',
    candidate_concepts JSONB NOT NULL DEFAULT '[]',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_summary UNIQUE (user_id, document_id)
);

-- 4. Offline Sync Outbox & Audit Table
CREATE TABLE IF NOT EXISTS public.sync_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id UUID NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    client_timestamp TIMESTAMPTZ NOT NULL,
    server_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Course Prerequisites Table (Phase 3 DAG Engine Support)
CREATE TABLE IF NOT EXISTS public.course_prerequisites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    prerequisite_course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_course_prereq UNIQUE (course_id, prerequisite_course_id),
    CONSTRAINT chk_no_self_prereq CHECK (course_id <> prerequisite_course_id)
);

-- 6. WebCal Feed Token on Profiles (Unauthenticated Calendar Subscriptions)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS webcal_token UUID DEFAULT gen_random_uuid() UNIQUE;

-- 7. Automated updated_at Trigger for Concepts Freshness Tracking
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_concepts_updated_at ON public.concepts;
CREATE TRIGGER trg_concepts_updated_at
    BEFORE UPDATE ON public.concepts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance & RLS evaluation
CREATE INDEX IF NOT EXISTS idx_concepts_user_id ON public.concepts(user_id);
CREATE INDEX IF NOT EXISTS idx_course_concepts_user_id ON public.course_concepts(user_id);
CREATE INDEX IF NOT EXISTS idx_course_concepts_course_id ON public.course_concepts(course_id);
CREATE INDEX IF NOT EXISTS idx_course_concepts_concept_id ON public.course_concepts(concept_id);
CREATE INDEX IF NOT EXISTS idx_document_summaries_user_id ON public.document_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_document_summaries_document_id ON public.document_summaries(document_id);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_user_time ON public.sync_outbox(user_id, client_timestamp);
CREATE INDEX IF NOT EXISTS idx_course_prereq_user_id ON public.course_prerequisites(user_id);
CREATE INDEX IF NOT EXISTS idx_course_prereq_course_id ON public.course_prerequisites(course_id);

-- ============================================================================
-- 100% ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_prerequisites ENABLE ROW LEVEL SECURITY;

-- Concepts RLS
CREATE POLICY "Users can manage their own concepts"
    ON public.concepts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Course Concepts RLS (Enforces parent course and concept tenant ownership)
CREATE POLICY "Users can manage their own course concepts"
    ON public.course_concepts FOR ALL
    USING (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.concepts cp WHERE cp.id = concept_id AND cp.user_id = auth.uid())
    )
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.concepts cp WHERE cp.id = concept_id AND cp.user_id = auth.uid())
    );

-- Document Summaries RLS (Enforces parent document tenant ownership)
CREATE POLICY "Users can manage their own document summaries"
    ON public.document_summaries FOR ALL
    USING (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.user_id = auth.uid())
    )
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.user_id = auth.uid())
    );

-- Sync Outbox RLS
CREATE POLICY "Users can manage their own sync outbox"
    ON public.sync_outbox FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Course Prerequisites RLS (Enforces parent course and prerequisite course tenant ownership)
CREATE POLICY "Users can manage their own course prerequisites"
    ON public.course_prerequisites FOR ALL
    USING (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.courses pr WHERE pr.id = prerequisite_course_id AND pr.user_id = auth.uid())
    )
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.courses pr WHERE pr.id = prerequisite_course_id AND pr.user_id = auth.uid())
    );
