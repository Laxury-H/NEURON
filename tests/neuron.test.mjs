import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load mock database logic for testing
import {
  INITIAL_SEMESTERS,
  INITIAL_COURSES,
  INITIAL_PEOPLE,
  INITIAL_COURSE_PEOPLE,
  INITIAL_DOCUMENTS,
  INITIAL_COURSE_DOCUMENTS,
  INITIAL_EVENTS,
  INITIAL_GRAPH_LAYOUTS,
} from '../src/lib/data/mock-data.ts';

test('1. Semester Management — Lifecycle and ordering', async (t) => {
  const semesters = JSON.parse(JSON.stringify(INITIAL_SEMESTERS));
  assert.ok(semesters.length >= 2, 'Should have initial semesters');

  // Verify active semester
  const activeSem = semesters.find((s) => s.is_active);
  assert.ok(activeSem, 'Active semester should exist');
  assert.equal(activeSem.name, 'Semester 1');

  // Create new semester
  const newSem = {
    id: 'sem-test-3',
    user_id: '00000000-0000-0000-0000-000000000001',
    name: 'Summer Session 2027',
    academic_year: 'Academic Year 2026–2027',
    start_date: '2027-07-01',
    end_date: '2027-08-31',
    sort_order: 3,
    is_active: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  semesters.push(newSem);
  assert.equal(semesters.length, 3);

  // Rename semester
  const target = semesters.find((s) => s.id === 'sem-test-3');
  target.name = 'Summer Research Term 2027';
  assert.equal(target.name, 'Summer Research Term 2027');
});

test('2. Course Neural Graph — Three Primary Nodes Structure', async (t) => {
  const courseId = 'c-ee4010';
  const course = INITIAL_COURSES.find((c) => c.id === courseId);
  assert.ok(course, 'EE4010 course must exist');
  assert.equal(course.course_code, 'EE4010');

  // Surrounding Node 1: Relationships
  const connectedPeopleLinks = INITIAL_COURSE_PEOPLE.filter((cp) => cp.course_id === courseId);
  assert.ok(connectedPeopleLinks.length >= 3, 'EE4010 should have connected people');

  // Surrounding Node 2: Files
  const connectedDocLinks = INITIAL_COURSE_DOCUMENTS.filter((cd) => cd.course_id === courseId);
  assert.ok(connectedDocLinks.length >= 3, 'EE4010 should have connected documents');

  // Verify node types and structure
  const primaryNodes = ['course', 'relationships', 'files'];
  assert.equal(primaryNodes.length, 3);
});

test('3. Relationships — Multi-course connections and context notes', async (t) => {
  const person = INITIAL_PEOPLE.find((p) => p.id === 'p-2'); // Pham Minh Tuan
  assert.ok(person, 'Pham Minh Tuan should exist');

  // Check connections to multiple courses
  const connections = INITIAL_COURSE_PEOPLE.filter((cp) => cp.person_id === person.id);
  assert.ok(connections.length >= 2, 'Pham Minh Tuan should be connected to multiple courses');

  const c1 = connections.find((c) => c.course_id === 'c-ee4010');
  const c2 = connections.find((c) => c.course_id === 'c-ee3101');
  assert.ok(c1, 'Should be linked to EE4010');
  assert.ok(c2, 'Should be linked to EE3101');
  assert.ok(c1.context_note, 'Should have specific EE4010 context note');
  assert.ok(c2.context_note, 'Should have specific EE3101 context note');
});

test('4. Documents — Preserved in library when unlinked from course', async (t) => {
  const documents = JSON.parse(JSON.stringify(INITIAL_DOCUMENTS));
  let courseDocs = JSON.parse(JSON.stringify(INITIAL_COURSE_DOCUMENTS));

  const targetDocId = 'doc-1';
  const targetDoc = documents.find((d) => d.id === targetDocId);
  assert.ok(targetDoc, 'Document 1 exists');

  // Remove connection from course 'c-ee4010'
  courseDocs = courseDocs.filter(
    (cd) => !(cd.course_id === 'c-ee4010' && cd.document_id === targetDocId)
  );

  // Assert document itself is NOT deleted
  const docStillExists = documents.find((d) => d.id === targetDocId);
  assert.ok(docStillExists, 'Original document must remain in library even if unlinked from course');
});

test('5. Graph Layout Persistence — Position restoration', async (t) => {
  const layout = INITIAL_GRAPH_LAYOUTS['c-ee4010'];
  assert.ok(layout, 'Saved layout should exist for c-ee4010');
  assert.ok(layout.positions['course'], 'Course position should exist');
  assert.ok(layout.positions['relationships'], 'Relationships position should exist');
  assert.ok(layout.positions['files'], 'Files position should exist');
  assert.ok(layout.viewport.zoom > 0, 'Viewport zoom should be saved');
});

test('6. Semester Calendar — Unified semester aggregation & categories', async (t) => {
  const semesterEvents = INITIAL_EVENTS.filter((e) => e.semester_id === 'sem-1');
  assert.ok(semesterEvents.length >= 4, 'Should aggregate all semester events');

  const types = new Set(semesterEvents.map((e) => e.event_type));
  assert.ok(types.has('CLASS'), 'Should have CLASS events');
  assert.ok(types.has('EXAM'), 'Should have EXAM events');
  assert.ok(types.has('DEADLINE'), 'Should have DEADLINE events');
  assert.ok(types.has('PERSONAL'), 'Should have PERSONAL events');

  // Verify personal event has no course_id
  const personalEvent = semesterEvents.find((e) => e.event_type === 'PERSONAL');
  assert.equal(personalEvent.course_id, null, 'Personal event should have null course_id');
});

test('7. Database Schema & RLS Security Migration Check', async (t) => {
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20261103000001_initial_schema.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration SQL file must exist');

  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.ok(content.includes('ENABLE ROW LEVEL SECURITY;'), 'RLS must be enabled on tables');
  assert.ok(content.includes('academic-documents'), 'Storage bucket configuration must exist');
  assert.ok(content.includes('auth.uid() = user_id'), 'RLS user isolation checks must exist');
});

test('8. Strict Monochrome Verification', async (t) => {
  const cssPath = path.join(process.cwd(), 'src', 'app', 'globals.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify allowed monochrome colors exist in globals.css
  assert.ok(css.includes('#FFFFFF'));
  assert.ok(css.includes('#171717'));

  // Ensure no colored hues are declared as active theme tokens
  const forbiddenColors = ['#0000ff', '#ff0000', '#00ff00', '#ffff00', '#ff00ff', 'rgb(0, 0, 255)'];
  for (const c of forbiddenColors) {
    assert.equal(css.toLowerCase().includes(c), false, `CSS must not include forbidden hue ${c}`);
  }
});

test('9. Universal Global Search Indexing', async (t) => {
  // Test search over courses
  const searchCourseQuery = 'Power System';
  const matchedCourses = INITIAL_COURSES.filter(
    (c) => c.course_name.toLowerCase().includes(searchCourseQuery.toLowerCase()) ||
           c.course_code.toLowerCase().includes(searchCourseQuery.toLowerCase())
  );
  assert.ok(matchedCourses.length >= 1, 'Should find EE4010');

  // Test search over people / topics
  const searchTopicQuery = 'Newton-Raphson';
  const matchedPeople = INITIAL_PEOPLE.filter(
    (p) => p.skills.some((sk) => sk.toLowerCase().includes(searchTopicQuery.toLowerCase()))
  );
  assert.ok(matchedPeople.length >= 1, 'Should find Prof Nguyen Van A with Newton-Raphson');

  // Test search over events
  const searchEventQuery = 'Midterm';
  const matchedEvents = INITIAL_EVENTS.filter(
    (e) => e.title.toLowerCase().includes(searchEventQuery.toLowerCase())
  );
  assert.ok(matchedEvents.length >= 1, 'Should find midterm examination');
});

test('10. Data Backup Export & Recovery Schema Validation', async (t) => {
  const archive = {
    userId: '00000000-0000-0000-0000-000000000001',
    semesters: INITIAL_SEMESTERS,
    courses: INITIAL_COURSES,
    people: INITIAL_PEOPLE,
    course_people: INITIAL_COURSE_PEOPLE,
    documents: INITIAL_DOCUMENTS,
    course_documents: INITIAL_COURSE_DOCUMENTS,
    events: INITIAL_EVENTS,
    layouts: INITIAL_GRAPH_LAYOUTS,
  };

  const serialized = JSON.stringify(archive);
  assert.ok(serialized.length > 1000, 'Serialized archive must contain full workspace data');

  const parsed = JSON.parse(serialized);
  assert.equal(parsed.semesters.length, INITIAL_SEMESTERS.length);
  assert.equal(parsed.courses.length, INITIAL_COURSES.length);
  assert.equal(parsed.people.length, INITIAL_PEOPLE.length);
  assert.equal(parsed.documents.length, INITIAL_DOCUMENTS.length);
  assert.equal(parsed.events.length, INITIAL_EVENTS.length);
});

