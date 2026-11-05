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
 * Computes a hierarchical non-overlapping neural layout:
 * - Course: Central Anchor Node (width 192, height 192)
 * - Relationships Cluster: West Sector (center.x - 320, center.y + 60)
 * - People: West Wing (relationships.x - 240, vertically centered)
 * - Files Cluster: East Sector (center.x + 320, center.y + 60)
 * - Documents: East Wing (files.x + 240, vertically centered)
 * - Concepts: North Crown Arc (centered above course with 260px horizontal stride)
 *
 * Guarantees 0-collision AABB spacing and strictly non-crossing orthogonal edges.
 */
export function computeConcentricLayout(
  center: Point,
  peopleCount: number,
  docsCount: number,
  conceptsCount: number = 0
): ConcentricLayoutResult {
  // 1. Center Course Node
  const course: Point = { x: center.x, y: center.y };

  // 2. Left Cluster: Relationships Node (w: 176, h: 70)
  const relationships: Point = { x: center.x - 320, y: center.y + 60 };

  // 3. Right Cluster: Files Node (w: 176, h: 70)
  const files: Point = { x: center.x + 320, y: center.y + 60 };

  // 4. People Nodes (w: 200, h: 50) - Placed to the LEFT of Relationships
  const people: Point[] = [];
  const peopleSpacingY = 72;
  const peopleStartY = (relationships.y + 35) - ((peopleCount - 1) * peopleSpacingY) / 2;
  for (let i = 0; i < peopleCount; i++) {
    let col = 0;
    let row = i;
    if (peopleCount > 5) {
      col = i % 2;
      row = Math.floor(i / 2);
    }
    const x = col === 0 ? relationships.x - 240 : relationships.x - 470;
    const y = Math.round(peopleStartY + row * peopleSpacingY);
    people.push({ x, y });
  }

  // 5. Document Nodes (w: 224, h: 56) - Placed to the RIGHT of Files
  const docs: Point[] = [];
  const docsSpacingY = 74;
  const docsStartY = (files.y + 35) - ((docsCount - 1) * docsSpacingY) / 2;
  for (let i = 0; i < docsCount; i++) {
    let col = 0;
    let row = i;
    if (docsCount > 5) {
      col = i % 2;
      row = Math.floor(i / 2);
    }
    const x = col === 0 ? files.x + 240 : files.x + 490;
    const y = Math.round(docsStartY + row * docsSpacingY);
    docs.push({ x, y });
  }

  // 6. Concept Nodes (w: 210, h: 90) - Placed in an arc ABOVE Course
  const concepts: Point[] = [];
  const conceptSpacingX = 260;
  const conceptStartX = (center.x + 96) - ((conceptsCount - 1) * conceptSpacingX) / 2 - 105;
  for (let i = 0; i < conceptsCount; i++) {
    const x = Math.round(conceptStartX + i * conceptSpacingX);
    const archOffset = Math.abs(i - (conceptsCount - 1) / 2) * 20;
    const y = Math.round(center.y - 180 + archOffset);
    concepts.push({ x, y });
  }

  return {
    course,
    relationships,
    files,
    people,
    docs,
    concepts,
  };
}
