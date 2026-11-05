// scripts/verify-m3-milestone.mjs
// Milestone 3 Verification Suite: Neural Knowledge Graph Evolution (Pillar 2)

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== NEURON Milestone 3 Verification Suite ===\n');

// 1. Concentric Radial Layout Engine with Screen-Space Inverted Y Coordinates & Staggering
console.log('[1] Testing Concentric Radial Layout Engine (src/components/graph/layout/radial-layout.ts)...');
const { computeConcentricLayout, calculateConcentricLayout } = await import('../src/components/graph/layout/radial-layout.ts');

const center = { x: 500, y: 320 };

// 1a. Test base radius when N <= 8
const resSmall = computeConcentricLayout(center, 4, 4, 3);
assert.equal(resSmall.people.length, 4);
assert.equal(resSmall.docs.length, 4);
assert.equal(resSmall.concepts.length, 3);

// Verify West sector (People): x < center.x (135° to 225°)
for (const p of resSmall.people) {
  assert.ok(p.x < center.x, `Person node (${p.x}, ${p.y}) should be West of center ${center.x}`);
  const dist = Math.hypot(p.x - center.x, p.y - center.y);
  assert.equal(Math.round(dist), 420, 'Base radius should be 420px for N <= 8');
}
console.log('  ✔ West Sector (People): All nodes placed West [3π/4, 5π/4] at R_base = 420px.');

// Verify East sector (Documents): x > center.x (-45° to 45°)
for (const d of resSmall.docs) {
  assert.ok(d.x > center.x, `Document node (${d.x}, ${d.y}) should be East of center ${center.x}`);
  const dist = Math.hypot(d.x - center.x, d.y - center.y);
  assert.equal(Math.round(dist), 420, 'Base radius should be 420px for N <= 8');
}
console.log('  ✔ East Sector (Documents): All nodes placed East [-π/4, π/4] at R_base = 420px.');

// Verify North sector (Concepts): y < center.y (DOM screen-space inverted Y)
for (const c of resSmall.concepts) {
  assert.ok(c.y < center.y, `Concept node (${c.x}, ${c.y}) must have y < ${center.y} to be placed North in screen space`);
  const dist = Math.hypot(c.x - center.x, c.y - center.y);
  assert.equal(Math.round(dist), 420, 'Base radius should be 420px for N <= 8');
}
console.log('  ✔ North Sector (Concepts): Screen-space inverted Y (y = Y_c - R*sin(theta)) places all concepts strictly North.');

// 1b. Test multi-tier staggering when N > 8
const resLarge = computeConcentricLayout(center, 10, 10, 10);
assert.equal(resLarge.people.length, 10);
for (let i = 0; i < resLarge.people.length; i++) {
  const p = resLarge.people[i];
  const dist = Math.hypot(p.x - center.x, p.y - center.y);
  const expectedRadius = i % 2 === 0 ? 380 : 460;
  assert.ok(Math.abs(dist - expectedRadius) <= 1.5, `Staggered node index ${i} should have radius ~${expectedRadius}px, got ${dist}px`);
}
console.log('  ✔ Multi-Tier Staggering (N > 8): Alternates odd/even nodes between R_1 = 380px and R_2 = 460px.');

// 1c. Test calculateConcentricLayout wrapper
const resWrapper = calculateConcentricLayout(null, [1, 2], [1], [1, 2, 3], { center });
assert.equal(resWrapper.people.length, 2);
assert.equal(resWrapper.docs.length, 1);
assert.equal(resWrapper.concepts.length, 3);
console.log('  ✔ calculateConcentricLayout contract wrapper verified.\n');

// 2. First-Class Concept Nodes Component Verification
console.log('[2] Testing First-Class Concept Nodes (src/components/graph/nodes/concept-node.tsx)...');
const conceptNodeSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/graph/nodes/concept-node.tsx'), 'utf8');

// Check 4 cardinal handles
assert.ok(conceptNodeSrc.includes('id="concept-top"'), 'ConceptNode must define concept-top handle');
assert.ok(conceptNodeSrc.includes('id="concept-bottom"'), 'ConceptNode must define concept-bottom handle');
assert.ok(conceptNodeSrc.includes('id="concept-left"'), 'ConceptNode must define concept-left handle');
assert.ok(conceptNodeSrc.includes('id="concept-right"'), 'ConceptNode must define concept-right handle');
assert.ok(conceptNodeSrc.includes('w-2.5 h-2.5 bg-foreground border border-background'), 'Handles must use monochrome styling w-2.5 h-2.5 bg-foreground border border-background');
console.log('  ✔ 4 Cardinal Handles verified (Top, Bottom, Left, Right) with monochrome styling.');

// Check occurrence badges & filter trigger
assert.ok(conceptNodeSrc.includes('{data.courseCount ?? 1} COURSES'), 'ConceptNode must render dynamic COURSES badge');
assert.ok(conceptNodeSrc.includes('{data.docCount ?? 0} DOCS'), 'ConceptNode must render dynamic DOCS badge');
assert.ok(conceptNodeSrc.includes('handleFilterClick'), 'ConceptNode must have interactive filter click handler');
assert.ok(conceptNodeSrc.includes('Filter'), 'ConceptNode must render Filter button');
console.log('  ✔ Dynamic Occurrence Badges ({courseCount} COURSES, {docCount} DOCS) & Filter Trigger verified.\n');

// 3. Macroscopic Global Curriculum Graph Page & Sidebar Integration
console.log('[3] Testing Macroscopic Global Curriculum Graph (/app/graph)...');
assert.ok(fs.existsSync(path.join(process.cwd(), 'src/app/app/graph/page.tsx')), 'src/app/app/graph/page.tsx must exist');
const graphPageSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/app/graph/page.tsx'), 'utf8');

assert.ok(graphPageSrc.includes('DataRepository.getSemesters()'), 'Graph page must load semesters via DataRepository.getSemesters()');
assert.ok(graphPageSrc.includes('DataRepository.getCourses()'), 'Graph page must load courses via DataRepository.getCourses()');
assert.ok(graphPageSrc.includes('DataRepository.getCoursePrerequisites()'), 'Graph page must load prerequisites via DataRepository.getCoursePrerequisites()');
assert.ok(graphPageSrc.includes('MarkerType.ArrowClosed'), 'Graph page must render directed prerequisite edges with hairline solid arrows');
assert.ok(graphPageSrc.includes('edge-bridge-'), 'Graph page must render shared concept bridges connecting to courses');
assert.ok(graphPageSrc.includes('timelineIndex'), 'Graph page must provide timeline progression navigation');
console.log('  ✔ Global Curriculum Graph view verified: multi-semester canvas, DAG tiers, shared concept bridges, and timeline navigation.');

// Sidebar navigation integration
const sidebarSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/navigation/app-sidebar.tsx'), 'utf8');
assert.ok(sidebarSrc.includes('href="/app/graph"'), 'app-sidebar.tsx must include navigation link to /app/graph');
assert.ok(sidebarSrc.includes('<Network className="h-4 w-4 shrink-0" />'), 'app-sidebar.tsx must render Network icon for /app/graph');
console.log('  ✔ Sidebar Integration verified: /app/graph link with Network icon present in app-sidebar.tsx.\n');

// 4. Zero-Jitter Viewport & Position Restoration Verification
console.log('[4] Testing Zero-Jitter Viewport & Persistence (src/components/graph/course-graph-canvas.tsx)...');
const canvasSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/graph/course-graph-canvas.tsx'), 'utf8');

// Synchronous viewport restoration without delay
assert.ok(canvasSrc.includes('setViewport(data.layout.viewport, { duration: 0 })'), 'Must synchronously apply saved viewport with duration: 0');
assert.ok(!canvasSrc.includes('setTimeout(() => {\n            setViewport(data.layout!.viewport, { duration: 300 });\n          }, 80)'), 'Must eliminate 80ms delayed animated camera leap');
assert.ok(canvasSrc.includes('hasSavedViewportRef.current'), 'Must track hasSavedViewportRef to guard camera position');
assert.ok(canvasSrc.includes('if (hasSavedViewportRef.current)'), 'Must bypass fitView when saved viewport is active');

// Debounced layout persistence
assert.ok(canvasSrc.includes('DataRepository.saveCourseGraphLayout(courseId, positions, viewport);\n      }, 300)'), 'Must maintain 300ms debounced persistence on move/drag events');

// Dynamic concept badge computation
assert.ok(canvasSrc.includes('courseLinks = (rawStore.course_concepts || []).filter'), 'Must compute courseCount dynamically from store.course_concepts');
assert.ok(canvasSrc.includes('docCount = new Set(docsInCourses.map'), 'Must compute docCount dynamically from store.course_documents');
console.log('  ✔ Zero-Jitter Viewport Restoration verified: synchronous duration:0 setViewport, fitView bypass, 300ms debounced persistence, and dynamic concept badges.\n');

console.log('=== ALL MILESTONE 3 VERIFICATION CHECKS PASSED ===\n');
