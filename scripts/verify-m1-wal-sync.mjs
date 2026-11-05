// scripts/verify-m1-wal-sync.mjs
// Adversarial Empirical Stress Test Suite for Milestone 1.2
// (WAL Outbox, Idempotent Upsert Replay, Dead-Letter Queue & Prerequisite DAG Foundations)

import assert from 'node:assert/strict';

// Setup Web Storage polyfill for Node.js environment
const storageMap = new Map();
globalThis.localStorage = {
  getItem: (k) => storageMap.get(k) ?? null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear(),
  get length() { return storageMap.size; },
  key: (i) => Array.from(storageMap.keys())[i] ?? null,
};

globalThis.window = globalThis;
globalThis.document = {
  _cookie: '',
  get cookie() { return this._cookie; },
  set cookie(val) { this._cookie += (this._cookie ? '; ' : '') + val; }
};

import { DataRepository } from '../src/lib/data/repository.ts';
import { createClient } from '../src/lib/supabase/client.ts';
import { INITIAL_COURSE_PREREQUISITES } from '../src/lib/data/mock-data.ts';

console.log('================================================================');
console.log('EMPIRICAL CHALLENGER M1.2: WAL OUTBOX, SYNC, REPLAY & PREREQUISITES');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

async function runEmpiricalTest(name, fn) {
  totalTests++;
  console.log(`[TEST ${totalTests}] ${name}`);
  try {
    await fn();
    passedTests++;
    console.log(`  -> RESULT: PASSED\n`);
    testResults.push({ name, status: 'PASSED' });
  } catch (err) {
    failedTests++;
    console.error(`  -> RESULT: FAILED: ${err.message}\n`);
    testResults.push({ name, status: 'FAILED', error: err.message, stack: err.stack });
  }
}

// Simulated backend configuration
const mockUserId = '5501ba2f-3339-47e4-9c15-e91e9e555430';
const token = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiI1NTAxYmEyZi0zMzM5LTQ3ZTQtOWMxNS1lOTFlOWU1NTU0MzAiLCJlbWFpbCI6ImFkbWluQG5ldXJvbi5sb2NhbCIsImV4cCI6OTk5OTk5OTk5OSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ.';

// In-memory simulated PostgreSQL Database for sync testing
const serverDatabase = {
  tables: new Map(), // tableName -> Map<id, record>
  queryLog: [],
  networkDropOnNext: false,
  poisonPillIds: new Set(),
};

function resetServerDatabase() {
  serverDatabase.tables.clear();
  serverDatabase.queryLog = [];
  serverDatabase.networkDropOnNext = false;
  serverDatabase.poisonPillIds.clear();
}

function getTable(name) {
  if (!serverDatabase.tables.has(name)) {
    serverDatabase.tables.set(name, new Map());
  }
  return serverDatabase.tables.get(name);
}

// Global Fetch Interceptor to simulate PostgREST / Supabase API
globalThis.fetch = async (url, opts) => {
  const urlStr = url.toString();
  const method = opts?.method || 'GET';
  const headers = opts?.headers || {};

  // Auth endpoint
  if (urlStr.includes('/auth/v1/user')) {
    return new Response(JSON.stringify({
      id: mockUserId,
      email: 'admin@neuron.local',
      role: 'authenticated',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Parse table name from /rest/v1/<table_name>
  const match = urlStr.match(/\/rest\/v1\/([^?]+)/);
  if (!match) {
    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const table = match[1];
  const tableStore = getTable(table);

  serverDatabase.queryLog.push({ method, url: urlStr, table, body: opts?.body });

  // Simulate Network Drop right before ACK (Dropped ACK)
  if (serverDatabase.networkDropOnNext) {
    serverDatabase.networkDropOnNext = false;
    // Commit to server database (server received & committed row)
    if (opts?.body) {
      const records = JSON.parse(opts.body);
      const rows = Array.isArray(records) ? records : [records];
      for (const row of rows) {
        tableStore.set(row.id, row);
      }
    }
    // Drop connection right before client receives response
    throw new TypeError('Network connection reset: ACK dropped before reaching client');
  }

  // Simulate Poison Pill server rejection
  if (opts?.body) {
    const records = JSON.parse(opts.body);
    const rows = Array.isArray(records) ? records : [records];
    for (const row of rows) {
      if (serverDatabase.poisonPillIds.has(row.id)) {
        return new Response(JSON.stringify({
          code: '23503',
          message: 'Foreign key violation: referenced entity does not exist in server catalog',
          details: `Key (id)=(${row.id}) fails foreign key check.`
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }

  if (method === 'POST') {
    const preferHeader = headers['Prefer'] || headers['prefer'] || '';
    const isUpsert = preferHeader.includes('resolution=merge-duplicates') || urlStr.includes('on_conflict=id');
    const records = JSON.parse(opts.body);
    const rows = Array.isArray(records) ? records : [records];

    for (const row of rows) {
      if (!isUpsert && tableStore.has(row.id)) {
        // Plain INSERT without ON CONFLICT throws duplicate key violation in Postgres
        return new Response(JSON.stringify({
          code: '23505',
          message: `duplicate key value violates unique constraint "${table}_pkey"`,
          details: `Key (id)=(${row.id}) already exists.`
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      tableStore.set(row.id, { ...tableStore.get(row.id), ...row });
    }

    return new Response(JSON.stringify(rows), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (method === 'DELETE') {
    const idMatch = urlStr.match(/id=eq\.([^&]+)/);
    if (idMatch) {
      tableStore.delete(idMatch[1]);
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify([]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

async function enableSupabaseOnlineMode() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-m1-project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key-12345';
  const client = createClient();
  if (client) {
    await client.auth.setSession({
      access_token: token,
      refresh_token: 'fake-refresh-token',
    });
  }
}

function enableSupabaseOfflineMode() {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

// =============================================================================
// TEST 1: IDEMPOTENT UPSERT & DUPLICATE KEY RESILIENCE (DROPPED ACK SIMULATION)
// =============================================================================
await runEmpiricalTest(
  '1. Idempotent Upsert & Duplicate Key Resilience on Dropped ACK Replay',
  async () => {
    // Phase 1: Work Offline to generate WAL Outbox mutation
    enableSupabaseOfflineMode();
    DataRepository.resetToDefaultData();
    resetServerDatabase();

    const coursePayload = {
      semester_id: 'sem-1',
      course_code: 'EE4099',
      course_name: 'Adversarial Fault Tolerance',
      lecturer: 'Prof. Challenger',
      credits: 3,
      description: 'Fault tolerance & replay semantics under dropped ACKs',
    };

    console.log('    [Step 1 - Offline Mutation]: Creating course in offline mode...');
    const createdCourse = await DataRepository.createCourse(coursePayload);

    // Verify WAL Outbox queued the mutation
    const outboxBefore = DataRepository.getSyncOutbox();
    assert.ok(outboxBefore.length > 0, 'WAL outbox must contain queued mutation');
    const outboxItem = outboxBefore.find((item) => item.record_id === createdCourse.id);
    assert.ok(outboxItem, 'Outbox item for new course must exist');
    assert.equal(outboxItem.status, 'PENDING');
    assert.equal(outboxItem.retry_count, 0);
    assert.ok(outboxItem.revision >= 1, 'Monotonic revision must be recorded');
    console.log(`    ✓ WAL mutation recorded: entity=${outboxItem.entity}, action=${outboxItem.action}, revision=${outboxItem.revision}`);

    // Phase 2: Come Online and simulate Dropped ACK during initial sync
    await enableSupabaseOnlineMode();
    serverDatabase.networkDropOnNext = true;

    console.log('    [Step 2 - Dropped ACK Simulation]: Triggering syncOutbox() with network drop...');
    const syncRes1 = await DataRepository.syncOutbox();

    // Verify Server state: Record was committed on server
    const serverCourses = getTable('courses');
    assert.ok(serverCourses.has(createdCourse.id), 'Server must have committed the record');

    // Verify Client state: Dropped ACK caused mutation to remain in outbox as FAILED with retry_count: 1
    const outboxAfterDrop = DataRepository.getSyncOutbox();
    const failedItem = outboxAfterDrop.find((item) => item.record_id === createdCourse.id);
    assert.equal(failedItem.status, 'FAILED', 'Client must record FAILED status due to dropped ACK');
    assert.equal(failedItem.retry_count, 1, 'Client must increment retry_count to 1');
    assert.ok(failedItem.last_error?.includes('Network connection reset'), 'Client must record dropped connection message');
    assert.equal(syncRes1.failed, 1, 'syncOutbox result must report 1 failed');
    console.log('    ✓ Mutation preserved in outbox as FAILED with retry_count=1');

    // Phase 3: Replay Phase (Network Resumed)
    // In an un-resilient system with plain INSERT, replaying this mutation would fail with:
    // "23505 duplicate key value violates unique constraint 'courses_pkey'".
    // Under Worker M1's idempotent upsert({ onConflict: 'id' }), it MUST succeed!
    console.log('    [Step 3 - Outbox Replay]: Replaying mutation via syncOutbox()...');
    const syncRes2 = await DataRepository.syncOutbox();

    assert.equal(syncRes2.failed, 0, 'Replayed sync MUST not fail');
    assert.equal(syncRes2.succeeded, 1, 'Replayed sync MUST report 1 succeeded');

    const outboxAfterReplay = DataRepository.getSyncOutbox();
    const completedItem = outboxAfterReplay.find((item) => item.record_id === createdCourse.id);
    assert.equal(completedItem.status, 'COMPLETED', 'Mutation status must transition to COMPLETED on replay');
    assert.equal(completedItem.last_error, null, 'last_error must be reset to null on success');
    assert.ok(completedItem.server_received_at, 'server_received_at timestamp must be populated');

    // Verify Server state: Exactly 1 record in database (no duplicates created)
    assert.equal(serverCourses.size, 1, 'Database must contain exactly 1 course record (no duplicate key collision)');
    const savedCourse = serverCourses.get(createdCourse.id);
    assert.equal(savedCourse.course_code, 'EE4099');

    // Phase 4: Repeated Execution (Triple Replay)
    console.log('    [Step 4 - Triple Replay]: Running syncOutbox() again...');
    const syncRes3 = await DataRepository.syncOutbox();
    assert.equal(syncRes3.processed, 0, 'Completed items must not be re-processed');
    assert.equal(syncRes3.succeeded, 0);
    assert.equal(syncRes3.failed, 0);

    console.log('    [Idempotency Verified]: Replay cleanly resolved via ON CONFLICT (id) DO UPDATE.');
  }
);

// =============================================================================
// TEST 2: DEAD-LETTER QUEUE & HEAD-OF-LINE BLOCKING ISOLATION
// =============================================================================
await runEmpiricalTest(
  '2. Dead-Letter Queue (DLQ) & Head-of-Line Blocking Isolation after 5 Retries',
  async () => {
    enableSupabaseOfflineMode();
    DataRepository.resetToDefaultData();
    resetServerDatabase();

    // 1. Create a sequence of 3 mutations offline:
    // Item 1: Valid semester creation
    const semester = await DataRepository.createSemester({
      name: 'Semester 2026.2 Autumn',
      code: '2026.2',
      start_date: '2026-09-01',
      end_date: '2027-01-15',
    });

    // Item 2: Inject a Poison Pill mutation that will always fail on server
    const poisonId = crypto.randomUUID();
    serverDatabase.poisonPillIds.add(poisonId);

    const exportedRaw = DataRepository.exportAllData();
    const parsedStore = JSON.parse(exportedRaw);

    const poisonItem = {
      id: crypto.randomUUID(),
      user_id: mockUserId,
      entity: 'courses',
      action: 'INSERT',
      record_id: poisonId,
      payload: {
        id: poisonId,
        semester_id: 'non-existent-semester',
        course_code: 'POISON999',
        course_name: 'Poison Pill Mutation',
      },
      client_timestamp: new Date().toISOString(),
      status: 'PENDING',
      retry_count: 0,
      last_error: null,
      revision: parsedStore.revision_counter + 1,
    };
    parsedStore.revision_counter += 1;
    parsedStore.sync_outbox.push(poisonItem);

    // Item 3: Valid concept creation queued AFTER the poison pill
    const validConceptId = crypto.randomUUID();
    const validConceptItem = {
      id: crypto.randomUUID(),
      user_id: mockUserId,
      entity: 'concepts',
      action: 'INSERT',
      record_id: validConceptId,
      payload: {
        id: validConceptId,
        name: 'Distributed Consensus',
        slug: 'distributed-consensus',
        description: 'Fault-tolerant consensus algorithm',
      },
      client_timestamp: new Date().toISOString(),
      status: 'PENDING',
      retry_count: 0,
      last_error: null,
      revision: parsedStore.revision_counter + 1,
    };
    parsedStore.revision_counter += 1;
    parsedStore.sync_outbox.push(validConceptItem);

    DataRepository.importAllData(JSON.stringify(parsedStore));

    const outboxInitial = DataRepository.getSyncOutbox();
    console.log(`    Outbox initialized with ${outboxInitial.length} items: [Valid Semester, Poison Pill, Valid Concept]`);

    // 2. PASS 1: Execute syncOutbox() in online mode
    await enableSupabaseOnlineMode();
    const resPass1 = await DataRepository.syncOutbox();
    console.log(`    Pass 1 Result: processed=${resPass1.processed}, succeeded=${resPass1.succeeded}, failed=${resPass1.failed}`);

    const outboxP1 = DataRepository.getSyncOutbox();
    const item1_p1 = outboxP1.find((i) => i.record_id === semester.id);
    const poison_p1 = outboxP1.find((i) => i.record_id === poisonId);
    const item3_p1 = outboxP1.find((i) => i.record_id === validConceptId);

    assert.equal(item1_p1.status, 'COMPLETED', 'Item 1 must be COMPLETED');
    assert.equal(poison_p1.status, 'FAILED', 'Poison pill must be FAILED');
    assert.equal(poison_p1.retry_count, 1, 'Poison pill retry_count must be 1');
    assert.equal(item3_p1.status, 'COMPLETED', 'Item 3 (queued behind poison pill) MUST SUCCEED (Zero Head-of-line blocking)');
    assert.equal(resPass1.succeeded, 2, '2 valid items must have succeeded');
    assert.equal(resPass1.failed, 1, 'Poison pill must have failed');
    console.log('    ✓ Zero Head-of-Line Blocking: Item 3 succeeded despite preceding Item 2 failure.');

    // 3. PASSES 2 to 4: Retries 2, 3, 4
    for (let pass = 2; pass <= 4; pass++) {
      const res = await DataRepository.syncOutbox();
      const currentOutbox = DataRepository.getSyncOutbox();
      const currentPoison = currentOutbox.find((i) => i.record_id === poisonId);
      assert.equal(currentPoison.retry_count, pass, `Pass ${pass} must have retry_count ${pass}`);
      assert.equal(currentPoison.status, 'FAILED', `Pass ${pass} must remain FAILED`);
      assert.equal(res.failed, 1);
      assert.equal(res.deadLetter, 0);
    }
    console.log('    ✓ Passes 2-4 completed: poison pill retried 4 times.');

    // 4. PASS 5: 5th retry must transition poison pill to DEAD_LETTER
    console.log('    Executing Pass 5 (Threshold boundary: retry_count = 5)...');
    const resPass5 = await DataRepository.syncOutbox();
    assert.equal(resPass5.deadLetter, 1, 'Pass 5 must report deadLetter: 1');

    const outboxP5 = DataRepository.getSyncOutbox();
    const poison_p5 = outboxP5.find((i) => i.record_id === poisonId);
    assert.equal(poison_p5.status, 'DEAD_LETTER', 'Poison pill MUST transition to DEAD_LETTER after 5 retries');
    assert.equal(poison_p5.retry_count, 5, 'Poison pill retry_count must be 5');
    assert.ok(poison_p5.last_error?.includes('Foreign key violation'), 'Error details must be preserved');
    console.log('    ✓ Poison pill transitioned to DEAD_LETTER after 5 retries.');

    // 5. PASS 6: Subsequent mutations are NOT blocked by the DEAD_LETTER item
    // Add new mutation offline
    enableSupabaseOfflineMode();
    const newCourse = await DataRepository.createCourse({
      semester_id: 'sem-1',
      course_code: 'EE5001',
      course_name: 'Post-DLQ Advanced Studies',
    });

    await enableSupabaseOnlineMode();
    console.log('    Executing Pass 6 with new course mutation...');
    const resPass6 = await DataRepository.syncOutbox();
    assert.equal(resPass6.processed, 1, 'Only the new mutation should be processed (DLQ item must be skipped)');
    assert.equal(resPass6.succeeded, 1, 'New mutation must succeed');
    assert.equal(resPass6.deadLetter, 0);
    assert.equal(resPass6.failed, 0);

    const outboxP6 = DataRepository.getSyncOutbox();
    const deadLetterItem = outboxP6.find((i) => i.record_id === poisonId);
    assert.equal(deadLetterItem.status, 'DEAD_LETTER', 'Dead letter item must remain isolated');

    // 6. Cleanup & Isolation Invariant: clearCompletedOutbox() clears completed items but preserves DEAD_LETTER
    DataRepository.clearCompletedOutbox();
    const outboxCleaned = DataRepository.getSyncOutbox();
    assert.ok(outboxCleaned.some((i) => i.record_id === poisonId), 'clearCompletedOutbox MUST NOT discard DEAD_LETTER items');
    assert.equal(outboxCleaned.filter((i) => i.status === 'COMPLETED').length, 0, 'All COMPLETED items must be cleared');

    console.log('    [DLQ Isolation Verified]: Dead-lettered items do not block queue and are preserved for inspection.');
  }
);

// =============================================================================
// TEST 3: MONOTONIC REVISION SEQUENCING UNDER RAPID EDITS
// =============================================================================
await runEmpiricalTest(
  '3. Monotonic Revision Sequencing Under Rapid Sequential & Concurrent Edits',
  async () => {
    enableSupabaseOfflineMode();
    DataRepository.resetToDefaultData();

    // 1. Check initial revision counter
    const initialStore = JSON.parse(DataRepository.exportAllData());
    assert.ok(typeof initialStore.revision_counter === 'number', 'revision_counter must be a number');
    const startRevision = initialStore.revision_counter;

    // 2. Perform 20 rapid sequential operations across different repository entities
    console.log(`    Performing 20 rapid sequential mutations starting from revision ${startRevision}...`);
    const operations = [];

    // Operation 1: Create Course
    const c = await DataRepository.createCourse({
      semester_id: 'sem-1',
      course_code: 'REV101',
      course_name: 'Revision Control 101',
    });
    operations.push({ name: 'createCourse', recordId: c.id });

    // Operations 2-6: Update Course 5 times rapidly
    for (let i = 1; i <= 5; i++) {
      await DataRepository.updateCourse(c.id, {
        description: `Rapid course edit revision ${i}`,
        credits: 3 + (i % 2),
      });
      operations.push({ name: `updateCourse-${i}`, recordId: c.id });
    }

    // Operations 7-9: Create 3 Concepts
    for (let i = 1; i <= 3; i++) {
      const concept = await DataRepository.createConcept({
        name: `Monotonic Concept ${i}`,
        description: `Concept test ${i}`,
      });
      operations.push({ name: `createConcept-${i}`, recordId: concept.id });
    }

    // Operation 10: Link Concept to Course
    const concepts = await DataRepository.getConcepts();
    const lastConcept = concepts[concepts.length - 1];
    await DataRepository.linkConceptToCourse(lastConcept.id, c.id);
    operations.push({ name: 'linkConceptToCourse', recordId: `${c.id}_${lastConcept.id}` });

    // Operation 11: Add Course Prerequisite
    const prereq = await DataRepository.addCoursePrerequisite(c.id, 'c-ee4010');
    operations.push({ name: 'addCoursePrerequisite', recordId: prereq.id });

    // Operation 12: Remove Course Prerequisite
    await DataRepository.removeCoursePrerequisite(c.id, 'c-ee4010');
    operations.push({ name: 'removeCoursePrerequisite', recordId: prereq.id });

    // Operations 13-16: Calendar Event operations
    const event = await DataRepository.createEvent({
      semester_id: 'sem-1',
      course_id: c.id,
      title: 'Revision Exam',
      event_type: 'exam',
      start_at: '2026-10-15T09:00:00Z',
      end_at: '2026-10-15T11:00:00Z',
    });
    operations.push({ name: 'createEvent', recordId: event.id });

    for (let i = 1; i <= 3; i++) {
      await DataRepository.updateEvent(event.id, {
        title: `Revision Exam Updated v${i}`,
        deadline_status: i === 3 ? 'completed' : 'pending',
      });
      operations.push({ name: `updateEvent-${i}`, recordId: event.id });
    }

    // Operations 17-20: Person operations
    const person = await DataRepository.createPerson({
      full_name: 'Dr. Alan Turing',
      email: 'turing@neuron.local',
    });
    operations.push({ name: 'createPerson', recordId: person.id });

    await DataRepository.linkPersonToCourse({
      course_id: c.id,
      person_id: person.id,
      relationship_type: 'Primary Instructor',
    });
    operations.push({ name: 'linkPersonToCourse', recordId: person.id });

    await DataRepository.unlinkPersonFromCourse(c.id, person.id);
    operations.push({ name: 'unlinkPersonFromCourse', recordId: person.id });

    await DataRepository.deletePerson(person.id);
    operations.push({ name: 'deletePerson', recordId: person.id });

    // Assert that exactly 20 mutations were appended to the WAL outbox
    const outbox = DataRepository.getSyncOutbox();
    assert.equal(outbox.length, 20, `Outbox must contain exactly 20 recorded mutations, got ${outbox.length}`);

    // Verify Strict Deterministic Monotonic Ordering
    console.log('    Verifying strict monotonic sequence: r[i] === r[i-1] + 1...');
    for (let i = 0; i < outbox.length; i++) {
      const expectedRev = startRevision + 1 + i;
      assert.equal(
        outbox[i].revision,
        expectedRev,
        `Mutation ${i} (${operations[i].name}) revision must be ${expectedRev}, got ${outbox[i].revision}`
      );
      if (i > 0) {
        assert.ok(
          outbox[i].revision > outbox[i - 1].revision,
          `Revision ${outbox[i].revision} must be strictly greater than previous revision ${outbox[i - 1].revision}`
        );
      }
    }

    // Verify zero duplicates
    const revisionSet = new Set(outbox.map((i) => i.revision));
    assert.equal(revisionSet.size, outbox.length, 'Every mutation revision in outbox must be distinct');

    // 3. Persistence of revision_counter across store export
    const exportedJson = DataRepository.exportAllData();
    const exportedParsed = JSON.parse(exportedJson);
    const maxRev = outbox[outbox.length - 1].revision;
    assert.equal(exportedParsed.revision_counter, maxRev, 'Exported store must preserve latest revision_counter');

    // 4. Test syncing and clearing completed outbox
    await enableSupabaseOnlineMode();
    const syncRes = await DataRepository.syncOutbox();
    assert.equal(syncRes.succeeded, 20, 'All 20 mutations must sync successfully');

    DataRepository.clearCompletedOutbox();
    const remainingOutbox = DataRepository.getSyncOutbox();
    assert.equal(remainingOutbox.length, 0, 'clearCompletedOutbox must clear all completed items');

    // 5. Next mutation offline must continue monotonically from maxRev (not reset to 1 or restart)
    enableSupabaseOfflineMode();
    const nextConcept = await DataRepository.createConcept({ name: 'Post-Clear Monotonic Concept' });
    const updatedOutbox = DataRepository.getSyncOutbox();
    const lastMutation = updatedOutbox[updatedOutbox.length - 1];
    assert.equal(lastMutation.revision, maxRev + 1, `Next revision must be ${maxRev + 1}, got ${lastMutation.revision}`);

    console.log(`    [Monotonicity Verified]: 21 mutations incremented deterministically from ${startRevision + 1} to ${maxRev + 1}.`);
  }
);

// =============================================================================
// TEST 4: PREREQUISITE DAG FOUNDATIONS
// =============================================================================
await runEmpiricalTest(
  '4. Prerequisite DAG Foundations (Self-Prerequisite Rejection & 5 Authentic Pairs)',
  async () => {
    enableSupabaseOfflineMode();
    DataRepository.resetToDefaultData();

    // 1. Assert addCoursePrerequisite('c-ee4010', 'c-ee4010') throws self-prerequisite error
    console.log('    Testing self-prerequisite rejection on "c-ee4010"...');
    let threwSelf1 = false;
    let errorMsg1 = '';
    try {
      await DataRepository.addCoursePrerequisite('c-ee4010', 'c-ee4010');
    } catch (err) {
      threwSelf1 = true;
      errorMsg1 = err.message;
    }
    assert.equal(threwSelf1, true, 'addCoursePrerequisite("c-ee4010", "c-ee4010") MUST throw an error');
    assert.ok(
      errorMsg1.toLowerCase().includes('cannot be a prerequisite of itself'),
      `Error message must contain "cannot be a prerequisite of itself", got: "${errorMsg1}"`
    );

    // Also assert self-prerequisite rejection on legacy alias 'c-ee4020'
    let threwSelf2 = false;
    try {
      await DataRepository.addCoursePrerequisite('c-ee4020', 'c-ee4020');
    } catch (err) {
      threwSelf2 = true;
    }
    assert.equal(threwSelf2, true, 'addCoursePrerequisite("c-ee4020", "c-ee4020") MUST throw');

    // Also assert self-prerequisite rejection on arbitrary UUID
    const arbUuid = crypto.randomUUID();
    let threwSelf3 = false;
    try {
      await DataRepository.addCoursePrerequisite(arbUuid, arbUuid);
    } catch (err) {
      threwSelf3 = true;
    }
    assert.equal(threwSelf3, true, 'Arbitrary UUID self-prerequisite MUST throw');

    // 2. Assert all 5 authentic pairs exist in getCoursePrerequisites()
    console.log('    Verifying the 5 authentic curriculum prerequisite pairs...');
    const allPrereqs = await DataRepository.getCoursePrerequisites();
    assert.equal(allPrereqs.length, 5, `getCoursePrerequisites() must return exactly 5 pairs, got ${allPrereqs.length}`);

    // The 5 authentic pairs specified in UPGRADE_PLAN.md and mock-data.ts:
    // Pair 1: EE4010E Phân tích HTĐ -> prerequisite: EE3140E Máy điện
    // Pair 2: EE4020E Ngắn mạch trong HTĐ -> prerequisite: EE4010E Phân tích HTĐ
    // Pair 3: EE3810E Đồ án -> prerequisite: EE3410E Điện tử công suất
    // Pair 4: EE3810E Đồ án -> prerequisite: EE3101E Năng lượng tái tạo
    // Pair 5: EE3600E Truyền thông CN -> prerequisite: IT4060 Lập trình mạng
    const expectedPairs = [
      { course: 'c-ee4010', prereq: 'c-ee3140' },
      { course: 'c-ee4020', prereq: 'c-ee4010' },
      { course: 'c-ee3810', prereq: 'c-ee3410' },
      { course: 'c-ee3810', prereq: 'c-ee3101' },
      { course: 'c-ee3600', prereq: 'c-it4060' },
    ];

    for (const exp of expectedPairs) {
      const found = allPrereqs.some(
        (p) =>
          (p.course_id === exp.course || (exp.course === 'c-ee4020' && p.course_id === 'c-ee4020e')) &&
          (p.prerequisite_course_id === exp.prereq || (exp.prereq === 'c-ee4020' && p.prerequisite_course_id === 'c-ee4020e'))
      );
      assert.ok(found, `Authentic prerequisite pair missing: ${exp.course} -> ${exp.prereq}`);
      console.log(`      ✓ Found authentic pair: ${exp.course} -> ${exp.prereq}`);
    }

    // 3. Assert course-scoped queries work accurately
    const ee3810Prereqs = await DataRepository.getCoursePrerequisites('c-ee3810');
    assert.equal(ee3810Prereqs.length, 2, 'c-ee3810 must have 2 prerequisites (c-ee3410 and c-ee3101)');

    const ee4010Prereqs = await DataRepository.getCoursePrerequisites('c-ee4010');
    assert.equal(ee4010Prereqs.length, 1, 'c-ee4010 must have 1 prerequisite (c-ee3140)');
    assert.equal(ee4010Prereqs[0].prerequisite_course_id, 'c-ee3140');

    // Alias lookup for c-ee4020 / c-ee4020e
    const ee4020Prereqs = await DataRepository.getCoursePrerequisites('c-ee4020');
    assert.equal(ee4020Prereqs.length, 1, 'c-ee4020 must resolve prerequisite');
    assert.equal(ee4020Prereqs[0].prerequisite_course_id, 'c-ee4010');

    // 4. Assert Idempotent addition: adding an existing pair returns existing record without adding duplicates
    const dupPrereq = await DataRepository.addCoursePrerequisite('c-ee4010', 'c-ee3140');
    assert.ok(dupPrereq);
    const afterDupList = await DataRepository.getCoursePrerequisites();
    assert.equal(afterDupList.length, 5, 'Duplicate prerequisite addition must not increase pair count');

    // 5. Test addition and removal of a new non-cyclic prerequisite
    const tempPrereq = await DataRepository.addCoursePrerequisite('c-ee3410', 'c-ee3140');
    assert.ok(tempPrereq);
    const listWithTemp = await DataRepository.getCoursePrerequisites('c-ee3410');
    assert.equal(listWithTemp.length, 1);

    const removeRes = await DataRepository.removeCoursePrerequisite('c-ee3410', 'c-ee3140');
    assert.equal(removeRes, true, 'removeCoursePrerequisite must return true');
    const listAfterRemove = await DataRepository.getCoursePrerequisites('c-ee3410');
    assert.equal(listAfterRemove.length, 0, 'Temporary prerequisite must be removed');

    console.log('    [Prerequisite DAG Foundations Verified]: Self-prerequisites blocked, all 5 authentic pairs verified.');
  }
);

console.log('================================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} EMPIRICAL ADVERSARIAL STRESS TESTS PASSED`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
process.exit(0);
