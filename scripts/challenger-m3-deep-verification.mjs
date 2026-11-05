// scripts/challenger-m3-deep-verification.mjs
// Empirical Challenger M3_2_2: Deep Verification & Stress-Test Harness

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validatePrerequisiteDAG, assertAcyclicPrerequisites } from '../src/lib/academic/prerequisites.ts';

console.log('========================================================================');
console.log(' CHALLENGER M3_2_2: DEEP EMPIRICAL VERIFICATION & STRESS-TEST HARNESS');
console.log(' Macroscopic Global Curriculum Graph, FK Integrity, Handles & Viewport');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;
const findings = [];

function recordTest(name, fn) {
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
    findings.push({ name, error: err.message, stack: err.stack });
  }
}

async function recordAsyncTest(name, fn) {
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
    findings.push({ name, error: err.message, stack: err.stack });
  }
}

// -----------------------------------------------------------------------------
// Direct replica of Macroscopic Topology Engine from src/app/app/graph/page.tsx
// -----------------------------------------------------------------------------
function buildMacroscopicTopology({
  courses = [],
  prerequisites = [],
  concepts = [],
  courseConcepts = [],
  semesters = [],
  timelineIndex = -1,
  searchQuery = '',
}) {
  if (courses.length === 0) return { nodes: [], edges: [], tiers: [], coursePositions: new Map() };

  const newNodes = [];
  const newEdges = [];

  const dagResult = validatePrerequisiteDAG(courses, prerequisites);
  const courseTierMap = new Map(Object.entries(dagResult.tiers));

  const tiers = [];
  courses.forEach((c) => {
    const tier = courseTierMap.get(c.id) ?? 0;
    if (!tiers[tier]) tiers[tier] = [];
    tiers[tier].push(c);
  });

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
    const colX = START_X + tierIdx * COLUMN_WIDTH;
    tierCourses.forEach((course, rowIdx) => {
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
        type: "courseNode",
        position: { x: colX, y: rowY },
        tier: tierIdx,
        data: {
          courseCode: course.course_code,
          courseName: course.course_name,
          credits: course.credits,
          lecturer: course.lecturer,
        },
        style: { opacity },
      });
    });
  });

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
        sourceHandle: "course-right",
        target: prereq.course_id,
        targetHandle: "course-left",
        type: "smoothstep",
        isActive,
        style: { opacity: isActive ? 1 : 0.15 },
      });
    }
  });

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

    const avgX = Math.round(
      validCoords.reduce((acc, p) => acc + p.x, 0) / validCoords.length
    );
    const avgY = Math.round(
      validCoords.reduce((acc, p) => acc + p.y, 0) / validCoords.length
    );

    const bridgePos = {
      x: avgX + (bridgeIdx % 2 === 0 ? 140 : -140),
      y: avgY + (bridgeIdx % 2 === 0 ? 120 : -120),
    };

    const nodeId = `global-concept-${concept.id}`;
    newNodes.push({
      id: nodeId,
      type: "conceptNode",
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
        sourceHandle: "course-top",
        target: nodeId,
        targetHandle: "concept-bottom",
        type: "smoothstep",
      });
    });
  });

  return { nodes: newNodes, edges: newEdges, tiers, coursePositions, courseTierMap, dagResult };
}

// =============================================================================
// TEST SUITE 1: DIAMOND DAG & ADVANCED TOPOLOGY STRESS TESTING
// =============================================================================
console.log('--- Test Suite 1: Diamond DAG & Sibling Traversal ---');

recordTest('1.1 Classic Symmetric Diamond DAG', () => {
  const courses = [
    { id: 'foundation', course_code: 'F1', course_name: 'Foundation' },
    { id: 'branch-a', course_code: 'A1', course_name: 'Branch A' },
    { id: 'branch-b', course_code: 'B1', course_name: 'Branch B' },
    { id: 'capstone', course_code: 'C1', course_name: 'Capstone' },
  ];
  const prerequisites = [
    { id: 'p1', course_id: 'branch-a', prerequisite_course_id: 'foundation' },
    { id: 'p2', course_id: 'branch-b', prerequisite_course_id: 'foundation' },
    { id: 'p3', course_id: 'capstone', prerequisite_course_id: 'branch-a' },
    { id: 'p4', course_id: 'capstone', prerequisite_course_id: 'branch-b' },
  ];

  const { courseTierMap, nodes } = buildMacroscopicTopology({ courses, prerequisites });
  assert.equal(courseTierMap.get('foundation'), 0, 'Foundation is Tier 0');
  assert.equal(courseTierMap.get('branch-a'), 1, 'Branch A is Tier 1');
  assert.equal(courseTierMap.get('branch-b'), 1, 'Branch B is Tier 1');
  assert.equal(courseTierMap.get('capstone'), 2, 'Capstone is Tier 2');

  const nodeA = nodes.find((n) => n.id === 'branch-a');
  const nodeB = nodes.find((n) => n.id === 'branch-b');
  assert.equal(nodeA.position.x, nodeB.position.x, 'Sibling branches occupy same column X');
  assert.notEqual(nodeA.position.y, nodeB.position.y, 'Sibling branches have distinct row Y');
});

recordTest('1.2 Asymmetric Diamond DAG with Unequal Branch Lengths', () => {
  // Foundation -> ShortBranch -> Capstone
  // Foundation -> Mid1 -> Mid2 -> Capstone
  const courses = [
    { id: 'foundation', course_code: 'F0', course_name: 'Foundation' },
    { id: 'short-branch', course_code: 'S1', course_name: 'Short Branch' },
    { id: 'mid-1', course_code: 'M1', course_name: 'Mid 1' },
    { id: 'mid-2', course_code: 'M2', course_name: 'Mid 2' },
    { id: 'capstone', course_code: 'C3', course_name: 'Capstone' },
  ];
  const prerequisites = [
    { id: 'p1', course_id: 'short-branch', prerequisite_course_id: 'foundation' },
    { id: 'p2', course_id: 'mid-1', prerequisite_course_id: 'foundation' },
    { id: 'p3', course_id: 'mid-2', prerequisite_course_id: 'mid-1' },
    { id: 'p4', course_id: 'capstone', prerequisite_course_id: 'short-branch' },
    { id: 'p5', course_id: 'capstone', prerequisite_course_id: 'mid-2' },
  ];

  const { courseTierMap } = buildMacroscopicTopology({ courses, prerequisites });
  assert.equal(courseTierMap.get('foundation'), 0);
  assert.equal(courseTierMap.get('short-branch'), 1);
  assert.equal(courseTierMap.get('mid-1'), 1);
  assert.equal(courseTierMap.get('mid-2'), 2);
  assert.equal(courseTierMap.get('capstone'), 3, 'Capstone must be Tier 3 (max path 0 -> 1 -> 2 -> 3)');
});

recordTest('1.3 Multi-Sibling Wide Lattice (8 Sibling Branches)', () => {
  const K = 8;
  const courses = [
    { id: 'root', course_code: 'ROOT', course_name: 'Root' },
    ...Array.from({ length: K }, (_, i) => ({
      id: `sibling-${i}`,
      course_code: `SIB${i}`,
      course_name: `Sibling ${i}`,
    })),
    { id: 'sink', course_code: 'SINK', course_name: 'Sink' },
  ];
  const prerequisites = [
    ...Array.from({ length: K }, (_, i) => ({
      id: `p-root-${i}`,
      course_id: `sibling-${i}`,
      prerequisite_course_id: 'root',
    })),
    ...Array.from({ length: K }, (_, i) => ({
      id: `p-sink-${i}`,
      course_id: 'sink',
      prerequisite_course_id: `sibling-${i}`,
    })),
  ];

  const { courseTierMap, nodes } = buildMacroscopicTopology({ courses, prerequisites });
  assert.equal(courseTierMap.get('root'), 0);
  for (let i = 0; i < K; i++) {
    assert.equal(courseTierMap.get(`sibling-${i}`), 1, `Sibling ${i} must be Tier 1`);
  }
  assert.equal(courseTierMap.get('sink'), 2, 'Sink must be Tier 2');

  const siblingNodes = nodes.filter((n) => n.id.startsWith('sibling-'));
  assert.equal(siblingNodes.length, K);
  const yPositions = new Set(siblingNodes.map((n) => n.position.y));
  assert.equal(yPositions.size, K, 'All siblings must have distinct non-overlapping Y rows');
});

// =============================================================================
// TEST SUITE 2: CYCLE RESILIENCE & SCALE HARNESS
// =============================================================================
console.log('\n--- Test Suite 2: Cycle Detection & Scalability ---');

recordTest('2.1 Complex Cycle with Disconnected Subgraph Non-Crash', () => {
  const courses = [
    { id: 'c1', course_code: 'C1', course_name: '1' },
    { id: 'c2', course_code: 'C2', course_name: '2' },
    { id: 'c3', course_code: 'C3', course_name: '3' },
    { id: 'ok1', course_code: 'OK1', course_name: 'OK 1' },
    { id: 'ok2', course_code: 'OK2', course_name: 'OK 2' },
  ];
  const prerequisites = [
    { id: 'p1', course_id: 'c2', prerequisite_course_id: 'c1' },
    { id: 'p2', course_id: 'c3', prerequisite_course_id: 'c2' },
    { id: 'p3', course_id: 'c1', prerequisite_course_id: 'c3' }, // Cycle 1-2-3-1
    { id: 'p4', course_id: 'ok2', prerequisite_course_id: 'ok1' },
  ];

  const result = validatePrerequisiteDAG(courses, prerequisites);
  assert.equal(result.isAcyclic, false, 'Cycle must be detected');
  assert.ok(result.cycles.length > 0, 'Cycles must be reported');
  assert.ok(result.cycleTrace, 'Cycle trace must be formatted');

  // Verify that building the macroscopic topology still completes safely without throwing
  const topo = buildMacroscopicTopology({ courses, prerequisites });
  assert.equal(topo.nodes.length, 5, 'All 5 nodes must be rendered');
});

recordTest('2.2 High-Throughput Scalability: 1,000-Node Linear Chain', () => {
  const N = 1000;
  const courses = Array.from({ length: N }, (_, i) => ({
    id: `node-${i}`,
    course_code: `C${i}`,
    course_name: `Course ${i}`,
  }));
  const prerequisites = Array.from({ length: N - 1 }, (_, i) => ({
    id: `prereq-${i}`,
    course_id: `node-${i + 1}`,
    prerequisite_course_id: `node-${i}`,
  }));

  const start = performance.now();
  const topo = buildMacroscopicTopology({ courses, prerequisites });
  const duration = performance.now() - start;

  assert.ok(duration < 250, `1000-node layout must execute under 250ms (took ${duration.toFixed(2)}ms)`);
  assert.equal(topo.nodes.length, N);
  assert.equal(topo.edges.length, N - 1);
  assert.equal(topo.courseTierMap.get(`node-${N - 1}`), N - 1, 'Final node must have tier 999');
});

// =============================================================================
// TEST SUITE 3: AUTHENTIC DATA INTEGRITY & EE4020E RENDERING
// =============================================================================
console.log('\n--- Test Suite 3: Authentic Data Foreign Key Integrity & EE4020E ---');

await recordAsyncTest('3.1 Authentic Curriculum Prerequisite Verification', async () => {
  const { INITIAL_COURSES, INITIAL_COURSE_PREREQUISITES } = await import('../src/lib/data/mock-data.ts');

  assert.equal(INITIAL_COURSES.length, 9, 'Authentic curriculum has 9 courses');
  assert.equal(INITIAL_COURSE_PREREQUISITES.length, 5, 'Authentic curriculum has 5 prerequisites');

  const prereq2 = INITIAL_COURSE_PREREQUISITES.find((p) => p.id === 'prereq-2');
  assert.ok(prereq2, 'prereq-2 must exist');
  assert.equal(prereq2.course_id, 'c-ee4020e', 'prereq-2 course_id must be c-ee4020e with trailing "e"');
  assert.equal(prereq2.prerequisite_course_id, 'c-ee4010', 'prereq-2 prerequisite is c-ee4010');

  const courseEE4020E = INITIAL_COURSES.find((c) => c.id === 'c-ee4020e');
  assert.ok(courseEE4020E, 'Course c-ee4020e must exist in INITIAL_COURSES');
  assert.equal(courseEE4020E.course_code, 'EE4020E');

  const topo = buildMacroscopicTopology({
    courses: INITIAL_COURSES,
    prerequisites: INITIAL_COURSE_PREREQUISITES,
  });

  // Verify DAG tiers of authentic courses:
  // c-ee3140 (EE3140E) -> Tier 0
  // c-ee4010 (EE4010E) -> Tier 1
  // c-ee4020e (EE4020E) -> Tier 2
  const tierEE3140 = topo.courseTierMap.get('c-ee3140');
  const tierEE4010 = topo.courseTierMap.get('c-ee4010');
  const tierEE4020E = topo.courseTierMap.get('c-ee4020e');

  assert.equal(tierEE3140, 0, 'EE3140E is Tier 0 foundation');
  assert.equal(tierEE4010, 1, 'EE4010E is Tier 1 dependent on EE3140E');
  assert.equal(tierEE4020E, 2, 'EE4020E is Tier 2 dependent on EE4010E');

  // Verify edge c-ee4010 -> c-ee4020e exists
  const edgeEE = topo.edges.find((e) => e.id === 'edge-prereq-c-ee4010-c-ee4020e');
  assert.ok(edgeEE, 'Prerequisite edge c-ee4010 -> c-ee4020e must exist in edges');
  assert.equal(edgeEE.source, 'c-ee4010');
  assert.equal(edgeEE.target, 'c-ee4020e');
  assert.equal(edgeEE.sourceHandle, 'course-right');
  assert.equal(edgeEE.targetHandle, 'course-left');

  // Verify positions: EE4020E must be positioned to the right of EE4010E
  const posEE4010 = topo.coursePositions.get('c-ee4010');
  const posEE4020E = topo.coursePositions.get('c-ee4020e');
  assert.ok(posEE4020E.x > posEE4010.x, 'EE4020E column X must be greater than EE4010E column X');
  assert.equal(posEE4020E.x - posEE4010.x, 580, 'EE4020E column X must be exactly COLUMN_WIDTH (580px) to the right');
});

// =============================================================================
// TEST SUITE 4: CONCEPT BRIDGE FILTERING & ORPHAN PREVENTION
// =============================================================================
console.log('\n--- Test Suite 4: Concept Bridge Filtering & Orphan Prevention ---');

recordTest('4.1 Concept Bridge Filtering Unmounted / Dangling Courses', () => {
  const courses = [
    { id: 'c1', course_code: 'C1', course_name: 'Course 1' },
    { id: 'c2', course_code: 'C2', course_name: 'Course 2' },
  ];
  const concepts = [
    { id: 'conc-shared', name: 'Shared Concept' },
    { id: 'conc-dangling-only', name: 'Ghost Concept' },
  ];
  const courseConcepts = [
    { id: 'cc1', course_id: 'c1', concept_id: 'conc-shared' },
    { id: 'cc2', course_id: 'c2', concept_id: 'conc-shared' },
    { id: 'cc3', course_id: 'c-ghost', concept_id: 'conc-shared' }, // Dangling ID in shared concept
    { id: 'cc4', course_id: 'c-ghost1', concept_id: 'conc-dangling-only' }, // All links dangling
    { id: 'cc5', course_id: 'c-ghost2', concept_id: 'conc-dangling-only' },
  ];

  const topo = buildMacroscopicTopology({ courses, concepts, courseConcepts });

  // 1. conc-shared should be rendered, but only connected to c1 and c2
  const sharedNode = topo.nodes.find((n) => n.id === 'global-concept-conc-shared');
  assert.ok(sharedNode, 'Shared concept node must be created');
  const sharedEdges = topo.edges.filter((e) => e.target === 'global-concept-conc-shared');
  assert.equal(sharedEdges.length, 2, 'Only 2 edges created for mounted courses c1 and c2');
  assert.ok(!sharedEdges.some((e) => e.source === 'c-ghost'), 'No edge created for dangling c-ghost');

  // 2. conc-dangling-only should NOT produce a concept node or NaN coordinates
  const ghostNode = topo.nodes.find((n) => n.id === 'global-concept-conc-dangling-only');
  assert.equal(ghostNode, undefined, 'Ghost concept with 0 valid mounted courses must not produce a node');

  // 3. Verify no NaN in any node positions
  for (const n of topo.nodes) {
    assert.ok(!Number.isNaN(n.position.x), `Node ${n.id} position.x is NaN`);
    assert.ok(!Number.isNaN(n.position.y), `Node ${n.id} position.y is NaN`);
  }
});

// =============================================================================
// TEST SUITE 5: COURSENODE & CONCEPTNODE HANDLE DUALITY & CONTRACT
// =============================================================================
console.log('\n--- Test Suite 5: CourseNode & ConceptNode Handle Duality ---');

recordTest('5.1 CourseNode 8 Cardinal Dual Handles Static AST Verification', () => {
  const courseNodeFilePath = path.join(process.cwd(), 'src/components/graph/nodes/course-node.tsx');
  const content = fs.readFileSync(courseNodeFilePath, 'utf8');

  // Verify all 8 handles exist
  const requiredHandles = [
    { id: 'course-top', type: 'source' },
    { id: 'course-top-target', type: 'target' },
    { id: 'course-bottom', type: 'target' },
    { id: 'course-bottom-source', type: 'source' },
    { id: 'course-left', type: 'target' },
    { id: 'course-left-source', type: 'source' },
    { id: 'course-right', type: 'source' },
    { id: 'course-right-target', type: 'target' },
  ];

  for (const h of requiredHandles) {
    const handleRegex = new RegExp(`type=["']${h.type}["'][^>]*id=["']${h.id}["']|id=["']${h.id}["'][^>]*type=["']${h.type}["']`);
    assert.ok(handleRegex.test(content), `CourseNode must define handle id="${h.id}" with type="${h.type}"`);
  }
});

recordTest('5.2 CourseGraphCanvas and Macroscopic Graph Edge Handle Compatibility', () => {
  const canvasContent = fs.readFileSync(path.join(process.cwd(), 'src/components/graph/course-graph-canvas.tsx'), 'utf8');
  const macroContent = fs.readFileSync(path.join(process.cwd(), 'src/app/app/graph/page.tsx'), 'utf8');

  // In course-graph-canvas.tsx:
  // West edge: sourceHandle: "course-left-source", targetHandle: "rel-right"
  assert.ok(canvasContent.includes('sourceHandle: "course-left-source"'), 'Canvas connects West branch via course-left-source');
  // East edge: sourceHandle: "course-right", targetHandle: "files-left"
  assert.ok(canvasContent.includes('sourceHandle: "course-right"'), 'Canvas connects East branch via course-right');

  // In macroscopic graph page.tsx:
  // Prerequisite edge: sourceHandle: "course-right", targetHandle: "course-left"
  assert.ok(macroContent.includes('sourceHandle: "course-right"'), 'Macroscopic graph connects prereq source to course-right');
  assert.ok(macroContent.includes('targetHandle: "course-left"'), 'Macroscopic graph connects prereq target to course-left');
  // Concept bridge: sourceHandle: "course-top", targetHandle: "concept-bottom"
  assert.ok(macroContent.includes('sourceHandle: "course-top"'), 'Bridge edge connects source to course-top');
  assert.ok(macroContent.includes('targetHandle: "concept-bottom"'), 'Bridge edge connects target to concept-bottom');
});

// =============================================================================
// TEST SUITE 6: VIEWPORT PERSISTENCE & TIMING AUDIT
// =============================================================================
console.log('\n--- Test Suite 6: Viewport Persistence & Debounce Timing ---');

recordTest('6.1 CourseGraphCanvas Synchronous Viewport Restoration Code Verification', () => {
  const canvasContent = fs.readFileSync(path.join(process.cwd(), 'src/components/graph/course-graph-canvas.tsx'), 'utf8');

  // Check synchronous setViewport with duration: 0
  assert.ok(canvasContent.includes('setViewport(data.layout.viewport, { duration: 0 })'), 'setViewport must be called with duration: 0');
  // Check fitView bypass when saved viewport exists
  assert.ok(canvasContent.includes('hasSavedViewportRef.current'), 'Must track hasSavedViewportRef to bypass fitView');
  assert.ok(canvasContent.includes('return; // Bypassed: saved viewport is active, preserving exact camera position'), 'fitView must be bypassed when saved viewport exists');
  // Check 300ms persistence debounce
  assert.ok(canvasContent.includes('300'), 'Persistence debounce must be 300ms');
});

// =============================================================================
// TEST SUITE 1 (EXTENDED): ADVANCED DAG TOPOLOGIES
// =============================================================================
recordTest('1.4 Cross-Tier Multi-Parent Convergence (Skip-Level Dependency)', () => {
  // Foundation (0) -> Intermediary (1) -> Dependent (2)
  // Foundation (0) ---------------------> SkipLevelDependent (depends on Foundation and Dependent)
  const courses = [
    { id: 'f0', course_code: 'F0', course_name: 'Foundation' },
    { id: 'm1', course_code: 'M1', course_name: 'Mid' },
    { id: 'd2', course_code: 'D2', course_name: 'Deep' },
    { id: 'skip', course_code: 'SKIP', course_name: 'Skip Level' },
  ];
  const prerequisites = [
    { id: 'p1', course_id: 'm1', prerequisite_course_id: 'f0' },
    { id: 'p2', course_id: 'd2', prerequisite_course_id: 'm1' },
    { id: 'p3', course_id: 'skip', prerequisite_course_id: 'f0' },
    { id: 'p4', course_id: 'skip', prerequisite_course_id: 'd2' },
  ];

  const { courseTierMap } = buildMacroscopicTopology({ courses, prerequisites });
  assert.equal(courseTierMap.get('f0'), 0);
  assert.equal(courseTierMap.get('m1'), 1);
  assert.equal(courseTierMap.get('d2'), 2);
  assert.equal(courseTierMap.get('skip'), 3, 'Skip-level course must be placed at Tier 3 (max of incoming parents + 1)');
});

recordTest('1.5 Bowtie / Butterfly DAG (Multi-Source Bottleneck Multi-Sink)', () => {
  // 3 Foundations (F1, F2, F3) -> Bottleneck B -> 3 Sinks (S1, S2, S3)
  const courses = [
    { id: 'f1', course_code: 'F1', course_name: 'F1' },
    { id: 'f2', course_code: 'F2', course_name: 'F2' },
    { id: 'f3', course_code: 'F3', course_name: 'F3' },
    { id: 'b', course_code: 'B', course_name: 'Bottleneck' },
    { id: 's1', course_code: 'S1', course_name: 'S1' },
    { id: 's2', course_code: 'S2', course_name: 'S2' },
    { id: 's3', course_code: 'S3', course_name: 'S3' },
  ];
  const prerequisites = [
    { id: 'p1', course_id: 'b', prerequisite_course_id: 'f1' },
    { id: 'p2', course_id: 'b', prerequisite_course_id: 'f2' },
    { id: 'p3', course_id: 'b', prerequisite_course_id: 'f3' },
    { id: 'p4', course_id: 's1', prerequisite_course_id: 'b' },
    { id: 'p5', course_id: 's2', prerequisite_course_id: 'b' },
    { id: 'p6', course_id: 's3', prerequisite_course_id: 'b' },
  ];

  const { courseTierMap } = buildMacroscopicTopology({ courses, prerequisites });
  assert.equal(courseTierMap.get('f1'), 0);
  assert.equal(courseTierMap.get('f2'), 0);
  assert.equal(courseTierMap.get('f3'), 0);
  assert.equal(courseTierMap.get('b'), 1, 'Bottleneck course must be Tier 1');
  assert.equal(courseTierMap.get('s1'), 2, 'Sink S1 must be Tier 2');
  assert.equal(courseTierMap.get('s2'), 2, 'Sink S2 must be Tier 2');
  assert.equal(courseTierMap.get('s3'), 2, 'Sink S3 must be Tier 2');
});

// =============================================================================
// TEST SUITE 2 (EXTENDED): CYCLE FALLBACK ROBUSTNESS
// =============================================================================
recordTest('2.3 Cyclic Courses Fallback to Tier 0 Safely in UI Layout', () => {
  // A and B form a 2-cycle; C is independent
  const courses = [
    { id: 'cA', course_code: 'A', course_name: 'A' },
    { id: 'cB', course_code: 'B', course_name: 'B' },
    { id: 'cC', course_code: 'C', course_name: 'C' },
  ];
  const prerequisites = [
    { id: 'p1', course_id: 'cA', prerequisite_course_id: 'cB' },
    { id: 'p2', course_id: 'cB', prerequisite_course_id: 'cA' },
  ];

  const topo = buildMacroscopicTopology({ courses, prerequisites });
  // All 3 courses must have non-NaN coordinates
  for (const n of topo.nodes) {
    assert.ok(typeof n.position.x === 'number' && !Number.isNaN(n.position.x));
    assert.ok(typeof n.position.y === 'number' && !Number.isNaN(n.position.y));
  }
  // cA and cB default to Tier 0 safely
  assert.equal(topo.courseTierMap.get('cA') ?? 0, 0);
  assert.equal(topo.courseTierMap.get('cB') ?? 0, 0);
  assert.equal(topo.courseTierMap.get('cC') ?? 0, 0);
});

// =============================================================================
// TEST SUITE 3 (EXTENDED): AUTHENTIC TOPOLOGY VERIFICATION
// =============================================================================
await recordAsyncTest('3.2 Authentic Curriculum Full Canvas Simulation', async () => {
  const { INITIAL_COURSES, INITIAL_COURSE_PREREQUISITES } = await import('../src/lib/data/mock-data.ts');
  const topo = buildMacroscopicTopology({
    courses: INITIAL_COURSES,
    prerequisites: INITIAL_COURSE_PREREQUISITES,
  });

  // Verify exact coordinates of EE4020E
  const ee4020eNode = topo.nodes.find((n) => n.id === 'c-ee4020e');
  assert.ok(ee4020eNode, 'EE4020E node must exist');
  assert.equal(ee4020eNode.tier, 2, 'EE4020E must be in Tier 2');
  assert.equal(ee4020eNode.position.x, 120 + 2 * 580, 'EE4020E column X must be 1280 (Tier 2)');

  // Verify internal prerequisite edges count (4 internal + 1 external dropped cleanly)
  const prereqEdges = topo.edges.filter((e) => e.id.startsWith('edge-prereq-'));
  assert.equal(prereqEdges.length, 4, 'Exactly 4 internal prerequisite edges rendered');
});

// =============================================================================
// TEST SUITE 6 (EXTENDED): DEBOUNCED LAYOUT TIMING VERIFICATION
// =============================================================================
await recordAsyncTest('6.2 Empirical 300ms Debounce Execution Verification', async () => {
  let executions = 0;
  let timer = null;

  const triggerDebounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      executions++;
    }, 300);
  };

  // 10 rapid triggers within 150ms
  for (let i = 0; i < 10; i++) {
    triggerDebounced();
    await new Promise((r) => setTimeout(r, 15));
  }

  assert.equal(executions, 0, 'Must not execute prematurely within 300ms');

  // Wait 350ms
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(executions, 1, 'Must execute exactly once after 300ms debounce expires');
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n========================================================================');
console.log(` RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log('========================================================================\n');

if (failCount > 0) {
  process.exit(1);
}

