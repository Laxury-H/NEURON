-- NEURON Database Schema & Row Level Security Migration
-- Target: Supabase PostgreSQL

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL,
  theme_preference TEXT DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Trigger to create profile automatically on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, timezone, theme_preference)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'Asia/Ho_Chi_Minh',
    'light'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. SEMESTERS TABLE
CREATE TABLE IF NOT EXISTS public.semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_semesters_user_id ON public.semesters(user_id);
CREATE INDEX IF NOT EXISTS idx_semesters_sort_order ON public.semesters(sort_order);

-- 3. COURSES TABLE
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  lecturer TEXT,
  credits INTEGER DEFAULT 3 NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_courses_user_id ON public.courses(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_semester_id ON public.courses(semester_id);
CREATE INDEX IF NOT EXISTS idx_courses_course_code ON public.courses(course_code);

-- 4. PEOPLE TABLE
CREATE TABLE IF NOT EXISTS public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nickname TEXT,
  email TEXT,
  phone TEXT,
  contact_links JSONB DEFAULT '{}'::jsonb NOT NULL,
  class_name TEXT,
  major TEXT,
  skills TEXT[] DEFAULT '{}'::text[] NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_people_user_id ON public.people(user_id);
CREATE INDEX IF NOT EXISTS idx_people_full_name ON public.people(full_name);

-- 5. COURSE_PEOPLE (Relationship junction)
CREATE TABLE IF NOT EXISTS public.course_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  relationship_type TEXT DEFAULT 'Classmate' NOT NULL CHECK (relationship_type IN ('Classmate', 'Project teammate', 'Lecturer', 'Friend', 'Other')),
  knowledge_topics TEXT[] DEFAULT '{}'::text[] NOT NULL,
  context_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_course_person UNIQUE(course_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_course_people_user_id ON public.course_people(user_id);
CREATE INDEX IF NOT EXISTS idx_course_people_course_id ON public.course_people(course_id);
CREATE INDEX IF NOT EXISTS idx_course_people_person_id ON public.course_people(person_id);

-- 6. DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  category TEXT DEFAULT 'Notes' NOT NULL CHECK (category IN ('Lecture', 'Assignment', 'Past Exam', 'Textbook', 'Notes', 'Reference', 'Other')),
  description TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);

-- 7. COURSE_DOCUMENTS (Course-document junction)
CREATE TABLE IF NOT EXISTS public.course_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_course_document UNIQUE(course_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_course_documents_user_id ON public.course_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_course_documents_course_id ON public.course_documents(course_id);
CREATE INDEX IF NOT EXISTS idx_course_documents_document_id ON public.course_documents(document_id);

-- 8. EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('CLASS', 'EXAM', 'DEADLINE', 'PERSONAL')),
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT false NOT NULL,
  recurrence_rule TEXT,
  timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL,
  reminder_offsets_minutes INTEGER[] DEFAULT '{15}'::integer[] NOT NULL,
  deadline_status TEXT DEFAULT 'pending' CHECK (deadline_status IN ('pending', 'completed', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_semester_id ON public.events(semester_id);
CREATE INDEX IF NOT EXISTS idx_events_course_id ON public.events(course_id);
CREATE INDEX IF NOT EXISTS idx_events_time_range ON public.events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.events(event_type);

-- 9. COURSE_GRAPH_LAYOUTS TABLE
CREATE TABLE IF NOT EXISTS public.course_graph_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  positions JSONB DEFAULT '{}'::jsonb NOT NULL,
  viewport JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_course_graph_layout UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_graph_layouts_course ON public.course_graph_layouts(course_id);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_graph_layouts ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only see and update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Semesters: Users can only access their own semesters
CREATE POLICY "Users can view own semesters" ON public.semesters
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own semesters" ON public.semesters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own semesters" ON public.semesters
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own semesters" ON public.semesters
  FOR DELETE USING (auth.uid() = user_id);

-- Courses: Users can only access their own courses
CREATE POLICY "Users can view own courses" ON public.courses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own courses" ON public.courses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own courses" ON public.courses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own courses" ON public.courses
  FOR DELETE USING (auth.uid() = user_id);

-- People: Users can only access their own contacts
CREATE POLICY "Users can view own people" ON public.people
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own people" ON public.people
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own people" ON public.people
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own people" ON public.people
  FOR DELETE USING (auth.uid() = user_id);

-- Course_People: Users can only access their own links
CREATE POLICY "Users can view own course_people" ON public.course_people
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own course_people" ON public.course_people
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own course_people" ON public.course_people
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own course_people" ON public.course_people
  FOR DELETE USING (auth.uid() = user_id);

-- Documents: Users can only access their own documents
CREATE POLICY "Users can view own documents" ON public.documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" ON public.documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" ON public.documents
  FOR DELETE USING (auth.uid() = user_id);

-- Course_Documents: Users can only access their own links
CREATE POLICY "Users can view own course_documents" ON public.course_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own course_documents" ON public.course_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own course_documents" ON public.course_documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own course_documents" ON public.course_documents
  FOR DELETE USING (auth.uid() = user_id);

-- Events: Users can only access their own events
CREATE POLICY "Users can view own events" ON public.events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events" ON public.events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events" ON public.events
  FOR DELETE USING (auth.uid() = user_id);

-- Course Graph Layouts: Users can only access their own layouts
CREATE POLICY "Users can view own graph layouts" ON public.course_graph_layouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own graph layouts" ON public.course_graph_layouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own graph layouts" ON public.course_graph_layouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own graph layouts" ON public.course_graph_layouts
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- STORAGE BUCKET CONFIGURATION (Supabase Storage)
-- ==========================================

-- Insert bucket for academic documents if not present
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'academic-documents',
  'academic-documents',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'text/plain',
    'text/markdown',
    'application/json'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

-- Storage policies: Users can only view/upload/delete files in their own folder (`user_id/*`)
CREATE POLICY "Allow authenticated user to upload own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'academic-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Allow authenticated user to read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'academic-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Allow authenticated user to delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'academic-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
