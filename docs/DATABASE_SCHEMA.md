# NEURON Database Architecture & Schema Documentation

## 1. Overview
NEURON utilizes a normalized relational schema on PostgreSQL (Supabase) to represent a student's personal academic intelligence network, course neural graphs, documents, and semester calendar schedules.

Cross-user connections are strictly forbidden; each user is an isolated tenant whose data is protected by Row Level Security (RLS).

---

## 2. Entity Relational Diagrams & Tables

### 2.1. `public.profiles`
Stores student personal preferences and global metadata.
- `id` (UUID, Primary Key, references `auth.users(id)` ON DELETE CASCADE)
- `display_name` (TEXT)
- `timezone` (TEXT, default `'Asia/Ho_Chi_Minh'`)
- `theme_preference` (TEXT, `'light'` or `'dark'`, default `'light'`)
- `created_at` (TIMESTAMPTZ, default `NOW()`)
- `updated_at` (TIMESTAMPTZ, default `NOW()`)

### 2.2. `public.semesters`
Acts as top-level organizational folders.
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `user_id` (UUID, references `auth.users(id)` ON DELETE CASCADE)
- `name` (TEXT, e.g., 'Semester 1')
- `academic_year` (TEXT, e.g., 'Academic Year 2026–2027')
- `start_date` (DATE)
- `end_date` (DATE)
- `sort_order` (INTEGER, default `0`)
- `is_active` (BOOLEAN, default `false`)
- `created_at` (TIMESTAMPTZ, default `NOW()`)
- `updated_at` (TIMESTAMPTZ, default `NOW()`)

Indexes:
- `idx_semesters_user_id` on `(user_id)`
- `idx_semesters_sort_order` on `(sort_order)`

### 2.3. `public.courses`
Courses belonging to a specific semester.
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `user_id` (UUID, references `auth.users(id)` ON DELETE CASCADE)
- `semester_id` (UUID, references `public.semesters(id)` ON DELETE CASCADE)
- `course_code` (TEXT, e.g., 'EE4010')
- `course_name` (TEXT, e.g., 'Power System Analysis')
- `lecturer` (TEXT, nullable)
- `credits` (INTEGER, default `3`)
- `description` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ, default `NOW()`)
- `updated_at` (TIMESTAMPTZ, default `NOW()`)

Indexes:
- `idx_courses_user_id` on `(user_id)`
- `idx_courses_semester_id` on `(semester_id)`
- `idx_courses_course_code` on `(course_code)`

### 2.4. `public.people`
Global contact repository for the student (professors, classmates, teammates).
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `user_id` (UUID, references `auth.users(id)` ON DELETE CASCADE)
- `full_name` (TEXT)
- `nickname` (TEXT, nullable)
- `email` (TEXT, nullable)
- `phone` (TEXT, nullable)
- `contact_links` (JSONB, default `'{}'::jsonb`)
- `class_name` (TEXT, nullable)
- `major` (TEXT, nullable)
- `skills` (TEXT[], default `'{}'::text[]`)
- `notes` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ, default `NOW()`)
- `updated_at` (TIMESTAMPTZ, default `NOW()`)

Indexes:
- `idx_people_user_id` on `(user_id)`
- `idx_people_full_name` on `(full_name)`

### 2.5. `public.course_people`
Many-to-many relationship junction connecting people to specific courses.
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `user_id` (UUID, references `auth.users(id)` ON DELETE CASCADE)
- `course_id` (UUID, references `public.courses(id)` ON DELETE CASCADE)
- `person_id` (UUID, references `public.people(id)` ON DELETE CASCADE)
- `relationship_type` (TEXT, `'Classmate' | 'Project teammate' | 'Lecturer' | 'Friend' | 'Other'`)
- `knowledge_topics` (TEXT[], default `'{}'::text[]`)
- `context_note` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ, default `NOW()`)

Constraints:
- Unique constraint `uq_course_person` on `(course_id, person_id)`

### 2.6. `public.documents`
Document metadata and storage reference.
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `user_id` (UUID, references `auth.users(id)` ON DELETE CASCADE)
- `original_file_name` (TEXT)
- `storage_path` (TEXT)
- `mime_type` (TEXT)
- `file_size` (BIGINT)
- `category` (TEXT, `'Lecture' | 'Assignment' | 'Past Exam' | 'Textbook' | 'Notes' | 'Reference' | 'Other'`)
- `description` (TEXT, nullable)
- `uploaded_at` (TIMESTAMPTZ, default `NOW()`)
- `updated_at` (TIMESTAMPTZ, default `NOW()`)

### 2.7. `public.course_documents`
Many-to-many junction connecting documents to courses.
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `user_id` (UUID, references `auth.users(id)` ON DELETE CASCADE)
- `course_id` (UUID, references `public.courses(id)` ON DELETE CASCADE)
- `document_id` (UUID, references `public.documents(id)` ON DELETE CASCADE)
- `display_order` (INTEGER, default `0`)
- `created_at` (TIMESTAMPTZ, default `NOW()`)

Constraints:
- Unique constraint `uq_course_document` on `(course_id, document_id)`

### 2.8. `public.events`
Semester calendar events.
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `user_id` (UUID, references `auth.users(id)` ON DELETE CASCADE)
- `semester_id` (UUID, references `public.semesters(id)` ON DELETE CASCADE)
- `course_id` (UUID, nullable, references `public.courses(id)` ON DELETE SET NULL)
- `title` (TEXT)
- `description` (TEXT, nullable)
- `event_type` (TEXT, `'CLASS' | 'EXAM' | 'DEADLINE' | 'PERSONAL'`)
- `location` (TEXT, nullable)
- `start_at` (TIMESTAMPTZ)
- `end_at` (TIMESTAMPTZ)
- `all_day` (BOOLEAN, default `false`)
- `recurrence_rule` (TEXT, nullable, e.g., `'FREQ=WEEKLY;BYDAY=TU'`)
- `timezone` (TEXT, default `'Asia/Ho_Chi_Minh'`)
- `reminder_offsets_minutes` (INTEGER[], default `'{15}'`)
- `deadline_status` (TEXT, `'pending' | 'completed' | 'overdue'`)
- `created_at` (TIMESTAMPTZ, default `NOW()`)
- `updated_at` (TIMESTAMPTZ, default `NOW()`)

### 2.9. `public.course_graph_layouts`
Stores custom draggable coordinates and zoom level for the course neural graph.
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `user_id` (UUID, references `auth.users(id)` ON DELETE CASCADE)
- `course_id` (UUID, references `public.courses(id)` ON DELETE CASCADE)
- `positions` (JSONB, node id -> `{ x: number, y: number }`)
- `viewport` (JSONB, `{ x: number, y: number, zoom: number }`)
- `updated_at` (TIMESTAMPTZ, default `NOW()`)

---

## 3. Row Level Security (RLS) Policy Specifications
Every table has RLS explicitly enabled:
- `SELECT`, `INSERT`, `UPDATE`, `DELETE` operations require `auth.uid() = user_id` (or `id` for profiles).
- Storage bucket `academic-documents` enforces `(storage.foldername(name))[1] = auth.uid()::text`.
