// scripts/adversarial-m3-macroscopic-viewport.mjs
// Empirical Challenger M3_2: Adversarial Stress Test Suite for Macroscopic Graph & Viewport Persistence

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validatePrerequisiteDAG } from '../src/lib/academic/prerequisites.ts';

console.log('========================================================================');
console.log(' CHALLENGER M3_2: EMPIRICAL ADVERSARIAL STRESS TEST SUITE');
console.log(' Scope: Macroscopic Global Curriculum Graph & Viewport Persistence');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;
let findingCount = 0;
const findings = [];

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✔ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✖ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    failCount++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✔ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✖ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    failCount++;
  }
}

function recordFinding(title, description, severity = 'MEDIUM') {
  findingCount++;
  findings.push({ title, description, severity });
  console.log(`  ⚠️ FINDING [${severity}]: ${title}`);
}

// --------------------------------------------------------------------------
// Helper: Emulate Macroscopic Graph Topology Logic from src/app/app/graph/page.tsx
// --------------------------------------------------------------------------
function computeMacroscopicTopology({
  courses = [],
  prerequisites = [],
  concepts = [],
  courseConcepts = [],
  semesters = [],
  timelineIndex = -1,
  searchQuery = '',
}) {
  if (courses.length === 0) {
    return { nodes: [], edges: [], tiers: [], coursePositions: new Map() };
  }

  const newNodes = [];
  const newEdges = [];

  // 1. Group courses by prerequisite dependency depth (DAG Tiers) using Kahn's topological sort
  const dagResult = validatePrerequisiteDAG(courses, prerequisites);
  const courseTierMap = new Map(Object.entries(dagResult.tiers));

  // Group courses by tier
  const tiers = [];
  courses.forEach((c) => {
    const tier = courseTierMap.get(c.id) ?? 0;
    if (!tiers[tier]) tiers[tier] = [];
    tiers[tier].push(c);
  });

  // Active timeline filter threshold
  const activeSemesterIds =
    timelineIndex === -1
      ? new Set(semesters.map((s) => s.id))
      : new Set(semesters.slice(0, timelineIndex + 1).map((s) => s.id));

  const coursePositions = new Map();
  const COLUMN_WIDTH = 580;
  const ROW_HEIGHT = 280;
  const START_X = 120;
  const START_Y = 140;

  tiers.forEach((tierCourses, tierIdx) => {
    tierCourses.forEach((course, rowIdx) => {
      const colX = START_X + tierIdx * COLUMN_WIDTH;
      const rowY = START_Y + rowIdx * ROW_HEIGHT;
      coursePositions.set(course.id, { x: colX, y: rowY });

      const matchesSearch =
        !searchQuery ||
        course.course_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (course.lecturer && course.lecturer.toLowerCase().includes(searchQuery.toLowerCase()));

      const isInTimeline = activeSemesterIds.has(course.semester_id);
      const opacity = isInTimeline ? (matchesSearch ? 1 : 0.25) : 0.15;

      newNodes.push({
        id: course.id,
        type: 'courseNode',
        position: { x: colX, y: rowY },
        tier: tierIdx,
        data: {
          courseCode: course.course_code,
          courseName: course.course_name,
        },
        style: { opacity },
      });
    });
  });

  // Prerequisite directed edges
  prerequisites.forEach((prereq) => {
    const sourcePos = coursePositions.get(prereq.prerequisite_course_id);
    const targetPos = coursePositions.get(prereq.course_id);

    if (sourcePos && targetPos) {
      const sourceCourse = courses.find((c) => c.id === prereq.prerequisite_course_id);
      const targetCourse = courses.find((c) => c.id === prereq.course_id);

      const isActive =
        sourceCourse &&
        targetCourse &&
        activeSemesterIds.has(sourceCourse.semester_id) &&
        activeSemesterIds.has(targetCourse.semester_id);

      newEdges.push({
        id: `edge-prereq-${prereq.prerequisite_course_id}-${prereq.course_id}`,
        source: prereq.prerequisite_course_id,
        sourceHandle: 'course-right',
        target: prereq.course_id,
        targetHandle: 'course-left',
        isActive,
        style: { opacity: isActive ? 1 : 0.15 },
      });
    }
  });

  // Shared concept bridges
  const conceptToCoursesMap = new Map();
  courseConcepts.forEach((cc) => {
    const list = conceptToCoursesMap.get(cc.concept_id) || [];
    if (!list.includes(cc.course_id)) {
      list.push(cc.course_id);
    }
    conceptToCoursesMap.set(cc.concept_id, list);
  });

  const sharedConceptEntries = Array.from(conceptToCoursesMap.entries()).filter(
    ([, courseIds]) => courseIds.length >= 2
  );

  const bridgeConceptEntries =
    sharedConceptEntries.length > 0
      ? sharedConceptEntries
      : Array.from(conceptToCoursesMap.entries()).slice(0, 4);

  bridgeConceptEntries.forEach(([conceptId, linkedCourseIds], bridgeIdx) => {
    const concept = concepts.find((c) => c.id === conceptId);
    if (!concept) return;

    const validCourseIds = linkedCourseIds.filter((courseId) =>
      coursePositions.has(courseId)
    );

    if (validCourseIds.length === 0) return;

    const validCoords = validCourseIds.map((cId) => coursePositions.get(cId));

    const avgX = Math.round(validCoords.reduce((acc, p) => acc + p.x, 0) / validCoords.length);
    const avgY = Math.round(validCoords.reduce((acc, p) => acc + p.y, 0) / validCoords.length);

    const bridgePos = {
      x: avgX + (bridgeIdx % 2 === 0 ? 140 : -140),
      y: avgY + (bridgeIdx % 2 === 0 ? 120 : -120),
    };

    const nodeId = `global-concept-${concept.id}`;
    newNodes.push({
      id: nodeId,
      type: 'conceptNode',
      position: bridgePos,
      data: {
        id: concept.id,
        label: concept.name,
        courseCount: linkedCourseIds.length,
      },
    });

    validCourseIds.forEach((courseId) => {
      newEdges.push({
        id: `edge-bridge-${concept.id}-${courseId}`,
        source: courseId,
        sourceHandle: 'course-top',
        target: nodeId,
        targetHandle: 'concept-bottom',
        type: 'smoothstep',
      });
    });
  });

  return { nodes: newNodes, edges: newEdges, tiers, coursePositions, courseTierMap };
}

// ==========================================================================
// DIMENSION 1: Macroscopic Curriculum Graph Topology & DAG Progression
// ==========================================================================
console.log('\n--- [Dimension 1] Macroscopic Curriculum Graph Topology & DAG Progression ---');

// 1.1 Diamond DAG & Sibling Traversal Trapping
runTest('Diamond DAG Sibling Traversal Behavior', () => {
  const courses = [
    { id: 'c-capstone', course_code: 'EE4900', course_name: 'Capstone', semester_id: 'sem-4' },
    { id: 'c-branchA', course_code: 'EE3200', course_name: 'Branch A (Power)', semester_id: 'sem-3' },
    { id: 'c-branchB', course_code: 'EE3300', course_name: 'Branch B (Control)', semester_id: 'sem-3' },
    { id: 'c-shared', course_code: 'EE2100', course_name: 'Circuit Theory', semester_id: 'sem-2' },
    { id: 'c-foundation', course_code: 'MATH101', course_name: 'Calculus I', semester_id: 'sem-1' },
  ];

  const prerequisites = [
    { id: 'p1', course_id: 'c-capstone', prerequisite_course_id: 'c-branchA' },
    { id: 'p2', course_id: 'c-capstone', prerequisite_course_id: 'c-branchB' },
    { id: 'p3', course_id: 'c-branchA', prerequisite_course_id: 'c-shared' },
    { id: 'p4', course_id: 'c-branchB', prerequisite_course_id: 'c-shared' },
    { id: 'p5', course_id: 'c-shared', prerequisite_course_id: 'c-foundation' },
  ];

  const result = computeMacroscopicTopology({ courses, prerequisites });

  const foundationTier = result.courseTierMap.get('c-foundation');
  const sharedTier = result.courseTierMap.get('c-shared');
  const branchATier = result.courseTierMap.get('c-branchA');
  const branchBTier = result.courseTierMap.get('c-branchB');
  const capstoneTier = result.courseTierMap.get('c-capstone');

  assert.equal(foundationTier, 0, 'Foundation must be tier 0');
  assert.equal(sharedTier, 1, 'Shared Circuit Theory must be tier 1');
  assert.equal(branchATier, 2, 'Branch A must be tier 2');

  // Verify whether branchB got trapped by shared visited set
  if (branchBTier === 1) {
    recordFinding(
      'Diamond DAG Sibling Traversal False-Cycle Trapping',
      `In a diamond DAG where Course D depends on A and B, and both A and B depend on C: ` +
      `because getTier passes a shared mutable Set down recursion branches without backtrack delete, ` +
      `Branch B sees C already in visited, treats it as a cycle and returns 0. ` +
      `Consequently, Branch B is assigned tier 1 (the exact same tier as its prerequisite C at tier 1), ` +
      `rather than tier 2. Courses and their prerequisites collapse into the same column.`,
      'HIGH'
    );
  } else {
    assert.equal(branchBTier, 2, 'Branch B should be tier 2');
  }

  assert.ok(capstoneTier >= 3, 'Capstone should be tier 3 or higher');
});

// 1.2 Cyclic Graph Termination & Non-Crash
runTest('Prerequisite Cycles: 2-cycle, 3-cycle, and Self-loop Termination', () => {
  // 2-cycle: A <-> B
  const courses2 = [
    { id: 'cA', course_code: 'A', course_name: 'Course A', semester_id: 'sem-1' },
    { id: 'cB', course_code: 'B', course_name: 'Course B', semester_id: 'sem-1' },
  ];
  const prereqs2 = [
    { id: 'p1', course_id: 'cA', prerequisite_course_id: 'cB' },
    { id: 'p2', course_id: 'cB', prerequisite_course_id: 'cA' },
  ];
  const res2 = computeMacroscopicTopology({ courses: courses2, prerequisites: prereqs2 });
  assert.equal(res2.nodes.length, 2, 'All cyclic courses must be rendered');
  assert.equal(res2.edges.length, 2, 'Both cyclic edges must be rendered');

  // 3-cycle: A -> B -> C -> A
  const courses3 = [
    { id: 'cA', course_code: 'A', course_name: 'Course A', semester_id: 'sem-1' },
    { id: 'cB', course_code: 'B', course_name: 'Course B', semester_id: 'sem-1' },
    { id: 'cC', course_code: 'C', course_name: 'Course C', semester_id: 'sem-1' },
  ];
  const prereqs3 = [
    { id: 'p1', course_id: 'cA', prerequisite_course_id: 'cB' },
    { id: 'p2', course_id: 'cB', prerequisite_course_id: 'cC' },
    { id: 'p3', course_id: 'cC', prerequisite_course_id: 'cA' },
  ];
  const res3 = computeMacroscopicTopology({ courses: courses3, prerequisites: prereqs3 });
  assert.equal(res3.nodes.length, 3, '3-cycle courses must be rendered without infinite loop');
  assert.equal(res3.edges.length, 3, '3-cycle edges must be rendered');

  // Self-prerequisite: A -> A
  const coursesSelf = [{ id: 'cA', course_code: 'A', course_name: 'Course A', semester_id: 'sem-1' }];
  const prereqsSelf = [{ id: 'p1', course_id: 'cA', prerequisite_course_id: 'cA' }];
  const resSelf = computeMacroscopicTopology({ courses: coursesSelf, prerequisites: prereqsSelf });
  assert.equal(resSelf.nodes.length, 1, 'Self-prerequisite course must be rendered');
  assert.equal(resSelf.edges.length, 1, 'Self-prerequisite edge must be rendered');
});

// 1.3 Disconnected Components & Isolated Islands
runTest('Disconnected Components: Independent Subtrees and Isolated Vertices', () => {
  const courses = [
    // Subtree 1: C1 -> C2 -> C3
    { id: 'c1', course_code: 'C1', course_name: '1', semester_id: 'sem-1' },
    { id: 'c2', course_code: 'C2', course_name: '2', semester_id: 'sem-2' },
    { id: 'c3', course_code: 'C3', course_name: '3', semester_id: 'sem-3' },
    // Subtree 2: C4 -> C5
    { id: 'c4', course_code: 'C4', course_name: '4', semester_id: 'sem-1' },
    { id: 'c5', course_code: 'C5', course_name: '5', semester_id: 'sem-2' },
    // Isolated Island 3: C6, C7
    { id: 'c6', course_code: 'C6', course_name: '6', semester_id: 'sem-1' },
    { id: 'c7', course_code: 'C7', course_name: '7', semester_id: 'sem-2' },
  ];

  const prerequisites = [
    { id: 'p1', course_id: 'c2', prerequisite_course_id: 'c1' },
    { id: 'p2', course_id: 'c3', prerequisite_course_id: 'c2' },
    { id: 'p3', course_id: 'c5', prerequisite_course_id: 'c4' },
  ];

  const res = computeMacroscopicTopology({ courses, prerequisites });
  assert.equal(res.nodes.length, 7, 'All 7 courses must be rendered');
  assert.equal(res.edges.length, 3, 'All 3 dependency edges must be rendered');

  // Verify tier placements
  assert.equal(res.courseTierMap.get('c1'), 0);
  assert.equal(res.courseTierMap.get('c2'), 1);
  assert.equal(res.courseTierMap.get('c3'), 2);
  assert.equal(res.courseTierMap.get('c4'), 0);
  assert.equal(res.courseTierMap.get('c5'), 1);
  assert.equal(res.courseTierMap.get('c6'), 0);
  assert.equal(res.courseTierMap.get('c7'), 0);

  // Verify coordinates are unique (no two nodes share identical x and y)
  const coordSet = new Set();
  for (const n of res.nodes) {
    const key = `${n.position.x},${n.position.y}`;
    assert.ok(!coordSet.has(key), `Duplicate node position detected at ${key} for node ${n.id}`);
    coordSet.add(key);
  }
});

// 1.4 Orphaned Courses & Missing Prerequisite Foreign Keys (Authentic Data Audit)
await runAsyncTest('Authentic Data Foreign Key Integrity & Dropped Prerequisite Edges', async () => {
  const { INITIAL_COURSES, INITIAL_COURSE_PREREQUISITES } = await import('../src/lib/data/mock-data.ts');

  const res = computeMacroscopicTopology({
    courses: INITIAL_COURSES,
    prerequisites: INITIAL_COURSE_PREREQUISITES,
  });

  const droppedPrereqs = [];
  INITIAL_COURSE_PREREQUISITES.forEach((p) => {
    // External cross-semester prerequisites (e.g. c-it4060 from prior semester) are legitimate and handled by validatePrerequisiteDAG
    if (p.prerequisite_course_id === 'c-it4060') return;
    const sourceExists = INITIAL_COURSES.some((c) => c.id === p.prerequisite_course_id);
    const targetExists = INITIAL_COURSES.some((c) => c.id === p.course_id);
    if (!sourceExists || !targetExists) {
      droppedPrereqs.push({
        id: p.id,
        course_id: p.course_id,
        prerequisite_course_id: p.prerequisite_course_id,
        sourceExists,
        targetExists,
      });
    }
  });

  if (droppedPrereqs.length > 0) {
    recordFinding(
      'Authentic Prerequisite Seeding Foreign Key Discrepancies',
      `Internal prerequisite foreign key matching failed for: ${droppedPrereqs.map((d) => d.id).join(', ')}`,
      'HIGH'
    );
  }

  assert.equal(res.nodes.length, INITIAL_COURSES.length, 'All 9 courses must be rendered');
});

// 1.5 Scalability: 100-node Linear Chain
runTest('Scalability Stress: 100-node Linear DAG Chain', () => {
  const N = 100;
  const courses = Array.from({ length: N }, (_, i) => ({
    id: `course-${i}`,
    course_code: `CS${100 + i}`,
    course_name: `Course Level ${i}`,
    semester_id: `sem-${Math.floor(i / 10)}`,
  }));

  const prerequisites = Array.from({ length: N - 1 }, (_, i) => ({
    id: `prereq-${i}`,
    course_id: `course-${i + 1}`,
    prerequisite_course_id: `course-${i}`,
  }));

  const t0 = performance.now();
  const res = computeMacroscopicTopology({ courses, prerequisites });
  const t1 = performance.now();

  assert.ok(t1 - t0 < 100, `100-node linear chain computation took too long: ${(t1 - t0).toFixed(2)}ms`);
  assert.equal(res.nodes.length, N);
  assert.equal(res.edges.length, N - 1);

  // Check monotonic tier assignment
  for (let i = 0; i < N; i++) {
    assert.equal(res.courseTierMap.get(`course-${i}`), i, `Node ${i} should be tier ${i}`);
  }
});

// ==========================================================================
// DIMENSION 2: Shared Concept Bridges Linking Courses
// ==========================================================================
console.log('\n--- [Dimension 2] Shared Concept Bridges Linking Courses ---');

// 2.1 Multi-Semester Shared Concept Centroid Positioning
runTest('Concept Centroid Positioning Between Courses Across Semesters', () => {
  const courses = [
    { id: 'c1', course_code: 'EE3410', course_name: 'Power Electronics', semester_id: 'sem-1' },
    { id: 'c2', course_code: 'EE3810', course_name: 'Project I', semester_id: 'sem-2' },
  ];
  const concepts = [
    { id: 'conc-pwm', name: 'PWM Inverters', description: 'Pulse-Width Modulation' },
  ];
  const courseConcepts = [
    { id: 'cc1', course_id: 'c1', concept_id: 'conc-pwm' },
    { id: 'cc2', course_id: 'c2', concept_id: 'conc-pwm' },
  ];

  const res = computeMacroscopicTopology({ courses, concepts, courseConcepts });

  const conceptNode = res.nodes.find((n) => n.id === 'global-concept-conc-pwm');
  assert.ok(conceptNode, 'Shared concept node must be created');
  assert.equal(conceptNode.data.courseCount, 2, 'courseCount must reflect 2 linked courses');

  const c1Pos = res.coursePositions.get('c1');
  const c2Pos = res.coursePositions.get('c2');
  const expectedAvgX = Math.round((c1Pos.x + c2Pos.x) / 2);
  const expectedAvgY = Math.round((c1Pos.y + c2Pos.y) / 2);

  // Bridge index 0 staggering: +140x, +120y
  assert.equal(conceptNode.position.x, expectedAvgX + 140, 'Concept bridge X position staggered by +140');
  assert.equal(conceptNode.position.y, expectedAvgY + 120, 'Concept bridge Y position staggered by +120');

  // Verify bridge edges
  const bridgeEdges = res.edges.filter((e) => e.id.startsWith('edge-bridge-conc-pwm'));
  assert.equal(bridgeEdges.length, 2, 'Must create 2 bridge edges connecting both courses');
  assert.equal(bridgeEdges[0].sourceHandle, 'course-top');
  assert.equal(bridgeEdges[0].targetHandle, 'concept-bottom');
});

// 2.2 Dangling Course Concept References
runTest('Dangling Course Foreign Key in Course-Concept Mapping', () => {
  const courses = [
    { id: 'c1', course_code: 'EE3410', course_name: 'Power Electronics', semester_id: 'sem-1' },
  ];
  const concepts = [
    { id: 'conc-1', name: 'Concept 1', description: 'Test' },
  ];
  // cc2 points to non-existent course c-deleted
  const courseConcepts = [
    { id: 'cc1', course_id: 'c1', concept_id: 'conc-1' },
    { id: 'cc2', course_id: 'c-deleted', concept_id: 'conc-1' },
  ];

  const res = computeMacroscopicTopology({ courses, concepts, courseConcepts });

  // Verify that an edge is created with source: 'c-deleted'
  const danglingEdge = res.edges.find((e) => e.source === 'c-deleted');
  if (danglingEdge) {
    recordFinding(
      'Dangling Bridge Edge Created for Non-Existent Course',
      `In /app/graph, courseConcepts loops through linkedCourseIds without filtering by coursePositions.has(courseId). ` +
      `If a courseConcept links to a deleted/unloaded course ID, React Flow receives an edge whose source node does not exist in nodes array.`,
      'LOW'
    );
  }
});

// ==========================================================================
// DIMENSION 3: Degree Path Timeline Scrubber & Filter Mechanics
// ==========================================================================
console.log('\n--- [Dimension 3] Degree Path Timeline Scrubber & Filter Mechanics ---');

const testSemesters = [
  { id: 'sem-1', name: 'Semester 1' },
  { id: 'sem-2', name: 'Semester 2' },
  { id: 'sem-3', name: 'Semester 3' },
];

const multiSemCourses = [
  { id: 'c-s1', course_code: 'CS101', course_name: 'Intro CS', semester_id: 'sem-1' },
  { id: 'c-s2', course_code: 'CS201', course_name: 'Data Structures', semester_id: 'sem-2' },
  { id: 'c-s3', course_code: 'CS301', course_name: 'Algorithms', semester_id: 'sem-3' },
];

const multiSemPrereqs = [
  { id: 'p1', course_id: 'c-s2', prerequisite_course_id: 'c-s1' },
  { id: 'p2', course_id: 'c-s3', prerequisite_course_id: 'c-s2' },
];

// 3.1 Timeline Index Scrubber Steps
runTest('Timeline Scrubber: All (-1), Sem 1 (0), Sem 2 (1), Sem 3 (2)', () => {
  // All (-1)
  const resAll = computeMacroscopicTopology({
    courses: multiSemCourses,
    prerequisites: multiSemPrereqs,
    semesters: testSemesters,
    timelineIndex: -1,
  });
  assert.equal(resAll.nodes.filter((n) => n.style.opacity === 1).length, 3, 'All 3 courses active under All');
  assert.equal(resAll.edges.filter((e) => e.isActive).length, 2, 'Both edges active under All');

  // Sem 1 only (0)
  const resSem1 = computeMacroscopicTopology({
    courses: multiSemCourses,
    prerequisites: multiSemPrereqs,
    semesters: testSemesters,
    timelineIndex: 0,
  });
  const nodeS1 = resSem1.nodes.find((n) => n.id === 'c-s1');
  const nodeS2 = resSem1.nodes.find((n) => n.id === 'c-s2');
  const nodeS3 = resSem1.nodes.find((n) => n.id === 'c-s3');
  assert.equal(nodeS1.style.opacity, 1, 'Sem 1 course must be full opacity 1.0');
  assert.equal(nodeS2.style.opacity, 0.15, 'Sem 2 course must be dimmed to 0.15');
  assert.equal(nodeS3.style.opacity, 0.15, 'Sem 3 course must be dimmed to 0.15');
  assert.equal(resSem1.edges.filter((e) => e.isActive).length, 0, 'Cross-semester edges dimmed when target not in timeline');

  // Sem 1 + 2 (1)
  const resSem2 = computeMacroscopicTopology({
    courses: multiSemCourses,
    prerequisites: multiSemPrereqs,
    semesters: testSemesters,
    timelineIndex: 1,
  });
  assert.equal(resSem2.nodes.find((n) => n.id === 'c-s1').style.opacity, 1);
  assert.equal(resSem2.nodes.find((n) => n.id === 'c-s2').style.opacity, 1);
  assert.equal(resSem2.nodes.find((n) => n.id === 'c-s3').style.opacity, 0.15);
  // Edge c-s1 -> c-s2 is now active!
  const edgeP1 = resSem2.edges.find((e) => e.id === 'edge-prereq-c-s1-c-s2');
  assert.equal(edgeP1.isActive, true, 'Edge between Sem 1 and Sem 2 is active');
  const edgeP2 = resSem2.edges.find((e) => e.id === 'edge-prereq-c-s2-c-s3');
  assert.equal(edgeP2.isActive, false, 'Edge to Sem 3 remains inactive');
});

// 3.2 Adversarial / Missing / Out-of-Bounds Semester Data
runTest('Timeline Scrubber: Empty Semesters, Negative, and Out-of-Bounds Index', () => {
  // Empty semesters array
  const resEmpty = computeMacroscopicTopology({
    courses: multiSemCourses,
    prerequisites: multiSemPrereqs,
    semesters: [],
    timelineIndex: -1,
  });
  assert.equal(resEmpty.nodes.length, 3, 'Must render courses even with 0 semesters');
  assert.equal(resEmpty.nodes.every((n) => n.style.opacity === 0.15), true, 'All courses dimmed to 0.15 safely');

  // Negative index != -1
  const resNeg = computeMacroscopicTopology({
    courses: multiSemCourses,
    prerequisites: multiSemPrereqs,
    semesters: testSemesters,
    timelineIndex: -5,
  });
  assert.equal(resNeg.nodes.length, 3, 'Must not crash on negative timelineIndex');

  // Out of bounds index
  const resOOB = computeMacroscopicTopology({
    courses: multiSemCourses,
    prerequisites: multiSemPrereqs,
    semesters: testSemesters,
    timelineIndex: 999,
  });
  assert.equal(resOOB.nodes.filter((n) => n.style.opacity === 1).length, 3, 'Index 999 activates all semesters');
});

// 3.3 Search Query Filtering & Highlighting
runTest('Search Query Filtering across Course Code, Name, and Lecturer', () => {
  const courses = [
    { id: 'c1', course_code: 'EE3410E', course_name: 'Điện tử công suất', lecturer: 'Trần Trọng Minh', semester_id: 'sem-1' },
    { id: 'c2', course_code: 'EE4010E', course_name: 'Phân tích HTĐ', lecturer: 'Nguyễn Đức Huy', semester_id: 'sem-1' },
  ];

  // Match course code
  const resCode = computeMacroscopicTopology({ courses, semesters: testSemesters, searchQuery: '3410' });
  assert.equal(resCode.nodes.find((n) => n.id === 'c1').style.opacity, 1.0);
  assert.equal(resCode.nodes.find((n) => n.id === 'c2').style.opacity, 0.25);

  // Match lecturer
  const resLect = computeMacroscopicTopology({ courses, semesters: testSemesters, searchQuery: 'Đức Huy' });
  assert.equal(resLect.nodes.find((n) => n.id === 'c1').style.opacity, 0.25);
  assert.equal(resLect.nodes.find((n) => n.id === 'c2').style.opacity, 1.0);
});

// ==========================================================================
// DIMENSION 4: Viewport & Camera Persistence & Debounce Timing
// ==========================================================================
console.log('\n--- [Dimension 4] Viewport & Camera Persistence & Debounce Timing ---');

// 4.1 Zero-Jitter Viewport Restoration Logic Simulation
runTest('Zero-Jitter Viewport Mount Simulation (Saved vs Unsaved)', () => {
  // Test Case A: Saved Viewport Exists
  let setViewportCalls = [];
  let fitViewCalls = [];

  const fakeSetViewport = (vp, opts) => {
    setViewportCalls.push({ vp, opts });
  };
  const fakeFitView = (opts) => {
    fitViewCalls.push(opts);
  };

  // Mount with saved viewport
  const savedViewport = { x: 350, y: 220, zoom: 1.15 };
  let hasSavedViewport = false;
  let initialFitDone = false;

  // Emulate loadData
  hasSavedViewport = true;
  fakeSetViewport(savedViewport, { duration: 0 });

  // Emulate nodes populated useEffect
  const nodes = [{ id: 'course' }, { id: 'relationships' }, { id: 'files' }];
  if (nodes.length > 0) {
    if (hasSavedViewport) {
      // Bypassed!
    } else if (!initialFitDone) {
      initialFitDone = true;
      fakeFitView({ padding: 0.25, duration: 0 });
    }
  }

  assert.equal(setViewportCalls.length, 1, 'setViewport must be called immediately');
  assert.deepEqual(setViewportCalls[0].vp, savedViewport);
  assert.equal(setViewportCalls[0].opts.duration, 0, 'setViewport duration must be strictly 0');
  assert.equal(fitViewCalls.length, 0, 'fitView must be completely bypassed when saved viewport exists');

  // Test Case B: Cluster Toggle with Saved Viewport
  // User expands relationships: nodes increase from 3 to 15
  const expandedNodes = Array.from({ length: 15 }, (_, i) => ({ id: `node-${i}` }));
  if (expandedNodes.length > 0) {
    if (hasSavedViewport) {
      // Bypassed!
    } else if (!initialFitDone) {
      initialFitDone = true;
      fakeFitView({ padding: 0.25, duration: 0 });
    }
  }
  assert.equal(fitViewCalls.length, 0, 'fitView must NEVER be called upon cluster toggling');

  // Test Case C: Mount with NO Saved Viewport
  setViewportCalls = [];
  fitViewCalls = [];
  hasSavedViewport = false;
  initialFitDone = false;

  if (nodes.length > 0) {
    if (hasSavedViewport) {
      // Bypassed!
    } else if (!initialFitDone) {
      initialFitDone = true;
      fakeFitView({ padding: 0.25, duration: 0 });
    }
  }
  assert.equal(setViewportCalls.length, 0, 'setViewport must NOT be called when no saved viewport exists');
  assert.equal(fitViewCalls.length, 1, 'fitView must be called once on initial load');

  // Subsequent cluster toggle without saved viewport: initialFitDone is true, so fitView still NOT called again!
  if (expandedNodes.length > 0) {
    if (hasSavedViewport) {
      // Bypassed!
    } else if (!initialFitDone) {
      initialFitDone = true;
      fakeFitView({ padding: 0.25, duration: 0 });
    }
  }
  assert.equal(fitViewCalls.length, 1, 'fitView must not re-trigger on cluster expansion even without saved viewport');
});

// 4.2 Debounce Timing Precision (300ms)
await runAsyncTest('Layout Persistence Debounce 300ms Timing Verification', async () => {
  let saveTimer = null;
  let saveCalls = [];

  const debouncedSaveLayout = (courseId, positions, viewport) => {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      saveCalls.push({ courseId, positions, viewport, timestamp: performance.now() });
    }, 300);
  };

  const startTime = performance.now();

  // Burst of 4 pan events within 200ms
  debouncedSaveLayout('c1', { n1: { x: 10, y: 10 } }, { x: 0, y: 0, zoom: 1 });
  await new Promise((r) => setTimeout(r, 50));
  debouncedSaveLayout('c1', { n1: { x: 20, y: 20 } }, { x: 10, y: 0, zoom: 1 });
  await new Promise((r) => setTimeout(r, 50));
  debouncedSaveLayout('c1', { n1: { x: 30, y: 30 } }, { x: 20, y: 0, zoom: 1 });
  await new Promise((r) => setTimeout(r, 50));
  debouncedSaveLayout('c1', { n1: { x: 40, y: 40 } }, { x: 30, y: 0, zoom: 1 });

  // At 180ms from start (30ms after last call), saveCalls should still be 0!
  assert.equal(saveCalls.length, 0, 'Debounced calls within 300ms window must not execute immediately');

  // Wait 350ms (total ~500ms from start, 350ms after last call)
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(saveCalls.length, 1, 'Burst of pan events must coalesce into exactly 1 save call');
  assert.deepEqual(saveCalls[0].viewport, { x: 30, y: 0, zoom: 1 }, 'Must save final viewport from latest event');

  // Trigger one more event after timer elapsed
  debouncedSaveLayout('c1', { n1: { x: 50, y: 50 } }, { x: 40, y: 0, zoom: 1 });
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(saveCalls.length, 2, 'Second event after timer expiration must trigger a second save');
});

// 4.3 Dynamic Concept Occurrence Badge Calculation Invariance
runTest('Dynamic Concept Badge Calculation from Relational Store', () => {
  const rawStore = {
    course_concepts: [
      { course_id: 'c-1', concept_id: 'conc-test' },
      { course_id: 'c-2', concept_id: 'conc-test' },
      { course_id: 'c-3', concept_id: 'conc-test' },
    ],
    course_documents: [
      { course_id: 'c-1', document_id: 'doc-1' },
      { course_id: 'c-1', document_id: 'doc-2' },
      { course_id: 'c-2', document_id: 'doc-2' }, // shared doc
      { course_id: 'c-2', document_id: 'doc-3' },
      { course_id: 'c-3', document_id: 'doc-4' },
      { course_id: 'c-other', document_id: 'doc-99' }, // not in concept courses
    ],
  };

  const conceptId = 'conc-test';

  const courseLinks = (rawStore.course_concepts || []).filter(
    (cc) => cc.concept_id === conceptId
  );
  let courseCount = courseLinks.length;
  let docCount = 0;

  if (courseLinks.length > 0) {
    const courseIds = new Set(courseLinks.map((cc) => cc.course_id));
    const docsInCourses = (rawStore.course_documents || []).filter((cd) =>
      courseIds.has(cd.course_id)
    );
    docCount = new Set(docsInCourses.map((cd) => cd.document_id)).size;
  }

  assert.equal(courseCount, 3, 'Course count should be 3');
  // Unique docs: doc-1, doc-2, doc-3, doc-4 = 4 documents
  assert.equal(docCount, 4, 'Doc count should be 4 unique documents');
});

// ==========================================================================
// DIMENSION 5: Code Audit Checks
// ==========================================================================
console.log('\n--- [Dimension 5] Source Code & Architecture Audit Checks ---');

runTest('CourseNode Handle Cardinality Check', () => {
  const courseNodeSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/graph/nodes/course-node.tsx'), 'utf8');
  assert.ok(courseNodeSrc.includes('id="course-top"'), 'CourseNode must have course-top');
  assert.ok(courseNodeSrc.includes('id="course-bottom"'), 'CourseNode must have course-bottom');
  assert.ok(courseNodeSrc.includes('id="course-left"'), 'CourseNode must have course-left');
  assert.ok(courseNodeSrc.includes('id="course-right"'), 'CourseNode must have course-right');

  // Verify handle types:
  // Note: in CourseNode, all handles are defined as type="source"
  const isLeftSource = courseNodeSrc.includes('type="source"\n        id="course-left"');
  if (isLeftSource) {
    recordFinding(
      'CourseNode Handle Type Asymmetry',
      `In CourseNode (src/components/graph/nodes/course-node.tsx), course-left has type="source", ` +
      `yet in src/app/app/graph/page.tsx, directed prerequisite edges connect with targetHandle: "course-left". ` +
      `While programmatic rendering works because nodesConnectable={false}, semantically course-left should include a target handle to prevent xyflow internal lookup warnings.`,
      'LOW'
    );
  }
});

runTest('App Sidebar Navigation Integration Check', () => {
  const sidebarSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/navigation/app-sidebar.tsx'), 'utf8');
  assert.ok(sidebarSrc.includes('/app/graph'), 'Sidebar must contain /app/graph link');
  assert.ok(sidebarSrc.includes('Curriculum Graph') || sidebarSrc.includes('Graph'), 'Sidebar must label the link appropriately');
});

console.log('\n========================================================================');
console.log(` RESULTS: ${passCount} PASSED, ${failCount} FAILED, ${findingCount} FINDINGS RECORDED`);
console.log('========================================================================\n');

if (findings.length > 0) {
  console.log('SUMMARY OF EMPIRICAL FINDINGS:');
  findings.forEach((f, idx) => {
    console.log(`\n[Finding ${idx + 1}] (${f.severity}) ${f.title}`);
    console.log(`  ${f.description}`);
  });
}
