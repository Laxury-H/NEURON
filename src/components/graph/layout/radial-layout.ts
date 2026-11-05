export interface Point {
  x: number;
  y: number;
}

export interface ConcentricLayoutResult {
  people: Point[];
  docs: Point[];
  concepts: Point[];
  relationships: Point;
  files: Point;
  course: Point;
}

/**
 * Computes a concentric radial neural knowledge graph layout:
 * - Central Course Node: Anchor point (X_c, Y_c) (R_0 = 0)
 * - West Sector: People [3*pi/4, 5*pi/4] (135° to 225°)
 * - East Sector: Documents [-pi/4, pi/4] (-45° to 45°)
 * - North Sector: Concepts [pi/4, 3*pi/4] (45° to 135°)
 *
 * Screen-Space Coordinate Normalization:
 * - In DOM / SVG / React Flow screen space, +Y points South (downwards).
 * - For North sector concepts (theta in [pi/4, 3*pi/4]), sin(theta) > 0.
 * - Inverted Y: y = Y_c - R * sin(theta) projects nodes upward (North) above the course center.
 *
 * Multi-Tier Dynamic Staggering:
 * - When node count in any sector exceeds 8 (N > 8), alternate leaf nodes between:
 *   Tier 1 (R_1 = 380px) for even indices (i % 2 === 0)
 *   Tier 2 (R_2 = 460px) for odd indices (i % 2 === 1)
 *   This interleaving eliminates card collisions and crowding.
 * - When N <= 8, uniform base radius R_base = 420px is applied.
 */
export function computeConcentricLayout(
  center: Point,
  peopleCount: number,
  docsCount: number,
  conceptsCount: number = 0
): ConcentricLayoutResult {
  const R_BASE = 420;
  const R_TIER_1 = 380;
  const R_TIER_2 = 460;

  // 1. Central Course Anchor Node
  const course: Point = { x: center.x, y: center.y };

  // 2. Intermediate Hub Nodes (Ring 1, R ~ 280-320px)
  const relationships: Point = { x: center.x - 320, y: center.y + 60 };
  const files: Point = { x: center.x + 320, y: center.y + 60 };

  // Helper to distribute nodes into an angular sector with multi-tier staggering
  const distribute = (
    count: number,
    startAngle: number,
    endAngle: number,
    invertY = false
  ): Point[] => {
    if (count <= 0) return [];
    const step = (endAngle - startAngle) / Math.max(count, 1);
    return Array.from({ length: count }, (_, i) => {
      const theta = startAngle + step * (i + 0.5);
      // Dynamic multi-tier staggering when leaf count > 8 to prevent node overlap
      const radius = count > 8 ? (i % 2 === 0 ? R_TIER_1 : R_TIER_2) : R_BASE;
      const yOffset = radius * Math.sin(theta);
      return {
        x: Math.round(center.x + radius * Math.cos(theta)),
        // Screen space Y inversion: subtract sine offset for Top/North arc
        y: Math.round(invertY ? center.y - yOffset : center.y + yOffset),
      };
    });
  };

  // 3. West Sector: People [3*pi/4, 5*pi/4] (135° to 225°)
  const people = distribute(peopleCount, (3 * Math.PI) / 4, (5 * Math.PI) / 4, false);

  // 4. East Sector: Documents [-pi/4, pi/4] (-45° to 45°)
  const docs = distribute(docsCount, -Math.PI / 4, Math.PI / 4, false);

  // 5. North Sector: Concepts [pi/4, 3*pi/4] (45° to 135°) with screen-space inverted Y
  const concepts = distribute(conceptsCount, Math.PI / 4, (3 * Math.PI) / 4, true);

  return {
    course,
    relationships,
    files,
    people,
    docs,
    concepts,
  };
}

/**
 * Convenience wrapper conforming to PROJECT.md interface contract #3:
 * calculateConcentricLayout(course, people, documents, concepts, options?)
 */
export function calculateConcentricLayout(
  _course: any,
  people: any[],
  documents: any[],
  concepts: any[],
  options?: { center?: Point }
): ConcentricLayoutResult {
  const center = options?.center || { x: 500, y: 320 };
  return computeConcentricLayout(
    center,
    people?.length || 0,
    documents?.length || 0,
    concepts?.length || 0
  );
}
