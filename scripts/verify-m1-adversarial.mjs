// scripts/verify-m1-adversarial.mjs
// Adversarial Empirical Stress Test Suite for Milestone 1 (Storage, Quota, Invariance & Robustness)

import assert from 'node:assert/strict';
import { DataRepository } from '../src/lib/data/repository.ts';
import { BlobStorage } from '../src/lib/data/blob-storage.ts';
import { INITIAL_COURSE_PREREQUISITES } from '../src/lib/data/mock-data.ts';

console.log('================================================================');
console.log('EMPIRICAL CHALLENGER M1: ADVERSARIAL STRESS TEST SUITE');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const findings = [];

async function runTest(name, fn) {
  totalTests++;
  console.log(`[TEST ${totalTests}] ${name}`);
  try {
    await fn();
    passedTests++;
    console.log(`  -> RESULT: PASSED\n`);
  } catch (err) {
    failedTests++;
    console.error(`  -> RESULT: FAILED: ${err.message}\n`);
    findings.push({ test: name, error: err.message, stack: err.stack });
  }
}

// =============================================================================
// 1. LOCALSTORAGE QUOTA TEST (10 Multi-Megabyte Documents)
// =============================================================================
await runTest('LocalStorage Quota: 10 Documents with ~14MB Payloads strictly < 150KB in LocalStorage', async () => {
  DataRepository.resetToDefaultData();
  await BlobStorage.clear();

  // Create 10 distinct documents with variable multi-megabyte payloads
  const payloadSizes = [
    500 * 1024,      // 500 KB
    1024 * 1024,     // 1 MB
    1500 * 1024,     // 1.5 MB
    2048 * 1024,     // 2 MB
    750 * 1024,      // 750 KB
    1200 * 1024,     // 1.2 MB
    800 * 1024,      // 800 KB
    600 * 1024,      // 600 KB
    2500 * 1024,     // 2.5 MB
    3000 * 1024,     // 3 MB
  ];

  const totalPayloadBytes = payloadSizes.reduce((a, b) => a + b, 0);
  console.log(`  Uploading 10 documents with total payload: ${(totalPayloadBytes / (1024 * 1024)).toFixed(2)} MB`);

  const uploadedDocs = [];
  const originalPayloads = new Map();

  for (let i = 0; i < payloadSizes.length; i++) {
    const size = payloadSizes[i];
    // Generate distinct payload
    const marker = `DOC_${i}_PAYLOAD_`;
    const payload = 'data:application/pdf;base64,' + marker + 'X'.repeat(Math.max(0, size - marker.length));
    
    const doc = await DataRepository.uploadDocument(
      {
        original_file_name: `Stress_Doc_${i + 1}.pdf`,
        category: i % 2 === 0 ? 'Textbook' : 'Lecture Note',
        mime_type: 'application/pdf',
        file_size: size,
        description: `Stress testing document ${i + 1} with ${size} bytes payload`,
        file_content_base64: payload,
      },
      'c-ee4010'
    );

    uploadedDocs.push(doc);
    originalPayloads.set(doc.id, payload);
  }

  // 1. Assert LocalStorage exported string size < 150,000 characters
  const exported = DataRepository.exportAllData();
  const exportedLength = exported.length;
  console.log(`  LocalStorage Export Size after 10 uploads: ${exportedLength} characters (~${(exportedLength / 1024).toFixed(2)} KB)`);
  assert.ok(
    exportedLength < 150000,
    `DataRepository.exportAllData().length (${exportedLength}) must be strictly < 150000 (< 150 KB)`
  );

  // 2. Assert no base64 payloads leaked into documents metadata
  const parsed = JSON.parse(exported);
  for (const doc of parsed.documents) {
    if (doc.download_url && doc.download_url.startsWith('data:')) {
      throw new Error(`Document ${doc.id} leaked raw base64 data URL into metadata store: ${doc.download_url.slice(0, 50)}...`);
    }
  }

  // 3. Assert all 10 blobs can be successfully retrieved from BlobStorage with 100% fidelity
  for (const doc of uploadedDocs) {
    const retrievedBlob = await BlobStorage.getBlob(doc.id);
    assert.ok(retrievedBlob !== null, `BlobStorage.getBlob(${doc.id}) returned null`);
    const expected = originalPayloads.get(doc.id);
    assert.equal(
      retrievedBlob,
      expected,
      `Blob content mismatch for doc ${doc.id}. Length expected=${expected.length}, actual=${retrievedBlob?.length}`
    );
  }
  console.log('  All 10 blobs retrieved from BlobStorage with 100% byte fidelity.');
});

// =============================================================================
// 2. SSR & NODE.JS SAFETY (Environment Robustness)
// =============================================================================
await runTest('SSR & Node.js Safety: BlobStorage operates cleanly when window and indexedDB are undefined', async () => {
  // Ensure we are in pure Node.js (window and indexedDB undefined)
  assert.equal(typeof window, 'undefined', 'global window should be undefined in Node.js test environment');

  const testKey = 'ssr-test-doc-id-123';
  const testData = 'Sample SSR payload content for offline/SSR execution';

  // 1. Save blob
  await BlobStorage.saveBlob(testKey, testData);

  // 2. Get blob
  const retrieved = await BlobStorage.getBlob(testKey);
  assert.equal(retrieved, testData, 'Retrieved blob in SSR mode must match saved payload');

  // 3. Get all blobs
  const allBlobs = await BlobStorage.getAllBlobs();
  assert.ok(allBlobs.has(testKey), 'getAllBlobs in SSR mode must contain saved key');

  // 4. Delete blob
  await BlobStorage.deleteBlob(testKey);
  const afterDelete = await BlobStorage.getBlob(testKey);
  assert.equal(afterDelete, null, 'Deleted blob in SSR mode must return null');

  // 5. Clear
  await BlobStorage.saveBlob('clear-test-1', 'data-1');
  await BlobStorage.saveBlob('clear-test-2', 'data-2');
  await BlobStorage.clear();
  const allAfterClear = await BlobStorage.getAllBlobs();
  assert.equal(allAfterClear.size, 0, 'BlobStorage.clear() in SSR mode must empty the memory store');

  console.log('  SSR fallback verified for save, get, getAll, delete, and clear.');
});

// =============================================================================
// 3. TEST 11 SYNCHRONOUS INVARIANCE & FULL VAULT ARCHIVE EXPORT
// =============================================================================
await runTest('Test 11 Invariance: Synchronous exportAllData() & Asynchronous exportFullArchive()', async () => {
  DataRepository.resetToDefaultData();

  // 1. Synchronous exportAllData() contract
  const syncExport = DataRepository.exportAllData();
  assert.equal(typeof syncExport, 'string', 'DataRepository.exportAllData() MUST return string synchronously');
  assert.ok(syncExport.length > 500, `exportAllData length (${syncExport.length}) must be > 500`);

  const parsedSync = JSON.parse(syncExport);
  assert.ok(Array.isArray(parsedSync.semesters), 'Parsed sync export must have semesters array');
  assert.ok(Array.isArray(parsedSync.courses), 'Parsed sync export must have courses array');
  assert.ok(Array.isArray(parsedSync.documents), 'Parsed sync export must have documents array');
  assert.ok(Array.isArray(parsedSync.concepts), 'Parsed sync export must have concepts array');
  assert.ok(Array.isArray(parsedSync.course_prerequisites), 'Parsed sync export must have course_prerequisites array');
  assert.equal(parsedSync.course_prerequisites.length, 5, 'Must contain 5 seeded prerequisites');

  // 2. Asynchronous exportFullArchive() contract
  const archivePromise = DataRepository.exportFullArchive();
  assert.ok(archivePromise instanceof Promise, 'exportFullArchive() MUST return a Promise');

  const archiveBlob = await archivePromise;
  assert.ok(archiveBlob instanceof Blob, 'Resolved archive MUST be an instance of Blob');
  assert.equal(archiveBlob.type, 'application/json', 'Archive blob type must be application/json');

  const archiveText = await archiveBlob.text();
  const parsedArchive = JSON.parse(archiveText);

  // Validate archive manifest
  assert.ok(parsedArchive._manifest, 'Archive MUST contain _manifest metadata');
  assert.equal(parsedArchive._manifest.app, 'NEURON');
  assert.equal(parsedArchive._manifest.version, '2.0.0');
  assert.ok(typeof parsedArchive._manifest.exported_at === 'string');
  assert.ok(typeof parsedArchive._blobs === 'object', 'Archive MUST contain _blobs record');

  // 3. Round-trip import validation
  const importResult = DataRepository.importAllData(archiveText);
  assert.equal(importResult, true, 'importAllData must accept and restore full archive');

  console.log(`  Synchronous export length: ${syncExport.length} chars. Vault archive size: ${archiveText.length} chars.`);
});

// =============================================================================
// 4. BACKWARD-COMPATIBLE ID RESOLUTION & RFC 4122 V4 UUID STANDARDIZATION
// =============================================================================
await runTest('Backward-Compatible ID Resolution & RFC 4122 v4 UUID Generation', async () => {
  DataRepository.resetToDefaultData();

  // 1. Legacy fixture lookups
  const semester = await DataRepository.getSemester('sem-1');
  assert.ok(semester !== null, 'getSemester("sem-1") must return semester');
  assert.equal(semester.id, 'sem-1');

  const course = await DataRepository.getCourse('c-ee4010');
  assert.ok(course !== null, 'getCourse("c-ee4010") must return course');
  assert.equal(course.course_code, 'EE4010E');

  // Alias lookup for c-ee4020 -> c-ee4020e
  const courseAlias = await DataRepository.getCourse('c-ee4020');
  assert.ok(courseAlias !== null, 'getCourse("c-ee4020") must resolve aliased course');
  assert.ok(courseAlias.id === 'c-ee4020e' || courseAlias.id === 'c-ee4020');

  const person = await DataRepository.getPerson('p-1');
  assert.ok(person !== null, 'getPerson("p-1") must return person');
  assert.equal(person.id, 'p-1');

  const document = await DataRepository.getDocument('doc-1');
  assert.ok(document !== null, 'getDocument("doc-1") must return document');
  assert.equal(document.id, 'doc-1');

  // 2. RFC 4122 v4 UUID for newly created course
  const newCourse = await DataRepository.createCourse({
    semester_id: 'sem-1',
    course_code: 'EE9999',
    course_name: 'Adversarial Verification Systems',
    lecturer: 'Dr. Empirical Tester',
    credits: 4,
    description: 'Adversarial testing course',
  });

  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.ok(
    uuidV4Regex.test(newCourse.id),
    `Newly created course ID (${newCourse.id}) must match RFC 4122 v4 UUID specification`
  );

  // Retrieve newly created course by UUID
  const retrievedNewCourse = await DataRepository.getCourse(newCourse.id);
  assert.ok(retrievedNewCourse !== null, 'Must retrieve newly created course by UUID');
  assert.equal(retrievedNewCourse.course_code, 'EE9999');

  console.log(`  Legacy lookups (sem-1, c-ee4010, c-ee4020, p-1, doc-1) succeeded.`);
  console.log(`  New course created with valid RFC 4122 v4 UUID: ${newCourse.id}`);
});

// =============================================================================
// 5. ADVERSARIAL CHALLENGES & EDGE CASES
// =============================================================================
await runTest('Adversarial Challenge: Course Prerequisite Constraints & DAG Integrity', async () => {
  DataRepository.resetToDefaultData();

  // 1. Initial 5 authentic prerequisites
  const initialPrereqs = await DataRepository.getCoursePrerequisites();
  assert.equal(initialPrereqs.length, 5, 'Must have exactly 5 authentic prerequisites initialized');

  // 2. Self-prerequisite rejection
  let selfPrereqRejected = false;
  try {
    await DataRepository.addCoursePrerequisite('c-ee4010', 'c-ee4010');
  } catch (err) {
    selfPrereqRejected = true;
    assert.ok(err.message.includes('prerequisite of itself'), 'Error message must explain self-prerequisite restriction');
  }
  assert.ok(selfPrereqRejected, 'addCoursePrerequisite must reject self-prerequisite');

  // 3. Duplicate prerequisite prevention
  const added = await DataRepository.addCoursePrerequisite('c-it4060', 'c-ee4010');
  assert.ok(added);
  const dup = await DataRepository.addCoursePrerequisite('c-it4060', 'c-ee4010');
  assert.equal(dup.id, added.id, 'Duplicate prerequisite should return existing entry without creating duplicates');

  // 4. Remove prerequisite
  const removed = await DataRepository.removeCoursePrerequisite('c-it4060', 'c-ee4010');
  assert.equal(removed, true, 'Removing prerequisite should return true');

  const afterRemove = await DataRepository.getCoursePrerequisites('c-it4060');
  assert.equal(afterRemove.some((p) => p.prerequisite_course_id === 'c-ee4010'), false);

  console.log('  Course prerequisite guardrails verified.');
});

await runTest('Adversarial Challenge: Sync Outbox WAL Monotonic Revisions & Dead-Letter Isolation', async () => {
  DataRepository.resetToDefaultData();

  // Create an entity to trigger WAL mutation
  const doc = await DataRepository.uploadDocument(
    {
      original_file_name: 'outbox_test.pdf',
      category: 'Exam / Quiz',
      mime_type: 'application/pdf',
      file_size: 1024,
    },
    'c-ee4010'
  );

  const outbox = DataRepository.getSyncOutbox();
  assert.ok(outbox.length > 0, 'Mutations must be recorded in sync_outbox');

  const lastItem = outbox[outbox.length - 1];
  assert.ok(lastItem.revision >= 1, 'Outbox item must have monotonic revision');
  assert.equal(lastItem.status, 'PENDING');
  assert.equal(lastItem.action, 'INSERT');

  console.log(`  WAL mutation recorded with revision ${lastItem.revision}, status ${lastItem.status}.`);
});

// =============================================================================
// 6. DEEPER EDGE CASES & VULNERABILITY AUDITS
// =============================================================================
await runTest('Edge Case Audit: ArrayBuffer BlobData handling in exportFullArchive', async () => {
  const bufId = 'doc-arraybuffer-test';
  const buffer = new ArrayBuffer(8);
  const view = new Uint8Array(buffer);
  view.set([1, 2, 3, 4, 5, 6, 7, 8]);

  await BlobStorage.saveBlob(bufId, buffer);
  const retrieved = await BlobStorage.getBlob(bufId);
  assert.ok(retrieved instanceof ArrayBuffer, 'BlobStorage must store and retrieve ArrayBuffer');

  const archive = await DataRepository.exportFullArchive();
  const text = await archive.text();
  const parsed = JSON.parse(text);

  // Check if ArrayBuffer was serialized into _blobs
  const inBlobs = parsed._blobs && parsed._blobs[bufId];
  if (!inBlobs) {
    console.log('  [OBSERVATION / EDGE CASE FOUND]: ArrayBuffer is in BlobData union type (Blob | ArrayBuffer | string), but exportFullArchive only checks (typeof === "string") and (instanceof Blob). ArrayBuffer payloads are omitted from exportFullArchive JSON!');
  } else {
    console.log('  ArrayBuffer successfully exported to full archive.');
  }
  // Clean up
  await BlobStorage.deleteBlob(bufId);
});

await runTest('Edge Case Audit: isUuid guards across DataRepository lookup methods', async () => {
  // Check if getSemester('sem-1') or getDocument('doc-1') have isUuid guard
  // We inspect whether any method omits isUuid guard before querying Supabase
  const repoContent = await import('node:fs').then(fs => 
    fs.readFileSync('./src/lib/data/repository.ts', 'utf8')
  );

  // Extract getSemester implementation
  const getSemesterMatch = repoContent.match(/async getSemester\([^)]*\):[^{]*\{([\s\S]*?)const store/);
  const getDocumentMatch = repoContent.match(/async getDocument\([^)]*\):[^{]*\{([\s\S]*?)const store/);

  const getSemesterSupabaseBlock = getSemesterMatch ? getSemesterMatch[1] : '';
  const getDocumentSupabaseBlock = getDocumentMatch ? getDocumentMatch[1] : '';

  const semHasIsUuid = getSemesterSupabaseBlock.includes('isUuid');
  const docHasIsUuid = getDocumentSupabaseBlock.includes('isUuid');

  console.log(`  getSemester contains isUuid guard: ${semHasIsUuid}`);
  console.log(`  getDocument contains isUuid guard: ${docHasIsUuid}`);

  if (!semHasIsUuid || !docHasIsUuid) {
    console.log('  [OBSERVATION / EDGE CASE FOUND]: getSemester and getDocument omit `isUuid(id)` guard in their Supabase check block, unlike getCourse, getPerson, getConcept, etc. If Supabase is active, querying legacy IDs (sem-1, doc-1) sends a malformed UUID query to PostgreSQL, triggering 22P02 before falling back to local store.');
  }
});

console.log('================================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
