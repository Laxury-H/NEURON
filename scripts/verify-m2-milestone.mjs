import assert from "node:assert/strict";
import { summarizeDocumentLocally } from "../src/lib/ai/local-summarizer.ts";
import {
  validatePrerequisiteDAG,
  assertAcyclicPrerequisites,
  calculateCourseAffinityScore,
  getRecommendedCourses,
} from "../src/lib/academic/prerequisites.ts";
import { POST as summarizeRoute } from "../src/app/api/ai/summarize/route.ts";
import { GET as webcalRoute } from "../src/app/api/calendar/feed/[token]/route.ts";
import { DataRepository } from "../src/lib/data/repository.ts";

async function runM2Verification() {
  console.log("=== NEURON Milestone 2 Verification Suite ===");

  // 1. Local Summarizer & NLP Heuristic Extractor Tests
  console.log("\n[1] Testing Deterministic Local Summarizer...");
  const sampleAcademicText = `
    In this lecture on Power System Analysis (EE4010E), we formulate the Newton-Raphson power flow algorithm.
    The electrical network is modeled via the bus admittance matrix Y_bus = G + jB relating nodal currents and voltages.
    Active power injected at bus i satisfies P_i = V_i * I_i * cos(theta_i).
    We demonstrate that Jacobian matrix invertibility guarantees quadratic convergence within 4 to 5 iterations.
    Theoretical principles of HVDC transmission and SCADA supervisory control were analyzed across renewable energy grids.
    MPPT algorithms ensure optimal photovoltaic operating point tracking under irradiance fluctuations.
  `;

  const summary = summarizeDocumentLocally(
    sampleAcademicText,
    "EE4010_Lecture_PowerFlow.pdf",
    "Lecture",
    "doc-ee4010-1"
  );

  assert.ok(summary.executiveSummary, "Executive summary must exist");
  assert.ok(
    summary.executiveSummary.length <= 300,
    `Executive summary length (${summary.executiveSummary.length}) must be <= 300`
  );
  assert.ok(
    summary.keyTakeaways.length >= 3 && summary.keyTakeaways.length <= 5,
    `Key takeaways count (${summary.keyTakeaways.length}) must be between 3 and 5`
  );
  assert.ok(
    summary.candidateConcepts.length >= 1 && summary.candidateConcepts.length <= 8,
    `Candidate concepts count (${summary.candidateConcepts.length}) must be between 1 and 8`
  );
  assert.ok(
    summary.extractedFormulas.length >= 1,
    "Formulas must be extracted from mathematical expressions"
  );
  for (const f of summary.extractedFormulas) {
    assert.ok(f.name && f.latex && f.description, "Each formula must have name, latex, and description");
  }
  console.log("  ✔ Local summarizer extracted executive summary, 3-5 takeaways, formulas, and concepts.");

  // Test robustness with empty/noisy text
  const emptySummary = summarizeDocumentLocally("", "empty.pdf", "Notes", "doc-empty");
  assert.ok(emptySummary.executiveSummary.length > 0);
  assert.equal(emptySummary.keyTakeaways.length, 3);
  assert.ok(emptySummary.candidateConcepts.length >= 1);
  console.log("  ✔ Local summarizer gracefully handles empty inputs without crashing.");

  // 2. Edge Summarization API Route Tests
  console.log("\n[2] Testing Edge Summarization API Route (/api/ai/summarize)...");
  const validReq = new Request("http://localhost:3000/api/ai/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: "doc-test-1",
      courseId: "c-ee4010",
      fileName: "Lecture_Notes.pdf",
      rawTextContent: sampleAcademicText,
      category: "Lecture",
    }),
  });

  const apiRes = await summarizeRoute(validReq);
  assert.equal(apiRes.status, 200, "API route must return 200");
  const apiJson = await apiRes.json();
  assert.equal(apiJson.documentId, "doc-test-1");
  assert.ok(apiJson.executiveSummary);
  assert.ok(apiJson.keyTakeaways.length >= 3 && apiJson.keyTakeaways.length <= 5);
  assert.ok(apiJson.candidateConcepts.length >= 1 && apiJson.candidateConcepts.length <= 8);
  console.log("  ✔ Edge Summarization API returns validated structured JSON conforming to schema.");

  // Invalid payload validation test
  const invalidReq = new Request("http://localhost:3000/api/ai/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId: "" }),
  });
  const badRes = await summarizeRoute(invalidReq);
  assert.equal(badRes.status, 400, "Invalid payload must return 400");
  console.log("  ✔ Edge Summarization API validates Zod input schema and rejects invalid payloads with 400.");

  // 3. Prerequisite DAG Validation Engine & Kahn's Topological Sort
  console.log("\n[3] Testing Prerequisite DAG Validation Engine (Kahn's Sort)...");
  const mockCourses = [
    { id: "c-1", course_code: "MATH101", course_name: "Calculus I", credits: 3, semester_id: "s1" },
    { id: "c-2", course_code: "PHYS101", course_name: "Physics I", credits: 4, semester_id: "s1" },
    { id: "c-3", course_code: "EE201", course_name: "Circuit Analysis", credits: 4, semester_id: "s1" },
    { id: "c-4", course_code: "EE301", course_name: "Power Systems", credits: 3, semester_id: "s1" },
    { id: "c-5", course_code: "EE401", course_name: "Advanced Power Flow", credits: 3, semester_id: "s1" },
  ];

  // Acyclic Graph: MATH101 -> EE201, PHYS101 -> EE201, EE201 -> EE301, EE301 -> EE401
  const acyclicPrereqs = [
    { id: "p1", course_id: "c-3", prerequisite_course_id: "c-1" },
    { id: "p2", course_id: "c-3", prerequisite_course_id: "c-2" },
    { id: "p3", course_id: "c-4", prerequisite_course_id: "c-3" },
    { id: "p4", course_id: "c-5", prerequisite_course_id: "c-4" },
  ];

  const dagResult = validatePrerequisiteDAG(mockCourses, acyclicPrereqs);
  assert.equal(dagResult.isAcyclic, true, "Graph should be acyclic");
  assert.equal(dagResult.sortedCourseIds.length, 5);
  // Verify topological order constraints
  const idxC1 = dagResult.sortedCourseIds.indexOf("c-1");
  const idxC3 = dagResult.sortedCourseIds.indexOf("c-3");
  const idxC4 = dagResult.sortedCourseIds.indexOf("c-4");
  const idxC5 = dagResult.sortedCourseIds.indexOf("c-5");
  assert.ok(idxC1 < idxC3, "c-1 must precede c-3");
  assert.ok(idxC3 < idxC4, "c-3 must precede c-4");
  assert.ok(idxC4 < idxC5, "c-4 must precede c-5");
  assert.equal(dagResult.tiers["c-1"], 0);
  assert.equal(dagResult.tiers["c-3"], 1);
  assert.equal(dagResult.tiers["c-4"], 2);
  assert.equal(dagResult.tiers["c-5"], 3);
  console.log("  ✔ Kahn's algorithm successfully produces topological order and tier levels.");

  // Cyclic Graph Detection: introduce cycle c-5 -> c-1
  const cyclicPrereqs = [
    ...acyclicPrereqs,
    { id: "p-cycle", course_id: "c-1", prerequisite_course_id: "c-5" },
  ];
  const cyclicResult = validatePrerequisiteDAG(mockCourses, cyclicPrereqs);
  assert.equal(cyclicResult.isAcyclic, false, "Graph with feedback edge must detect cycle");
  assert.ok(cyclicResult.cycleTrace, "Must generate cycle trace");
  console.log(`  ✔ Cycle detected successfully: ${cyclicResult.cycleTrace}`);

  let assertThrew = false;
  try {
    assertAcyclicPrerequisites(mockCourses, cyclicPrereqs);
  } catch (err) {
    assertThrew = true;
    assert.ok(err.message.includes("Circular prerequisite dependency detected"));
  }
  assert.equal(assertThrew, true, "assertAcyclicPrerequisites must throw on cycle");
  console.log("  ✔ assertAcyclicPrerequisites throws descriptive error with cycle trace.");

  // Course Affinity Scoring Formula Verification
  console.log("\n[4] Testing Course Affinity Scoring Formula...");
  // Score(C) = 0.5 * PrereqSatisfied(C) + 0.3 * TopicSimilarity(C, S_skills) + 0.2 * WorkloadBalance(C, Semester)
  const affinity = calculateCourseAffinityScore(mockCourses[3], {
    completedCourseIds: ["c-1", "c-2", "c-3"],
    studentSkills: ["power systems", "electrical circuits"],
    currentSemesterCredits: 12,
    maxSemesterCredits: 24,
    prerequisites: acyclicPrereqs,
  });

  assert.equal(affinity.isEligible, true, "Course should be eligible since c-3 is completed");
  assert.equal(affinity.prereqSatisfied, 1.0, "All prereqs satisfied");
  assert.ok(affinity.topicSimilarity >= 0.5, "Topic similarity should reflect matched skills");
  assert.ok(affinity.workloadBalance > 0.8, "12+3=15 credits is optimal workload");
  assert.ok(affinity.score >= 0.7, `Affinity score (${affinity.score}) should be high`);
  console.log(`  ✔ Affinity score computed: ${affinity.score} (prereq=${affinity.prereqSatisfied}, topic=${affinity.topicSimilarity}, workload=${affinity.workloadBalance})`);

  // 4. WebCal RFC 5545 Subscription Route
  console.log("\n[5] Testing RFC 5545 Live WebCal Subscription Route (/api/calendar/feed/[token])...");
  const webcalReq = new Request("http://localhost:3000/api/calendar/feed/test-token-123", {
    method: "GET",
  });
  const webcalRes = await webcalRoute(webcalReq, {
    params: Promise.resolve({ token: "test-token-123" }),
  });
  assert.equal(webcalRes.status, 200, "WebCal route must return 200");
  assert.ok(webcalRes.headers.get("content-type")?.includes("text/calendar"), "Must return text/calendar Content-Type");
  const icsText = await webcalRes.text();
  assert.ok(icsText.startsWith("BEGIN:VCALENDAR"), "Feed must start with BEGIN:VCALENDAR");
  assert.ok(icsText.includes("END:VCALENDAR"), "Feed must end with END:VCALENDAR");
  assert.ok(icsText.includes("VERSION:2.0"), "Must declare RFC 5545 VERSION:2.0");
  assert.ok(icsText.includes("PRODID:"), "Must declare PRODID");
  console.log("  ✔ WebCal route serves RFC 5545 valid calendar feed with text/calendar header.");

  // Test missing token
  const emptyTokenReq = new Request("http://localhost:3000/api/calendar/feed/  ", {
    method: "GET",
  });
  const emptyRes = await webcalRoute(emptyTokenReq, {
    params: Promise.resolve({ token: "   " }),
  });
  assert.equal(emptyRes.status, 401, "Missing/blank token must return 401");
  console.log("  ✔ WebCal route rejects invalid/empty tokens with 401.");

  console.log("\n=== ALL MILESTONE 2 ADVERSARIAL TESTS PASSED (100%) ===");
}

runM2Verification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
