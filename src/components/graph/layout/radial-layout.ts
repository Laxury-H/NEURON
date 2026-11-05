export interface Point {
  x: number;
  y: number;
}

export interface ConcentricLayoutResult {
  people: Point[];
  docs: Point[];
  concepts: Point[];
}

/**
 * Computes a concentric multi-ring layout with angular dispersion
 * and dynamic multi-tier staggering for high node counts.
 * - People: West Sector (135° to 225°)
 * - Documents: East Sector (-45° to 45°)
 * - Concepts: North Arc (45° to 135°, invertY for screen-space Y coordinates)
 */
export function computeConcentricLayout(
  center: Point,
  peopleCount: number,
  docsCount: number,
  conceptsCount: number = 0
): ConcentricLayoutResult {
  const R_BASE = 400;
  const R_TIER_1 = 360;
  const R_TIER_2 = 450;

  const distribute = (
    count: number,
    startAngle: number,
    endAngle: number,
    invertY = false
  ): Point[] => {
    if (count === 0) return [];
    const step = (endAngle - startAngle) / Math.max(count, 1);
    return Array.from({ length: count }, (_, i) => {
      const theta = startAngle + step * (i + 0.5);
      // Dynamic multi-tier staggering when leaf count > 8 to prevent node overlap
      const radius = count > 8 ? (i % 2 === 0 ? R_TIER_1 : R_TIER_2) : R_BASE;
      const yOffset = radius * Math.sin(theta);
      return {
        x: Math.round(center.x + radius * Math.cos(theta)),
        y: Math.round(invertY ? center.y - yOffset : center.y + yOffset),
      };
    });
  };

  return {
    // People: Left Hemisphere (135° to 225° / West Sector)
    people: distribute(peopleCount, (3 * Math.PI) / 4, (5 * Math.PI) / 4, false),
    // Documents: Right Hemisphere (-45° to 45° / East Sector)
    docs: distribute(docsCount, -Math.PI / 4, Math.PI / 4, false),
    // Concepts: Top Arc (45° to 135° / North Sector, invertY = true)
    concepts: distribute(conceptsCount, Math.PI / 4, (3 * Math.PI) / 4, true),
  };
}
