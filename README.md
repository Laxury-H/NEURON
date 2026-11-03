# NEURON

> **Connect People. Connect Knowledge.**  
> Personal Academic Intelligence System

---

## 1. Overview & Identity

**NEURON** is a minimalist, monochrome academic knowledge management system designed for university students. Unlike generic course dashboards or social platforms, NEURON represents an academic career through a hierarchical structure:

```
SEMESTER (Top-level folder)
   └── COURSES
         └── COURSE KNOWLEDGE GRAPH (@xyflow/react)
               ├── CENTRAL NODE: Course (code, title, credits, syllabus)
               ├── SURROUNDING NODE 1: Relationships (contacts, roles, topics)
               └── SURROUNDING NODE 2: Files (documents, categories, previews)
```

Outside individual course graphs exists a **Unified Semester Calendar** powered by FullCalendar, aggregating lectures, exams, assignment deadlines, and personal milestones across all courses in the active semester.

---

## 2. Design Philosophy: Strict Monochrome System

NEURON strictly adheres to an **achromatic monochrome palette** inspired by Swiss typography and monochrome futurism:

- **Allowed Hues**: `#FFFFFF`, `#FAFAFA`, `#F5F5F5`, `#E5E5E5`, `#D4D4D4`, `#A3A3A3`, `#737373`, `#525252`, `#404040`, `#262626`, `#171717`, `#000000`.
- **Zero Colors**: No blue, purple, cyan, green, yellow, orange, or pink badges or event indicators.
- **Grayscale Visual Hierarchy**: Hierarchy is achieved through contrast, typography weights, monospace accents, thin borders, and fill inversion.
- **Light & Dark Modes**: Full support for light mode (default) and dark mode (inverted monochrome).

---

## 3. Technology Stack

- **Framework**: Next.js 15 (App Router, Server Components & Client Components)
- **Language**: TypeScript 5.8
- **Styling**: Tailwind CSS, Shadcn UI architectural patterns
- **Graph Visualization**: `@xyflow/react` (React Flow)
- **Calendar**: `@fullcalendar/react` v6 (with `daygrid`, `timegrid`, `list`, `interaction`)
- **Backend & Auth**: Supabase PostgreSQL, Row Level Security (RLS), Supabase Storage
- **Validation & Date**: Zod, Date-fns
- **Notifications**: Sonner (configured in strict monochrome theme)

---

## 4. Features & Module Breakdown

### Module 1: Semester & Course Management
- **Semesters**: Create, edit, rename, delete, and set active semester.
- **Folder Sections**: Clean folder cards showing academic year, course counts, and expandable course lists.
- **Courses**: Code (e.g. `EE4010`), course name, credits, lecturer, syllabus notes.

### Module 2: Interactive Course Neural Graph
- **Initial Load**: Starts cleanly with the 3 primary nodes (Course, Relationships group, Files group).
- **Expansion**:
  - Expanding **Relationships** retrieves connected classmates, lecturers, and teammates arranged radially.
  - Expanding **Files** retrieves connected lecture notes, assignments, and past exams.
- **Detailed Inspectors**:
  - **Person Inspector**: Full contact information, nickname, email, phone, class, skills tags, knowledge topics, and course-specific context note. Allows unlinking from course or editing global profile.
  - **Document Inspector**: File size, format, upload date, category, annotations, download/preview, and course unlinking without deleting original file.
- **Drag & Persistence**: Moving nodes or adjusting zoom persists layout coordinates in the database (`course_graph_layouts`). Restores positions upon reopening.

### Module 3: Semester Calendar
- **Unified Aggregation**: Gathers all events from all courses in the active semester.
- **Semester Selector**: Switch seamlessly between semesters.
- **Views**: Month view, Week view, Agenda/List view.
- **Event Categories**: `CLASS` (lecture), `EXAM`, `DEADLINE`, `PERSONAL`.
- **Filters**: Filter by course or filter by event category using monochrome pattern chips.
- **Recurring Schedules**: Supports weekly recurrence for regular university classes.

### Module 4: Global Search (Cmd+K / Ctrl+K)
- Universal instant search across semesters, courses, people, documents, and calendar events.
- Distinct monochrome item indicators.
- Direct navigation to relevant node, course, or calendar entry.

### Module 5: Workspace Settings & Backup
- Student profile preferences (display name, default timezone `Asia/Ho_Chi_Minh`).
- Theme toggle (Light / Dark).
- **JSON Backup & Recovery**: Export complete workspace state to JSON; import backups; reset to default academic seed fixture.

---

## 5. Local Setup & Running

### Prerequisites
- Node.js 18+ (tested on Node v25.9.0)
- `pnpm` (or `npm`)

### Installation

```bash
# Clone the repository
cd NEURON

# Install dependencies
pnpm install
```

### Environment Configuration

Copy the example environment configuration:

```bash
cp .env.example .env.local
```

Contents of `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=academic-documents
```

> **Dual Storage Engine**: If Supabase credentials are not provided or set to empty, NEURON automatically operates in **Persistent Local Storage Mode** (using browser `localStorage`), pre-seeded with realistic university data. All CRUD actions, graph layouts, and calendar changes persist across page reloads. Once you provide Supabase credentials, it automatically connects to your PostgreSQL cloud instance.

### Run Development Server

```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Tests

```bash
pnpm test
```
Runs the 10 automated unit and integration suites validating semester CRUD, neural graph structures, multi-course person integrity, document preservation, layout persistence, calendar aggregation, RLS policies, and strict monochrome compliance.

### Run Production Build

```bash
pnpm build
pnpm start
```

---

## 6. Supabase Database & Storage Setup

1. In your Supabase Dashboard, open the **SQL Editor**.
2. Run the SQL migration located at:
   `supabase/migrations/20261103000001_initial_schema.sql`
3. (Optional) Run the seed fixture script at:
   `supabase/seed.sql`
4. Verify that the private storage bucket `academic-documents` is created with authenticated RLS policies.

---

## 7. Required External Credentials (When using Supabase Cloud)

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL (e.g. `https://xyz.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anonymous API key for client authentication and queries.
- `SUPABASE_SERVICE_ROLE_KEY`: (Optional) Admin key for direct backend CLI migrations. Never exposed to browser.
