import type { CalendarEvent } from "../../types/database.ts";

export interface ConflictPair {
  eventA: CalendarEvent;
  eventB: CalendarEvent;
  overlapStart: string;
  overlapEnd: string;
  severity: "WARNING" | "CRITICAL"; // CRITICAL if involves EXAM
}

export interface CrunchWindow {
  startDate: Date;
  endDate: Date;
  severity: "MODERATE" | "HIGH" | "CRITICAL";
  events: CalendarEvent[];
  recommendedPreparationHours: number;
}

/**
 * Pre-expands recurring weekly events into individual concrete occurrences across
 * the semester date range before interval overlap sorting and collision checks.
 */
export function expandRecurringOccurrences(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  if (!event.recurrence_rule || !event.recurrence_rule.includes("FREQ=WEEKLY")) {
    return [event];
  }

  const occurrences: CalendarEvent[] = [];
  const eventStart = new Date(event.start_at);
  const eventEnd = new Date(event.end_at);
  const durationMs = eventEnd.getTime() - eventStart.getTime();

  // Parse BYDAY tokens (e.g. BYDAY=MO,TU,WE,TH,FR,SA,SU)
  const byDayMatch = event.recurrence_rule.match(/BYDAY=([A-Z,]+)/);
  const dayMap: Record<string, number> = {
    SU: 0,
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6,
  };
  const targetDays = byDayMatch
    ? byDayMatch[1]
        .split(",")
        .map((d) => dayMap[d.trim()])
        .filter((d) => d !== undefined)
    : [eventStart.getDay()];

  // Parse INTERVAL
  const intervalMatch = event.recurrence_rule.match(/INTERVAL=(\d+)/);
  const interval = intervalMatch ? Math.max(1, parseInt(intervalMatch[1], 10)) : 1;

  // Parse UNTIL
  const untilMatch = event.recurrence_rule.match(/UNTIL=([0-9TZ]+)/);
  let untilDate: Date | null = null;
  if (untilMatch) {
    const u = untilMatch[1];
    if (u.length === 8) {
      untilDate = new Date(
        Date.UTC(
          parseInt(u.substring(0, 4), 10),
          parseInt(u.substring(4, 6), 10) - 1,
          parseInt(u.substring(6, 8), 10),
          23,
          59,
          59
        )
      );
    } else {
      untilDate = new Date(
        u.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/, "$1-$2-$3T$4:$5:$6Z")
      );
    }
  }

  // Anchor to Monday of event start week to compute discrete week differentials
  const startDayOffset = (eventStart.getDay() + 6) % 7; // 0 = Monday, ..., 6 = Sunday
  const startMonday = new Date(eventStart);
  startMonday.setDate(eventStart.getDate() - startDayOffset);
  startMonday.setHours(0, 0, 0, 0);

  const cursor = new Date(Math.max(eventStart.getTime(), rangeStart.getTime()));
  cursor.setHours(0, 0, 0, 0);
  const horizonEnd = new Date(rangeEnd.getTime());

  while (cursor <= horizonEnd) {
    if (untilDate && cursor > untilDate) {
      break;
    }

    if (targetDays.includes(cursor.getDay())) {
      // Check interval week alignment
      const cursorDayOffset = (cursor.getDay() + 6) % 7;
      const cursorMonday = new Date(cursor);
      cursorMonday.setDate(cursor.getDate() - cursorDayOffset);
      cursorMonday.setHours(0, 0, 0, 0);

      const diffWeeks = Math.round(
        (cursorMonday.getTime() - startMonday.getTime()) / (7 * 24 * 3600 * 1000)
      );

      if (diffWeeks >= 0 && diffWeeks % interval === 0) {
        const occStart = new Date(cursor);
        occStart.setHours(
          eventStart.getHours(),
          eventStart.getMinutes(),
          eventStart.getSeconds(),
          eventStart.getMilliseconds()
        );
        const occEnd = new Date(occStart.getTime() + durationMs);

        if (occStart >= eventStart && occStart <= horizonEnd) {
          occurrences.push({
            ...event,
            id: `${event.id}_occ_${occStart.toISOString()}`,
            start_at: occStart.toISOString(),
            end_at: occEnd.toISOString(),
          });
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences.length > 0 ? occurrences : [event];
}

/**
 * Detects overlapping events within the given semester range using interval overlap:
 * S1 < E2 && S2 < E1.
 */
export function detectScheduleConflicts(
  events: CalendarEvent[],
  semesterRange?: { start: Date; end: Date }
): ConflictPair[] {
  const conflicts: ConflictPair[] = [];

  const defaultStart =
    events.length > 0
      ? new Date(Math.min(...events.map((e) => new Date(e.start_at).getTime())))
      : new Date();
  const rangeStart = semesterRange?.start || defaultStart;
  const rangeEnd =
    semesterRange?.end ||
    new Date(rangeStart.getTime() + 180 * 24 * 60 * 60 * 1000);

  // 1. Recurrence Pre-Expansion
  const expanded: CalendarEvent[] = [];
  for (const ev of events) {
    expanded.push(...expandRecurringOccurrences(ev, rangeStart, rangeEnd));
  }

  // 2. Sort chronologically by start_at
  const sorted = expanded.sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );

  // 3. Interval overlap comparison
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];

      // Skip self-collision between occurrences originating from the same recurring parent event
      const rootIdA = a.id.split("_occ_")[0];
      const rootIdB = b.id.split("_occ_")[0];
      if (rootIdA === rootIdB) continue;

      const aStart = new Date(a.start_at).getTime();
      const aEnd = new Date(a.end_at).getTime();
      const bStart = new Date(b.start_at).getTime();
      const bEnd = new Date(b.end_at).getTime();

      // If event B starts after event A ends, no further pairs with A can overlap
      if (bStart >= aEnd) break;

      if (aStart < bEnd && bStart < aEnd) {
        const isExam = a.event_type === "EXAM" || b.event_type === "EXAM";
        conflicts.push({
          eventA: a,
          eventB: b,
          overlapStart: new Date(Math.max(aStart, bStart)).toISOString(),
          overlapEnd: new Date(Math.min(aEnd, bEnd)).toISOString(),
          severity: isExam ? "CRITICAL" : "WARNING",
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detects rolling 72-hour clusters of multiple EXAM or DEADLINE events
 * to warn students of upcoming crunch periods.
 */
export function detectExamCrunches(events: CalendarEvent[]): CrunchWindow[] {
  const highStakes = events
    .filter((e) => e.event_type === "EXAM" || e.event_type === "DEADLINE")
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const rawClusters: CalendarEvent[][] = [];
  const WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours
  const seenClusters = new Set<string>();

  for (let i = 0; i < highStakes.length; i++) {
    const current = highStakes[i];
    const cluster = [current];
    const currentStart = new Date(current.start_at).getTime();

    for (let j = i + 1; j < highStakes.length; j++) {
      const next = highStakes[j];
      if (new Date(next.start_at).getTime() - currentStart <= WINDOW_MS) {
        cluster.push(next);
      } else {
        break;
      }
    }

    if (cluster.length >= 2) {
      const clusterKey = cluster
        .map((c) => c.id)
        .sort()
        .join("::");
      if (!seenClusters.has(clusterKey)) {
        seenClusters.add(clusterKey);
        rawClusters.push(cluster);
      }
    }
  }

  // Filter out redundant subset clusters so students only see maximal crunch windows
  rawClusters.sort((a, b) => b.length - a.length);
  const maximalClusters: CalendarEvent[][] = [];
  for (const cluster of rawClusters) {
    const isSubset = maximalClusters.some((parent) => {
      const parentIds = new Set(parent.map((e) => e.id));
      return cluster.every((e) => parentIds.has(e.id));
    });
    if (!isSubset) {
      maximalClusters.push(cluster);
    }
  }

  // Re-sort chronologically by start date
  maximalClusters.sort(
    (a, b) => new Date(a[0].start_at).getTime() - new Date(b[0].start_at).getTime()
  );

  return maximalClusters.map((cluster) => {
    const examCount = cluster.filter((c) => c.event_type === "EXAM").length;
    return {
      startDate: new Date(cluster[0].start_at),
      endDate: new Date(cluster[cluster.length - 1].end_at),
      severity:
        examCount >= 2 ? "CRITICAL" : cluster.length >= 3 ? "HIGH" : "MODERATE",
      events: cluster,
      recommendedPreparationHours: cluster.length * 8,
    };
  });
}
