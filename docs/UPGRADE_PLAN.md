# NEURON Master Upgrade Plan & Architecture Roadmap
**Version:** 2.0.0-PROPOSAL  
**Document Status:** Definitive Technical Specification & Engineering Roadmap  
**Target System:** NEURON — Minimalist Monochrome Personal Academic Intelligence & Neural Knowledge Graph  
**Target Repository:** `https://github.com/Laxury-H/NEURON`  
**Current Baseline Verification:** 13/13 Automated Test Suites Passing (~190ms, `node --experimental-strip-types --test`)  
**Lead Author:** Worker 1 (Master Plan Author)  
**Parent Orchestrator:** `798b98af-54d8-43e9-8bce-f67d57efe38d`

---

## Executive Summary & System Philosophy

### 1.1 Vision & Mission
NEURON is a single-tenant personal academic intelligence platform and spatial knowledge graph system engineered specifically for university students, researchers, and technical scholars. Modern university education is plagued by acute digital fragmentation: syllabi reside on legacy Learning Management Systems (Canvas, Blackboard, Moodle); course discussions and study groups scatter across Telegram, Discord, and Zalo; reading materials and slides clutter local download folders; and academic deadlines are tracked on uncoordinated mobile calendars.

NEURON resolves this friction by synthesizing four fundamental academic dimensions into a unified, distraction-free spatial workspace:
1. **Academic Intelligence & AI:** Automated document synthesis, syllabus topic decomposition, cross-course semantic linking, and intelligent workload balancing.
2. **Neural Knowledge Graph:** A dynamic, 2D spatial representation of courses, study materials, classmates, professors, and knowledge concepts built on `@xyflow/react`.
3. **Unified Semester Calendar:** A centralized temporal timeline consolidating lectures, recitations, laboratory sessions, assignment deadlines, and exam milestones built on `FullCalendar v6`.
4. **Data Synchronization & Offline-First Resilience:** A zero-friction dual-persistence engine supporting instant, offline-capable local execution with seamless synchronization to a Supabase PostgreSQL cloud backend protected by 100% Row Level Security (RLS).

```
                      ┌────────────────────────────────────────────────────────┐
                      │                 NEURON UNIFIED WORKSPACE               │
                      └───────────────────────────┬────────────────────────────┘
                                                  │
                 ┌────────────────────────────────┴────────────────────────────────┐
                 │                                                                 │
                 ▼                                                                 ▼
┌─────────────────────────────────┐                             ┌──────────────────────────────────┐
│   SPATIAL KNOWLEDGE GRAPH       │                             │    UNIFIED SEMESTER CALENDAR     │
│   (@xyflow/react v12.4.3)       │◄───────────────────────────►│    (FullCalendar v6.1.15)        │
│   - Central Course Nodes        │        Cross-Domain         │    - Weekly Recurrent Lectures   │
│   - Contact Hubs & Classmates   │      Deep Integration       │    - Milestone Deadlines & Exams │
│   - Materials Vaults            │                             │    - Live Conflict Detection     │
│   - First-Class Concept Nodes   │                             │    - RFC 5545 iCal / WebCal Sync │
└────────────────┬────────────────┘                             └─────────────────┬────────────────┘
                 │                                                                │
                 │              ┌───────────────────────────────────┐             │
                 └─────────────►│    ACADEMIC INTELLIGENCE ENGINE   │◄────────────┘
                                │    - Syllabus Summarization       │
                                │    - Concept Extraction & Linking │
                                │    - Prerequisite Recommender     │
                                │    - Crunch Alert & Study Balance │
                                └─────────────────┬─────────────────┘
                                                  │
                                                  ▼
                                ┌───────────────────────────────────┐
                                │   OFFLINE-FIRST DATA REPOSITORY   │
                                │   - IndexedDB Document Blobs      │
                                │   - LocalStorage Outbox (WAL)     │
                                │   - Supabase PostgreSQL (100% RLS)│
                                └───────────────────────────────────┘
```

### 1.2 The 5 Architectural Commandments
Every proposed upgrade, component modification, and database migration must strictly adhere to the following five invariant principles:

1. **Strict Achromatic Monochrome Purity:**
   The user interface is entirely devoid of chromatic color (zero blue, red, green, yellow, purple, or pastel accents). Visual hierarchy, state differentiation, and affordance must be communicated solely through typographic scale, weight contrast, hairline borders (`1px solid`), dot-matrix grids, hatched canvas textures, and inverted luminance fills (`#000000` vs `#FFFFFF`). Status indicators must use monospaced text badges (`[PENDING]`, `[CONFLICT]`, `[COMPLETED]`) rather than colored status pills.

2. **100% Non-Breaking Test Invariance:**
   The existing baseline of 13 automated test suites in `tests/neuron.test.mjs` must remain completely green at every stage of the upgrade roadmap. No existing public method on `DataRepository`, schema constraint, or test assertion may be broken, bypassed, or weakened.

3. **Offline-First Sovereignty:**
   The application must remain fully functional without an internet connection or Supabase credentials. Local operations (reading courses, navigating graphs, searching nodes, scheduling events) must execute instantaneously with sub-millisecond local latency. Network synchronization must occur asynchronously in the background.

4. **Zero Cloud Vendor Lock-In:**
   The entire database schema, storage vault, and graph topology must be exportable to an unencrypted, human-readable, portable JSON archive with a single click. Students retain absolute ownership of their academic data.

5. **Deep Relational Integrity:**
   Entities maintain strict referential boundaries. Foreign key cascades, course-semester integrity validation, and isolated tenant RLS policies prevent orphaned records, cross-semester leakage, or cross-student data contamination.

---

## 2. Current Architecture Audit & Baseline Analysis

### 2.1 Next.js 15 App Router & Hydration Boundaries
NEURON is constructed using Next.js 15.2.0 (App Router), React 19.0.0, and TypeScript 5.8.2.

```
src/
├── app/
│   ├── layout.tsx                      # Root Layout (Inter, JetBrains Mono, ThemeProvider, Sonner Toaster)
│   ├── globals.css                     # Monochrome CSS tokens, FullCalendar & React Flow overrides
│   ├── page.tsx                        # Root Redirect -> /app/semesters
│   ├── login/page.tsx                  # Supabase Auth Login + Local Demo Workspace Bypass
│   ├── signup/page.tsx                 # Supabase Registration
│   └── app/                            # Protected Academic App Shell
│       ├── layout.tsx                  # Workspace Layout (Collapsible AppSidebar + Mobile Drawer)
│       ├── semesters/
│       │   ├── page.tsx                # Semesters Folder Grid, Active Status Toggle
│       │   └── [semesterId]/
│       │       ├── page.tsx            # Semester Detail & Courses List
│       │       └── courses/[courseId]/
│       │           └── page.tsx        # 2D Spatial Course Knowledge Graph Canvas
│       ├── calendar/page.tsx           # Unified Semester Calendar View
│       └── settings/page.tsx           # Dual-Engine Sync Status, JSON Backup & Restore
```

#### Hydration & Execution Audit
- **Client Component Ubiquity:** Currently, nearly all route endpoints (`/app/semesters/page.tsx`, `/app/calendar/page.tsx`, `/app/semesters/[semesterId]/courses/[courseId]/page.tsx`, `/app/settings/page.tsx`) carry the `"use client"` directive.
- **Architectural Rationale:** The application operates in dual-persistence mode. In LocalStorage fallback mode, data cannot be read on the Node.js server during SSR without throwing `ReferenceError: localStorage is not defined`. The repository gracefully handles SSR via an in-memory `memoryStore`, but components must mount in the browser to access persistent local data.
- **Target Optimization:** Move static presentation shells to Server Components, hydrating data through specialized client boundary hooks (`useNeuronData`, `useCourseGraph`), reducing the initial JavaScript bundle footprint by ~28%.

### 2.2 Strict Achromatic Monochrome Design System Audit
The design system enforces zero-hue contrast using Tailwind CSS 3.4.17 and Radix UI primitives.

#### Token Verification (`tailwind.config.ts` & `src/app/globals.css`)
- **Monochrome Tokens:** Defined in `tailwind.config.ts`:
  ```typescript
  mono: {
    white: "#FFFFFF",
    50: "#FAFAFA",
    100: "#F5F5F5",
    200: "#E5E5E5",
    300: "#D4D4D4",
    400: "#A3A3A3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
    950: "#000000",
  }
  ```
- **CSS Variables:** All theme variables in `globals.css` are configured strictly with **0% HSL saturation**:
  - Light Mode: `--background: 0 0% 100%`, `--foreground: 0 0% 9%`, `--primary: 0 0% 0%`, `--border: 0 0% 90%`.
  - Dark Mode: `--background: 0 0% 9%`, `--foreground: 0 0% 98%`, `--primary: 0 0% 100%`, `--border: 0 0% 22%`.
- **Zero-Hue Static Code Analysis:**
  - Case-insensitive regex scans across `src/**/*.tsx` for standard Tailwind color classes (`text-red-500`, `bg-blue-600`, `border-emerald-400`, etc.) return **0 matches**.
  - Automated Test 13 asserts the absolute absence of forbidden CSS rules (`#0000ff`, `#ff0000`, `blue`, `green`, `rgb(...)`) in `globals.css`.

### 2.3 Dual-Persistence Data Layer Architecture
The core data layer is abstracted by `DataRepository` (`src/lib/data/repository.ts`, 1,321 lines).

```
                             ┌─────────────────────────────────┐
                             │         DataRepository          │
                             │    (Unified Application API)    │
                             └────────────────┬────────────────┘
                                              │
                              Is Supabase Configured & Active?
                                             / \
                                     Yes    /   \   No / Offline
                                           ▼     ▼
┌──────────────────────────────────────────────┐ ┌──────────────────────────────────────────────┐
│            SUPABASE CLOUD CLIENT             │ │          LOCAL STORAGE ENGINE                │
│            (@supabase/ssr v0.5.2)            │ │          (neuron_store_v1)                   │
├──────────────────────────────────────────────┤ ├──────────────────────────────────────────────┤
│ - PostgreSQL 15 Database (9 Tables)          │ │ - JSON serialized in LocalStorage            │
│ - 100% Row Level Security (RLS)              │ │ - SSR in-memory fallback (memoryStore)       │
│ - Private Bucket: 'academic-documents' (50MB)│ │ - Pre-seeded with university mock data       │
│ - Strict Tenant Isolation: auth.uid()=user_id│ │ - Custom event: "neuron_data_changed"        │
└──────────────────────────────────────────────┘ └──────────────────────────────────────────────┘
```

#### Current Entity Relational Mapping (PostgreSQL Schema)
1. `public.profiles`: Student profile, timezone (`Asia/Ho_Chi_Minh`), theme preference (`light` | `dark`).
2. `public.semesters`: Academic periods (`start_date`, `end_date`, `is_active`, `sort_order`).
3. `public.courses`: Courses scoped to semester (`course_code`, `course_name`, `lecturer`, `credits`, `description`).
4. `public.people`: Global directory of academic contacts (`full_name`, `skills`, `contact_links` JSONB).
5. `public.course_people`: Many-to-many junction (`relationship_type`, `knowledge_topics`, `context_note`).
6. `public.documents`: Global academic materials library (`original_file_name`, `storage_path`, `category`, `file_size`).
7. `public.course_documents`: Many-to-many junction binding files to courses with `display_order`.
8. `public.events`: Calendar events (`event_type`, `start_at`, `end_at`, `recurrence_rule`, `deadline_status`).
9. `public.course_graph_layouts`: Draggable spatial coordinates (`positions` JSONB, `viewport` JSONB).

### 2.4 Automated Test Matrix Status (The 13 Invariant Suites)
The testing harness is implemented in `tests/neuron.test.mjs` and executes natively using Node.js 22 built-in runner (`node --experimental-strip-types --test`). The complete matrix runs in ~190ms with 100% pass rate:

| Suite # | Title | Subsystem Tested | Core Assertions Verified |
|:---:|---|---|---|
| **1** | Semester Management | CRUD & Ordering | Pre-seeded >=2 semesters, active semester detection, creation, update, and cascade deletion. |
| **2** | Course Management | CRUD & Scoping | Retrieval scoped to semester, creation, get by ID, credit updates, cascade unlinking on delete. |
| **3** | Course Neural Graph | Graph Hierarchy | Core triad structure: Central Course Node, Relationships Group (>=3 contacts), Files Group (>=3 docs). |
| **4** | Relationships | Contact Associations | Multi-course linking, structured JSONB links (`contact_links`), context notes, preservation in global directory upon unlinking. |
| **5** | Documents | Vault Preservation | File upload, course association in canvas, unlinking detaches from course while preserving in global document library. |
| **6** | Graph Layout Persistence | Position & Viewport | Persistent storage of drag coordinates `{x, y}` for all node types, exact restoration of viewport zoom and pan offsets. |
| **7** | Semester Calendar | Category Aggregation | Aggregation of events across 4 categories (`CLASS`, `EXAM`, `DEADLINE`, `PERSONAL`), course-specific event filtering. |
| **8** | Calendar Integrity | Integrity Guardrail | Enforces that linking an event to a course belonging to another semester throws `'Course does not belong to the selected semester'`. |
| **9** | Calendar Recurrence | Weekly RRULE Parsing | Verification of `FREQ=WEEKLY;BYDAY=` recurrence rule, validation of `Asia/Ho_Chi_Minh` timezone preservation. |
| **10** | Universal Spotlight Search | Cmd+K Indexing | Substring matching across 5 domains: Course code/name, Person name, Knowledge topics, Document filenames, Event titles. |
| **11** | Backup & Recovery | Disaster Recovery | Complete JSON database export (>500 chars), strict rejection of invalid JSON payloads, successful lossless restore. |
| **12** | Database Migration & RLS | Security Audit | Direct AST/text audit of SQL migration: `ALTER TABLE ENABLE ROW LEVEL SECURITY` on all 9 tables, private storage bucket, `auth.uid() = user_id`. |
| **13** | Monochrome Compliance | Zero-Hue Verification | Absence of chromatic colors (`blue`, `green`, `yellow`, `#ff0000`, `#0000ff`) in `src/app/globals.css`, presence of `#FFFFFF` and `#171717`. |

### 2.5 Critical Bottlenecks, Technical Debt & Vulnerabilities

1. **LocalStorage 5MB Quota Risk (Document Binaries):**
   In local mode, `uploadDocument` converts files into Base64 strings stored in `download_url` inside `localStorage['neuron_store_v1']`. A single 4MB PDF base64-encoded expands to ~5.3MB, triggering `DOMException: QuotaExceededError` and permanently corrupting local storage.
2. **Missing Outbox & Two-Way Sync:**
   `repository.ts` operates as a hard conditional: either Supabase is configured or LocalStorage is used. Offline mutations when disconnected from Supabase are not queued in a Write-Ahead Log (WAL), leading to data divergence upon reconnecting.
3. **UUID vs String ID Discrepancy:**
   Supabase enforces strict `UUID` primary keys (`gen_random_uuid()`). LocalStorage seed data uses arbitrary strings (`sem-1`, `c-ee4010`, `p-1`). Attempting to migrate local data into Supabase triggers PostgreSQL error `22P02: invalid input syntax for type uuid`.
4. **Supabase Bypass in Repository:**
   Methods `getPerson(id)` and `getDocument(id)` in `src/lib/data/repository.ts` directly read from `loadStore()` even when Supabase is configured and active, returning stale or missing data.
5. **Linear Pseudo-Radial Knowledge Graph Layout:**
   `CourseGraphCanvas` calculates child node positions using a simple linear column offset: `relPos.y - 120 + index * 75`. Courses with more than 15 files or contacts create unmanageable vertical columns that overlap and require excessive navigation.
6. **Static Calendar Scheduling:**
   FullCalendar v6 has `editable={false}` hardcoded. Events cannot be dragged to reschedule, deadlines cannot be marked complete in the UI, and no overlapping schedule conflict detection exists.
7. **Complete Absence of Academic Intelligence:**
   Despite the product positioning, there is currently no AI integration for summarization, concept extraction, natural language search, or study scheduling.

---

## 3. Core Pillar 1: Academic Intelligence & AI Engineering

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      PILLAR 1: ACADEMIC INTELLIGENCE ENGINE                      │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────┐  │
│   │  Document Summary   │      │  Automated Concept  │      │ Natural Language│  │
│   │  & Key Takeaways    │      │  Linking Pipeline   │      │ Spotlight (CmdK)│  │
│   └──────────┬──────────┘      └──────────┬──────────┘      └────────┬────────┘  │
│              │                            │                          │           │
│              ▼                            ▼                          ▼           │
│   ┌───────────────────────────────────────────────────────────────────────────┐  │
│   │              NEURON Academic Intelligence Service (Edge/Client)           │  │
│   │  - Local Heuristic / TF-IDF Tokenizer (Offline Fallback)                 │  │
│   │  - Streaming Vercel AI SDK / OpenAI-Compatible API (Cloud Mode)           │  │
│   │  - Strict JSON Structured Output (Zod Schema Validation)                  │  │
│   └─────────────────────────────────────┬─────────────────────────────────────┘  │
│                                         │                                        │
│              ┌──────────────────────────┴───────────────────────────┐            │
│              ▼                                                      ▼            │
│   ┌─────────────────────┐                                ┌─────────────────────┐ │
│   │ Prerequisite Graph  │                                │ Study Schedule &    │ │
│   │ Recommender (DAG)   │                                │ Exam Crunch Alert   │ │
│   └─────────────────────┘                                └─────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Document Summarization & Key Takeaways Generator

#### Feature Overview
University students frequently ingest dense 40-page lecture slides, research publications, and laboratory protocols. The Document Summarizer provides instant, structured extraction without leaving the spatial canvas:
- **Executive Abstract:** Concise 2-sentence distillation of the core academic thesis.
- **Key Takeaways:** 3 to 5 bullet points capturing primary findings or exam-critical concepts.
- **Core Formulas & Definitions:** Extracted LaTeX mathematical expressions or canonical definitions.
- **Suggested Graph Concepts:** Candidate knowledge topics automatically formatted for node creation.

#### API Specification (`POST /api/ai/summarize`)
- **Runtime:** Next.js Edge Runtime (`export const runtime = 'edge'`).
- **Request Headers:** `Content-Type: application/json`, `Authorization: Bearer <supabase_jwt>`.
- **Request Payload:**
  ```typescript
  export interface SummarizeRequest {
    documentId: string;
    courseId: string;
    fileName: string;
    rawTextContent: string;
    category: DocumentCategory;
  }
  ```
- **Response Payload (Zod Schema):**
  ```typescript
  import { z } from 'zod';

  export const AcademicSummarySchema = z.object({
    documentId: z.string().uuid(),
    executiveSummary: z.string().max(300),
    keyTakeaways: z.array(z.string()).min(3).max(5),
    extractedFormulas: z.array(
      z.object({
        name: z.string(),
        latex: z.string(),
        description: z.string(),
      })
    ).default([]),
    candidateConcepts: z.array(z.string()).min(1).max(8),
    generatedAt: z.string().datetime(),
  });

  export type AcademicSummary = z.infer<typeof AcademicSummarySchema>;
  ```

#### Strict System Prompt Specification
```text
You are NEURON Academic Intelligence, an expert university-level academic research assistant.
Analyze the following academic text extracted from document "{{fileName}}" belonging to course "{{courseCode}}: {{courseName}}".

Output MUST strictly conform to the following JSON schema. Do not output markdown code blocks or conversational text.
{
  "documentId": "{{documentId}}",
  "executiveSummary": "Concise 2-sentence summary of the academic core.",
  "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
  "extractedFormulas": [{"name": "Formula Name", "latex": "\\frac{a}{b}", "description": "Meaning"}],
  "candidateConcepts": ["Concept A", "Concept B"]
}

Rules:
1. Tone must be strictly academic, objective, rigorous, and concise.
2. In LaTeX formulas, use standard AMS-LaTeX syntax.
3. Candidate concepts must be atomic academic subjects (e.g., "Eigenvalue Decomposition", "Markov Decision Process"), not generic words.
```

#### Client UI Integration & Streaming
- **Component Seam:** `src/components/graph/document-detail-panel.tsx`.
- Add an `"AI Intelligence"` tab alongside `"Overview"`.
- Uses `useCompletion` or `useChat` from the Vercel AI SDK with a custom monochrome streaming cursor (`<span className="inline-block w-2 h-4 bg-foreground animate-pulse ml-1" />`).

### 3.2 Automated Concept Extraction & Cross-Course Linking

#### Concept Graph Data Model
Concepts are promoted from passive strings into first-class relational entities linking multiple courses:

```typescript
export interface Concept {
  id: string;
  user_id: string;
  name: string; // e.g., "Fourier Transform"
  slug: string; // "fourier-transform"
  description: string | null;
  created_at: string;
}

export interface CourseConcept {
  id: string;
  user_id: string;
  course_id: string;
  concept_id: string;
  relevance_score: number; // 0.00 to 1.00
  source_type: 'MANUAL' | 'EXTRACTED_SYLLABUS' | 'EXTRACTED_DOCUMENT';
  created_at: string;
  concept?: Concept;
}
```

#### Local Heuristic / Offline Concept Extraction Engine
When offline or operating in local mode, NEURON runs a client-side NLP pipeline using a deterministic TF-IDF tokenizer with a bundled stopword dictionary (removing academic boilerplate like *"introduction"*, *"chapter"*, *"homework"*, *"week"*):

```typescript
// src/lib/ai/local-concept-extractor.ts
export function extractLocalConcepts(text: string, existingConcepts: string[] = []): string[] {
  const academicStopwords = new Set([
    'introduction', 'overview', 'chapter', 'lecture', 'assignment', 'homework',
    'syllabus', 'course', 'student', 'university', 'semester', 'grade', 'exam'
  ]);
  
  // Extract capitalized n-grams and technical terminology
  const nGramRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g;
  const matches = text.match(nGramRegex) || [];
  
  const frequencyMap = new Map<string, number>();
  for (const m of matches) {
    const normalized = m.trim();
    if (!academicStopwords.has(normalized.toLowerCase()) && normalized.length > 3) {
      frequencyMap.set(normalized, (frequencyMap.get(normalized) || 0) + 1);
    }
  }

  // Sort by frequency and return top candidate concepts
  return Array.from(frequencyMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([concept]) => concept);
}
```

### 3.3 Natural Language Spotlight Search ("Ask NEURON" in Cmd+K)

#### Natural Language Intent Parser
Extends `src/components/navigation/global-search.tsx` by prefixing queries with `?` or natural language questions (e.g. *"When is my next exam?"*, *"Who knows about load flow?"*).

```typescript
export interface AcademicQueryIntent {
  action: 'FILTER_CALENDAR' | 'FIND_EXPERT' | 'FIND_DOCUMENT' | 'RECOMMEND_STUDY';
  entities: {
    eventType?: EventType;
    topic?: string;
    timeframe?: 'TODAY' | 'THIS_WEEK' | 'THIS_SEMESTER';
    courseCode?: string;
  };
}

export function parseAcademicIntent(query: string): AcademicQueryIntent | null {
  const q = query.toLowerCase();
  if (q.includes('exam') || q.includes('due') || q.includes('deadline')) {
    return {
      action: 'FILTER_CALENDAR',
      entities: {
        eventType: q.includes('exam') ? 'EXAM' : 'DEADLINE',
        timeframe: q.includes('week') ? 'THIS_WEEK' : 'THIS_SEMESTER'
      }
    };
  }
  if (q.startsWith('who knows') || q.includes('expert in') || q.includes('teammate for')) {
    const topic = q.replace(/who knows|expert in|teammate for|\?/g, '').trim();
    return {
      action: 'FIND_EXPERT',
      entities: { topic }
    };
  }
  return null;
}
```

When an intent is detected, the Spotlight modal displays a specialized **Monochrome Action Card** with keyboard shortcut `Enter ↵` to jump straight to the filtered Calendar or zoom directly to the expert contact in the Course Graph.

### 3.4 Prerequisite & Course Recommender Engine
University students must map multi-semester academic plans satisfying prerequisite Directed Acyclic Graphs (DAGs).

#### Recommender Architecture
- **Input:** Completed courses, active semester courses, student skills array, and degree prerequisite graph.
- **DAG Cycle Detection:** Kahn's Topological Sort algorithm verifies that proposed course sequences contain zero circular dependencies.
- **Affinity Score Formulation:**
  $$\text{Score}(C) = w_1 \cdot \text{PrereqSatisfied}(C) + w_2 \cdot \text{TopicSimilarity}(C, S_{\text{skills}}) + w_3 \cdot \text{WorkloadBalance}(C, \text{Semester})$$
  Where $w_1 = 0.5$, $w_2 = 0.3$, $w_3 = 0.2$.

### 3.5 Study Schedule Optimizer & Exam Crunch Alert System

#### Schedule Crunch Detection Algorithm
Students frequently encounter "crunch weeks" where multiple midterms or heavy deadlines collide within a 72-hour rolling window.

```typescript
export interface CrunchWindow {
  startDate: Date;
  endDate: Date;
  severity: 'MODERATE' | 'HIGH' | 'CRITICAL';
  events: CalendarEvent[];
  recommendedPreparationHours: number;
}

export function detectExamCrunches(events: CalendarEvent[]): CrunchWindow[] {
  const highStakes = events.filter(e => e.event_type === 'EXAM' || e.event_type === 'DEADLINE')
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  
  const crunches: CrunchWindow[] = [];
  const WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours
  const seenClusters = new Set<string>();

  for (let i = 0; i < highStakes.length; i++) {
    const current = highStakes[i];
    const cluster = [current];
    const currentStart = new Date(current.start_at).getTime();

    for (let j = i + 1; j < highStakes.length; j++) {
      const next = highStakes[j];
      if (new Date(next.start_at).getTime() - currentStart <= WINDOW_MS) {
        cluster.push(next);
      } else {
        break;
      }
    }

    if (cluster.length >= 2) {
      const clusterKey = cluster.map(c => c.id).sort().join('::');
      if (!seenClusters.has(clusterKey)) {
        seenClusters.add(clusterKey);
        const examCount = cluster.filter(c => c.event_type === 'EXAM').length;
        crunches.push({
          startDate: new Date(cluster[0].start_at),
          endDate: new Date(cluster[cluster.length - 1].end_at),
          severity: examCount >= 2 ? 'CRITICAL' : cluster.length >= 3 ? 'HIGH' : 'MODERATE',
          events: cluster,
          recommendedPreparationHours: cluster.length * 8,
        });
      }
      // Note: Removed i += cluster.length - 1 to maintain a continuous sliding window.
      // This ensures chained multi-day sequences (e.g. Mon-Wed-Fri) detect all pairwise
      // and overlapping crunch intervals without skipping consecutive windows.
    }
  }

  return crunches;
}
```

- **Visual Alert Rendering:** Rendered in the Calendar toolbar as a high-contrast monochrome banner:
  `[CRITICAL CRUNCH DETECTED: 2 Exams within 48h (Nov 12 - Nov 14). Recommended Study: 16h]`

---

## 4. Core Pillar 2: Neural Knowledge Graph Evolution (@xyflow/react)

```
                       ┌───────────────────────────────┐
                       │     CENTRAL COURSE NODE       │
                       │     (Core Radius: R0 = 0)     │
                       └───────────────┬───────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────┐                     ┌───────────────────────────────┐
│     RELATIONSHIPS HUB         │                     │       MATERIALS VAULT         │
│     (Ring 1: R1 = 280px)      │                     │     (Ring 1: R1 = 280px)      │
└───────────────┬───────────────┘                     └───────────────┬───────────────┘
                │                                                     │
        ┌───────┴───────┐                                     ┌───────┴───────┐
        ▼               ▼                                     ▼               ▼
┌──────────────┐ ┌──────────────┐                     ┌──────────────┐ ┌──────────────┐
│  Classmate   │ │   Lecturer   │                     │ Lecture Note │ │ Past Exam PDF│
│ (Leaf Node)  │ │ (Leaf Node)  │                     │ (Leaf Node)  │ │ (Leaf Node)  │
└──────────────┘ └──────────────┘                     └──────────────┘ └──────────────┘
                ▲                                                     ▲
                └──────────────────────┬──────────────────────────────┘
                                       │
                        ┌──────────────┴──────────────┐
                        ▼                             ▼
         ┌──────────────────────────────┐ ┌──────────────────────────────┐
         │     CONCEPT NODE (ALPHA)     │ │     CONCEPT NODE (BETA)      │
         │     (Ring 2: R2 = 450px)     │ │     (Ring 2: R2 = 450px)     │
         └──────────────────────────────┘ └──────────────────────────────┘
```

### 4.1 Concentric Multi-Ring Radial Layout Engine
The current implementation positions nodes with a linear vertical formula (`relPos.y - 120 + index * 75`), causing long, unmanageable columns. The upgrade introduces a mathematical **concentric multi-ring force layout** with angular dispersion and collision resolution.

#### Mathematical Formulation
1. **Ring Radius Assignment:**
   $$R_k = R_{\text{anchor}} + k \cdot \Delta R$$
   Where $R_{\text{core}} = 0$, $R_{\text{group}} = 260\,\text{px}$, and default base leaf radius $R_{\text{base}} = 420\,\text{px}$.
   When leaf count in a cluster exceeds 8 ($N > 8$), dynamic multi-tier concentric staggering is engaged to alternate card radii and eliminate angular overlap:
   $$R_i = \begin{cases} R_1 = 380\,\text{px} & \text{if } i \pmod 2 = 0 \\ R_2 = 460\,\text{px} & \text{if } i \pmod 2 = 1 \end{cases}$$
2. **Angular Distribution:**
   For a cluster of $N$ nodes spanning angular aperture $[\theta_{\text{start}}, \theta_{\text{end}}]$:
   $$\theta_i = \theta_{\text{start}} + \frac{i + 0.5}{N} \cdot (\theta_{\text{end}} - \theta_{\text{start}})$$
   - Left Cluster (People): $\theta \in [\frac{3\pi}{4}, \frac{5\pi}{4}]$ (West sector: $135^\circ$ to $225^\circ$).
   - Right Cluster (Documents): $\theta \in [-\frac{\pi}{4}, \frac{\pi}{4}]$ (East sector: $-45^\circ$ to $45^\circ$).
   - Top Cluster (Concepts): $\theta \in [\frac{\pi}{4}, \frac{3\pi}{4}]$ (North sector: $45^\circ$ to $135^\circ$).
3. **Cartesian Coordinates in Screen Space:**
   In browser DOM, SVG, and `@xyflow/react` canvas coordinates, $+Y$ points **downward (South)** and $-Y$ points **upward (North)**. For the North/Top Arc concepts where $\theta \in [\frac{\pi}{4}, \frac{3\pi}{4}]$ and $\sin(\theta) > 0$, the vertical component must be subtracted rather than added to place nodes above the course center:
   $$x_i = X_{\text{center}} + R_i \cdot \cos(\theta_i)$$
   $$y_i = \begin{cases} Y_{\text{center}} - R_i \cdot \sin(\theta_i) & \text{for Top Arc (Concepts, North)} \\ Y_{\text{center}} + R_i \cdot \sin(\theta_i) & \text{for Lateral / Equatorial clusters} \end{cases}$$
4. **Collision Avoidance:**
   Bounding-box overlap check. If two cards overlap ($|x_1 - x_2| < W_{\text{node}} \land |y_1 - y_2| < H_{\text{node}}$), an iterative repulsive force pushes them along the normal vector $\vec{n} = \frac{p_2 - p_1}{\|p_2 - p_1\|}$ until minimum margin $M = 24\,\text{px}$ is attained.

#### Algorithm Implementation
```typescript
// src/components/graph/layout/radial-layout.ts
export interface Point { x: number; y: number; }

export function computeConcentricLayout(
  center: Point,
  peopleCount: number,
  docsCount: number,
  conceptsCount: number
): { people: Point[]; docs: Point[]; concepts: Point[] } {
  const R_BASE = 420;
  const R_TIER_1 = 380;
  const R_TIER_2 = 460;

  const distribute = (
    count: number,
    startAngle: number,
    endAngle: number,
    invertY = false
  ): Point[] => {
    if (count === 0) return [];
    const step = (endAngle - startAngle) / Math.max(count, 1);
    return Array.from({ length: count }, (_, i) => {
      const theta = startAngle + step * (i + 0.5);
      // Dynamic multi-tier staggering when leaf count > 8 to prevent node overlap
      const radius = count > 8 ? (i % 2 === 0 ? R_TIER_1 : R_TIER_2) : R_BASE;
      const yOffset = radius * Math.sin(theta);
      return {
        x: Math.round(center.x + radius * Math.cos(theta)),
        // Screen space Y inversion: subtract sine offset for Top/North arc
        y: Math.round(invertY ? center.y - yOffset : center.y + yOffset),
      };
    });
  };

  return {
    // People: Left Hemisphere (135° to 225°)
    people: distribute(peopleCount, (3 * Math.PI) / 4, (5 * Math.PI) / 4, false),
    // Documents: Right Hemisphere (-45° to 45°)
    docs: distribute(docsCount, -Math.PI / 4, Math.PI / 4, false),
    // Concepts: Top Arc (45° to 135°) — invertY: true places nodes North (above center)
    concepts: distribute(conceptsCount, Math.PI / 4, (3 * Math.PI) / 4, true),
  };
}
```

### 4.2 First-Class Concept Nodes (`conceptNode`)

#### Node Component Specification (`src/components/graph/nodes/concept-node.tsx`)
- **Visual Design:** Diamond or hexagonal geometric container, hairline monochrome border (`1.5px solid var(--border)`), dot-matrix background texture.
- **Card Contents:** Monospaced concept slug, occurrence badge (number of associated courses/documents), and quick filter trigger.
- **Handles:** 4 handles (Top, Bottom, Left, Right) with monochrome inverted fills.

```tsx
// src/components/graph/nodes/concept-node.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Brain } from 'lucide-react';

export interface ConceptNodeData {
  label: string;
  courseCount: number;
  docCount: number;
  isSelected?: boolean;
}

export const ConceptNode = memo(({ data }: NodeProps<ConceptNodeData>) => {
  return (
    <div className={`relative px-4 py-3 bg-card border ${data.isSelected ? 'border-primary ring-1 ring-primary' : 'border-border'} rounded-md shadow-sm w-48 transition-all duration-150`}>
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-foreground border border-background" />
      <div className="flex items-center gap-2 mb-1.5">
        <Brain className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground truncate">
          {data.label}
        </span>
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground border-t border-border pt-1.5">
        <span>{data.courseCount} courses</span>
        <span>{data.docCount} docs</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-foreground border border-background" />
    </div>
  );
});

ConceptNode.displayName = 'ConceptNode';
```

### 4.3 Macroscopic Global Curriculum Graph View
While course-scoped canvases provide detailed operational context, students need a macroscopic view of their entire degree path.

- **Route:** `/app/graph` (Global Academic Knowledge Canvas).
- **Topology:**
  - Nodes: All Semesters (Clusters), All Courses (Major Hubs), Shared Concepts (Inter-Course Bridges), and Shared Professors/Classmates.
  - Inter-Course Edges: Directed arrows indicating prerequisite dependency or shared conceptual foundation.
  - Interactive Filter: Slider to scrub through time from Semester 1 to Graduation, visualizing knowledge network expansion.

### 4.4 Viewport & Node Position Persistence Pipeline
NEURON persists layout coordinates using debounced writes (`300ms`) to avoid blocking UI interaction:
- Node positions: Map of `Record<string, { x: number; y: number }>`.
- Viewport: Camera coordinates `{ x: number, y: number, zoom: number }`.
- Restoration: Upon mount, `fitView` is bypassed if saved coordinates exist, executing `setViewport(savedViewport, { duration: 0 })` to ensure instant, zero-jitter visual stability.

---

## 5. Core Pillar 3: Unified Semester Calendar Engineering (FullCalendar v6)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      PILLAR 3: UNIFIED SEMESTER CALENDAR                         │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────┐  │
│   │ Live Conflict Engine│      │ Drag-to-Reschedule  │      │ Deadline State  │  │
│   │ [Interval Overlap]  │      │ (editable={true})   │      │ [Pending/Done]  │  │
│   └──────────┬──────────┘      └──────────┬──────────┘      └────────┬────────┘  │
│              │                            │                          │           │
│              ▼                            ▼                          ▼           │
│   ┌───────────────────────────────────────────────────────────────────────────┐  │
│   │               FullCalendar v6.1.15 Unified React Adapter                  │  │
│   │   - dayGridMonth / timeGridWeek / listMonth / interaction                 │  │
│   │   - Strict Achromatic Event Badges (Hatched, Bordered, Solid Inverted)    │  │
│   │   - Recurrence Expansion Engine (Asia/Ho_Chi_Minh Timezone)               │  │
│   └─────────────────────────────────────┬─────────────────────────────────────┘  │
│                                         │                                        │
│                                         ▼                                        │
│                        ┌─────────────────────────────────┐                       │
│                        │ RFC 5545 iCalendar & WebCal     │                       │
│                        │ - Static .ics Export File       │                       │
│                        │ - Live HTTP Subscription URL    │                       │
│                        └─────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Real-Time Schedule Conflict Detection Engine

#### Problem Definition
University schedules frequently have overlapping lectures, laboratory sessions coinciding with exams, or multiple concurrent deadlines. FullCalendar displays events superimposed without explicit collision warnings.

#### Interval Overlap Algorithm
Two events $E_1 = [S_1, E_1)$ and $E_2 = [S_2, E_2)$ conflict if and only if:
$$S_1 < E_2 \quad \land \quad S_2 < E_1$$
For recurring weekly events, recurrence intervals are expanded across the semester date range $[\text{start\_date}, \text{end\_date}]$ before evaluating intersections.

```typescript
// src/lib/calendar/conflict-detector.ts
export interface ConflictPair {
  eventA: CalendarEvent;
  eventB: CalendarEvent;
  overlapStart: string;
  overlapEnd: string;
  severity: 'WARNING' | 'CRITICAL'; // CRITICAL if involves EXAM
}

/**
 * Pre-expands recurring weekly events into individual concrete occurrences across
 * the semester date range before interval overlap sorting and collision checks.
 */
export function expandRecurringOccurrences(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  if (!event.recurrence_rule || !event.recurrence_rule.includes('FREQ=WEEKLY')) {
    return [event];
  }

  const occurrences: CalendarEvent[] = [];
  const eventStart = new Date(event.start_at);
  const eventEnd = new Date(event.end_at);
  const durationMs = eventEnd.getTime() - eventStart.getTime();

  // Parse BYDAY tokens (e.g. BYDAY=MO,TU,WE,TH,FR,SA,SU)
  const byDayMatch = event.recurrence_rule.match(/BYDAY=([A-Z,]+)/);
  const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const targetDays = byDayMatch
    ? byDayMatch[1].split(',').map((d) => dayMap[d.trim()]).filter((d) => d !== undefined)
    : [eventStart.getDay()];

  const cursor = new Date(Math.max(eventStart.getTime(), rangeStart.getTime()));
  cursor.setHours(0, 0, 0, 0);
  const horizonEnd = new Date(rangeEnd.getTime());

  while (cursor <= horizonEnd) {
    if (targetDays.includes(cursor.getDay())) {
      const occStart = new Date(cursor);
      occStart.setHours(eventStart.getHours(), eventStart.getMinutes(), eventStart.getSeconds(), eventStart.getMilliseconds());
      const occEnd = new Date(occStart.getTime() + durationMs);

      if (occStart >= eventStart && occStart <= horizonEnd) {
        occurrences.push({
          ...event,
          id: `${event.id}_occ_${occStart.toISOString()}`,
          start_at: occStart.toISOString(),
          end_at: occEnd.toISOString(),
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences.length > 0 ? occurrences : [event];
}

export function detectScheduleConflicts(
  events: CalendarEvent[],
  semesterRange?: { start: Date; end: Date }
): ConflictPair[] {
  const conflicts: ConflictPair[] = [];

  // Default range spans from earliest event to 180 days forward
  const defaultStart = events.length > 0
    ? new Date(Math.min(...events.map((e) => new Date(e.start_at).getTime())))
    : new Date();
  const rangeStart = semesterRange?.start || defaultStart;
  const rangeEnd = semesterRange?.end || new Date(rangeStart.getTime() + 180 * 24 * 60 * 60 * 1000);

  // 1. Recurrence Pre-Expansion: expand all recurring lectures and labs across semester bounds
  const expanded: CalendarEvent[] = [];
  for (const ev of events) {
    expanded.push(...expandRecurringOccurrences(ev, rangeStart, rangeEnd));
  }

  // 2. Sort expanded occurrences chronologically by start_at
  const sorted = expanded.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  // 3. Interval overlap comparison with early break
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];

      // Skip self-collision between occurrences originating from the same recurring parent event
      const rootIdA = a.id.split('_occ_')[0];
      const rootIdB = b.id.split('_occ_')[0];
      if (rootIdA === rootIdB) continue;

      const aStart = new Date(a.start_at).getTime();
      const aEnd = new Date(a.end_at).getTime();
      const bStart = new Date(b.start_at).getTime();
      const bEnd = new Date(b.end_at).getTime();

      // If event B starts after event A ends, no further pairs with A can overlap
      if (bStart >= aEnd) break;

      if (aStart < bEnd && bStart < aEnd) {
        const isExam = a.event_type === 'EXAM' || b.event_type === 'EXAM';
        conflicts.push({
          eventA: a,
          eventB: b,
          overlapStart: new Date(Math.max(aStart, bStart)).toISOString(),
          overlapEnd: new Date(Math.min(aEnd, bEnd)).toISOString(),
          severity: isExam ? 'CRITICAL' : 'WARNING',
        });
      }
    }
  }

  return conflicts;
}
```

#### Visual Monochrome Rendering
- Conflicting event pills on the calendar canvas receive a hatched diagonal stripe overlay:
  `background: repeating-linear-gradient(45deg, #171717, #171717 4px, #404040 4px, #404040 8px);`
- A monospaced badge `[! CONFLICT]` is appended to the event title.
- A collapsible Conflict Drawer lists all colliding pairs with quick "Resolve" actions.

### 5.2 Interactive Drag-to-Reschedule (`editable={true}`)
Currently, `semester-calendar.tsx:437` hardcodes `editable={false}`.

#### Upgrade Specification
1. Enable `editable={true}`, `eventDurationEditable={true}`, `droppable={true}`.
2. Implement `eventDrop` handler:
   ```typescript
   const handleEventDrop = async (info: EventDropArg) => {
     const { id, start, end, allDay } = info.event;
     try {
       await DataRepository.updateEvent(id, {
         start_at: start!.toISOString(),
         end_at: end ? end.toISOString() : new Date(start!.getTime() + 3600000).toISOString(),
         all_day: allDay,
       });
       toast.success('Event rescheduled', { description: `Moved to ${format(start!, 'MMM dd, HH:mm')}` });
     } catch (err: any) {
       info.revert();
       toast.error('Failed to reschedule event', { description: err.message });
     }
   };
   ```
3. Implement `eventResize` handler for dragging event duration handles.
4. **Foreign Key Integrity Enforcement & Test 8 Scoping Guardrail:**
   In `DataRepository.createEvent`, relational integrity is strictly enforced by asserting that `course.semester_id === params.semester_id`, throwing `'Course does not belong to the selected semester'` on mismatch (as validated by automated Test 8).
   However, `updateEvent(id, params)` historically lacked this verification. When dragging events across views or editing course assignments, `updateEvent` MUST enforce the identical scoping guardrail:
   ```typescript
   // src/lib/data/repository.ts -> updateEvent
   if (params.course_id !== undefined || params.semester_id !== undefined) {
     const currentEvent = store.events.find((e) => e.id === id);
     if (!currentEvent) throw new Error('Event not found');

     const targetSemesterId = params.semester_id || currentEvent.semester_id;
     const targetCourseId = params.course_id !== undefined ? params.course_id : currentEvent.course_id;

     if (targetCourseId) {
       const course = store.courses.find((c) => c.id === targetCourseId);
       if (!course || course.semester_id !== targetSemesterId) {
         throw new Error('Course does not belong to the selected semester');
       }
     }
   }
   ```
   This prevents drag-to-reschedule actions or modal updates from corrupting calendar relational integrity or leaking events across semester boundaries.

### 5.3 Academic Deadline Lifecycle & Progress State Management
The database schema defines `deadline_status` as `'pending' | 'completed' | 'overdue'`, but the UI lacks status toggle controls.

#### UI Enhancements
- **Quick-Check Button:** Add an interactive Radix Checkbox directly on deadline cards in `EventDetailPanel` and in the calendar list view.
- **Visual Strikethrough:** When marked `'completed'`, the deadline title renders with `line-through opacity-60`, and its calendar badge renders with an inverted checkmark icon (`[✓ COMPLETED]`).
- **Automated Overdue Transition:** A background evaluator flags any deadline whose `end_at < now()` and `status === 'pending'` as `'overdue'`.

### 5.4 RFC 5545 iCalendar (.ics) Export & Live WebCal Subscription Feeds

#### Export Engine Specification
University students rely on Apple Calendar, Google Calendar, and Outlook on mobile devices. NEURON must support both static file exports and live subscription feeds.

```typescript
// src/lib/calendar/ical-generator.ts
export function generateICalendarFeed(semester: Semester, events: CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NEURON Academic Intelligence//Semester Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:NEURON - ${semester.name}`,
    `X-WR-TIMEZONE:${events[0]?.timezone || 'Asia/Ho_Chi_Minh'}`,
  ];

  for (const event of events) {
    const uid = `${event.id}@neuron.academic`;
    const dtStamp = formatUtcIcal(new Date());
    const dtStart = formatUtcIcal(new Date(event.start_at));
    const dtEnd = formatUtcIcal(new Date(event.end_at));

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:[${event.event_type}] ${escapeIcalText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcalText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcalText(event.location)}`);
    if (event.recurrence_rule) lines.push(`RRULE:${event.recurrence_rule}`);
    lines.push(`STATUS:${event.deadline_status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
```

- **Live WebCal Endpoint (`/api/calendar/feed/[token]`):**
  - Next.js Route Handler serving `Content-Type: text/calendar; charset=utf-8`.
  - Accessible via `webcal://neuron.academic/api/calendar/feed/{user_token}` for automatic periodic background synchronization on iPhone/Mac/Android.

---

## 6. Core Pillar 4: Data Synchronization & Offline-First Storage Engine

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                 PILLAR 4: DATA SYNCHRONIZATION & OFFLINE ENGINE                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────┐  │
│   │ IndexedDB Blob Store│      │  Outbox Queue (WAL) │      │ UUID Gen (v4)   │  │
│   │ (Decoupled Files)   │      │  [Client Mutations] │      │ [Parity Engine] │  │
│   └──────────┬──────────┘      └──────────┬──────────┘      └────────┬────────┘  │
│              │                            │                          │           │
│              ▼                            ▼                          ▼           │
│   ┌───────────────────────────────────────────────────────────────────────────┐  │
│   │                 NEURON Offline-First Sync Reconciliation                  │  │
│   │   - Network Connectivity Monitor (navigator.onLine / WebSocket)           │  │
│   │   - Two-Way Diffing & Replay with Exponential Backoff                     │  │
│   │   - Conflict Resolution Strategy: Last-Write-Wins (LWW) with Timestamps   │  │
│   └─────────────────────────────────────┬─────────────────────────────────────┘  │
│                                         │                                        │
│                                         ▼                                        │
│                        ┌─────────────────────────────────┐                       │
│                        │ Supabase PostgreSQL (100% RLS)  │                       │
│                        │ - 9 Existing Relational Tables  │                       │
│                        │ - New: 'sync_outbox' & Concept  │                       │
│                        │ - Private 'academic-documents'  │                       │
│                        └─────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Decoupling Document Binaries to IndexedDB (5MB Quota Solution)

#### Architecture
To eliminate the browser LocalStorage 5MB quota crash, document binary payloads (`ArrayBuffer` or `Blob`) are extracted out of `localStorage['neuron_store_v1']` and stored into a dedicated IndexedDB database (`neuron_blobs_v1`). LocalStorage stores only lightweight metadata (`id`, `file_name`, `mime_type`, `file_size`, `category`).

#### SSR-Safe, Leak-Free Implementation
In Next.js 15 Server Components, static page prerendering, and the Node.js test runner (`node --experimental-strip-types --test`), the global `indexedDB` object is undefined. Furthermore, opening fresh database connections on every read/write causes connection handle leaks in the browser. 

The upgraded `BlobStorage` implements:
1. Environment detection (`typeof window !== 'undefined' && 'indexedDB' in window`) with an in-memory `Map` fallback for SSR/testing.
2. Singleton database connection caching with `onversionchange` handle cleanup.

```typescript
// src/lib/data/blob-storage.ts
const DB_NAME = 'neuron_blobs_v1';
const STORE_NAME = 'blobs';

export class BlobStorage {
  private static dbInstance: IDBDatabase | null = null;
  // In-memory Map fallback for Next.js SSR and Node.js automated test runner execution
  private static memoryFallback = new Map<string, Blob | ArrayBuffer>();

  private static isBrowser(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  private static async getDb(): Promise<IDBDatabase | null> {
    if (!this.isBrowser()) return null;
    if (this.dbInstance) return this.dbInstance;

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => {
        this.dbInstance = req.result;
        this.dbInstance.onversionchange = () => {
          this.dbInstance?.close();
          this.dbInstance = null;
        };
        resolve(this.dbInstance);
      };
      req.onerror = () => reject(req.error);
    });
  }

  static async saveBlob(documentId: string, data: Blob | ArrayBuffer): Promise<void> {
    if (!this.isBrowser()) {
      this.memoryFallback.set(documentId, data);
      return;
    }
    const db = await this.getDb();
    if (!db) {
      this.memoryFallback.set(documentId, data);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(data, documentId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getBlob(documentId: string): Promise<Blob | ArrayBuffer | null> {
    if (!this.isBrowser()) {
      return this.memoryFallback.get(documentId) || null;
    }
    const db = await this.getDb();
    if (!db) {
      return this.memoryFallback.get(documentId) || null;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(documentId);
      req.onsuccess = () => resolve(req.result || this.memoryFallback.get(documentId) || null);
      req.onerror = () => reject(req.error);
    });
  }

  static async deleteBlob(documentId: string): Promise<void> {
    if (!this.isBrowser()) {
      this.memoryFallback.delete(documentId);
      return;
    }
    const db = await this.getDb();
    if (!db) {
      this.memoryFallback.delete(documentId);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(documentId);
      tx.oncomplete = () => {
        this.memoryFallback.delete(documentId);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }
}
```

#### Data Export & Backup Invariance Guardrail (Test 11 Preservation)
Automated Test 11 (`tests/neuron.test.mjs:322`) mandates a strictly **synchronous** string return:
```javascript
const exported = DataRepository.exportAllData();
assert.ok(typeof exported === 'string' && exported.length > 500);
```
Converting `DataRepository.exportAllData()` to `async` returns a `Promise<string>` (`typeof === 'object'`), which immediately breaks automated Test 11.
To preserve 100% backward compatibility and test suite invariance while simultaneously upholding **Commandment 4: Zero Cloud Vendor Lock-In** (full archive exportability), the repository implements a dual-export architecture:

1. **`DataRepository.exportAllData(): string` (Synchronous Metadata Export):**
   - Strictly preserves synchronous contract: reads `localStorage['neuron_store_v1']` and returns the serialized JSON metadata string.
   - Contains a manifest header declaring decoupled blob references and schema version.
   - Satisfies Test 11 with 100% invariance and zero regressions.

2. **`DataRepository.exportFullArchive(): Promise<Blob>` (Asynchronous Binary Vault Export):**
   - Asynchronously queries `BlobStorage` to fetch all binary payloads (`ArrayBuffer` / `Blob`).
   - Packages metadata together with base64-encoded blobs into a self-contained portable backup archive (`.json` or `.zip`).
   - Invoked exclusively by user interactions on the `/app/settings` page with an export progress indicator.

### 6.2 Client-Side Write-Ahead Log (WAL) & Outbox Mutation Queue
When working offline, any mutation (creating a course, moving a graph node, updating a deadline) is committed locally and appended to an outbox queue.

```typescript
export interface OutboxMutation {
  id: string; // UUID v4
  entity: 'semesters' | 'courses' | 'people' | 'course_people' | 'documents' | 'course_documents' | 'events' | 'course_graph_layouts';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  recordId: string;
  payload: Record<string, any>;
  clientTimestamp: string;
  revision: number; // Monotonic sequence counter
  retryCount: number;
  status: 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';
}
```

### 6.3 Two-Way Synchronization & Reconciliation Engine

#### Reconciliation Pipeline
1. **Network Detection:** Listen to window `'online'` and `'offline'` events and Supabase Auth session refresh.
2. **Idempotent Outbox Drain:**
   - Iterate through `PENDING` mutations in FIFO order.
   - Set status to `'SYNCING'`.
   - Send changes to Supabase using explicit **idempotent upsert semantics** (`.upsert(payload, { onConflict: 'id' })` in Supabase SDK, generating `INSERT ... ON CONFLICT (id) DO UPDATE SET ...`).
   - Retrying a mutation after a dropped network ACK safely updates the existing record instead of throwing HTTP 409 Duplicate Key collision, eliminating head-of-line blocking.
   - **Retry Budget & Dead-Letter Isolation:** Each mutation has an exponential backoff budget (`maxRetries = 5`). If a mutation repeatedly fails due to unrecoverable errors (e.g., deleted parent entity), it is isolated to `'DEAD_LETTER'` status and triggers an unobtrusive toast notification, allowing subsequent queue items to drain without wedging the sync pipeline.
3. **Deterministic Conflict Resolution (Monotonic Revision Counters & Server Clocks):**
   - *Removal of the 5-Minute Heuristic Paradox:* The naive rule allowing local edits made within 5 minutes to overwrite newer remote changes created an inverted causality race condition (e.g., an offline edit from 14:37 overwriting a 14:39 phone update upon reconnecting at 14:40). This heuristic is completely removed.
   - *Defense Against Device Clock Skew:* Student device wall-clocks (`new Date().toISOString()`) can be desynchronized by minutes or hours. Device timestamps are treated as client metadata only; the server-assigned `server_received_at` / `NOW()` or monotonic entity revision counters (`revision INTEGER NOT NULL DEFAULT 1`) serve as the authoritative ordering key.
   - *Reconciliation Rules:*
     - If `remote.revision > client.revision`, remote state takes precedence.
     - If `remote.revision === client.revision`, compare deterministic tie-breakers (server commit timestamp, or higher UUID lexicographical value).
     - Upon successful upsert, increment `revision` monotonically.
4. **Inbound Pull:** Fetch all remote records modified since `last_sync_timestamp` and merge into local IndexedDB / LocalStorage state.

### 6.4 UUID Standardization & Cross-Mode ID Parity
- **Remediation:** Replace all pseudo-ID generators (`sem-${Date.now()}`, `p-1`, etc.) with standard RFC 4122 v4 UUIDs generated via `crypto.randomUUID()`.
- **Migration Helper:** Local storage migrator converts any legacy string ID into a deterministic UUID v5 namespace before uploading to Supabase.

### 6.5 Remediation of Repository Supabase-Bypass Functions
- **Audit Finding:** `getPerson(id)` and `getDocument(id)` in `src/lib/data/repository.ts` bypassed Supabase.
- **Fix:** Update both methods to check `isSupabaseConfigured()`, execute authenticated queries against Supabase tables `public.people` and `public.documents`, and fall back to `loadStore()` only if offline or unconfigured.

---

## 7. Three-Phase Implementation Roadmap & Dependency Matrix

The upgrade is partitioned into three phases designed to eliminate regression risks and deliver immediate, tangible value at each step.

```
PHASE 1: IMMEDIATE / NEAR-TERM (Sprints 1–2)
├── Task 1.1: Live Calendar Conflict Detection Algorithm
├── Task 1.2: Calendar Drag-to-Reschedule (editable={true})
├── Task 1.3: Deadline Status Toggle (Pending vs Completed)
├── Task 1.4: IndexedDB Document Binary Decoupling
├── Task 1.5: Fuzzy Spotlight Search (Fuse.js in Cmd+K)
└── Task 1.6: UUID v4 Standardization Across Repository
        │
        ▼
PHASE 2: MEDIUM-TERM (Sprints 3–5)
├── Task 2.1: First-Class Concept Nodes in @xyflow/react
├── Task 2.2: Concentric Radial Auto-Layout Engine
├── Task 2.3: RFC 5545 iCalendar (.ics) Export & WebCal Endpoint
├── Task 2.4: Outbox Mutation Queue & Two-Way Sync Engine
├── Task 2.5: Incremental Supabase Migration (20261105000001_*.sql)
└── Task 2.6: Global Directory Pages (/app/people & /app/documents)
        │
        ▼
PHASE 3: LONG-TERM / ADVANCED INTELLIGENCE (Sprints 6–8)
├── Task 3.1: Academic Document Summarizer & Edge API
├── Task 3.2: Automated Concept Extraction & Cross-Course Linking
├── Task 3.3: Macroscopic Global Curriculum Graph View
├── Task 3.4: Prerequisite & Course Path Recommender (DAG Engine)
└── Task 3.5: Study Schedule Optimizer & Exam Crunch Alert System
```

### 7.1 Phase Breakdown & Detailed Specifications

| Phase | Task ID | Feature Title | Target Files | Complexity | Dependencies | Architectural Trade-offs |
|---|---|---|---|:---:|---|---|
| **P1** | **1.1** | Calendar Conflict Detection | `semester-calendar.tsx`, `lib/calendar/conflict.ts` | **S** | None | Client-side computation; negligible CPU impact for <1000 events. |
| **P1** | **1.2** | Drag-to-Reschedule | `semester-calendar.tsx`, `repository.ts` | **M** | 1.1 | Must strictly preserve course-semester integrity rule (Test 8). |
| **P1** | **1.3** | Deadline Status Tracking | `event-detail-panel.tsx`, `database.ts` | **S** | None | Pure UI state toggle; zero database schema alteration. |
| **P1** | **1.4** | IndexedDB Blob Decoupling | `lib/data/blob-storage.ts`, `repository.ts` | **M** | None | Solves 5MB quota with SSR/Node Map fallback; preserves synchronous `exportAllData` while adding `exportFullArchive`. |
| **P1** | **1.5** | Fuzzy Spotlight Search | `global-search.tsx`, `lib/search/fuse.ts` | **S** | None | Replaces substring containment with Fuse.js client scoring. |
| **P1** | **1.6** | UUID v4 Standardization | `repository.ts`, `mock-data.ts` | **M** | None | Must maintain backward-compatible string lookups in tests. |
| **P2** | **2.1** | First-Class Concept Nodes | `nodes/concept-node.tsx`, `canvas.tsx` | **M** | 1.6 | Adds 4th node type to React Flow canvas; preserves layout format. |
| **P2** | **2.2** | Concentric Radial Layout | `canvas.tsx`, `radial-layout.ts` | **M** | 2.1 | Replaces linear offset; screen-space Y inversion + multi-tier staggering for N>8. |
| **P2** | **2.3** | iCalendar .ics & WebCal | `api/calendar/export`, `ical.ts` | **M** | 1.1 | Standard RFC 5545 format; `webcal_token` on profiles enables headerless feed auth. |
| **P2** | **2.4** | Outbox Mutation Sync Queue | `lib/data/sync.ts`, `repository.ts` | **L** | 1.4, 1.6 | WAL outbox; idempotent upserts & monotonic revisions eliminate 409s & clock drift. |
| **P2** | **2.5** | Incremental SQL Migration | `supabase/migrations/20261105000001_*.sql` | **M** | 2.1, 2.4 | Adds 5 tables + webcal token; enforces composite parent ownership RLS & indices. |
| **P2** | **2.6** | Global Directory Pages | `app/people/page.tsx`, `app/docs/page.tsx` | **M** | 1.6 | New Next.js App Router views for all contacts and documents. |
| **P3** | **3.1** | AI Document Summarization | `api/ai/summarize`, `panel.tsx` | **L** | 1.4, 2.5 | Edge API with streaming; graceful local fallback when offline. |
| **P3** | **3.2** | Automated Concept Linking | `lib/ai/concepts.ts`, `canvas.tsx` | **L** | 2.1, 3.1 | Connects courses via shared topics; increases edge density. |
| **P3** | **3.3** | Global Curriculum Graph | `app/graph/page.tsx`, `curriculum.tsx` | **XL** | 2.2, 3.2 | Multi-course macroscopic view; requires canvas virtualization. |
| **P3** | **3.4** | Prerequisite Recommender | `lib/ai/recommender.ts`, `semesters.tsx`| **L** | 3.3 | DAG topological sort over `course_prerequisites`; models graduation paths. |
| **P3** | **3.5** | Study Schedule Optimizer | `lib/calendar/optimizer.ts`, `calendar.tsx`| **L** | 1.1, 3.4 | Exam crunch detection; continuous sliding window captures all pairwise crunches. |

*Complexity T-Shirt Sizing: **S** (1-2 days), **M** (3-5 days), **L** (1-2 weeks), **XL** (2-3 weeks).*

---

## 8. Database Migration & Security Strategy

### 8.1 PostgreSQL Incremental Migration Specification
**File Path:** `supabase/migrations/20261105000001_academic_intelligence_and_sync.sql`

> **CRITICAL INVARIANCE RULE (Test 12):**  
> Never modify or overwrite `supabase/migrations/20261103000001_initial_schema.sql`. All schema evolution must occur in new, timestamped migration files.

```sql
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
```

### 8.2 LocalStorage Backward-Compatible Schema Migration Engine
To ensure existing users whose browser storage contains legacy `neuron_store_v1` do not experience `undefined` property crashes when accessing new entities, `loadStore()` implements an automatic versioned schema migrator:

```typescript
// src/lib/data/migrator.ts
export function migrateLocalStore(raw: any): LocalStoreState {
  if (!raw || typeof raw !== 'object') {
    return getInitialStore();
  }

  return {
    userId: typeof raw.userId === 'string' ? raw.userId : 'user-local-default',
    semesters: Array.isArray(raw.semesters) ? raw.semesters : [],
    courses: Array.isArray(raw.courses) ? raw.courses : [],
    people: Array.isArray(raw.people) ? raw.people : [],
    course_people: Array.isArray(raw.course_people) ? raw.course_people : [],
    documents: Array.isArray(raw.documents) ? raw.documents : [],
    course_documents: Array.isArray(raw.course_documents) ? raw.course_documents : [],
    events: Array.isArray(raw.events) ? raw.events : [],
    layouts: raw.layouts && typeof raw.layouts === 'object' ? raw.layouts : {},
    // New collections initialized safely with empty defaults
    concepts: Array.isArray(raw.concepts) ? raw.concepts : [],
    course_concepts: Array.isArray(raw.course_concepts) ? raw.course_concepts : [],
    document_summaries: Array.isArray(raw.document_summaries) ? raw.document_summaries : [],
    sync_outbox: Array.isArray(raw.sync_outbox) ? raw.sync_outbox : [],
  };
}
```

---

## 9. Architecture Review Rubric & Non-Breaking Verification Guardrails

### 9.1 Formal Architecture Review Rubric

The following formal scoring rubric must be evaluated by code reviewers and CI audit tools prior to approving any Pull Request or milestone delivery:

| Category | Evaluation Criteria | Severity | Verification Method | Pass Condition |
|---|---|:---:|---|---|
| **1. Monochrome Purity (Components)** | Zero chromatic Tailwind color tokens (`text-blue-*`, `bg-red-*`, `border-green-*`, etc.) in any React component. | **CRITICAL** | Automated AST / Regex Scan (`scripts/audit-monochrome.mjs`) | 0 forbidden chromatic color matches across all `src/**/*.{ts,tsx}` files. |
| **1. Monochrome Purity (Tokens)** | CSS variables in `globals.css` maintain strict 0% HSL saturation across all theme modes. | **CRITICAL** | Unit Test 13 | All active color variables conform to `0 0% X%`. |
| **1. Monochrome Purity (UI Affordance)**| Affordance communicated via borders, typography, hatching, and inverted fills—never colored badges. | **MAJOR** | Visual Inspection | Destructive actions use solid black/white or `#262626` borders; no colored buttons. |
| **2. Next.js 15 App Router** | Strict adherence to App Router conventions (`layout.tsx`, `page.tsx`, nested routes). | **MAJOR** | `next build` | All static and dynamic routes compile cleanly with zero errors. |
| **2. Next.js 15 App Router** | Proper placement of `"use client"` directives only at interactive boundaries. | **MINOR** | Code Review | Data-fetching wrappers isolate client components. |
| **3. Test Suite Invariance** | All 13 existing automated test suites in `tests/neuron.test.mjs` pass without modification. | **CRITICAL** | `npm test` | 13 pass, 0 fail, 0 skipped (~190ms runtime). |
| **4. Dual-Engine Parity** | All new repository methods implement both Supabase cloud queries and local offline fallbacks. | **CRITICAL** | Integration Test | Application operates identically with `.env.local` omitted. |
| **5. Database & Multi-File RLS** | 100% of PostgreSQL tables across all migrations declare `ENABLE ROW LEVEL SECURITY` with tenant ownership checks. | **CRITICAL** | Migration Scanner (`scripts/audit-migrations.mjs`) | All `supabase/migrations/*.sql` tables have verified RLS policies with `auth.uid() = user_id`. |
| **6. Quota & Memory Safety** | Large file binaries are never serialized directly into LocalStorage strings. | **CRITICAL** | IndexedDB Inspection | LocalStorage payload remains < 500 KB regardless of uploaded file size. |

### 9.2 The 13/13 Test Suite Invariance Guardrail Matrix

To guarantee zero regressions throughout the implementation of the upgrade plan, every new module is bounded by explicit invariance rules mapping to the existing 13 test suites:

```
                               THE 13 INVARIANT TEST GUARDRAILS
┌──────────────────────────────────────┬─────────────────────────────────────────────────────────────┐
│ Test Suite                           │ Upgrade Invariance Rule                                     │
├──────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ 1. Semester Management CRUD          │ createSemester must preserve sort_order & is_active logic.  │
│ 2. Course Management CRUD            │ Course codes must auto-uppercase; scoping must remain tight.│
│ 3. Course Neural Graph Triad         │ getCourseGraphData must return 'course', 'relationships',   │
│                                      │ and 'files' primary hubs even when concepts are added.      │
│ 4. Relationships Multi-Course        │ Unlinking person must NEVER delete person from directory.   │
│ 5. Documents Vault Preservation      │ Unlinking document must NEVER delete document from library. │
│ 6. Graph Layout Persistence          │ Layout schema must accept { positions, viewport } format.   │
│ 7. Semester Calendar Aggregation     │ getEvents must aggregate across all 4 core EventTypes.      │
│ 8. Calendar Integrity Guardrail      │ Scoping check rejecting cross-semester courses MUST run     │
│                                      │ on both createEvent AND updateEvent.                        │
│ 9. Calendar Weekly Recurrence        │ FREQ=WEEKLY;BYDAY= parser must retain Asia/Ho_Chi_Minh tz;  │
│                                      │ conflict detector must pre-expand recurring occurrences.   │
│ 10. Universal Spotlight Search (CmdK)│ Querying must continue returning 5 core domain entities.    │
│ 11. Backup Export & Restore          │ exportAllData MUST remain synchronous; exportFullArchive    │
│                                      │ provides asynchronous binary bundle packaging.             │
│ 12. Database Migration & RLS         │ 20261103000001_initial_schema.sql MUST NOT BE MODIFIED;     │
│                                      │ all subsequent migrations must enforce 100% RLS & indices.  │
│ 13. Strict Monochrome Palette        │ globals.css MUST NOT contain forbidden hues; AST scanner    │
│                                      │ validates all .tsx component templates.                     │
└──────────────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

### 9.3 Verification Script & Automated CI Pipeline
To eliminate CI blindspots and prevent regressions, the repository workflow integrates multi-file migration security verification and full-tree component monochrome AST scanning alongside build and unit test suites:

```json
"scripts": {
  "test": "node --experimental-strip-types --test",
  "audit:monochrome": "node scripts/audit-monochrome.mjs",
  "audit:migrations": "node scripts/audit-migrations.mjs",
  "lint": "next lint",
  "build": "next build",
  "verify:all": "npm test && npm run audit:monochrome && npm run audit:migrations && npm run lint && npm run build"
}
```

#### Automated Audit Tooling Specifications:
1. **`scripts/audit-monochrome.mjs`:**
   Recursively parses all `.tsx` and `.ts` files in `src/` to assert that no chromatic Tailwind utility tokens (e.g., `text-(red|blue|green|amber|purple|emerald|indigo|rose|cyan|teal|yellow)-[0-9]+`, `bg-...`, `border-...`) appear in component templates. Only zero-hue monochromatic classes (`neutral-*`, `zinc-*`, `stone-*`, `gray-*`, `black`, `white`, `transparent`, `current`) and CSS theme variables are permitted.
2. **`scripts/audit-migrations.mjs`:**
   Globs all migration files in `supabase/migrations/*.sql` (preventing the single-file blindspot of legacy Test 12). For every `CREATE TABLE` declaration, it validates the existence of an associated `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statement, required tenant `auth.uid() = user_id` policies, composite parent ownership checks on foreign keys, and indexes on tenant columns.

Pre-commit hooks configured via Husky / lint-staged execute `npm run verify:all` before any commit is permitted to land on the master branch.

---

## 10. Conclusion & Architectural Sign-Off

The NEURON Upgrade Plan establishes a clear, rigorous, and achievable roadmap to elevate NEURON from an elegant academic tracker into the premier minimalist personal academic intelligence and spatial knowledge graph system. By preserving strict monochrome aesthetics, maintaining 100% test invariance, resolving storage quota bottlenecks, and introducing production-grade academic intelligence capabilities, this technical roadmap ensures NEURON remains fast, reliable, beautiful, and profoundly useful for university scholars worldwide.
