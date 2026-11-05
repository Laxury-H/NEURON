/**
 * NEURON Prerequisite DAG Validation Engine & Course Recommender
 * Implements Kahn's Topological Sort algorithm, circular dependency detection with cycle tracing,
 * and academic affinity scoring formula:
 * Score(C) = 0.5 * PrereqSatisfied(C) + 0.3 * TopicSimilarity(C, S_skills) + 0.2 * WorkloadBalance(C, Semester)
 */

import type { Course, CoursePrerequisite, CourseConcept, Concept } from "../../types/database.ts";

export interface DAGValidationResult {
  isAcyclic: boolean;
  sortedCourseIds: string[];
  sortedCourses: Course[];
  cycles: string[][];
  cycleTrace?: string;
  tiers: Record<string, number>;
}

export interface CourseAffinityResult {
  courseId: string;
  courseCode: string;
  courseName: string;
  score: number;
  prereqSatisfied: number;
  topicSimilarity: number;
  workloadBalance: number;
  isEligible: boolean;
  missingPrerequisiteIds: string[];
  missingPrerequisiteCodes: string[];
}

export interface AffinityCalculationParams {
  completedCourseIds: string[];
  studentSkills?: string[];
  currentSemesterCredits?: number;
  maxSemesterCredits?: number;
  prerequisites: CoursePrerequisite[];
  courseConcepts?: (CourseConcept & { concept?: Concept })[];
}

/**
 * Validates a course prerequisite graph using Kahn's topological sort algorithm.
 * Detects cycles and produces an ordered sequence and level tiers if acyclic.
 */
export function validatePrerequisiteDAG(
  courses: Course[],
  prerequisites: CoursePrerequisite[]
): DAGValidationResult {
  const courseMap = new Map<string, Course>();
  for (const c of courses) {
    courseMap.set(c.id, c);
  }

  // Build adjacency list: prerequisiteCourseId -> dependentCourseId[]
  // In-degree: number of prerequisites a course has
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const c of courses) {
    adj.set(c.id, []);
    inDegree.set(c.id, 0);
  }

  // Filter prerequisites that exist within the provided courses set
  const relevantPrereqs = prerequisites.filter(
    (p) => courseMap.has(p.course_id) && courseMap.has(p.prerequisite_course_id)
  );

  for (const p of relevantPrereqs) {
    adj.get(p.prerequisite_course_id)!.push(p.course_id);
    inDegree.set(p.course_id, inDegree.get(p.course_id)! + 1);
  }

  // Queue nodes with in-degree 0 (courses with no prerequisites)
  const queue: string[] = [];
  const tiers: Record<string, number> = {};

  for (const [courseId, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(courseId);
      tiers[courseId] = 0;
    }
  }

  const sortedCourseIds: string[] = [];

  while (queue.length > 0) {
    const u = queue.shift()!;
    sortedCourseIds.push(u);

    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      tiers[v] = Math.max(tiers[v] || 0, (tiers[u] || 0) + 1);
      const newDeg = inDegree.get(v)! - 1;
      inDegree.set(v, newDeg);
      if (newDeg === 0) {
        queue.push(v);
      }
    }
  }

  // If sorted list does not contain all courses, a cycle exists
  if (sortedCourseIds.length < courses.length) {
    // Find cycles using Depth-First Search on nodes that still have in-degree > 0
    const remainingCourseIds = courses
      .map((c) => c.id)
      .filter((id) => (inDegree.get(id) || 0) > 0);

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string) => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = adj.get(node) || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          dfs(next);
        } else if (recursionStack.has(next)) {
          // Cycle found: extract cycle segment from path
          const cycleStartIndex = path.indexOf(next);
          if (cycleStartIndex !== -1) {
            const cyclePath = path.slice(cycleStartIndex).concat(next);
            cycles.push(cyclePath);
          }
        }
      }

      recursionStack.delete(node);
      path.pop();
    };

    for (const id of remainingCourseIds) {
      if (!visited.has(id)) {
        dfs(id);
      }
    }

    // Format human-readable cycle trace with course codes
    const primaryCycle = cycles[0] || remainingCourseIds;
    const cycleTrace = primaryCycle
      .map((id) => courseMap.get(id)?.course_code || id)
      .join(" -> ");

    return {
      isAcyclic: false,
      sortedCourseIds,
      sortedCourses: sortedCourseIds.map((id) => courseMap.get(id)!),
      cycles,
      cycleTrace,
      tiers,
    };
  }

  return {
    isAcyclic: true,
    sortedCourseIds,
    sortedCourses: sortedCourseIds.map((id) => courseMap.get(id)!),
    cycles: [],
    tiers,
  };
}

/**
 * Asserts that the course prerequisite graph is acyclic; throws descriptive error if cycle detected.
 */
export function assertAcyclicPrerequisites(
  courses: Course[],
  prerequisites: CoursePrerequisite[]
): DAGValidationResult {
  const result = validatePrerequisiteDAG(courses, prerequisites);
  if (!result.isAcyclic) {
    throw new Error(
      `Circular prerequisite dependency detected: ${
        result.cycleTrace || "Cycle detected in course prerequisite graph"
      }`
    );
  }
  return result;
}

/**
 * Computes course eligibility and academic affinity score:
 * Score(C) = 0.5 * PrereqSatisfied(C) + 0.3 * TopicSimilarity(C, S_skills) + 0.2 * WorkloadBalance(C, Semester)
 */
export function calculateCourseAffinityScore(
  course: Course,
  params: AffinityCalculationParams
): CourseAffinityResult {
  const {
    completedCourseIds = [],
    studentSkills = [],
    currentSemesterCredits = 12,
    maxSemesterCredits = 24,
    prerequisites = [],
    courseConcepts = [],
  } = params;

  // 1. Prerequisite Satisfaction Component (w1 = 0.5)
  // Find all prerequisites where course_id === course.id
  const directPrereqs = prerequisites.filter((p) => p.course_id === course.id);
  const missingPrerequisiteIds: string[] = [];
  const missingPrerequisiteCodes: string[] = [];

  let prereqSatisfied = 1.0;
  if (directPrereqs.length > 0) {
    let satisfiedCount = 0;
    for (const prereq of directPrereqs) {
      const isCompleted = completedCourseIds.includes(prereq.prerequisite_course_id);
      if (isCompleted) {
        satisfiedCount++;
      } else {
        missingPrerequisiteIds.push(prereq.prerequisite_course_id);
      }
    }
    prereqSatisfied = satisfiedCount / directPrereqs.length;
  }

  const isEligible = directPrereqs.length === 0 || missingPrerequisiteIds.length === 0;

  // 2. Topic Similarity Component (w2 = 0.3)
  // Compare student skills against course title, description, and attached concepts
  let topicSimilarity = 0.5; // Neutral baseline when no skills specified
  if (studentSkills.length > 0) {
    const courseCorpus = [
      course.course_name,
      course.course_code,
      course.description || "",
      ...courseConcepts
        .filter((cc) => cc.course_id === course.id)
        .map((cc) => cc.concept?.name || ""),
    ]
      .join(" ")
      .toLowerCase();

    let matchedSkills = 0;
    for (const skill of studentSkills) {
      const cleanSkill = skill.toLowerCase().trim();
      if (cleanSkill && courseCorpus.includes(cleanSkill)) {
        matchedSkills++;
      }
    }
    topicSimilarity = Math.min(1.0, matchedSkills / Math.max(1, studentSkills.length));
    // If student has partial match, give scaled credit
    if (matchedSkills > 0) {
      topicSimilarity = Math.max(0.4, topicSimilarity);
    }
  }

  // 3. Workload Balance Component (w3 = 0.2)
  // Balances projected semester credit total: ideal 15-18 credits, drops if overloaded
  const courseCredits = course.credits || 3;
  const projectedCredits = currentSemesterCredits + courseCredits;

  let workloadBalance = 1.0;
  if (projectedCredits <= 18) {
    workloadBalance = 1.0 - Math.max(0, 15 - projectedCredits) * 0.04;
  } else if (projectedCredits <= 21) {
    workloadBalance = 0.85 - (projectedCredits - 18) * 0.1;
  } else if (projectedCredits <= maxSemesterCredits) {
    workloadBalance = 0.5 - (projectedCredits - 21) * 0.12;
  } else {
    workloadBalance = 0.0;
  }
  workloadBalance = Math.max(0.0, Math.min(1.0, workloadBalance));

  // Compute final composite score
  const rawScore = 0.5 * prereqSatisfied + 0.3 * topicSimilarity + 0.2 * workloadBalance;
  const score = Number(Math.max(0.0, Math.min(1.0, rawScore)).toFixed(2));

  return {
    courseId: course.id,
    courseCode: course.course_code,
    courseName: course.course_name,
    score,
    prereqSatisfied: Number(prereqSatisfied.toFixed(2)),
    topicSimilarity: Number(topicSimilarity.toFixed(2)),
    workloadBalance: Number(workloadBalance.toFixed(2)),
    isEligible,
    missingPrerequisiteIds,
    missingPrerequisiteCodes,
  };
}

/**
 * Evaluates all candidate courses and returns ranked recommendations based on affinity score.
 */
export function getRecommendedCourses(
  courses: Course[],
  params: AffinityCalculationParams,
  options?: { limit?: number; onlyEligible?: boolean }
): CourseAffinityResult[] {
  const { completedCourseIds = [] } = params;
  const { limit = 10, onlyEligible = false } = options || {};

  const candidates = courses.filter((c) => !completedCourseIds.includes(c.id));

  const results = candidates.map((course) =>
    calculateCourseAffinityScore(course, params)
  );

  let filtered = results;
  if (onlyEligible) {
    filtered = filtered.filter((r) => r.isEligible);
  }

  // Sort by composite score descending
  return filtered.sort((a, b) => b.score - a.score).slice(0, limit);
}
