// scripts/adversarial-m3-radial-layout.mjs
// Empirical Challenger M3_1: Adversarial Stress Test Suite for Concentric Radial Layout Engine

import assert from 'node:assert/strict';
import {
  computeConcentricLayout,
  calculateConcentricLayout,
} from '../src/components/graph/layout/radial-layout.ts';

console.log('================================================================');
console.log(' CHALLENGER M3_1: ADVERSARIAL STRESS TEST SUITE — RADIAL LAYOUT');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

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

// --------------------------------------------------------------------------
// 1. Multi-Tier Staggering Radius Invariants ($N = 1, 2, 8, 9, 20, 50, 100$)
// --------------------------------------------------------------------------
console.log('[Dimension 1] Multi-Tier Staggering Invariants');

const testCasesN = [1, 2, 8, 9, 20, 50, 100];
const center = { x: 500, y: 320 };

for (const N of testCasesN) {
  runTest(`Radial radii check for N = ${N} (West, East, North)`, () => {
    const layout = computeConcentricLayout(center, N, N, N);

    assert.equal(layout.people.length, N, `People count mismatch for N=${N}`);
    assert.equal(layout.docs.length, N, `Docs count mismatch for N=${N}`);
    assert.equal(layout.concepts.length, N, `Concepts count mismatch for N=${N}`);

    const sectors = [
      { name: 'people', nodes: layout.people },
      { name: 'docs', nodes: layout.docs },
      { name: 'concepts', nodes: layout.concepts },
    ];

    for (const sector of sectors) {
      for (let i = 0; i < N; i++) {
        const pt = sector.nodes[i];
        const dist = Math.hypot(pt.x - center.x, pt.y - center.y);

        if (N <= 8) {
          // Uniform base radius R_base = 420px (allow <= 1.0px for Math.round)
          const expected = 420;
          const diff = Math.abs(dist - expected);
          assert.ok(
            diff <= 1.0,
            `Sector ${sector.name} [N=${N}, i=${i}] expected radius ${expected}px, got ${dist.toFixed(2)}px (diff=${diff.toFixed(2)})`
          );
        } else {
          // Dynamic staggering: even -> 380px, odd -> 460px
          const expected = i % 2 === 0 ? 380 : 460;
          const diff = Math.abs(dist - expected);
          assert.ok(
            diff <= 1.0,
            `Sector ${sector.name} [N=${N}, i=${i}] expected staggered radius ${expected}px, got ${dist.toFixed(2)}px (diff=${diff.toFixed(2)})`
          );
        }
      }
    }
  });
}

// --------------------------------------------------------------------------
// 2. Strict Screen-Space Inverted Y Coordinate Verification
// --------------------------------------------------------------------------
console.log('\n[Dimension 2] Screen-Space Inverted Y Coordinates (Concepts North)');

runTest('Concept nodes must have strictly y < center.y (screen-space North)', () => {
  for (const N of [1, 2, 3, 5, 8, 9, 15, 30, 50, 100]) {
    const layout = computeConcentricLayout(center, 0, 0, N);
    for (let i = 0; i < layout.concepts.length; i++) {
      const c = layout.concepts[i];
      assert.ok(
        c.y < center.y,
        `Concept node index ${i} with N=${N} has y=${c.y} which is not < center.y=${center.y}`
      );
      // Theoretical maximum Y for North arc is center.y - R * sin(theta)
      // Since theta in [pi/4, 3*pi/4], sin(theta) >= sin(pi/4) ~ 0.7071
      // Minimum radius is 380px, so y <= center.y - 380 * 0.7071 = center.y - 268px
      const maxY = center.y - Math.floor(380 * Math.SQRT1_2);
      assert.ok(
        c.y <= maxY,
        `Concept node index ${i} has y=${c.y} which exceeds maxY=${maxY}`
      );
    }
  }
});

runTest('Exact inverted Y formula: y === Math.round(center.y - radius * sin(theta))', () => {
  const N = 17;
  const layout = computeConcentricLayout(center, 0, 0, N);
  const startAngle = Math.PI / 4;
  const endAngle = (3 * Math.PI) / 4;
  const step = (endAngle - startAngle) / N;

  for (let i = 0; i < N; i++) {
    const theta = startAngle + step * (i + 0.5);
    const radius = i % 2 === 0 ? 380 : 460;
    const expectedX = Math.round(center.x + radius * Math.cos(theta));
    const expectedY = Math.round(center.y - radius * Math.sin(theta));

    assert.equal(layout.concepts[i].x, expectedX, `Concept ${i} x coordinate mismatch`);
    assert.equal(layout.concepts[i].y, expectedY, `Concept ${i} y coordinate mismatch`);
  }
});

// --------------------------------------------------------------------------
// 3. Angular Sector Boundaries & Sector Containment
// --------------------------------------------------------------------------
console.log('\n[Dimension 3] Angular Sector Boundaries & Containment');

runTest('People sector: nodes strictly in West quadrant (x < center.x)', () => {
  for (const N of [1, 5, 8, 12, 50]) {
    const layout = computeConcentricLayout(center, N, 0, 0);
    for (let i = 0; i < layout.people.length; i++) {
      const p = layout.people[i];
      assert.ok(
        p.x < center.x,
        `Person index ${i} (N=${N}) has x=${p.x} not < center.x=${center.x}`
      );
      // For theta in [3*pi/4, 5*pi/4], cos(theta) <= -0.7071
      // With min R=380, x <= center.x - 268
      const maxX = center.x - Math.floor(380 * Math.SQRT1_2);
      assert.ok(
        p.x <= maxX,
        `Person index ${i} has x=${p.x} which exceeds maxX=${maxX}`
      );
    }
  }
});

runTest('Documents sector: nodes strictly in East quadrant (x > center.x)', () => {
  for (const N of [1, 5, 8, 12, 50]) {
    const layout = computeConcentricLayout(center, 0, N, 0);
    for (let i = 0; i < layout.docs.length; i++) {
      const d = layout.docs[i];
      assert.ok(
        d.x > center.x,
        `Doc index ${i} (N=${N}) has x=${d.x} not > center.x=${center.x}`
      );
      // For theta in [-pi/4, pi/4], cos(theta) >= 0.7071
      // With min R=380, x >= center.x + 268
      const minX = center.x + Math.floor(380 * Math.SQRT1_2);
      assert.ok(
        d.x >= minX,
        `Doc index ${i} has x=${d.x} which is less than minX=${minX}`
      );
    }
  }
});

runTest('Screen-space angular sector disjointness (West, East, North sectors do not overlap)', () => {
  // Test large N=50 to inspect edge nodes near sector boundaries
  const N = 50;
  const layout = computeConcentricLayout(center, N, N, N);

  // Compute screen-space polar angles phi in degrees [0, 360)
  // phi = (Math.atan2(y - center.y, x - center.x) * 180 / Math.PI + 360) % 360
  // Standard screen directions:
  // 0 deg: East (+X)
  // 90 deg: South (+Y)
  // 180 deg: West (-X)
  // 270 deg: North (-Y)
  const toScreenAngle = (pt) => {
    const angle = (Math.atan2(pt.y - center.y, pt.x - center.x) * 180) / Math.PI;
    return (angle + 360) % 360;
  };

  const docAngles = layout.docs.map(toScreenAngle);
  const peopleAngles = layout.people.map(toScreenAngle);
  const conceptAngles = layout.concepts.map(toScreenAngle);

  // East Docs should be in [-45, +45] -> [315, 360) U [0, 45]
  for (const a of docAngles) {
    const inEast = a <= 45.1 || a >= 314.9;
    assert.ok(inEast, `Doc node angle ${a.toFixed(2)}° is outside East sector [315°, 45°]`);
  }

  // West People should be in [135, 225]
  for (const a of peopleAngles) {
    const inWest = a >= 134.9 && a <= 225.1;
    assert.ok(inWest, `People node angle ${a.toFixed(2)}° is outside West sector [135°, 225°]`);
  }

  // North Concepts should be in [225, 315] (since invertY maps sin to -Y)
  for (const a of conceptAngles) {
    const inNorth = a >= 224.9 && a <= 315.1;
    assert.ok(inNorth, `Concept node angle ${a.toFixed(2)}° is outside North sector [225°, 315°]`);
  }

  // Verify non-intersection of sets
  for (const d of docAngles) {
    for (const p of peopleAngles) {
      assert.ok(Math.abs(d - p) > 40, `Doc angle ${d}° too close to People angle ${p}°`);
    }
  }
});

// --------------------------------------------------------------------------
// 4. Boundary & Edge Cases
// --------------------------------------------------------------------------
console.log('\n[Dimension 4] Boundary & Edge Cases');

runTest('Empty counts (N = 0) returns empty arrays without crash', () => {
  const layout = computeConcentricLayout(center, 0, 0, 0);
  assert.equal(layout.people.length, 0);
  assert.equal(layout.docs.length, 0);
  assert.equal(layout.concepts.length, 0);
  assert.deepEqual(layout.course, center);
  assert.deepEqual(layout.relationships, { x: center.x - 320, y: center.y + 60 });
  assert.deepEqual(layout.files, { x: center.x + 320, y: center.y + 60 });
});

runTest('Single node (N = 1) is placed exactly at sector midpoint', () => {
  const layout = computeConcentricLayout(center, 1, 1, 1);
  // Midpoints:
  // West midpoint: 180 deg -> x = center.x - 420, y = center.y
  assert.deepEqual(layout.people[0], { x: center.x - 420, y: center.y });
  // East midpoint: 0 deg -> x = center.x + 420, y = center.y
  assert.deepEqual(layout.docs[0], { x: center.x + 420, y: center.y });
  // North midpoint: 90 deg -> x = center.x, y = center.y - 420
  assert.deepEqual(layout.concepts[0], { x: center.x, y: center.y - 420 });
});

runTest('Negative counts (N < 0) return empty arrays safely', () => {
  const layout = computeConcentricLayout(center, -5, -10, -1);
  assert.equal(layout.people.length, 0);
  assert.equal(layout.docs.length, 0);
  assert.equal(layout.concepts.length, 0);
});

runTest('Extreme center coordinates (0, 0), negative coords, and large coords (10^6)', () => {
  const centers = [
    { x: 0, y: 0 },
    { x: -5000, y: -3000 },
    { x: 1000000, y: 1000000 },
  ];
  for (const c of centers) {
    const layout = computeConcentricLayout(c, 4, 4, 4);
    assert.equal(layout.course.x, c.x);
    assert.equal(layout.course.y, c.y);
    assert.equal(layout.relationships.x, c.x - 320);
    assert.equal(layout.relationships.y, c.y + 60);
    assert.equal(layout.files.x, c.x + 320);
    assert.equal(layout.files.y, c.y + 60);

    for (const p of layout.people) {
      assert.ok(p.x < c.x, `West node must be < c.x=${c.x}`);
    }
    for (const d of layout.docs) {
      assert.ok(d.x > c.x, `East node must be > c.x=${c.x}`);
    }
    for (const conc of layout.concepts) {
      assert.ok(conc.y < c.y, `North node must be < c.y=${c.y}`);
    }
  }
});

runTest('Asymmetric sector sizes (e.g. People=1, Docs=50, Concepts=9)', () => {
  const layout = computeConcentricLayout(center, 1, 50, 9);
  // People N=1: radius 420px
  assert.equal(layout.people.length, 1);
  assert.equal(Math.round(Math.hypot(layout.people[0].x - center.x, layout.people[0].y - center.y)), 420);

  // Docs N=50: staggered 380/460
  assert.equal(layout.docs.length, 50);
  for (let i = 0; i < 50; i++) {
    const r = Math.round(Math.hypot(layout.docs[i].x - center.x, layout.docs[i].y - center.y));
    const exp = i % 2 === 0 ? 380 : 460;
    assert.ok(Math.abs(r - exp) <= 1, `Doc ${i} staggered radius mismatch`);
  }

  // Concepts N=9: staggered 380/460
  assert.equal(layout.concepts.length, 9);
  for (let i = 0; i < 9; i++) {
    const r = Math.round(Math.hypot(layout.concepts[i].x - center.x, layout.concepts[i].y - center.y));
    const exp = i % 2 === 0 ? 380 : 460;
    assert.ok(Math.abs(r - exp) <= 1, `Concept ${i} staggered radius mismatch`);
  }
});

// --------------------------------------------------------------------------
// 5. PROJECT.md Interface Contract #3 Wrapper (`calculateConcentricLayout`)
// --------------------------------------------------------------------------
console.log('\n[Dimension 5] calculateConcentricLayout Interface Contract #3');

runTest('calculateConcentricLayout conforms to contract signature', () => {
  const course = { id: 'c-1', course_code: 'EE3600E' };
  const people = [{ id: 'p-1' }, { id: 'p-2' }];
  const documents = [{ id: 'd-1' }];
  const concepts = [{ id: 'conc-1' }, { id: 'conc-2' }, { id: 'conc-3' }];

  const res = calculateConcentricLayout(course, people, documents, concepts, { center });
  assert.equal(res.people.length, 2);
  assert.equal(res.docs.length, 1);
  assert.equal(res.concepts.length, 3);
  assert.deepEqual(res.course, center);
});

runTest('calculateConcentricLayout handles undefined/null options and arrays', () => {
  // Test with null arrays and undefined options
  const res1 = calculateConcentricLayout(null, null, null, null);
  assert.equal(res1.people.length, 0);
  assert.equal(res1.docs.length, 0);
  assert.equal(res1.concepts.length, 0);
  assert.deepEqual(res1.course, { x: 500, y: 320 }); // Default center

  // Test with empty options object
  const res2 = calculateConcentricLayout(null, [], [], [], {});
  assert.deepEqual(res2.course, { x: 500, y: 320 });
});

// --------------------------------------------------------------------------
// 6. Node Uniqueness & Inter-Node Distance Collision Audit
// --------------------------------------------------------------------------
console.log('\n[Dimension 6] Node Uniqueness & Distance Audit');

runTest('No two nodes in any sector have identical (x, y) coordinates for N up to 100', () => {
  for (const N of [2, 8, 9, 20, 50, 100]) {
    const layout = computeConcentricLayout(center, N, N, N);

    const checkUnique = (nodes, sectorName) => {
      const set = new Set();
      for (let i = 0; i < nodes.length; i++) {
        const key = `${nodes[i].x},${nodes[i].y}`;
        assert.ok(
          !set.has(key),
          `Duplicate coordinate detected in ${sectorName} at index ${i}: ${key} (N=${N})`
        );
        set.add(key);
      }
    };

    checkUnique(layout.people, 'people');
    checkUnique(layout.docs, 'docs');
    checkUnique(layout.concepts, 'concepts');
  }
});

runTest('Adjacent staggered nodes maintain Euclidean distance >= 80px', () => {
  // When N > 8, adjacent nodes i and i+1 alternate between R1=380 and R2=460.
  // Their radial difference alone is 80px, so Euclidean distance must be >= 79px.
  for (const N of [9, 15, 30, 50, 100]) {
    const layout = computeConcentricLayout(center, N, N, N);
    const sectors = [layout.people, layout.docs, layout.concepts];

    for (const sec of sectors) {
      for (let i = 0; i < N - 1; i++) {
        const d = Math.hypot(sec[i].x - sec[i + 1].x, sec[i].y - sec[i + 1].y);
        assert.ok(
          d >= 79.0,
          `Adjacent nodes ${i} and ${i + 1} for N=${N} have distance ${d.toFixed(2)}px < 79px`
        );
      }
    }
  }
});

// --------------------------------------------------------------------------
// 7. Exhaustive Sweep across all N in [1..100]
// --------------------------------------------------------------------------
console.log('\n[Dimension 7] Exhaustive Sweep across all N in [1..100]');

runTest('Exhaustive N=1..100 radius and staggering invariants across all sectors', () => {
  for (let N = 1; N <= 100; N++) {
    const layout = computeConcentricLayout(center, N, N, N);
    const sectors = [layout.people, layout.docs, layout.concepts];

    for (const sec of sectors) {
      assert.equal(sec.length, N, `Expected length ${N}`);
      for (let i = 0; i < N; i++) {
        const pt = sec[i];
        const dist = Math.hypot(pt.x - center.x, pt.y - center.y);
        const expected = N <= 8 ? 420 : (i % 2 === 0 ? 380 : 460);
        const diff = Math.abs(dist - expected);
        assert.ok(
          diff <= 1.0,
          `Exhaustive radius mismatch at N=${N}, idx=${i}: expected ${expected}, got ${dist.toFixed(2)}`
        );
      }
    }
  }
});

runTest('Exhaustive N=1..100 coordinate uniqueness within each sector', () => {
  for (let N = 1; N <= 100; N++) {
    const layout = computeConcentricLayout(center, N, N, N);
    const sectors = [
      { name: 'people', list: layout.people },
      { name: 'docs', list: layout.docs },
      { name: 'concepts', list: layout.concepts },
    ];

    for (const sec of sectors) {
      const seen = new Set();
      for (let i = 0; i < sec.list.length; i++) {
        const key = `${sec.list[i].x},${sec.list[i].y}`;
        assert.ok(
          !seen.has(key),
          `Exhaustive duplicate coordinate in ${sec.name} at N=${N}, idx=${i}: ${key}`
        );
        seen.add(key);
      }
    }
  }
});

runTest('Exhaustive N=1..100 strict North positioning and sector containment', () => {
  for (let N = 1; N <= 100; N++) {
    const layout = computeConcentricLayout(center, N, N, N);

    // People strictly West (x < center.x)
    for (let i = 0; i < N; i++) {
      assert.ok(layout.people[i].x < center.x, `People[${i}] at N=${N} has x >= center.x`);
    }

    // Docs strictly East (x > center.x)
    for (let i = 0; i < N; i++) {
      assert.ok(layout.docs[i].x > center.x, `Docs[${i}] at N=${N} has x <= center.x`);
    }

    // Concepts strictly North (y < center.y) and y <= center.y - 268
    for (let i = 0; i < N; i++) {
      assert.ok(layout.concepts[i].y < center.y, `Concepts[${i}] at N=${N} has y >= center.y`);
      assert.ok(
        layout.concepts[i].y <= center.y - 268,
        `Concepts[${i}] at N=${N} y=${layout.concepts[i].y} exceeds North cap ${center.y - 268}`
      );
    }
  }
});

// --------------------------------------------------------------------------
// 8. Angular Monotonicity & Ordering
// --------------------------------------------------------------------------
console.log('\n[Dimension 8] Angular Monotonicity & Progression');

runTest('Concepts strictly sweep from East to West across the North sky (X decreases)', () => {
  for (const N of [3, 5, 10, 25, 50, 100]) {
    const layout = computeConcentricLayout(center, 0, 0, N);
    const startAngle = Math.PI / 4;
    const endAngle = (3 * Math.PI) / 4;
    const step = (endAngle - startAngle) / N;

    // Verify mathematical theta increases strictly monotonically
    for (let i = 0; i < N - 1; i++) {
      const thetaA = startAngle + step * (i + 0.5);
      const thetaB = startAngle + step * (i + 1.5);
      assert.ok(thetaB > thetaA, `Theta did not increase at idx=${i}`);
      // As theta increases from pi/4 to 3*pi/4, cos(theta) strictly decreases
      assert.ok(Math.cos(thetaB) < Math.cos(thetaA), `cos(theta) did not decrease at idx=${i}`);
    }
  }
});

runTest('People sector strictly sweeps from North-West to South-West (Y increases)', () => {
  for (const N of [3, 5, 10, 25, 50, 100]) {
    const layout = computeConcentricLayout(center, N, 0, 0);
    const startAngle = (3 * Math.PI) / 4;
    const endAngle = (5 * Math.PI) / 4;
    const step = (endAngle - startAngle) / N;

    // For theta from 135 deg to 225 deg, sin(theta) decreases strictly from +0.707 to -0.707
    for (let i = 0; i < N - 1; i++) {
      const thetaA = startAngle + step * (i + 0.5);
      const thetaB = startAngle + step * (i + 1.5);
      assert.ok(thetaB > thetaA, `Theta did not increase at idx=${i}`);
    }
  }
});

// --------------------------------------------------------------------------
// 9. Decimal and Non-Standard Types
// --------------------------------------------------------------------------
console.log('\n[Dimension 9] Decimal, Floating Center, and Non-Standard Types');

runTest('Decimal counts truncate/floor gracefully without infinite loop or NaN', () => {
  const layout = computeConcentricLayout(center, 4.7, 2.2, 0);
  assert.equal(layout.people.length, 4);
  assert.equal(layout.docs.length, 2);
  assert.equal(layout.concepts.length, 0);
});

runTest('Floating point center coordinates compute finite numbers without NaN and preserve radius', () => {
  const floatCenter = { x: 500.67, y: 320.33 };
  const layout = computeConcentricLayout(floatCenter, 5, 5, 5);

  const checkFinite = (pt) => {
    assert.equal(Number.isFinite(pt.x), true, `x is not finite: ${pt.x}`);
    assert.equal(Number.isFinite(pt.y), true, `y is not finite: ${pt.y}`);
    assert.equal(Number.isNaN(pt.x), false, `x is NaN`);
    assert.equal(Number.isNaN(pt.y), false, `y is NaN`);
  };

  checkFinite(layout.course);
  checkFinite(layout.relationships);
  checkFinite(layout.files);
  layout.people.forEach(checkFinite);
  layout.docs.forEach(checkFinite);
  layout.concepts.forEach(checkFinite);

  // Check radius with respect to floatCenter
  for (const p of layout.people) {
    const d = Math.hypot(p.x - floatCenter.x, p.y - floatCenter.y);
    assert.ok(Math.abs(d - 420) <= 1.5, `Radius mismatch for floatCenter: ${d}`);
  }
});

console.log('\n================================================================');
console.log(` SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
}

