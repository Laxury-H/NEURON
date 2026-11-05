import type {
  Semester,
  Course,
  Person,
  CoursePerson,
  DocumentItem,
  CourseDocument,
  CalendarEvent,
  CourseGraphLayout,
  GlobalSearchResult,
  RelationshipType,
  DocumentCategory,
  EventType,
  Concept,
  CourseConcept,
  CoursePrerequisite,
  DocumentSummary,
  SyncOutboxItem,
} from '../../types/database.ts';
import {
  INITIAL_USER_ID,
  INITIAL_SEMESTERS,
  INITIAL_COURSES,
  INITIAL_PEOPLE,
  INITIAL_COURSE_PEOPLE,
  INITIAL_DOCUMENTS,
  INITIAL_COURSE_DOCUMENTS,
  INITIAL_CONCEPTS,
  INITIAL_COURSE_CONCEPTS,
  INITIAL_EVENTS,
  INITIAL_GRAPH_LAYOUTS,
  INITIAL_COURSE_PREREQUISITES,
} from './mock-data.ts';
import { createClient, isSupabaseConfigured } from '../supabase/client.ts';
import { BlobStorage } from './blob-storage.ts';

const STORAGE_KEY = 'neuron_store_v2026_1_pure_real_v3';
const LEGACY_STORAGE_KEYS = [
  'neuron_store_v1',
  'neuron_store_v2026_1',
  'neuron_store_v2026_1_real_docs',
  'neuron_store_v2026_1_unified',
  'neuron_store_v2026_1_balanced',
  'neuron_store_v2026_1_pure_real',
];

interface LocalStoreState {
  userId: string;
  semesters: Semester[];
  courses: Course[];
  people: Person[];
  course_people: CoursePerson[];
  documents: DocumentItem[];
  course_documents: CourseDocument[];
  concepts: Concept[];
  course_concepts: CourseConcept[];
  document_summaries: DocumentSummary[];
  course_prerequisites: CoursePrerequisite[];
  sync_outbox: SyncOutboxItem[];
  events: CalendarEvent[];
  layouts: Record<string, CourseGraphLayout>;
  revision_counter?: number;
}

function getInitialStore(): LocalStoreState {
  return {
    userId: INITIAL_USER_ID,
    semesters: JSON.parse(JSON.stringify(INITIAL_SEMESTERS)),
    courses: JSON.parse(JSON.stringify(INITIAL_COURSES)),
    people: JSON.parse(JSON.stringify(INITIAL_PEOPLE)),
    course_people: JSON.parse(JSON.stringify(INITIAL_COURSE_PEOPLE)),
    documents: JSON.parse(JSON.stringify(INITIAL_DOCUMENTS)),
    course_documents: JSON.parse(JSON.stringify(INITIAL_COURSE_DOCUMENTS)),
    concepts: JSON.parse(JSON.stringify(INITIAL_CONCEPTS)),
    course_concepts: JSON.parse(JSON.stringify(INITIAL_COURSE_CONCEPTS)),
    document_summaries: [],
    course_prerequisites: JSON.parse(JSON.stringify(INITIAL_COURSE_PREREQUISITES)),
    sync_outbox: [],
    events: JSON.parse(JSON.stringify(INITIAL_EVENTS)),
    layouts: JSON.parse(JSON.stringify(INITIAL_GRAPH_LAYOUTS)),
    revision_counter: 1,
  };
}

// In-memory fallback if running on server or before client hydration
let memoryStore: LocalStoreState = getInitialStore();

function loadStore(): LocalStoreState {
  if (typeof window === 'undefined') {
    return memoryStore;
  }
  try {
    // Purge legacy storage versions
    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      try {
        localStorage.removeItem(legacyKey);
      } catch {}
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    // Auto-migrate if store contains any legacy mock data artifacts or outdated structure
    const hasLegacySemesters = parsed.semesters && parsed.semesters.some(
      (s: Semester) => s.id === 'sem-2' || s.name === 'Semester 2' || s.name === 'Semester 1'
    );
    const hasLegacyDocCollision = parsed.course_documents && parsed.course_documents.some(
      (cd: CourseDocument) => cd.course_id === 'c-ee4020'
    );
    const hasLegacyMockCourse = parsed.courses && parsed.courses.some(
      (c: Course) => c.id === 'c-ee4020'
    );
    const hasLegacyMockPeople = parsed.people && parsed.people.some(
      (p: Person) => p.id === 'p-2' || p.id === 'p-3' || p.id === 'p-5' || p.id === 'p-8' ||
        p.full_name === 'Nguyen Van A' || p.full_name === 'Pham Minh Tuan' || p.full_name === 'Le Thi Mai'
    );
    const hasLegacyMockEvents = parsed.events && parsed.events.some(
      (ev: CalendarEvent) => ev.id === 'ev-3' || ev.id === 'ev-4' || ev.id === 'ev-5'
    );

    if (
      !parsed.semesters ||
      !Array.isArray(parsed.semesters) ||
      parsed.semesters.length === 0 ||
      !Array.isArray(parsed.courses) ||
      hasLegacySemesters ||
      hasLegacyDocCollision ||
      hasLegacyMockCourse ||
      hasLegacyMockPeople ||
      hasLegacyMockEvents
    ) {
      const initial = getInitialStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    if (!Array.isArray(parsed.concepts)) {
      parsed.concepts = [];
    }
    if (!Array.isArray(parsed.course_concepts)) {
      parsed.course_concepts = [];
    }
    if (!Array.isArray(parsed.document_summaries)) {
      parsed.document_summaries = [];
    }
    if (!Array.isArray(parsed.course_prerequisites)) {
      parsed.course_prerequisites = JSON.parse(JSON.stringify(INITIAL_COURSE_PREREQUISITES));
    }
    if (!Array.isArray(parsed.sync_outbox)) {
      parsed.sync_outbox = [];
    }
    if (typeof parsed.revision_counter !== 'number') {
      parsed.revision_counter = 1;
    }

    return parsed;
  } catch (err) {
    console.error('Failed to load local store:', err);
    return memoryStore;
  }
}

function saveStore(state: LocalStoreState): void {
  memoryStore = state;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
  }
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function queueMutation(
  store: LocalStoreState,
  entity: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  recordId: string,
  payload: Record<string, any>
): SyncOutboxItem {
  if (!store.sync_outbox) store.sync_outbox = [];
  store.revision_counter = (store.revision_counter || 0) + 1;
  const item: SyncOutboxItem = {
    id: crypto.randomUUID(),
    user_id: store.userId,
    entity,
    action,
    record_id: recordId,
    payload: { ...payload },
    client_timestamp: new Date().toISOString(),
    status: 'PENDING',
    retry_count: 0,
    last_error: null,
    revision: store.revision_counter,
  };
  store.sync_outbox.push(item);
  return item;
}

/* ==========================================================================
   DATA REPOSITORY API
   ========================================================================== */

export const DataRepository = {
  /* ------------------------------------------------------------------------
     SEMESTERS
     ------------------------------------------------------------------------ */
  async getSemesters(): Promise<Semester[]> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('semesters')
          .select('*, courses(*)')
          .order('sort_order', { ascending: true });
        if (!error && data) {
          return data;
        }
      }
    }
    const store = loadStore();
    const sorted = [...store.semesters].sort((a, b) => a.sort_order - b.sort_order);
    return sorted.map((s) => ({
      ...s,
      courses: store.courses.filter((c) => c.semester_id === s.id),
    }));
  },

  async getSemester(id: string): Promise<Semester | null> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('semesters')
          .select('*, courses(*)')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      }
    }
    const store = loadStore();
    const sem = store.semesters.find((s) => s.id === id);
    if (!sem) return null;
    return {
      ...sem,
      courses: store.courses.filter((c) => c.semester_id === sem.id),
    };
  },

  async createSemester(params: {
    name: string;
    academic_year: string;
    start_date: string;
    end_date: string;
    sort_order?: number;
    is_active?: boolean;
  }): Promise<Semester> {
    const store = loadStore();
    const newId = crypto.randomUUID();
    const newSemester: Semester = {
      id: newId,
      user_id: store.userId,
      name: params.name,
      academic_year: params.academic_year,
      start_date: params.start_date,
      end_date: params.end_date,
      sort_order: params.sort_order ?? store.semesters.length + 1,
      is_active: params.is_active ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      courses: [],
    };

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('semesters')
            .insert({
              id: newSemester.id,
              user_id: authData.user.id,
              name: params.name,
              academic_year: params.academic_year,
              start_date: params.start_date,
              end_date: params.end_date,
              sort_order: params.sort_order ?? store.semesters.length + 1,
              is_active: params.is_active ?? false,
            })
            .select()
            .single();
          if (!error && data) return data;
        }
      }
    }

    if (newSemester.is_active) {
      store.semesters.forEach((s) => (s.is_active = false));
    }
    store.semesters.push(newSemester);
    queueMutation(store, 'semesters', 'INSERT', newSemester.id, newSemester);
    saveStore(store);
    return newSemester;
  },

  async updateSemester(
    id: string,
    params: Partial<Omit<Semester, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<Semester | null> {
    if (isSupabaseConfigured() && isUuid(id)) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('semesters')
          .update({ ...params, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
      }
    }
    const store = loadStore();
    const idx = store.semesters.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    if (params.is_active) {
      store.semesters.forEach((s) => (s.is_active = false));
    }

    const updated = {
      ...store.semesters[idx],
      ...params,
      updated_at: new Date().toISOString(),
    };
    store.semesters[idx] = updated;
    queueMutation(store, 'semesters', 'UPDATE', id, updated);
    saveStore(store);
    return updated;
  },

  async deleteSemester(id: string): Promise<boolean> {
    if (isSupabaseConfigured() && isUuid(id)) {
      const supabase = createClient();
      if (supabase) {
        const { error } = await supabase.from('semesters').delete().eq('id', id);
        if (!error) return true;
      }
    }
    const store = loadStore();
    const courseIds = store.courses
      .filter((c) => c.semester_id === id)
      .map((c) => c.id);

    store.semesters = store.semesters.filter((s) => s.id !== id);
    store.courses = store.courses.filter((c) => c.semester_id !== id);
    store.course_people = store.course_people.filter(
      (cp) => !courseIds.includes(cp.course_id)
    );
    store.course_documents = store.course_documents.filter(
      (cd) => !courseIds.includes(cd.course_id)
    );
    store.events = store.events.filter((e) => e.semester_id !== id);
    queueMutation(store, 'semesters', 'DELETE', id, { id });
    saveStore(store);
    return true;
  },

  /* ------------------------------------------------------------------------
     COURSES
     ------------------------------------------------------------------------ */
  async getCourses(semesterId?: string): Promise<Course[]> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        let query = supabase.from('courses').select('*');
        if (semesterId) {
          query = query.eq('semester_id', semesterId);
        }
        const { data, error } = await query.order('course_code', { ascending: true });
        if (!error && data) return data;
      }
    }
    const store = loadStore();
    let courses = store.courses;
    if (semesterId) {
      courses = courses.filter((c) => c.semester_id === semesterId);
    }
    return courses.map((c) => {
      const people_count = store.course_people.filter((cp) => cp.course_id === c.id).length;
      const documents_count = store.course_documents.filter((cd) => cd.course_id === c.id).length;
      return { ...c, people_count, documents_count };
    });
  },

  async getCourse(id: string): Promise<Course | null> {
    if (isSupabaseConfigured() && isUuid(id)) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      }
    }
    const store = loadStore();
    const course = store.courses.find((c) => c.id === id || (id === 'c-ee4020' && c.id === 'c-ee4020e') || (id === 'c-ee4020e' && c.id === 'c-ee4020'));
    if (!course) return null;
    const people_count = store.course_people.filter((cp) => cp.course_id === course.id).length;
    const documents_count = store.course_documents.filter((cd) => cd.course_id === course.id).length;
    return { ...course, people_count, documents_count };
  },

  async createCourse(params: {
    semester_id: string;
    course_code: string;
    course_name: string;
    lecturer?: string | null;
    credits?: number;
    description?: string | null;
  }): Promise<Course> {
    const store = loadStore();
    const newId = crypto.randomUUID();
    const newCourse: Course = {
      id: newId,
      user_id: store.userId,
      semester_id: params.semester_id,
      course_code: params.course_code.trim().toUpperCase(),
      course_name: params.course_name.trim(),
      lecturer: params.lecturer?.trim() || null,
      credits: params.credits ?? 3,
      description: params.description?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('courses')
            .insert({
              id: newCourse.id,
              user_id: authData.user.id,
              semester_id: params.semester_id,
              course_code: newCourse.course_code,
              course_name: newCourse.course_name,
              lecturer: newCourse.lecturer,
              credits: newCourse.credits,
              description: newCourse.description,
            })
            .select()
            .single();
          if (!error && data) return data;
        }
      }
    }

    store.courses.push(newCourse);
    queueMutation(store, 'courses', 'INSERT', newCourse.id, newCourse);
    saveStore(store);
    return newCourse;
  },

  async updateCourse(
    id: string,
    params: Partial<Omit<Course, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<Course | null> {
    if (isSupabaseConfigured() && isUuid(id)) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('courses')
          .update({ ...params, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
      }
    }
    const store = loadStore();
    const idx = store.courses.findIndex((c) => c.id === id || (id === 'c-ee4020' && c.id === 'c-ee4020e'));
    if (idx === -1) return null;
    const updated = {
      ...store.courses[idx],
      ...params,
      course_code: params.course_code ? params.course_code.trim().toUpperCase() : store.courses[idx].course_code,
      updated_at: new Date().toISOString(),
    };
    store.courses[idx] = updated;
    queueMutation(store, 'courses', 'UPDATE', id, updated);
    saveStore(store);
    return updated;
  },

  async deleteCourse(id: string): Promise<boolean> {
    if (isSupabaseConfigured() && isUuid(id)) {
      const supabase = createClient();
      if (supabase) {
        const { error } = await supabase.from('courses').delete().eq('id', id);
        if (!error) return true;
      }
    }
    const store = loadStore();
    store.courses = store.courses.filter((c) => c.id !== id && c.id !== (id === 'c-ee4020' ? 'c-ee4020e' : ''));
    store.course_people = store.course_people.filter((cp) => cp.course_id !== id);
    store.course_documents = store.course_documents.filter((cd) => cd.course_id !== id);
    store.course_concepts = (store.course_concepts || []).filter((cc) => cc.course_id !== id);
    store.course_prerequisites = (store.course_prerequisites || []).filter((cp) => cp.course_id !== id && cp.prerequisite_course_id !== id);
    store.events = store.events.map((e) => (e.course_id === id ? { ...e, course_id: null } : e));
    delete store.layouts[id];
    queueMutation(store, 'courses', 'DELETE', id, { id });
    saveStore(store);
    return true;
  },

  /* ------------------------------------------------------------------------
     COURSE GRAPH (People, Documents, Concepts & Layout for Course)
     ------------------------------------------------------------------------ */
  async getCourseGraphData(courseId: string): Promise<{
    course: Course;
    people: Person[];
    documents: DocumentItem[];
    concepts: Concept[];
    layout: CourseGraphLayout | null;
    allPeople: Person[];
    allDocuments: DocumentItem[];
  } | null> {
    const course = await this.getCourse(courseId);
    if (!course) return null;

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        // Query connected people
        const { data: cpData } = await supabase
          .from('course_people')
          .select('*, people(*)')
          .eq('course_id', courseId);

        // Query connected documents
        const { data: cdData } = await supabase
          .from('course_documents')
          .select('*, documents(*)')
          .eq('course_id', courseId)
          .order('display_order', { ascending: true });

        // Query connected concepts
        const { data: ccData } = await supabase
          .from('course_concepts')
          .select('*, concepts(*)')
          .eq('course_id', courseId);

        // Query layout
        const { data: layoutData } = await supabase
          .from('course_graph_layouts')
          .select('*')
          .eq('course_id', courseId)
          .maybeSingle();

        // Query all user's people and documents
        const { data: allP } = await supabase.from('people').select('*');
        const { data: allD } = await supabase.from('documents').select('*');

        const connectedPeople = (cpData || []).map((cp: any) => ({
          ...cp.people,
          course_relationship: {
            id: cp.id,
            user_id: cp.user_id,
            course_id: cp.course_id,
            person_id: cp.person_id,
            relationship_type: cp.relationship_type,
            knowledge_topics: cp.knowledge_topics || [],
            context_note: cp.context_note,
            created_at: cp.created_at,
          },
        }));

        const connectedDocs = (cdData || []).map((cd: any) => cd.documents);
        const connectedConcepts = (ccData || []).map((cc: any) => cc.concepts).filter(Boolean);

        return {
          course,
          people: connectedPeople,
          documents: connectedDocs,
          concepts: connectedConcepts,
          layout: layoutData || null,
          allPeople: allP || [],
          allDocuments: allD || [],
        };
      }
    }

    const store = loadStore();
    const effectiveCourseId = (courseId === 'c-ee4020' && !store.layouts['c-ee4020'] && store.layouts['c-ee4020e'])
      ? 'c-ee4020e'
      : ((courseId === 'c-ee4020e' && !store.layouts['c-ee4020e'] && store.layouts['c-ee4020']) ? 'c-ee4020' : courseId);

    const coursePeopleLinks = store.course_people.filter(
      (cp) => cp.course_id === courseId || cp.course_id === effectiveCourseId
    );
    const people: Person[] = [];
    for (const cp of coursePeopleLinks) {
      const person = store.people.find((p) => p.id === cp.person_id);
      if (person) {
        const associatedCourses = store.course_people
          .filter((link) => link.person_id === person.id)
          .map((link) => {
            const c = store.courses.find((x) => x.id === link.course_id);
            return {
              id: link.course_id,
              course_code: c?.course_code || '',
              course_name: c?.course_name || '',
              relationship_type: link.relationship_type,
            };
          });

        people.push({
          ...person,
          course_relationship: cp,
          associated_courses: associatedCourses,
        });
      }
    }

    const courseDocLinks = store.course_documents
      .filter((cd) => cd.course_id === courseId || cd.course_id === effectiveCourseId)
      .sort((a, b) => a.display_order - b.display_order);

    const documents: DocumentItem[] = [];
    for (const cd of courseDocLinks) {
      const doc = store.documents.find((d) => d.id === cd.document_id);
      if (doc) {
        const associatedCourses = store.course_documents
          .filter((link) => link.document_id === doc.id)
          .map((link) => {
            const c = store.courses.find((x) => x.id === link.course_id);
            return {
              id: link.course_id,
              course_code: c?.course_code || '',
              course_name: c?.course_name || '',
            };
          });
        documents.push({
          ...doc,
          associated_courses: associatedCourses,
        });
      }
    }

    const courseConceptLinks = (store.course_concepts || []).filter(
      (cc) => cc.course_id === courseId || cc.course_id === effectiveCourseId
    );
    const concepts: Concept[] = [];
    for (const cc of courseConceptLinks) {
      const conc = (store.concepts || []).find((c) => c.id === cc.concept_id);
      if (conc) {
        concepts.push(conc);
      }
    }

    const layout = store.layouts[courseId] || store.layouts[effectiveCourseId] || null;

    return {
      course,
      people,
      documents,
      concepts,
      layout,
      allPeople: store.people,
      allDocuments: store.documents,
    };
  },

  async saveCourseGraphLayout(
    courseId: string,
    positions: Record<string, { x: number; y: number }>,
    viewport: { x: number; y: number; zoom: number }
  ): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { error } = await supabase
            .from('course_graph_layouts')
            .upsert(
              {
                user_id: authData.user.id,
                course_id: courseId,
                positions,
                viewport,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,course_id' }
            );
          if (!error) return true;
        }
      }
    }

    const store = loadStore();
    const layout: CourseGraphLayout = {
      course_id: courseId,
      user_id: store.userId,
      positions,
      viewport,
      updated_at: new Date().toISOString(),
    };
    store.layouts[courseId] = layout;
    queueMutation(store, 'course_graph_layouts', 'UPDATE', courseId, layout);
    saveStore(store);
    return true;
  },

  /* ------------------------------------------------------------------------
     PEOPLE & RELATIONSHIPS
     ------------------------------------------------------------------------ */
  async getPeople(): Promise<Person[]> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('people')
          .select('*')
          .order('full_name', { ascending: true });
        if (!error && data) return data;
      }
    }
    const store = loadStore();
    return store.people.map((p) => {
      const associatedCourses = store.course_people
        .filter((cp) => cp.person_id === p.id)
        .map((cp) => {
          const c = store.courses.find((x) => x.id === cp.course_id);
          return {
            id: cp.course_id,
            course_code: c?.course_code || '',
            course_name: c?.course_name || '',
            relationship_type: cp.relationship_type,
          };
        });
      return { ...p, associated_courses: associatedCourses };
    });
  },

  async getPerson(id: string): Promise<Person | null> {
    if (isSupabaseConfigured() && isUuid(id)) {
      const supabase = createClient();
      if (supabase) {
        const { data: p, error } = await supabase
          .from('people')
          .select('*, course_people(*, courses(*))')
          .eq('id', id)
          .maybeSingle();
        if (!error && p) {
          const associatedCourses = (p.course_people || []).map((cp: any) => ({
            id: cp.course_id,
            course_code: cp.courses?.course_code || '',
            course_name: cp.courses?.course_name || '',
            relationship_type: cp.relationship_type,
          }));
          return { ...p, associated_courses: associatedCourses };
        }
      }
    }
    const store = loadStore();
    const p = store.people.find((person) => person.id === id);
    if (!p) return null;
    const associatedCourses = store.course_people
      .filter((cp) => cp.person_id === p.id)
      .map((cp) => {
        const c = store.courses.find((x) => x.id === cp.course_id);
        return {
          id: cp.course_id,
          course_code: c?.course_code || '',
          course_name: c?.course_name || '',
          relationship_type: cp.relationship_type,
        };
      });
    return { ...p, associated_courses: associatedCourses };
  },

  async createPerson(params: {
    full_name: string;
    nickname?: string | null;
    email?: string | null;
    phone?: string | null;
    contact_links?: Record<string, string>;
    class_name?: string | null;
    major?: string | null;
    skills?: string[];
    notes?: string | null;
  }): Promise<Person> {
    const store = loadStore();
    const newId = crypto.randomUUID();
    const newPerson: Person = {
      id: newId,
      user_id: store.userId,
      full_name: params.full_name.trim(),
      nickname: params.nickname?.trim() || null,
      email: params.email?.trim() || null,
      phone: params.phone?.trim() || null,
      contact_links: params.contact_links || {},
      class_name: params.class_name?.trim() || null,
      major: params.major?.trim() || null,
      skills: params.skills || [],
      notes: params.notes?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('people')
            .insert({ ...newPerson, user_id: authData.user.id })
            .select()
            .single();
          if (!error && data) return data;
        }
      }
    }

    store.people.push(newPerson);
    queueMutation(store, 'people', 'INSERT', newPerson.id, newPerson);
    saveStore(store);
    return newPerson;
  },

  async updatePerson(
    id: string,
    params: Partial<Omit<Person, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<Person | null> {
    if (isSupabaseConfigured() && isUuid(id)) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('people')
          .update({ ...params, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
      }
    }
    const store = loadStore();
    const idx = store.people.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const updated = {
      ...store.people[idx],
      ...params,
      updated_at: new Date().toISOString(),
    };
    store.people[idx] = updated;
    queueMutation(store, 'people', 'UPDATE', id, updated);
    saveStore(store);
    return updated;
  },

  async deletePerson(id: string): Promise<boolean> {
    if (isSupabaseConfigured() && isUuid(id)) {
      const supabase = createClient();
      if (supabase) {
        const { error } = await supabase.from('people').delete().eq('id', id);
        if (!error) return true;
      }
    }
    const store = loadStore();
    store.people = store.people.filter((p) => p.id !== id);
    store.course_people = store.course_people.filter((cp) => cp.person_id !== id);
    queueMutation(store, 'people', 'DELETE', id, { id });
    saveStore(store);
    return true;
  },

  async linkPersonToCourse(params: {
    course_id: string;
    person_id: string;
    relationship_type: RelationshipType;
    knowledge_topics?: string[];
    context_note?: string | null;
  }): Promise<CoursePerson> {
    const store = loadStore();
    const existingIdx = store.course_people.findIndex(
      (cp) => cp.course_id === params.course_id && cp.person_id === params.person_id
    );

    if (existingIdx !== -1) {
      // update existing
      store.course_people[existingIdx] = {
        ...store.course_people[existingIdx],
        relationship_type: params.relationship_type,
        knowledge_topics: params.knowledge_topics || [],
        context_note: params.context_note?.trim() || null,
      };
      queueMutation(
        store,
        'course_people',
        'UPDATE',
        store.course_people[existingIdx].id,
        store.course_people[existingIdx]
      );
      saveStore(store);
      return store.course_people[existingIdx];
    }

    const newLink: CoursePerson = {
      id: crypto.randomUUID(),
      user_id: store.userId,
      course_id: params.course_id,
      person_id: params.person_id,
      relationship_type: params.relationship_type,
      knowledge_topics: params.knowledge_topics || [],
      context_note: params.context_note?.trim() || null,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('course_people')
            .upsert(
              {
                id: newLink.id,
                user_id: authData.user.id,
                course_id: params.course_id,
                person_id: params.person_id,
                relationship_type: params.relationship_type,
                knowledge_topics: params.knowledge_topics || [],
                context_note: params.context_note?.trim() || null,
              },
              { onConflict: 'course_id,person_id' }
            )
            .select()
            .single();
          if (!error && data) return data;
        }
      }
    }

    store.course_people.push(newLink);
    queueMutation(store, 'course_people', 'INSERT', newLink.id, newLink);
    saveStore(store);
    return newLink;
  },

  async unlinkPersonFromCourse(course_id: string, person_id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { error } = await supabase
          .from('course_people')
          .delete()
          .eq('course_id', course_id)
          .eq('person_id', person_id);
        if (!error) return true;
      }
    }
    const store = loadStore();
    const removed = store.course_people.find(
      (cp) => cp.course_id === course_id && cp.person_id === person_id
    );
    store.course_people = store.course_people.filter(
      (cp) => !(cp.course_id === course_id && cp.person_id === person_id)
    );
    if (removed) {
      queueMutation(store, 'course_people', 'DELETE', removed.id, { id: removed.id });
    }
    saveStore(store);
    return true;
  },

  /* ------------------------------------------------------------------------
     DOCUMENTS & COURSE DOCUMENTS
     ------------------------------------------------------------------------ */
  async getDocuments(): Promise<DocumentItem[]> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .order('uploaded_at', { ascending: false });
        if (!error && data) return data;
      }
    }
    const store = loadStore();
    return store.documents.map((d) => {
      const associatedCourses = store.course_documents
        .filter((cd) => cd.document_id === d.id)
        .map((cd) => {
          const c = store.courses.find((x) => x.id === cd.course_id);
          return {
            id: cd.course_id,
            course_code: c?.course_code || '',
            course_name: c?.course_name || '',
          };
        });
      return { ...d, associated_courses: associatedCourses };
    });
  },

  async getDocument(id: string): Promise<DocumentItem | null> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data: d, error } = await supabase
          .from('documents')
          .select('*, course_documents(*, courses(*))')
          .eq('id', id)
          .maybeSingle();
        if (!error && d) {
          const associatedCourses = (d.course_documents || []).map((cd: any) => ({
            id: cd.course_id,
            course_code: cd.courses?.course_code || '',
            course_name: cd.courses?.course_name || '',
          }));
          return { ...d, associated_courses: associatedCourses };
        }
      }
    }
    const store = loadStore();
    const doc = store.documents.find((d) => d.id === id);
    if (!doc) return null;
    const associatedCourses = store.course_documents
      .filter((cd) => cd.document_id === doc.id)
      .map((cd) => {
        const c = store.courses.find((x) => x.id === cd.course_id);
        return {
          id: cd.course_id,
          course_code: c?.course_code || '',
          course_name: c?.course_name || '',
        };
      });
    return { ...doc, associated_courses: associatedCourses };
  },

  async uploadDocument(
    params: {
      original_file_name: string;
      category: DocumentCategory;
      mime_type: string;
      file_size: number;
      description?: string | null;
      file_content_base64?: string;
    },
    courseId?: string
  ): Promise<DocumentItem> {
    const store = loadStore();
    const newDocId = crypto.randomUUID();
    const storagePath = `documents/${store.userId}/${newDocId}_${params.original_file_name}`;

    // Store binary payload exclusively in IndexedDB (with in-memory fallback for SSR/tests)
    if (params.file_content_base64) {
      await BlobStorage.saveBlob(newDocId, params.file_content_base64).catch(() => {});
    }

    const newDoc: DocumentItem = {
      id: newDocId,
      user_id: store.userId,
      original_file_name: params.original_file_name,
      storage_path: storagePath,
      mime_type: params.mime_type,
      file_size: params.file_size,
      category: params.category,
      description: params.description?.trim() || null,
      uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      download_url: `/api/documents/${newDocId}`,
    };

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('documents')
            .insert({
              id: newDoc.id,
              user_id: authData.user.id,
              original_file_name: newDoc.original_file_name,
              storage_path: storagePath,
              mime_type: newDoc.mime_type,
              file_size: newDoc.file_size,
              category: newDoc.category,
              description: newDoc.description,
            })
            .select()
            .single();

          if (!error && data) {
            if (courseId) {
              await this.linkDocumentToCourse(courseId, data.id);
            }
            return data;
          }
        }
      }
    }

    store.documents.unshift(newDoc);
    queueMutation(store, 'documents', 'INSERT', newDoc.id, newDoc);

    if (courseId) {
      const newCd: CourseDocument = {
        id: crypto.randomUUID(),
        user_id: store.userId,
        course_id: courseId,
        document_id: newDoc.id,
        display_order: store.course_documents.filter((cd) => cd.course_id === courseId).length + 1,
        created_at: new Date().toISOString(),
      };
      store.course_documents.push(newCd);
      queueMutation(store, 'course_documents', 'INSERT', newCd.id, newCd);
    }
    saveStore(store);
    return newDoc;
  },

  async updateDocument(
    id: string,
    params: Partial<Pick<DocumentItem, 'original_file_name' | 'category' | 'description'>>
  ): Promise<DocumentItem | null> {
    if (isSupabaseConfigured() && isUuid(id)) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('documents')
          .update({ ...params, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
      }
    }
    const store = loadStore();
    const idx = store.documents.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    const updated = {
      ...store.documents[idx],
      ...params,
      updated_at: new Date().toISOString(),
    };
    store.documents[idx] = updated;
    queueMutation(store, 'documents', 'UPDATE', id, updated);
    saveStore(store);
    return updated;
  },

  async linkDocumentToCourse(course_id: string, document_id: string): Promise<boolean> {
    const store = loadStore();
    const exists = store.course_documents.some(
      (cd) => cd.course_id === course_id && cd.document_id === document_id
    );
    if (exists) return true;

    const newLink: CourseDocument = {
      id: crypto.randomUUID(),
      user_id: store.userId,
      course_id,
      document_id,
      display_order: store.course_documents.filter((cd) => cd.course_id === course_id).length + 1,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { error } = await supabase
            .from('course_documents')
            .insert({
              id: newLink.id,
              user_id: authData.user.id,
              course_id,
              document_id,
              display_order: newLink.display_order,
            });
          if (!error) return true;
        }
      }
    }

    store.course_documents.push(newLink);
    queueMutation(store, 'course_documents', 'INSERT', newLink.id, newLink);
    saveStore(store);
    return true;
  },

  async unlinkDocumentFromCourse(course_id: string, document_id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { error } = await supabase
          .from('course_documents')
          .delete()
          .eq('course_id', course_id)
          .eq('document_id', document_id);
        if (!error) return true;
      }
    }
    const store = loadStore();
    const removed = store.course_documents.find(
      (cd) => cd.course_id === course_id && cd.document_id === document_id
    );
    store.course_documents = store.course_documents.filter(
      (cd) => !(cd.course_id === course_id && cd.document_id === document_id)
    );
    if (removed) {
      queueMutation(store, 'course_documents', 'DELETE', removed.id, { id: removed.id });
    }
    saveStore(store);
    return true;
  },

  async moveDocument(document_id: string, from_course_id: string, to_course_id: string): Promise<boolean> {
    await this.unlinkDocumentFromCourse(from_course_id, document_id);
    await this.linkDocumentToCourse(to_course_id, document_id);
    return true;
  },

  async deleteDocument(id: string): Promise<boolean> {
    if (isSupabaseConfigured() && isUuid(id)) {
      const supabase = createClient();
      if (supabase) {
        const { error } = await supabase.from('documents').delete().eq('id', id);
        if (!error) return true;
      }
    }
    const store = loadStore();
    store.documents = store.documents.filter((d) => d.id !== id);
    store.course_documents = store.course_documents.filter((cd) => cd.document_id !== id);
    queueMutation(store, 'documents', 'DELETE', id, { id });
    saveStore(store);
    await BlobStorage.deleteBlob(id).catch(() => {});
    return true;
  },

  async getDocumentBlob(documentId: string): Promise<Blob | ArrayBuffer | string | null> {
    const b = await BlobStorage.getBlob(documentId);
    if (b) return b;
    const doc = await this.getDocument(documentId);
    return doc?.download_url || null;
  },

  /* ------------------------------------------------------------------------
     CONCEPTS (Academic Knowledge Graph Nodes)
     ------------------------------------------------------------------------ */
  async getConcepts(): Promise<Concept[]> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase.from('concepts').select('*').order('name', { ascending: true });
        if (!error && data) return data;
      }
    }
    const store = loadStore();
    return [...(store.concepts || [])].sort((a, b) => a.name.localeCompare(b.name));
  },

  async getConcept(id: string): Promise<Concept | null> {
    if (isSupabaseConfigured() && isUuid(id)) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase.from('concepts').select('*').eq('id', id).maybeSingle();
        if (!error && data) return data;
      }
    }
    const store = loadStore();
    return (store.concepts || []).find((c) => c.id === id) || null;
  },

  async createConcept(data: { name: string; description?: string }): Promise<Concept> {
    const store = loadStore();
    const id = crypto.randomUUID();
    const slug =
      data.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `concept-${Date.now()}`;

    const concept: Concept = {
      id,
      user_id: store.userId,
      name: data.name.trim(),
      slug,
      description: data.description?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data: created, error } = await supabase
            .from('concepts')
            .insert({ ...concept, user_id: authData.user.id })
            .select()
            .single();
          if (!error && created) return created;
        }
      }
    }

    store.concepts = [...(store.concepts || []), concept];
    queueMutation(store, 'concepts', 'INSERT', concept.id, concept);
    saveStore(store);
    return concept;
  },

  async getCourseConcepts(courseId: string): Promise<(CourseConcept & { concept?: Concept })[]> {
    const normCourseId = (courseId === 'c-ee4020' && !loadStore().courses.some(c => c.id === 'c-ee4020')) ? 'c-ee4020e' : courseId;
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('course_concepts')
          .select('*, concept:concepts(*)')
          .eq('course_id', normCourseId);
        if (!error && data) return data;
      }
    }
    const store = loadStore();
    const links = (store.course_concepts || []).filter(
      (cc) => cc.course_id === courseId || cc.course_id === normCourseId
    );
    return links.map((link) => ({
      ...link,
      concept: (store.concepts || []).find((c) => c.id === link.concept_id),
    }));
  },

  async linkConceptToCourse(data: {
    course_id: string;
    concept_id: string;
    relevance_score?: number;
    source_type?: 'MANUAL' | 'EXTRACTED_SYLLABUS' | 'EXTRACTED_DOCUMENT';
  }): Promise<CourseConcept> {
    const store = loadStore();
    const existing = (store.course_concepts || []).find(
      (cc) => cc.course_id === data.course_id && cc.concept_id === data.concept_id
    );
    if (existing) return existing;

    const newLink: CourseConcept = {
      id: crypto.randomUUID(),
      user_id: store.userId,
      course_id: data.course_id,
      concept_id: data.concept_id,
      relevance_score: data.relevance_score ?? 1.0,
      source_type: data.source_type ?? 'MANUAL',
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data: created, error } = await supabase
            .from('course_concepts')
            .upsert(
              { ...newLink, user_id: authData.user.id },
              { onConflict: 'course_id,concept_id' }
            )
            .select()
            .single();
          if (!error && created) return created;
        }
      }
    }

    store.course_concepts = [...(store.course_concepts || []), newLink];
    queueMutation(store, 'course_concepts', 'INSERT', newLink.id, newLink);
    saveStore(store);
    return newLink;
  },

  async unlinkConceptFromCourse(courseId: string, conceptId: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { error } = await supabase
          .from('course_concepts')
          .delete()
          .eq('course_id', courseId)
          .eq('concept_id', conceptId);
        if (!error) return true;
      }
    }
    const store = loadStore();
    const removed = (store.course_concepts || []).find(
      (cc) => cc.course_id === courseId && cc.concept_id === conceptId
    );
    store.course_concepts = (store.course_concepts || []).filter(
      (cc) => !(cc.course_id === courseId && cc.concept_id === conceptId)
    );
    if (removed) {
      queueMutation(store, 'course_concepts', 'DELETE', removed.id, { id: removed.id });
    }
    saveStore(store);
    return true;
  },

  /* ------------------------------------------------------------------------
     DOCUMENT AI SUMMARIES
     ------------------------------------------------------------------------ */
  async getDocumentSummary(documentId: string): Promise<DocumentSummary | null> {
    if (isSupabaseConfigured() && isUuid(documentId)) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('document_summaries')
          .select('*')
          .eq('document_id', documentId)
          .maybeSingle();
        if (!error && data) return data;
      }
    }
    const store = loadStore();
    return (store.document_summaries || []).find((s) => s.document_id === documentId) || null;
  },

  async saveDocumentSummary(summary: DocumentSummary): Promise<DocumentSummary> {
    const store = loadStore();
    const finalSummary: DocumentSummary = {
      ...summary,
      id: summary.id || crypto.randomUUID(),
      user_id: summary.user_id || store.userId,
      generated_at: summary.generated_at || new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('document_summaries')
            .upsert(
              { ...finalSummary, user_id: authData.user.id },
              { onConflict: 'user_id,document_id' }
            )
            .select()
            .single();
          if (!error && data) return data;
        }
      }
    }

    if (!store.document_summaries) store.document_summaries = [];
    const idx = store.document_summaries.findIndex((s) => s.document_id === finalSummary.document_id);
    if (idx !== -1) {
      store.document_summaries[idx] = finalSummary;
    } else {
      store.document_summaries.push(finalSummary);
    }
    queueMutation(store, 'document_summaries', 'INSERT', finalSummary.id, finalSummary);
    saveStore(store);
    return finalSummary;
  },

  /* ------------------------------------------------------------------------
     COURSE PREREQUISITES (Academic Curriculum DAG)
     ------------------------------------------------------------------------ */
  async getCoursePrerequisites(courseId?: string): Promise<CoursePrerequisite[]> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        let query = supabase.from('course_prerequisites').select('*');
        if (courseId && isUuid(courseId)) {
          query = query.eq('course_id', courseId);
        }
        const { data, error } = await query;
        if (!error && data) return data;
      }
    }
    const store = loadStore();
    const list = store.course_prerequisites || [];
    if (courseId) {
      return list.filter(
        (p) =>
          p.course_id === courseId ||
          (courseId === 'c-ee4020' && p.course_id === 'c-ee4020e') ||
          (courseId === 'c-ee4020e' && p.course_id === 'c-ee4020')
      );
    }
    return list;
  },

  async addCoursePrerequisite(
    courseId: string,
    prerequisiteCourseId: string
  ): Promise<CoursePrerequisite> {
    if (courseId === prerequisiteCourseId) {
      throw new Error('A course cannot be a prerequisite of itself');
    }
    const store = loadStore();
    const existing = (store.course_prerequisites || []).find(
      (p) => p.course_id === courseId && p.prerequisite_course_id === prerequisiteCourseId
    );
    if (existing) return existing;

    const item: CoursePrerequisite = {
      id: crypto.randomUUID(),
      user_id: store.userId,
      course_id: courseId,
      prerequisite_course_id: prerequisiteCourseId,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('course_prerequisites')
            .upsert(
              { ...item, user_id: authData.user.id },
              { onConflict: 'course_id,prerequisite_course_id' }
            )
            .select()
            .single();
          if (!error && data) return data;
        }
      }
    }

    store.course_prerequisites = [...(store.course_prerequisites || []), item];
    queueMutation(store, 'course_prerequisites', 'INSERT', item.id, item);
    saveStore(store);
    return item;
  },

  async removeCoursePrerequisite(
    courseId: string,
    prerequisiteCourseId: string
  ): Promise<boolean> {
    const store = loadStore();
    const existing = (store.course_prerequisites || []).find(
      (p) => p.course_id === courseId && p.prerequisite_course_id === prerequisiteCourseId
    );

    if (isSupabaseConfigured() && existing && isUuid(existing.id)) {
      const supabase = createClient();
      if (supabase) {
        const { error } = await supabase
          .from('course_prerequisites')
          .delete()
          .eq('id', existing.id);
        if (!error) return true;
      }
    }

    store.course_prerequisites = (store.course_prerequisites || []).filter(
      (p) => !(p.course_id === courseId && p.prerequisite_course_id === prerequisiteCourseId)
    );
    if (existing) {
      queueMutation(store, 'course_prerequisites', 'DELETE', existing.id, { id: existing.id });
    }
    saveStore(store);
    return true;
  },

  /* ------------------------------------------------------------------------
     EVENTS & CALENDAR
     ------------------------------------------------------------------------ */
  async getEvents(
    semesterId: string,
    filters?: { courseId?: string; eventTypes?: EventType[] }
  ): Promise<CalendarEvent[]> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        let query = supabase
          .from('events')
          .select('*, courses(*)')
          .eq('semester_id', semesterId);
        if (filters?.courseId) {
          query = query.eq('course_id', filters.courseId);
        }
        if (filters?.eventTypes && filters.eventTypes.length > 0) {
          query = query.in('event_type', filters.eventTypes);
        }
        const { data, error } = await query.order('start_at', { ascending: true });
        if (!error && data) {
          return data.map((ev: any) => ({
            ...ev,
            course: ev.courses || null,
          }));
        }
      }
    }

    const store = loadStore();
    let events = store.events.filter((e) => e.semester_id === semesterId);

    if (filters?.courseId) {
      events = events.filter((e) => e.course_id === filters.courseId);
    }
    if (filters?.eventTypes && filters.eventTypes.length > 0) {
      events = events.filter((e) => filters.eventTypes!.includes(e.event_type));
    }

    return events.map((e) => ({
      ...e,
      course: e.course_id ? store.courses.find((c) => c.id === e.course_id) || null : null,
    }));
  },

  async createEvent(params: {
    semester_id: string;
    course_id?: string | null;
    title: string;
    description?: string | null;
    event_type: EventType;
    location?: string | null;
    start_at: string;
    end_at: string;
    all_day?: boolean;
    recurrence_rule?: string | null;
    timezone?: string;
    reminder_offsets_minutes?: number[];
  }): Promise<CalendarEvent> {
    const store = loadStore();

    // Verify course-semester integrity
    if (params.course_id) {
      const course = store.courses.find((c) => c.id === params.course_id);
      if (!course || course.semester_id !== params.semester_id) {
        throw new Error('Course does not belong to the selected semester');
      }
    }

    const newId = crypto.randomUUID();
    const newEvent: CalendarEvent = {
      id: newId,
      user_id: store.userId,
      semester_id: params.semester_id,
      course_id: params.course_id || null,
      title: params.title.trim(),
      description: params.description?.trim() || null,
      event_type: params.event_type,
      location: params.location?.trim() || null,
      start_at: params.start_at,
      end_at: params.end_at,
      all_day: params.all_day ?? false,
      recurrence_rule: params.recurrence_rule || null,
      timezone: params.timezone || 'Asia/Ho_Chi_Minh',
      reminder_offsets_minutes: params.reminder_offsets_minutes || [15],
      deadline_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          const { data, error } = await supabase
            .from('events')
            .insert({ ...newEvent, user_id: authData.user.id })
            .select()
            .single();
          if (!error && data) return data;
        }
      }
    }

    store.events.push(newEvent);
    queueMutation(store, 'events', 'INSERT', newEvent.id, newEvent);
    saveStore(store);
    return newEvent;
  },

  async updateEvent(
    id: string,
    params: Partial<Omit<CalendarEvent, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'course'>>
  ): Promise<CalendarEvent | null> {
    const store = loadStore();
    const idx = store.events.findIndex((e) => e.id === id);
    if (idx === -1) return null;

    // Verify course-semester integrity
    if (params.course_id !== undefined || params.semester_id !== undefined) {
      const targetSemesterId = params.semester_id || store.events[idx].semester_id;
      const targetCourseId = params.course_id !== undefined ? params.course_id : store.events[idx].course_id;

      if (targetCourseId) {
        const course = store.courses.find((c) => c.id === targetCourseId);
        if (!course || course.semester_id !== targetSemesterId) {
          throw new Error('Course does not belong to the selected semester');
        }
      }
    }

    // Validate start_at <= end_at if both are effective
    const effectiveStart = params.start_at !== undefined ? params.start_at : store.events[idx].start_at;
    const effectiveEnd = params.end_at !== undefined ? params.end_at : store.events[idx].end_at;
    if (effectiveStart && effectiveEnd && new Date(effectiveStart).getTime() > new Date(effectiveEnd).getTime()) {
      throw new Error('Event start_at cannot be after end_at');
    }

    if (isSupabaseConfigured() && isUuid(id)) {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('events')
          .update({ ...params, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
      }
    }

    const updated = {
      ...store.events[idx],
      ...params,
      updated_at: new Date().toISOString(),
    };
    store.events[idx] = updated;
    queueMutation(store, 'events', 'UPDATE', id, updated);
    saveStore(store);
    return updated;
  },

  async deleteEvent(id: string): Promise<boolean> {
    if (isSupabaseConfigured() && isUuid(id)) {
      const supabase = createClient();
      if (supabase) {
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (!error) return true;
      }
    }
    const store = loadStore();
    store.events = store.events.filter((e) => e.id !== id);
    queueMutation(store, 'events', 'DELETE', id, { id });
    saveStore(store);
    return true;
  },

  /* ------------------------------------------------------------------------
     GLOBAL SEARCH (Semesters, Courses, People, Documents, Events, Concepts)
     ------------------------------------------------------------------------ */
  async globalSearch(query: string): Promise<GlobalSearchResult[]> {
    if (!query || query.trim().length === 0) return [];
    const q = query.trim().toLowerCase();
    const nq = q
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd');

    const matchesSearch = (text: string | null | undefined): boolean => {
      if (!text) return false;
      const lower = text.toLowerCase();
      if (lower.includes(q)) return true;
      const normalized = lower
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd');
      return normalized.includes(nq);
    };

    const store = loadStore();
    const results: GlobalSearchResult[] = [];

    // Search Semesters
    for (const sem of store.semesters) {
      if (matchesSearch(sem.name) || matchesSearch(sem.academic_year)) {
        results.push({
          id: sem.id,
          type: 'semester',
          title: sem.name,
          subtitle: sem.academic_year,
          url: `/app/semesters/${sem.id}`,
        });
      }
    }

    // Search Courses
    for (const c of store.courses) {
      if (
        matchesSearch(c.course_code) ||
        matchesSearch(c.course_name) ||
        matchesSearch(c.lecturer) ||
        matchesSearch(c.description)
      ) {
        results.push({
          id: c.id,
          type: 'course',
          title: `${c.course_code} – ${c.course_name}`,
          subtitle: c.lecturer ? `Lecturer: ${c.lecturer}` : `Credits: ${c.credits}`,
          url: `/app/semesters/${c.semester_id}/courses/${c.id}`,
        });
      }
    }

    // Search People (including skills, knowledge topics, context notes, and contact links)
    for (const p of store.people) {
      const courseLinks = store.course_people.filter((cp) => cp.person_id === p.id);
      const matchesTopic = courseLinks.some((cp) =>
        cp.knowledge_topics?.some((kt) => matchesSearch(kt)) ||
        matchesSearch(cp.context_note)
      );
      const matchesContact = Object.values(p.contact_links || {}).some(
        (val) => typeof val === 'string' && matchesSearch(val)
      );

      if (
        matchesSearch(p.full_name) ||
        matchesSearch(p.nickname) ||
        matchesSearch(p.email) ||
        matchesSearch(p.phone) ||
        matchesSearch(p.class_name) ||
        matchesSearch(p.major) ||
        p.skills.some((sk) => matchesSearch(sk)) ||
        matchesSearch(p.notes) ||
        matchesTopic ||
        matchesContact
      ) {
        const firstLink = store.course_people.find((cp) => cp.person_id === p.id);
        const course = firstLink ? store.courses.find((c) => c.id === firstLink.course_id) : null;
        results.push({
          id: p.id,
          type: 'person',
          title: p.full_name,
          subtitle: `${p.class_name || p.major || 'Contact'}${
            p.skills.length > 0 ? ` • ${p.skills.slice(0, 3).join(', ')}` : ''
          }`,
          url: course
            ? `/app/semesters/${course.semester_id}/courses/${course.id}?inspectPerson=${p.id}`
            : `/app/semesters`,
        });
      }
    }

    // Search Documents
    for (const doc of store.documents) {
      if (
        matchesSearch(doc.original_file_name) ||
        matchesSearch(doc.category) ||
        matchesSearch(doc.description)
      ) {
        const firstLink = store.course_documents.find((cd) => cd.document_id === doc.id);
        const course = firstLink ? store.courses.find((c) => c.id === firstLink.course_id) : null;
        results.push({
          id: doc.id,
          type: 'document',
          title: doc.original_file_name,
          subtitle: `${doc.category} • ${(doc.file_size / 1024 / 1024).toFixed(2)} MB`,
          url: course
            ? `/app/semesters/${course.semester_id}/courses/${course.id}?inspectDoc=${doc.id}`
            : `/app/semesters`,
        });
      }
    }

    // Search Events
    for (const ev of store.events) {
      if (
        matchesSearch(ev.title) ||
        matchesSearch(ev.description) ||
        matchesSearch(ev.location)
      ) {
        results.push({
          id: ev.id,
          type: 'event',
          title: ev.title,
          subtitle: `${ev.event_type} • ${new Date(ev.start_at).toLocaleDateString()}`,
          url: `/app/calendar?semesterId=${ev.semester_id}&eventId=${ev.id}`,
        });
      }
    }

    // Search Concepts
    for (const c of store.concepts || []) {
      if (
        matchesSearch(c.name) ||
        matchesSearch(c.slug) ||
        matchesSearch(c.description)
      ) {
        const link = (store.course_concepts || []).find((cc) => cc.concept_id === c.id);
        const course = link ? store.courses.find((x) => x.id === link.course_id) : null;
        results.push({
          id: c.id,
          type: 'concept',
          title: c.name,
          subtitle: course ? `Concept in ${course.course_code}` : 'Academic Concept',
          url: course
            ? `/app/semesters/${course.semester_id}/courses/${course.id}`
            : `/app/semesters`,
        });
      }
    }

    return results;
  },

  /* ------------------------------------------------------------------------
     BACKUP & RESTORE / SEED RESET
     ------------------------------------------------------------------------ */
  exportAllData(): string {
    const store = loadStore();
    return JSON.stringify(store, null, 2);
  },

  async exportFullArchive(): Promise<Blob> {
    const store = loadStore();
    const blobs: Record<string, string> = {};

    // 1. Collect all stored blobs from BlobStorage
    const allStoredBlobs = await BlobStorage.getAllBlobs();
    for (const [docId, blobVal] of allStoredBlobs.entries()) {
      if (typeof blobVal === "string") {
        blobs[docId] = blobVal;
      } else if (typeof Blob !== "undefined" && blobVal instanceof Blob) {
        try {
          const buffer = await blobVal.arrayBuffer();
          const base64 = typeof Buffer !== "undefined"
            ? Buffer.from(buffer).toString("base64")
            : btoa(String.fromCharCode(...new Uint8Array(buffer)));
          blobs[docId] = `data:${blobVal.type || "application/octet-stream"};base64,${base64}`;
        } catch {}
      }
    }

    // 2. Fall back to any data URLs in store.documents
    for (const doc of store.documents) {
      if (!blobs[doc.id] && doc.download_url && doc.download_url.startsWith("data:")) {
        blobs[doc.id] = doc.download_url;
      }
    }

    const archiveJson = JSON.stringify(
      {
        ...store,
        _blobs: blobs,
        _manifest: {
          app: "NEURON",
          version: "2.0.0",
          exported_at: new Date().toISOString(),
          storage_engine: "indexeddb+localstorage",
          blob_count: Object.keys(blobs).length,
        },
      },
      null,
      2
    );

    return new Blob([archiveJson], { type: "application/json" });
  },

  importAllData(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && Array.isArray(parsed.semesters) && Array.isArray(parsed.courses)) {
        if (parsed._blobs && typeof parsed._blobs === "object") {
          for (const [docId, blobVal] of Object.entries(parsed._blobs)) {
            if (typeof blobVal === "string") {
              BlobStorage.saveBlob(docId, blobVal).catch(() => {});
            }
          }
        }
        delete (parsed as Record<string, any>)._manifest;
        delete (parsed as Record<string, any>)._blobs;
        if (!Array.isArray(parsed.concepts)) {
          parsed.concepts = JSON.parse(JSON.stringify(INITIAL_CONCEPTS));
        }
        if (!Array.isArray(parsed.course_concepts)) {
          parsed.course_concepts = JSON.parse(JSON.stringify(INITIAL_COURSE_CONCEPTS));
        }
        if (!Array.isArray(parsed.document_summaries)) {
          parsed.document_summaries = [];
        }
        if (!Array.isArray(parsed.course_prerequisites)) {
          parsed.course_prerequisites = JSON.parse(JSON.stringify(INITIAL_COURSE_PREREQUISITES));
        }
        if (!Array.isArray(parsed.sync_outbox)) {
          parsed.sync_outbox = [];
        }
        if (typeof parsed.revision_counter !== 'number') {
          parsed.revision_counter = 1;
        }
        saveStore(parsed as LocalStoreState);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  /* ------------------------------------------------------------------------
     WAL OUTBOX MUTATION QUEUE & RECONCILIATION
     ------------------------------------------------------------------------ */
  async syncOutbox(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    deadLetter: number;
  }> {
    const store = loadStore();
    const result = { processed: 0, succeeded: 0, failed: 0, deadLetter: 0 };

    if (!store.sync_outbox || store.sync_outbox.length === 0) {
      return result;
    }

    if (!isSupabaseConfigured()) {
      return result;
    }

    const supabase = createClient();
    if (!supabase) return result;

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return result;

    const queue = store.sync_outbox.filter(
      (item) => item.status === 'PENDING' || (item.status === 'FAILED' && (item.retry_count || 0) < 5)
    );

    for (const item of queue) {
      result.processed++;
      item.status = 'SYNCING';

      try {
        const table = item.entity;

        if (item.action === 'DELETE') {
          const { error } = await supabase.from(table).delete().eq('id', item.record_id);
          if (error) throw error;
        } else {
          // INSERT or UPDATE: Idempotent upsert
          const payload = {
            ...item.payload,
            id: item.record_id,
            user_id: authData.user.id,
          };
          delete (payload as Record<string, any>).courses;
          delete (payload as Record<string, any>).course;
          delete (payload as Record<string, any>).person;
          delete (payload as Record<string, any>).document;
          delete (payload as Record<string, any>).concept;
          delete (payload as Record<string, any>).associated_courses;
          delete (payload as Record<string, any>).course_relationship;
          delete (payload as Record<string, any>).people_count;
          delete (payload as Record<string, any>).documents_count;

          const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
          if (error) throw error;
        }

        item.status = 'COMPLETED';
        item.server_received_at = new Date().toISOString();
        item.last_error = null;
        result.succeeded++;
      } catch (err: any) {
        item.retry_count = (item.retry_count || 0) + 1;
        item.last_error = err?.message || String(err);
        if (item.retry_count >= 5) {
          item.status = 'DEAD_LETTER';
          result.deadLetter++;
        } else {
          item.status = 'FAILED';
          result.failed++;
        }
      }
    }

    saveStore(store);
    return result;
  },

  getSyncOutbox(): SyncOutboxItem[] {
    const store = loadStore();
    return store.sync_outbox || [];
  },

  clearCompletedOutbox(): void {
    const store = loadStore();
    if (store.sync_outbox) {
      store.sync_outbox = store.sync_outbox.filter((item) => item.status !== 'COMPLETED');
      saveStore(store);
    }
  },

  getDefaultData(): LocalStoreState {
    return getInitialStore();
  },

  resetToDefaultData(): void {
    const fresh = getInitialStore();
    saveStore(fresh);
    if (typeof window !== 'undefined') {
      try {
        for (const legacyKey of LEGACY_STORAGE_KEYS) {
          localStorage.removeItem(legacyKey);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      } catch {}
    }
  },
};
