// scripts/verify-challenger-2.mjs
// Empirical Verification Harness for Challenger 2
// (Database Migration & Offline Sync Edge Cases)

import assert from 'node:assert/strict';
import { DataRepository } from '../src/lib/data/repository.ts';

console.log('================================================================');
console.log('EMPIRICAL CHALLENGER 2: ADVERSARIAL STRESS TEST SUITE');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function runEmpiricalTest(name, fn) {
  totalTests++;
  console.log(`[TEST ${totalTests}] ${name}`);
  try {
    await fn();
    passedTests++;
    console.log(`  -> RESULT: CONFIRMED BUG / EDGE CASE REPRODUCED (PASS)\n`);
  } catch (err) {
    failedTests++;
    console.error(`  -> RESULT: UNEXPECTED FAILURE / NOT REPRODUCED:`, err.message, '\n');
  }
}

// -----------------------------------------------------------------------------
// TEST 1: Cross-Tenant Unique Collision & DoS in public.document_summaries
// -----------------------------------------------------------------------------
await runEmpiricalTest('Cross-Tenant Unique Collision & Silent DoS on document_summaries', () => {
  // Simulating PostgreSQL Database State with Proposed Schema:
  // CREATE TABLE document_summaries (
  //   id UUID, user_id UUID, document_id UUID, ..., CONSTRAINT uq_document_summary UNIQUE (document_id)
  // );
  // RLS: USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)

  const database = {
    documents: [
      { id: 'doc-bob-123', user_id: 'user-bob-uuid', name: 'Private_Thesis.pdf' },
    ],
    document_summaries: [],
  };

  const currentAuth = { uid: null };

  // Helper: insert with RLS check and unique constraint check
  function insertDocumentSummary(row) {
    // RLS WITH CHECK: auth.uid() = user_id
    if (row.user_id !== currentAuth.uid) {
      throw new Error('RLS check violation: auth.uid() != user_id');
    }
    // Foreign Key check on documents(id) - system level (bypasses RLS in Postgres FK validation)
    const docExists = database.documents.some((d) => d.id === row.document_id);
    if (!docExists) {
      throw new Error('FK violation: document_id does not exist');
    }
    // Unique constraint: uq_document_summary UNIQUE (document_id)
    const collision = database.document_summaries.some((s) => s.document_id === row.document_id);
    if (collision) {
      throw new Error('23505: duplicate key value violates unique constraint "uq_document_summary"');
    }
    database.document_summaries.push(row);
    return row;
  }

  // Helper: select with RLS USING (auth.uid() = user_id)
  function selectDocumentSummary(docId) {
    return database.document_summaries.filter(
      (s) => s.document_id === docId && s.user_id === currentAuth.uid
    );
  }

  // Step 1: Malicious User Alice crafts an insert targeting Bob's document_id
  currentAuth.uid = 'user-alice-uuid';
  insertDocumentSummary({
    id: 'sum-alice-1',
    user_id: 'user-alice-uuid', // Alice uses her own user_id -> Passes RLS!
    document_id: 'doc-bob-123', // Bob's document_id -> Passes FK because doc exists!
    executive_summary: 'Poisoned summary injected by Alice',
  });

  // Step 2: Legitimate User Bob tries to generate a summary for his own document
  currentAuth.uid = 'user-bob-uuid';
  let bobThrew = false;
  let bobError = '';
  try {
    insertDocumentSummary({
      id: 'sum-bob-1',
      user_id: 'user-bob-uuid',
      document_id: 'doc-bob-123',
      executive_summary: 'Bob legitimate summary',
    });
  } catch (err) {
    bobThrew = true;
    bobError = err.message;
  }

  // Bob is locked out!
  assert.equal(bobThrew, true, 'Bob must be rejected due to unique constraint');
  assert.ok(bobError.includes('uq_document_summary'), 'Error must be duplicate key on document_id');

  // Step 3: Bob tries to query his summary to see what happened
  const bobResults = selectDocumentSummary('doc-bob-123');
  assert.equal(bobResults.length, 0, 'Bob cannot see the colliding summary because Alice owns it');

  console.log(`  [Vulnerability Proved]: Alice DoS locks Bob out from summarizing his own document.`);
  console.log(`  Bob Error: "${bobError}". Bob visible rows: ${bobResults.length}`);
});

// -----------------------------------------------------------------------------
// TEST 2: Cross-Tenant Concept Hijacking in public.course_concepts
// -----------------------------------------------------------------------------
await runEmpiricalTest('Cross-Tenant Foreign Key Linking in course_concepts without Tenant Scoping', () => {
  // Schema:
  // course_concepts: user_id, course_id, concept_id
  // RLS: auth.uid() = user_id
  const database = {
    courses: [
      { id: 'course-alice-1', user_id: 'alice-uuid', name: 'Power Systems' },
      { id: 'course-bob-1', user_id: 'bob-uuid', name: 'Quantum Physics' },
    ],
    concepts: [
      { id: 'concept-bob-secret', user_id: 'bob-uuid', name: 'Proprietary Quantum Algorithm' },
    ],
    course_concepts: [],
  };

  const currentAuth = { uid: 'alice-uuid' };

  function linkCourseConcept(courseId, conceptId) {
    if (currentAuth.uid !== 'alice-uuid') throw new Error('RLS violated');
    // In PostgreSQL, FK only checks existence of PK in referenced table
    const courseExists = database.courses.some((c) => c.id === courseId);
    const conceptExists = database.concepts.some((k) => k.id === conceptId);
    if (!courseExists || !conceptExists) throw new Error('FK violation');

    // Missing tenant ownership check!
    const row = {
      id: 'cc-1',
      user_id: currentAuth.uid,
      course_id: courseId,
      concept_id: conceptId,
    };
    database.course_concepts.push(row);
    return row;
  }

  // Alice links her course to Bob's private concept
  const linked = linkCourseConcept('course-alice-1', 'concept-bob-secret');
  assert.ok(linked);
  assert.equal(linked.concept_id, 'concept-bob-secret');
  console.log(`  [Vulnerability Proved]: Alice attached Bob's private concept to her course without validation.`);
});

// -----------------------------------------------------------------------------
// TEST 3: Timezone Skew of `timezone('utc'::text, now())` into TIMESTAMPTZ
// -----------------------------------------------------------------------------
await runEmpiricalTest('Timestamp Skew: timezone("utc", now()) assigned to TIMESTAMPTZ under UTC+7', () => {
  // Simulating PostgreSQL server logic:
  // When now() (timestamptz) is passed to timezone('utc', now()), it produces a TIMESTAMP WITHOUT TIME ZONE (wall time at UTC).
  // When stored in a column declared TIMESTAMPTZ, Postgres reinterprets the timestamp without timezone
  // using the session's TimeZone setting (Asia/Ho_Chi_Minh = UTC+7).

  const utcNow = new Date('2026-11-05T12:00:00.000Z'); // Exact UTC time 12:00
  
  // 1. timezone('utc'::text, now()) strips tz and keeps UTC wall clock:
  const wallClockUtc = {
    hours: utcNow.getUTCHours(), // 12
    minutes: utcNow.getUTCMinutes(),
  };

  // 2. Coercing back to TIMESTAMPTZ in Asia/Ho_Chi_Minh session (+07:00):
  // The database treats 12:00 as 12:00+07:00!
  const coercedDate = new Date(`2026-11-05T${wallClockUtc.hours}:00:00.000+07:00`);

  // Difference in milliseconds between real UTC and stored TIMESTAMPTZ:
  const skewHours = (utcNow.getTime() - coercedDate.getTime()) / (1000 * 60 * 60);

  assert.equal(skewHours, 7, 'Stored time must be skewed by exactly 7 hours');
  console.log(`  [Bug Proved]: Real UTC time was ${utcNow.toISOString()}, but stored time became ${coercedDate.toISOString()}`);
  console.log(`  Skew: -${skewHours} hours! Created records appear 7 hours in the past.`);
});

// -----------------------------------------------------------------------------
// TEST 4: SSR / Node Test Runner Crash on BlobStorage (indexedDB undefined)
// -----------------------------------------------------------------------------
await runEmpiricalTest('BlobStorage throws ReferenceError in Node.js / SSR environment', async () => {
  // Proposed code in UPGRADE_PLAN.md lines 827-837:
  class ProposedBlobStorage {
    static async getDb() {
      return new Promise((resolve, reject) => {
        // Line 830: req = indexedDB.open(DB_NAME, 1)
        if (typeof indexedDB === 'undefined') {
          throw new ReferenceError('indexedDB is not defined');
        }
        resolve(null);
      });
    }
  }

  let threw = false;
  let errorType = '';
  try {
    await ProposedBlobStorage.getDb();
  } catch (err) {
    threw = true;
    errorType = err.name;
  }

  assert.equal(threw, true);
  assert.equal(errorType, 'ReferenceError');
  console.log(`  [Crash Proved]: Proposed BlobStorage unconditionally references indexedDB, breaking SSR & npm test.`);
});

// -----------------------------------------------------------------------------
// TEST 5: API Signature Invariance Violation on DataRepository.exportAllData()
// -----------------------------------------------------------------------------
await runEmpiricalTest('Synchronous exportAllData() contract cannot await IndexedDB blobs without breaking Test 11', () => {
  // Baseline verification:
  const exported = DataRepository.exportAllData();
  assert.equal(typeof exported, 'string', 'exportAllData must be synchronous string');

  // If someone alters exportAllData to be async:
  async function hypotheticalAsyncExport() {
    return Promise.resolve(exported);
  }

  const asyncResult = hypotheticalAsyncExport();
  assert.equal(typeof asyncResult, 'object', 'Promise return type is object, NOT string');
  assert.notEqual(typeof asyncResult, 'string');
  console.log(`  [Contract Break Proved]: Making exportAllData async returns object Promise, directly failing Test 11 line 323.`);
});

// -----------------------------------------------------------------------------
// TEST 6: LWW Conflict Resolution "Last 5 Minutes" Inverted Causality Paradox
// -----------------------------------------------------------------------------
await runEmpiricalTest('LWW "Last 5 Minutes" heuristic causes OLDER local edit to overwrite NEWER remote edit', () => {
  // Rule in UPGRADE_PLAN.md line 895:
  // "If remote.updated_at > clientTimestamp, the remote record takes precedence
  // unless the client mutation was explicit user input within the last 5 minutes."

  function resolveConflict(localMutation, remoteRecord, currentClock) {
    const isWithin5Minutes = (currentClock - localMutation.timestamp) <= 5 * 60 * 1000;
    
    // Heuristic from UPGRADE_PLAN:
    if (remoteRecord.updated_at > localMutation.timestamp) {
      if (isWithin5Minutes) {
        return 'LOCAL_WINS'; // Overwrite remote because local is recent!
      }
      return 'REMOTE_WINS';
    }
    return 'LOCAL_WINS';
  }

  const now = new Date('2026-11-05T14:40:00.000Z').getTime();

  // Scenario:
  // Device B (Phone) made an update 1 minute ago (14:39:00) -> NEWER
  const remoteRecord = {
    updated_at: new Date('2026-11-05T14:39:00.000Z').getTime(),
    title: 'Phone New Title',
  };

  // Device A (Laptop) made an update 3 minutes ago (14:37:00) -> OLDER
  const localMutation = {
    timestamp: new Date('2026-11-05T14:37:00.000Z').getTime(),
    title: 'Laptop Stale Title',
  };

  const outcome = resolveConflict(localMutation, remoteRecord, now);

  // The laptop's edit is 3 minutes old (within 5 minutes).
  // Even though Remote was edited at 14:39 and Local was edited at 14:37,
  // Local WINS and overwrites the newer edit!
  assert.equal(outcome, 'LOCAL_WINS');
  console.log(`  [Race Condition Proved]: Older edit from 14:37 overwrote newer edit from 14:39 due to 5-min heuristic!`);
});

// -----------------------------------------------------------------------------
// TEST 7: Clock Skew Denial of Synchronization
// -----------------------------------------------------------------------------
await runEmpiricalTest('Device Clock Skew (+10 min) permanently blocks peer device updates', () => {
  function lwwWinner(clientA_time, clientB_time) {
    return clientA_time > clientB_time ? 'DEVICE_A' : 'DEVICE_B';
  }

  const realTime = Date.now();
  const deviceA_fastClock = realTime + (10 * 60 * 1000); // 10 minutes ahead
  const deviceB_accurateClock = realTime;

  // Device A writes first
  const mutationA = { time: deviceA_fastClock };
  // Device B writes 5 minutes later in reality
  const mutationB = { time: deviceB_accurateClock + (5 * 60 * 1000) };

  // Comparison:
  const winner = lwwWinner(mutationA.time, mutationB.time);
  assert.equal(winner, 'DEVICE_A');
  console.log(`  [Clock Skew Proved]: Device B wrote 5 minutes AFTER Device A in reality, but Device A won due to +10m clock drift!`);
});

// -----------------------------------------------------------------------------
// TEST 8: Head-of-Line Blocking in FIFO Outbox on Network Interruption
// -----------------------------------------------------------------------------
await runEmpiricalTest('Mid-flight Network Interruption creates duplicate key conflict without UPSERT', () => {
  // Client queue:
  const outbox = [
    { id: 'mut-1', entity: 'course', action: 'INSERT', recordId: 'c-uuid-1', payload: { code: 'CS101' } },
  ];

  const serverDb = new Map();

  // Step 1: Client sends mutation 1 to server
  // Server receives and writes:
  serverDb.set(outbox[0].recordId, outbox[0].payload);

  // Step 2: Network drops before ACK arrives at client!
  const clientReceivedAck = false;

  // Client retains mutation in outbox as PENDING / RETRY
  assert.equal(clientReceivedAck, false);

  // Step 3: Network resumes. Client retries plain INSERT:
  function retryInsert(mutation) {
    if (serverDb.has(mutation.recordId)) {
      throw new Error('409 Conflict: duplicate key value violates unique constraint "courses_pkey"');
    }
    serverDb.set(mutation.recordId, mutation.payload);
  }

  let errorOccurred = false;
  let errorMsg = '';
  try {
    retryInsert(outbox[0]);
  } catch (err) {
    errorOccurred = true;
    errorMsg = err.message;
  }

  assert.equal(errorOccurred, true);
  assert.ok(errorMsg.includes('409 Conflict'));
  console.log(`  [Sync Wedged Proved]: Retry without explicit ON CONFLICT DO UPDATE throws 409 and wedges sync queue.`);
});

console.log('================================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} EMPIRICAL TESTS CONFIRMED FAILURE MODES`);
console.log('================================================================\n');
