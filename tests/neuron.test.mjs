import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Import real DataRepository
import { DataRepository } from '../src/lib/data/repository.ts';

test('1. Semester Management — Real DataRepository CRUD & Ordering', async () => {
  // Reset to sample state first
  DataRepository.resetToDefaultData();

  const initialSemesters = await DataRepository.getSemesters();
  assert.ok(initialSemesters.length >= 2, 'Should load initial semesters');

  const activeSem = initialSemesters.find((s) => s.is_active);
  assert.ok(activeSem, 'Active semester should exist');
  assert.equal(activeSem.name, 'Semester 1');

  // Create new semester
  const created = await DataRepository.createSemester({
    name: 'Summer Research Term 2027',
    academic_year: 'Academic Year 2026–2027',
    start_date: '2027-06-01',
    end_date: '2027-08-31',
    sort_order: 3,
    is_active: false,
  });
  assert.ok(created.id, 'Created semester must have an id');
  assert.equal(created.name, 'Summer Research Term 2027');

  // Verify list reflects new semester
  const listAfterCreate = await DataRepository.getSemesters();
  assert.equal(listAfterCreate.length, initialSemesters.length + 1);

  // Update semester
  const updated = await DataRepository.updateSemester(created.id, {
    name: 'Summer Advanced Research Term 2027',
  });
  assert.equal(updated?.name, 'Summer Advanced Research Term 2027');

  // Delete semester
  const deleteSuccess = await DataRepository.deleteSemester(created.id);
  assert.equal(deleteSuccess, true);

  const listAfterDelete = await DataRepository.getSemesters();
  assert.equal(listAfterDelete.length, initialSemesters.length);
  const deletedLookup = await DataRepository.getSemester(created.id);
  assert.equal(deletedLookup, null);
});

test('2. Course Management — CRUD and Semester Scoping', async () => {
  DataRepository.resetToDefaultData();

  const semesterId = 'sem-1';
  const initialCourses = await DataRepository.getCourses(semesterId);
  assert.ok(initialCourses.length >= 2, 'Semester 1 should have initial courses');

  // Create new course
  const newCourse = await DataRepository.createCourse({
    semester_id: semesterId,
    course_code: 'EE4999',
    course_name: 'Senior Capstone Design',
    lecturer: 'Prof. Le Van C',
    credits: 4,
    description: 'Autonomous robotics capstone project and thesis.',
  });
  assert.ok(newCourse.id);
  assert.equal(newCourse.course_code, 'EE4999');

  // Retrieve course
  const retrieved = await DataRepository.getCourse(newCourse.id);
  assert.ok(retrieved);
  assert.equal(retrieved.course_name, 'Senior Capstone Design');

  // Update course
  const updated = await DataRepository.updateCourse(newCourse.id, {
    credits: 5,
  });
  assert.equal(updated?.credits, 5);

  // Delete course
  const deleted = await DataRepository.deleteCourse(newCourse.id);
  assert.equal(deleted, true);

  const lookupAfterDelete = await DataRepository.getCourse(newCourse.id);
  assert.equal(lookupAfterDelete, null);
});

test('3. Course Neural Graph — Three Primary Nodes Structure & Data Loader', async () => {
  DataRepository.resetToDefaultData();

  const courseId = 'c-ee4010';
  const graphData = await DataRepository.getCourseGraphData(courseId);
  assert.ok(graphData, 'Graph data must exist for EE4010');
  assert.equal(graphData.course.course_code, 'EE4010');

  // Central Node: course
  assert.ok(graphData.course);

  // Surrounding Node 1: Relationships
  assert.ok(graphData.people.length >= 3, 'EE4010 should have connected people');
  for (const person of graphData.people) {
    assert.ok(person.course_relationship, 'Person in course graph must have course_relationship data');
    assert.equal(person.course_relationship.course_id, courseId);
  }

  // Surrounding Node 2: Files
  assert.ok(graphData.documents.length >= 3, 'EE4010 should have connected documents');

  // Layout positions
  assert.ok(graphData.layout, 'EE4010 should have saved layout');
  assert.ok(graphData.layout.positions['course']);
  assert.ok(graphData.layout.positions['relationships']);
  assert.ok(graphData.layout.positions['files']);
});

test('4. Relationships — Multi-Course Linking, Context Notes & Contact Links', async () => {
  DataRepository.resetToDefaultData();

  const personId = 'p-2'; // Pham Minh Tuan
  const person = await DataRepository.getPerson(personId);
  assert.ok(person, 'Pham Minh Tuan should exist');
  assert.ok(person.associated_courses.length >= 2, 'Pham Minh Tuan should be connected to multiple courses');

  const c1 = person.associated_courses.find((ac) => ac.id === 'c-ee4010');
  const c2 = person.associated_courses.find((ac) => ac.id === 'c-ee3101');
  assert.ok(c1, 'Should be linked to EE4010');
  assert.ok(c2, 'Should be linked to EE3101');

  // Create new contact with contact links (Facebook, Zalo)
  const newContact = await DataRepository.createPerson({
    full_name: 'Vu Thi Lan',
    nickname: 'Lan V.',
    email: 'lan.vu@student.univ.edu',
    phone: '+84 987 654 321',
    contact_links: { zalo: 'lanvu_ee', facebook: 'fb.com/lanvu' },
    class_name: 'EE-K65',
    major: 'Automation',
    skills: ['SCADA', 'PLC'],
    notes: 'Lab partner candidate',
  });
  assert.ok(newContact.id);
  assert.equal(newContact.contact_links.zalo, 'lanvu_ee');

  // Link to course
  const link = await DataRepository.linkPersonToCourse({
    course_id: 'c-ee4010',
    person_id: newContact.id,
    relationship_type: 'Project teammate',
    knowledge_topics: ['SCADA Integration'],
    context_note: 'Working on substation SCADA interface',
  });
  assert.ok(link);
  assert.equal(link.relationship_type, 'Project teammate');

  // Unlink from course without deleting person
  const unlinked = await DataRepository.unlinkPersonFromCourse('c-ee4010', newContact.id);
  assert.equal(unlinked, true);

  // Person must still exist in global contact library
  const contactStillExists = await DataRepository.getPerson(newContact.id);
  assert.ok(contactStillExists, 'Unlinked person must remain in contact directory');
});

test('5. Documents — Upload, Course Linking, and Global Library Preservation', async () => {
  DataRepository.resetToDefaultData();

  // Upload document
  const uploaded = await DataRepository.uploadDocument(
    {
      original_file_name: 'Test_Exam_Prep_2026.pdf',
      category: 'Past Exam',
      mime_type: 'application/pdf',
      file_size: 1548000,
      description: 'Practice questions and solutions for midterm exam.',
      file_content_base64: 'data:application/pdf;base64,JVBERi0xLjQKJc...',
    },
    'c-ee4010'
  );
  assert.ok(uploaded.id);
  assert.equal(uploaded.original_file_name, 'Test_Exam_Prep_2026.pdf');

  // Verify it shows in course graph
  const graphData = await DataRepository.getCourseGraphData('c-ee4010');
  const foundInCourse = graphData?.documents.find((d) => d.id === uploaded.id);
  assert.ok(foundInCourse, 'Uploaded document must be attached to course');

  // Unlink document from course
  const unlinked = await DataRepository.unlinkDocumentFromCourse('c-ee4010', uploaded.id);
  assert.equal(unlinked, true);

  // Verify document is removed from course
  const graphAfterUnlink = await DataRepository.getCourseGraphData('c-ee4010');
  const notInCourse = graphAfterUnlink?.documents.find((d) => d.id === uploaded.id);
  assert.equal(notInCourse, undefined, 'Document should no longer be attached to course');

  // Original document must remain preserved in global document library
  const docInLibrary = await DataRepository.getDocument(uploaded.id);
  assert.ok(docInLibrary, 'Document must remain preserved in global library when unlinked');
});

test('6. Graph Layout Persistence — Position & Viewport Restoration', async () => {
  DataRepository.resetToDefaultData();

  const courseId = 'c-ee4010';
  const customPositions = {
    course: { x: 500, y: 300 },
    relationships: { x: 120, y: 200 },
    files: { x: 850, y: 200 },
    'person-p-1': { x: -80, y: 150 },
  };
  const customViewport = { x: 120, y: 80, zoom: 1.25 };

  await DataRepository.saveCourseGraphLayout(courseId, customPositions, customViewport);

  // Re-read graph data
  const data = await DataRepository.getCourseGraphData(courseId);
  assert.ok(data?.layout);
  assert.deepEqual(data.layout.positions.course, { x: 500, y: 300 });
  assert.deepEqual(data.layout.positions['person-p-1'], { x: -80, y: 150 });
  assert.equal(data.layout.viewport.zoom, 1.25);
  assert.equal(data.layout.viewport.x, 120);
});

test('7. Semester Calendar — Unified Aggregation across Categories', async () => {
  DataRepository.resetToDefaultData();

  const semesterEvents = await DataRepository.getEvents('sem-1');
  assert.ok(semesterEvents.length >= 4, 'Should aggregate all semester events');

  const types = new Set(semesterEvents.map((e) => e.event_type));
  assert.ok(types.has('CLASS'), 'Should aggregate CLASS events');
  assert.ok(types.has('EXAM'), 'Should aggregate EXAM events');
  assert.ok(types.has('DEADLINE'), 'Should aggregate DEADLINE events');
  assert.ok(types.has('PERSONAL'), 'Should aggregate PERSONAL events');

  // Verify personal event has null course_id
  const personalEvent = semesterEvents.find((e) => e.event_type === 'PERSONAL');
  assert.ok(personalEvent);
  assert.equal(personalEvent.course_id, null, 'Personal event should have null course_id');

  // Verify filter by course
  const courseEvents = await DataRepository.getEvents('sem-1', { courseId: 'c-ee4010' });
  assert.ok(courseEvents.length >= 2);
  for (const ev of courseEvents) {
    assert.equal(ev.course_id, 'c-ee4010');
  }
});

test('8. Calendar Course-Semester Integrity Rule Enforcement', async () => {
  DataRepository.resetToDefaultData();

  // Attempt to associate a course belonging to Semester 2 (c-ee4020 is in sem-2) with an event in Semester 1
  let threw = false;
  try {
    await DataRepository.createEvent({
      semester_id: 'sem-1',
      course_id: 'c-ee4020', // c-ee4020 belongs to sem-2!
      title: 'Illegal Cross-Semester Event',
      event_type: 'CLASS',
      start_at: '2026-09-10T08:00:00+07:00',
      end_at: '2026-09-10T10:00:00+07:00',
    });
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('Course does not belong to the selected semester'));
  }
  assert.equal(threw, true, 'Creating event with mismatched course semester must be rejected');

  // Verify updating event with mismatched course semester is also rejected
  const events = await DataRepository.getEvents('sem-1');
  assert.ok(events.length > 0);
  let updateThrew = false;
  try {
    await DataRepository.updateEvent(events[0].id, {
      course_id: 'c-ee4020', // belongs to sem-2!
    });
  } catch (err) {
    updateThrew = true;
    assert.ok(err.message.includes('Course does not belong to the selected semester'));
  }
  assert.equal(updateThrew, true, 'Updating event with mismatched course semester must be rejected');
});

test('9. Calendar Weekly Recurrence Rule Parsing and Integrity', async () => {
  DataRepository.resetToDefaultData();

  const events = await DataRepository.getEvents('sem-1');
  const recurringLecture = events.find((e) => e.recurrence_rule?.includes('FREQ=WEEKLY'));
  assert.ok(recurringLecture, 'Recurring weekly lecture should exist in seed data');
  assert.ok(recurringLecture.recurrence_rule.includes('BYDAY='));

  // Test creating a weekly recurring event
  const created = await DataRepository.createEvent({
    semester_id: 'sem-1',
    course_id: 'c-ee4010',
    title: 'Weekly Tutorial Session',
    event_type: 'CLASS',
    start_at: '2026-09-11T14:00:00+07:00',
    end_at: '2026-09-11T16:00:00+07:00',
    recurrence_rule: 'FREQ=WEEKLY;BYDAY=FR',
    timezone: 'Asia/Ho_Chi_Minh',
  });
  assert.ok(created.id);
  assert.equal(created.recurrence_rule, 'FREQ=WEEKLY;BYDAY=FR');
});

test('10. Universal Global Search — Full Indexing across All Domains', async () => {
  DataRepository.resetToDefaultData();

  // Course Search
  const courseResults = await DataRepository.globalSearch('Power System');
  assert.ok(courseResults.some((r) => r.type === 'course' && r.title.includes('EE4010')));

  // Person by Name Search
  const personResults = await DataRepository.globalSearch('Nguyen Van A');
  assert.ok(personResults.some((r) => r.type === 'person' && r.title.includes('Nguyen Van A')));

  // Knowledge Topic Search ("Newton-Raphson" is in course_people knowledge_topics)
  const topicResults = await DataRepository.globalSearch('Newton-Raphson');
  assert.ok(topicResults.length >= 1, 'Should find person linked with Newton-Raphson knowledge topic');

  // Document Search
  const docResults = await DataRepository.globalSearch('AdmittanceMatrix');
  assert.ok(docResults.some((r) => r.type === 'document'));

  // Event Search
  const eventResults = await DataRepository.globalSearch('Midterm');
  assert.ok(eventResults.some((r) => r.type === 'event'));
});

test('11. Data Backup Export, Recovery & Schema Validation', async () => {
  DataRepository.resetToDefaultData();

  const exported = DataRepository.exportAllData();
  assert.ok(typeof exported === 'string' && exported.length > 500);

  // Validate parsed structure
  const parsed = JSON.parse(exported);
  assert.ok(Array.isArray(parsed.semesters));
  assert.ok(Array.isArray(parsed.courses));
  assert.ok(Array.isArray(parsed.people));
  assert.ok(Array.isArray(parsed.documents));
  assert.ok(Array.isArray(parsed.events));

  // Test corrupt import rejection
  const invalidImport = DataRepository.importAllData('{"not_a_valid_neuron_backup": 123}');
  assert.equal(invalidImport, false, 'Invalid backup structure must be rejected');

  // Test valid import acceptance
  const validImport = DataRepository.importAllData(exported);
  assert.equal(validImport, true, 'Valid backup must be accepted and restored');
});

test('12. Database Migration SQL & RLS Security Rules Verification', async () => {
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20261103000001_initial_schema.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration SQL file must exist');

  const content = fs.readFileSync(migrationPath, 'utf8');

  // RLS enablement on all tables
  const requiredTables = [
    'profiles',
    'semesters',
    'courses',
    'people',
    'course_people',
    'documents',
    'course_documents',
    'events',
    'course_graph_layouts',
  ];
  for (const table of requiredTables) {
    assert.ok(
      content.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`),
      `RLS must be enabled on public.${table}`
    );
  }

  // Storage bucket and user isolation
  assert.ok(content.includes('academic-documents'), 'Storage bucket configuration must exist');
  assert.ok(content.includes('auth.uid() = user_id'), 'RLS user isolation checks must exist');
});

test('13. Strict Monochrome Palette Compliance', async () => {
  const cssPath = path.join(process.cwd(), 'src', 'app', 'globals.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify allowed monochrome colors exist in globals.css
  assert.ok(css.includes('#FFFFFF'));
  assert.ok(css.includes('#171717'));

  // Ensure no colored hues are declared as active theme tokens
  const forbiddenColors = [
    '#0000ff', '#ff0000', '#00ff00', '#ffff00', '#ff00ff',
    '#00ffff', '#ffa500', '#ffc0cb', 'rgb(0, 0, 255)', 'blue', 'green', 'yellow'
  ];
  for (const c of forbiddenColors) {
    assert.equal(
      css.toLowerCase().includes(`color: ${c}`) || css.toLowerCase().includes(`background-color: ${c}`),
      false,
      `CSS must not use forbidden hue ${c}`
    );
  }
});
