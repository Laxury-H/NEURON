// Database & Entity Types for NEURON

export type RelationshipType =
  | 'Classmate'
  | 'Project teammate'
  | 'Lecturer'
  | 'Friend'
  | 'Other';

export type DocumentCategory =
  | 'Lecture'
  | 'Assignment'
  | 'Past Exam'
  | 'Textbook'
  | 'Notes'
  | 'Reference'
  | 'Other';

export type EventType =
  | 'CLASS'
  | 'EXAM'
  | 'DEADLINE'
  | 'PERSONAL';

export type DeadlineStatus =
  | 'pending'
  | 'completed'
  | 'overdue';

export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  theme_preference: 'light' | 'dark';
  created_at: string;
  updated_at: string;
}

export interface Semester {
  id: string;
  user_id: string;
  name: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  courses?: Course[];
}

export interface Course {
  id: string;
  user_id: string;
  semester_id: string;
  course_code: string;
  course_name: string;
  lecturer: string | null;
  credits: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  people_count?: number;
  documents_count?: number;
}

export interface Person {
  id: string;
  user_id: string;
  full_name: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  contact_links: Record<string, string>;
  class_name: string | null;
  major: string | null;
  skills: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Included when querying linked course
  course_relationship?: CoursePerson;
  associated_courses?: { id: string; course_code: string; course_name: string; relationship_type: RelationshipType }[];
}

export interface CoursePerson {
  id: string;
  user_id: string;
  course_id: string;
  person_id: string;
  relationship_type: RelationshipType;
  knowledge_topics: string[];
  context_note: string | null;
  created_at: string;
  person?: Person;
}

export interface DocumentItem {
  id: string;
  user_id: string;
  original_file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  category: DocumentCategory;
  description: string | null;
  uploaded_at: string;
  updated_at: string;
  download_url?: string;
  associated_courses?: { id: string; course_code: string; course_name: string }[];
}

export interface CourseDocument {
  id: string;
  user_id: string;
  course_id: string;
  document_id: string;
  display_order: number;
  created_at: string;
  document?: DocumentItem;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  semester_id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  event_type: EventType;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  recurrence_rule: string | null;
  timezone: string;
  reminder_offsets_minutes: number[];
  deadline_status: DeadlineStatus;
  created_at: string;
  updated_at: string;
  course?: Course | null;
}

export interface CourseGraphLayout {
  id?: string;
  user_id: string;
  course_id: string;
  positions: Record<string, { x: number; y: number }>;
  viewport: { x: number; y: number; zoom: number };
  updated_at: string;
}

export interface GlobalSearchResult {
  id: string;
  type: 'semester' | 'course' | 'person' | 'document' | 'event';
  title: string;
  subtitle: string;
  url: string;
  metadata?: Record<string, any>;
}

export interface Concept {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseConcept {
  id: string;
  user_id: string;
  course_id: string;
  concept_id: string;
  relevance_score: number;
  source_type: 'MANUAL' | 'EXTRACTED_SYLLABUS' | 'EXTRACTED_DOCUMENT';
  created_at: string;
  concept?: Concept;
}

export interface DocumentSummary {
  id: string;
  user_id: string;
  document_id: string;
  executive_summary: string;
  key_takeaways: string[];
  extracted_formulas: string[];
  candidate_concepts: string[];
  generated_at: string;
}

export interface SyncOutboxItem {
  id: string;
  user_id: string;
  entity: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: string;
  payload: Record<string, any>;
  client_timestamp: string;
  server_received_at?: string;
}

export interface CoursePrerequisite {
  id: string;
  user_id: string;
  course_id: string;
  prerequisite_course_id: string;
  created_at: string;
}

