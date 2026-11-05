import assert from "node:assert/strict";
import { z } from "zod";
import { summarizeDocumentLocally, extractCandidateConcepts, extractLaTeXFormulas } from "../src/lib/ai/local-summarizer.ts";
import {
  validatePrerequisiteDAG,
  assertAcyclicPrerequisites,
  calculateCourseAffinityScore,
  getRecommendedCourses,
} from "../src/lib/academic/prerequisites.ts";
import { POST as summarizeRoute } from "../src/app/api/ai/summarize/route.ts";

const AcademicSummarySchema = z.object({
  documentId: z.string().min(1),
  executiveSummary: z.string().min(1).max(500),
  keyTakeaways: z.array(z.string()).min(3).max(5),
  extractedFormulas: z.array(
    z.object({
      name: z.string().min(1),
      latex: z.string().min(1),
      description: z.string().min(1),
    })
  ),
  candidateConcepts: z.array(z.string().min(1)).min(1).max(8),
  generatedAt: z.string().min(1),
});

async function runAdversarialM2StressTests() {
  console.log("================================================================================");
  console.log("       NEURON MILESTONE 2 EMPIRICAL ADVERSARIAL STRESS TEST HARNESS             ");
  console.log("================================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function recordPass(testName) {
    passedTests++;
    totalTests++;
    console.log(`  [PASS] ${testName}`);
  }

  function recordFail(testName, err) {
    totalTests++;
    console.error(`  [FAIL] ${testName}`);
    console.error(`         ${err.message}`);
    throw err;
  }

  // ============================================================================
  // SUITE 1: Summarization Robustness & Offline Fallback
  // ============================================================================
  console.log("--- SUITE 1: Summarization Robustness & Offline Fallback ---");

  // Test 1.1: Empty payload & Invalid JSON parsing (must return 400, never 500)
  try {
    const invalidJsonReq = new Request("http://localhost:3000/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ broken json...",
    });
    const res = await summarizeRoute(invalidJsonReq);
    assert.equal(res.status, 400, "Invalid JSON body must return 400");
    const json = await res.json();
    assert.equal(json.error, "Invalid JSON in request body");
    recordPass("1.1 Invalid JSON payload rejected with HTTP 400");
  } catch (err) {
    recordFail("1.1 Invalid JSON payload rejection", err);
  }

  // Test 1.2: Missing required schema fields (documentId, courseId, fileName)
  try {
    const badPayloads = [
      {},
      { documentId: "" },
      { documentId: "doc-1" }, // missing courseId, fileName
      { documentId: "doc-1", courseId: "c-1" }, // missing fileName
      { documentId: "doc-1", courseId: "", fileName: "notes.pdf" }, // empty courseId
      { documentId: "doc-1", courseId: "c-1", fileName: "" }, // empty fileName
      { documentId: 123, courseId: "c-1", fileName: "notes.pdf" }, // invalid type
    ];

    for (const payload of badPayloads) {
      const req = new Request("http://localhost:3000/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const res = await summarizeRoute(req);
      assert.equal(res.status, 400, `Payload ${JSON.stringify(payload)} must return 400`);
      const json = await res.json();
      assert.ok(json.error, "Must return error field");
    }
    recordPass("1.2 Missing / invalid payload fields strictly rejected with HTTP 400");
  } catch (err) {
    recordFail("1.2 Missing / invalid payload fields rejection", err);
  }

  // Test 1.3: Empty text input (rawTextContent: "")
  try {
    const emptyReq = new Request("http://localhost:3000/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: "doc-empty-1",
        courseId: "c-empty",
        fileName: "EmptyLecture.pdf",
        rawTextContent: "",
        category: "Lecture",
      }),
    });
    const res = await summarizeRoute(emptyReq);
    assert.equal(res.status, 200, "Empty text must return 200 via fallback");
    const json = await res.json();
    const validated = AcademicSummarySchema.safeParse(json);
    assert.ok(validated.success, `Schema validation failed: ${JSON.stringify(validated.error?.issues)}`);
    assert.equal(json.documentId, "doc-empty-1");
    assert.ok(json.executiveSummary.length > 0 && json.executiveSummary.length <= 500);
    assert.ok(json.keyTakeaways.length >= 3 && json.keyTakeaways.length <= 5);
    assert.ok(json.candidateConcepts.length >= 1 && json.candidateConcepts.length <= 8);
    recordPass("1.3 Empty text input handled gracefully with valid AcademicSummary");
  } catch (err) {
    recordFail("1.3 Empty text input handling", err);
  }

  // Test 1.4: Whitespace and noisy punctuation text input
  try {
    const noisyReq = new Request("http://localhost:3000/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: "doc-noisy-1",
        courseId: "c-noisy",
        fileName: "NoisyNotes.txt",
        rawTextContent: "   \n\n\t\t   ... --- !!! ??? *** ###   \n\t  ",
        category: "Notes",
      }),
    });
    const res = await summarizeRoute(noisyReq);
    assert.equal(res.status, 200);
    const json = await res.json();
    const validated = AcademicSummarySchema.safeParse(json);
    assert.ok(validated.success, "Noisy text must yield schema-conforming summary");
    recordPass("1.4 Whitespace and noisy punctuation input yields valid AcademicSummary");
  } catch (err) {
    recordFail("1.4 Whitespace/noisy input handling", err);
  }

  // Test 1.5: Oversized text (120,000+ characters) stress test
  try {
    const baseAcademicParagraph = `
      The investigation of high-voltage transmission networks requires rigorous mathematical modeling.
      Nodal admittance analysis represents the foundational method for solving non-linear load flow problems.
      We formulate the complex power injection equation S_i = P_i + jQ_i = V_i * sum(Y_ik^* * V_k^*).
      Newton-Raphson iteration utilizes the Jacobian matrix partitioned into sub-matrices H, N, J, and L.
      Under extreme loading conditions, voltage collapse occurs when the system reaches the maximum power transfer limit.
      FACTS devices including STATCOM and SVC provide dynamic reactive power compensation to maintain voltage stability.
      The renewable energy integration of offshore wind farms utilizes HVDC converters operating with PWM modulation.
    `;
    // Repeat to create > 120,000 characters
    const repetitions = 200;
    const oversizedText = baseAcademicParagraph.repeat(repetitions);
    assert.ok(oversizedText.length > 120000, `Oversized text length must exceed 120,000 (got ${oversizedText.length})`);

    const t0 = performance.now();
    const oversizedReq = new Request("http://localhost:3000/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: "doc-oversized-1",
        courseId: "c-ee4010",
        fileName: "Comprehensive_Power_Systems_Monograph.pdf",
        rawTextContent: oversizedText,
        category: "Lecture",
      }),
    });
    const res = await summarizeRoute(oversizedReq);
    const elapsed = performance.now() - t0;

    assert.equal(res.status, 200, "Oversized request must succeed with 200");
    const json = await res.json();
    const validated = AcademicSummarySchema.safeParse(json);
    assert.ok(validated.success, `Schema validation on oversized text failed: ${JSON.stringify(validated.error?.issues)}`);
    assert.ok(json.executiveSummary.length <= 500, `Executive summary length (${json.executiveSummary.length}) must be <= 500`);
    assert.ok(json.keyTakeaways.length >= 3 && json.keyTakeaways.length <= 5);
    assert.ok(json.candidateConcepts.length >= 1 && json.candidateConcepts.length <= 8);
    assert.ok(elapsed < 2000, `Execution time (${elapsed.toFixed(1)}ms) must be under 2000ms`);
    recordPass(`1.5 Oversized text (120k+ chars) processed in ${elapsed.toFixed(1)}ms with strict schema conformance`);
  } catch (err) {
    recordFail("1.5 Oversized text stress test", err);
  }

  // Test 1.6: Unconfigured API key and simulated provider failure
  try {
    const originalApiKey = process.env.OPENAI_API_KEY;
    const originalBaseUrl = process.env.OPENAI_BASE_URL;

    // A: Without API key
    delete process.env.OPENAI_API_KEY;
    const unconfReq = new Request("http://localhost:3000/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: "doc-unconf",
        courseId: "c-1",
        fileName: "Syllabus.pdf",
        rawTextContent: "This course introduces discrete mathematics and graph theory algorithms.",
        category: "Syllabus",
      }),
    });
    const unconfRes = await summarizeRoute(unconfReq);
    assert.equal(unconfRes.status, 200);
    assert.equal(unconfRes.headers.get("X-Summarizer-Engine"), "deterministic-local-heuristic");
    const unconfJson = await unconfRes.json();
    assert.ok(AcademicSummarySchema.safeParse(unconfJson).success);

    // B: With API key but unreachable endpoint (simulating network error / timeout)
    process.env.OPENAI_API_KEY = "mock-invalid-key";
    process.env.OPENAI_BASE_URL = "http://127.0.0.1:54321/v1"; // unreachable port

    const failReq = new Request("http://localhost:3000/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: "doc-net-fail",
        courseId: "c-1",
        fileName: "Algorithm_Design.pdf",
        rawTextContent: "Greedy algorithms and dynamic programming provide polynomial time solutions.",
        category: "Lecture",
      }),
    });
    const failRes = await summarizeRoute(failReq);
    assert.equal(failRes.status, 200, "Unreachable provider must fall back silently to 200");
    const failJson = await failRes.json();
    assert.ok(AcademicSummarySchema.safeParse(failJson).success);

    // Restore environment
    if (originalApiKey) process.env.OPENAI_API_KEY = originalApiKey;
    else delete process.env.OPENAI_API_KEY;
    if (originalBaseUrl) process.env.OPENAI_BASE_URL = originalBaseUrl;
    else delete process.env.OPENAI_BASE_URL;

    recordPass("1.6 Unconfigured API keys and network connection drops fall back cleanly to local engine");
  } catch (err) {
    recordFail("1.6 Unconfigured API key and provider failure fallback", err);
  }

  // Test 1.7: LaTeX formula extraction on multi-line equations, environments & symbol-rich text
  try {
    const complexMathText = `
      # Advanced Control Theory and Electrodynamics
      
      Maxwell's macroscopic equations govern the electrodynamic continuum:
      \\begin{align}
        \\nabla \\times \\mathbf{E} &= -\\frac{\\partial \\mathbf{B}}{\\partial t} \\\\
        \\nabla \\times \\mathbf{H} &= \\mathbf{J} + \\frac{\\partial \\mathbf{D}}{\\partial t}
      \\end{align}

      The state-space representation of the MIMO dynamic system is expressed as:
      \\[
        \\begin{aligned}
          \\dot{\\mathbf{x}}(t) &= \\mathbf{A}\\mathbf{x}(t) + \\mathbf{B}\\mathbf{u}(t) \\\\
          \\mathbf{y}(t) &= \\mathbf{C}\\mathbf{x}(t) + \\mathbf{D}\\mathbf{u}(t)
        \\end{aligned}
      \\]

      The Gaussian probability density function integral evaluates over the real domain:
      $$
        \\int_{-\\infty}^{+\\infty} e^{-\\frac{(x - \\mu)^2}{2\\sigma^2}} dx = \\sigma \\sqrt{2\\pi}
      $$

      In electric machinery, Ohm's law V = I * R and Active power P = V * I * cos(theta) are fundamental.
      Also, complex apparent power satisfies S = P + jQ and bus admittance is Y_bus = G + jB.
    `;

    const extractedFormulas = extractLaTeXFormulas(complexMathText, "Lecture");
    assert.ok(extractedFormulas.length >= 3, `Expected at least 3 extracted formulas, got ${extractedFormulas.length}`);

    // Verify formula structure
    for (const f of extractedFormulas) {
      assert.ok(f.name && f.name.length > 0, "Formula must have non-empty name");
      assert.ok(f.latex && f.latex.length > 0, "Formula must have non-empty LaTeX");
      assert.ok(f.description && f.description.length > 0, "Formula must have description");
      // Must not contain unescaped raw newlines in name or description
      assert.ok(!f.name.includes("\n"), "Formula name must not contain newlines");
    }

    // Verify multi-line environment captured
    const hasAlignOrBlock = extractedFormulas.some(
      (f) => f.latex.includes("\\mathbf{E}") || f.latex.includes("\\dot{\\mathbf{x}}") || f.latex.includes("\\int_")
    );
    assert.ok(hasAlignOrBlock, "Must extract multi-line LaTeX block or environment");

    // Verify ASCII equation conversion
    const hasActivePower = extractedFormulas.some((f) => f.name.includes("Active Power"));
    const hasAdmittance = extractedFormulas.some((f) => f.name.includes("Bus Admittance"));
    assert.ok(hasActivePower || hasAdmittance, "Must detect and convert standard plain ASCII equations");

    recordPass("1.7 Multi-line LaTeX blocks, environments (align), and symbol-rich formulas extracted");
  } catch (err) {
    recordFail("1.7 LaTeX formula extraction on multi-line equations", err);
  }

  // ============================================================================
  // SUITE 2: Kahn's Topological Sort & Cycle Stress
  // ============================================================================
  console.log("\n--- SUITE 2: Kahn's Topological Sort & Cycle Stress ---");

  // Helper to generate mock courses
  function createCourses(specs) {
    return specs.map(([id, code, name, credits]) => ({
      id,
      course_code: code,
      course_name: name,
      credits: credits || 3,
      semester_id: "sem-test",
    }));
  }

  // Test 2.1: Deep linear chain (10 levels deep)
  try {
    const chainLength = 10;
    const chainCourses = createCourses(
      Array.from({ length: chainLength }, (_, i) => [
        `c-${i + 1}`,
        `CS${100 + i * 10}`,
        `Computer Science Level ${i + 1}`,
        3,
      ])
    );
    const chainPrereqs = Array.from({ length: chainLength - 1 }, (_, i) => ({
      id: `p-${i + 1}`,
      course_id: `c-${i + 2}`,
      prerequisite_course_id: `c-${i + 1}`,
    }));

    const result = validatePrerequisiteDAG(chainCourses, chainPrereqs);
    assert.equal(result.isAcyclic, true, "Deep linear chain must be acyclic");
    assert.equal(result.sortedCourseIds.length, chainLength);

    // Verify sequence is strictly c-1 to c-10
    for (let i = 0; i < chainLength; i++) {
      assert.equal(result.sortedCourseIds[i], `c-${i + 1}`);
      assert.equal(result.tiers[`c-${i + 1}`], i, `Tier for c-${i + 1} must be ${i}`);
    }
    recordPass("2.1 Deep linear chain (10 levels) yields exact topological order and progressive tiers");
  } catch (err) {
    recordFail("2.1 Deep linear chain test", err);
  }

  // Test 2.2: Multi-tier diamond DAG with multi-parent dependencies
  try {
    // Topologies:
    // Roots: C1 (tier 0), C2 (tier 0)
    // Tier 1: C3 (requires C1, C2), C4 (requires C1)
    // Tier 2: C5 (requires C3, C4)
    // Tier 3: C6 (requires C5)
    const diamondCourses = createCourses([
      ["c-1", "MATH101", "Calculus I", 3],
      ["c-2", "PHYS101", "Physics I", 3],
      ["c-3", "EE201", "Circuits I", 4],
      ["c-4", "CS101", "Intro Programming", 3],
      ["c-5", "EE301", "Embedded Systems", 4],
      ["c-6", "EE401", "Capstone Project", 3],
    ]);

    const diamondPrereqs = [
      { id: "p1", course_id: "c-3", prerequisite_course_id: "c-1" },
      { id: "p2", course_id: "c-3", prerequisite_course_id: "c-2" },
      { id: "p3", course_id: "c-4", prerequisite_course_id: "c-1" },
      { id: "p4", course_id: "c-5", prerequisite_course_id: "c-3" },
      { id: "p5", course_id: "c-5", prerequisite_course_id: "c-4" },
      { id: "p6", course_id: "c-6", prerequisite_course_id: "c-5" },
    ];

    const result = validatePrerequisiteDAG(diamondCourses, diamondPrereqs);
    assert.equal(result.isAcyclic, true, "Diamond DAG must be acyclic");
    assert.equal(result.sortedCourseIds.length, 6);

    // Topological invariants: for every prereq, index of prereq < index of course
    for (const p of diamondPrereqs) {
      const pIdx = result.sortedCourseIds.indexOf(p.prerequisite_course_id);
      const cIdx = result.sortedCourseIds.indexOf(p.course_id);
      assert.ok(pIdx < cIdx, `Prerequisite ${p.prerequisite_course_id} must precede ${p.course_id}`);
    }

    // Exact tier assignments
    assert.equal(result.tiers["c-1"], 0);
    assert.equal(result.tiers["c-2"], 0);
    assert.equal(result.tiers["c-3"], 1);
    assert.equal(result.tiers["c-4"], 1);
    assert.equal(result.tiers["c-5"], 2);
    assert.equal(result.tiers["c-6"], 3);

    recordPass("2.2 Multi-tier diamond DAG with multi-parent dependencies correctly stratified");
  } catch (err) {
    recordFail("2.2 Multi-tier diamond DAG", err);
  }

  // Test 2.3: Disconnected components & isolated courses
  try {
    const disconnectedCourses = createCourses([
      // Component A: A1 -> A2 -> A3
      ["a-1", "A1", "Course A1", 3],
      ["a-2", "A2", "Course A2", 3],
      ["a-3", "A3", "Course A3", 3],
      // Component B: B1 -> B2
      ["b-1", "B1", "Course B1", 3],
      ["b-2", "B2", "Course B2", 3],
      // Component C: Isolated nodes
      ["iso-1", "ISO1", "Isolated Course 1", 2],
      ["iso-2", "ISO2", "Isolated Course 2", 2],
    ]);

    const disconnectedPrereqs = [
      { id: "pa1", course_id: "a-2", prerequisite_course_id: "a-1" },
      { id: "pa2", course_id: "a-3", prerequisite_course_id: "a-2" },
      { id: "pb1", course_id: "b-2", prerequisite_course_id: "b-1" },
    ];

    const result = validatePrerequisiteDAG(disconnectedCourses, disconnectedPrereqs);
    assert.equal(result.isAcyclic, true, "Disconnected components must be acyclic");
    assert.equal(result.sortedCourseIds.length, 7);

    // Assert internal ordering within each component
    assert.ok(result.sortedCourseIds.indexOf("a-1") < result.sortedCourseIds.indexOf("a-2"));
    assert.ok(result.sortedCourseIds.indexOf("a-2") < result.sortedCourseIds.indexOf("a-3"));
    assert.ok(result.sortedCourseIds.indexOf("b-1") < result.sortedCourseIds.indexOf("b-2"));

    // Tiers
    assert.equal(result.tiers["a-1"], 0);
    assert.equal(result.tiers["a-2"], 1);
    assert.equal(result.tiers["a-3"], 2);
    assert.equal(result.tiers["b-1"], 0);
    assert.equal(result.tiers["b-2"], 1);
    assert.equal(result.tiers["iso-1"], 0);
    assert.equal(result.tiers["iso-2"], 0);

    recordPass("2.3 Disconnected components and isolated nodes sorted and tiered without interference");
  } catch (err) {
    recordFail("2.3 Disconnected components test", err);
  }

  // Test 2.4: Complex cycle: A -> B -> C -> D -> B (tail into cycle)
  try {
    const cycleCourses = createCourses([
      ["c-a", "CRS_A", "Course A", 3],
      ["c-b", "CRS_B", "Course B", 3],
      ["c-c", "CRS_C", "Course C", 3],
      ["c-d", "CRS_D", "Course D", 3],
    ]);

    // A -> B; B -> C; C -> D; D -> B (cycle B -> C -> D -> B)
    const cyclePrereqs = [
      { id: "p-ab", course_id: "c-b", prerequisite_course_id: "c-a" },
      { id: "p-bc", course_id: "c-c", prerequisite_course_id: "c-b" },
      { id: "p-cd", course_id: "c-d", prerequisite_course_id: "c-c" },
      { id: "p-db", course_id: "c-b", prerequisite_course_id: "c-d" }, // Cycle edge!
    ];

    const result = validatePrerequisiteDAG(cycleCourses, cyclePrereqs);
    assert.equal(result.isAcyclic, false, "Cycle must be detected");
    assert.ok(result.cycleTrace, "Must provide human-readable cycleTrace");
    assert.ok(
      result.cycleTrace.includes("CRS_B") &&
      result.cycleTrace.includes("CRS_C") &&
      result.cycleTrace.includes("CRS_D"),
      `Cycle trace (${result.cycleTrace}) must contain the cycle participants`
    );

    // assertAcyclicPrerequisites must throw descriptive error
    let threw = false;
    let errorMessage = "";
    try {
      assertAcyclicPrerequisites(cycleCourses, cyclePrereqs);
    } catch (err) {
      threw = true;
      errorMessage = err.message;
    }
    assert.equal(threw, true, "assertAcyclicPrerequisites must throw");
    assert.ok(
      errorMessage.startsWith("Circular prerequisite dependency detected:"),
      `Error must start with standard prefix. Got: ${errorMessage}`
    );
    assert.ok(
      errorMessage.includes("CRS_B -> CRS_C -> CRS_D -> CRS_B") ||
      errorMessage.includes("CRS_C -> CRS_D -> CRS_B -> CRS_C") ||
      errorMessage.includes("CRS_D -> CRS_B -> CRS_C -> CRS_D"),
      `Error message must contain exact circular path. Got: ${errorMessage}`
    );

    recordPass(`2.4 Complex cycle A -> B -> C -> D -> B detected with exact trace: ${result.cycleTrace}`);
  } catch (err) {
    recordFail("2.4 Complex cycle test", err);
  }

  // Test 2.5: Self-loop cycle (A -> A)
  try {
    const selfCourses = createCourses([["c-self", "CRS_SELF", "Self Dependent Course", 3]]);
    const selfPrereqs = [{ id: "p-self", course_id: "c-self", prerequisite_course_id: "c-self" }];

    const result = validatePrerequisiteDAG(selfCourses, selfPrereqs);
    assert.equal(result.isAcyclic, false, "Self-loop must be detected as cyclic");

    let threw = false;
    let msg = "";
    try {
      assertAcyclicPrerequisites(selfCourses, selfPrereqs);
    } catch (err) {
      threw = true;
      msg = err.message;
    }
    assert.equal(threw, true);
    assert.ok(msg.includes("CRS_SELF -> CRS_SELF") || msg.includes("CRS_SELF"));
    recordPass(`2.5 Self-loop cycle (CRS_SELF -> CRS_SELF) detected: ${result.cycleTrace}`);
  } catch (err) {
    recordFail("2.5 Self-loop cycle test", err);
  }

  // Test 2.6: Disconnected cycle with valid component
  try {
    const mixedCourses = createCourses([
      // Valid Component: V1 -> V2
      ["v-1", "VALID1", "Valid 1", 3],
      ["v-2", "VALID2", "Valid 2", 3],
      // Cyclic Component: X -> Y -> X
      ["x-1", "CYC_X", "Cycle X", 3],
      ["y-1", "CYC_Y", "Cycle Y", 3],
    ]);

    const mixedPrereqs = [
      { id: "pv", course_id: "v-2", prerequisite_course_id: "v-1" },
      { id: "pxy", course_id: "y-1", prerequisite_course_id: "x-1" },
      { id: "pyx", course_id: "x-1", prerequisite_course_id: "y-1" },
    ];

    const result = validatePrerequisiteDAG(mixedCourses, mixedPrereqs);
    assert.equal(result.isAcyclic, false);
    assert.ok(result.cycleTrace.includes("CYC_X") && result.cycleTrace.includes("CYC_Y"));

    assert.throws(
      () => assertAcyclicPrerequisites(mixedCourses, mixedPrereqs),
      /Circular prerequisite dependency detected:/
    );
    recordPass("2.6 Disconnected cycle alongside valid component cleanly isolated and rejected");
  } catch (err) {
    recordFail("2.6 Disconnected cycle test", err);
  }

  // ============================================================================
  // SUITE 3: Course Affinity Scoring Boundary Conditions
  // ============================================================================
  console.log("\n--- SUITE 3: Course Affinity Scoring Boundary Conditions ---");

  const targetCourse = {
    id: "target-c1",
    course_code: "EE4050",
    course_name: "High Voltage Transmission and Smart Grid Control",
    description: "Covers synchronous power flow, FACTS controllers, and SCADA monitoring.",
    credits: 3,
    semester_id: "sem-1",
  };

  const targetPrereqs = [
    { id: "p1", course_id: "target-c1", prerequisite_course_id: "req-1" },
    { id: "p2", course_id: "target-c1", prerequisite_course_id: "req-2" },
  ];

  const targetConcepts = [
    { id: "cc-1", course_id: "target-c1", concept_id: "con-1", concept: { id: "con-1", name: "Smart Grid" } },
    { id: "cc-2", course_id: "target-c1", concept_id: "con-2", concept: { id: "con-2", name: "FACTS Controllers" } },
  ];

  // Test 3.1: Zero satisfied prerequisites penalty
  try {
    const zeroPrereqResult = calculateCourseAffinityScore(targetCourse, {
      completedCourseIds: [], // Neither req-1 nor req-2 completed!
      studentSkills: ["Smart Grid", "High Voltage"],
      currentSemesterCredits: 12,
      maxSemesterCredits: 24,
      prerequisites: targetPrereqs,
      courseConcepts: targetConcepts,
    });

    assert.equal(zeroPrereqResult.isEligible, false, "Must not be eligible with 0 prereqs satisfied");
    assert.equal(zeroPrereqResult.prereqSatisfied, 0.0, "Prereq satisfied score must be 0.0");
    assert.equal(zeroPrereqResult.missingPrerequisiteIds.length, 2);
    assert.ok(zeroPrereqResult.missingPrerequisiteIds.includes("req-1"));
    assert.ok(zeroPrereqResult.missingPrerequisiteIds.includes("req-2"));

    // Compare with fully satisfied prereqs
    const fullPrereqResult = calculateCourseAffinityScore(targetCourse, {
      completedCourseIds: ["req-1", "req-2"],
      studentSkills: ["Smart Grid", "High Voltage"],
      currentSemesterCredits: 12,
      maxSemesterCredits: 24,
      prerequisites: targetPrereqs,
      courseConcepts: targetConcepts,
    });

    assert.equal(fullPrereqResult.isEligible, true);
    assert.equal(fullPrereqResult.prereqSatisfied, 1.0);
    // Score delta must be exactly 0.5 * 1.0 = 0.50
    const delta = fullPrereqResult.score - zeroPrereqResult.score;
    assert.ok(
      Math.abs(delta - 0.5) <= 0.02,
      `Prereq satisfaction weight (0.50) must account for score delta. Got delta=${delta.toFixed(2)}`
    );

    recordPass(`3.1 Zero satisfied prerequisites yields 0.0 prereq score, ineligibility, and 0.50 score penalty`);
  } catch (err) {
    recordFail("3.1 Zero satisfied prerequisites penalty", err);
  }

  // Test 3.2: Skills similarity boundaries (Max vs Disjoint vs Neutral)
  try {
    // A: 100% matched skills
    const maxSkillsResult = calculateCourseAffinityScore(targetCourse, {
      completedCourseIds: ["req-1", "req-2"],
      studentSkills: ["Smart Grid", "High Voltage", "SCADA"],
      currentSemesterCredits: 12,
      maxSemesterCredits: 24,
      prerequisites: targetPrereqs,
      courseConcepts: targetConcepts,
    });
    assert.equal(maxSkillsResult.topicSimilarity, 1.0, "All skills present in corpus must give 1.0 similarity");

    // B: 0% matched skills (completely disjoint academic domain)
    const zeroSkillsResult = calculateCourseAffinityScore(targetCourse, {
      completedCourseIds: ["req-1", "req-2"],
      studentSkills: ["Sanskrit Grammar", "Underwater Archaeology"],
      currentSemesterCredits: 12,
      maxSemesterCredits: 24,
      prerequisites: targetPrereqs,
      courseConcepts: targetConcepts,
    });
    assert.equal(zeroSkillsResult.topicSimilarity, 0.0, "Completely disjoint skills must give 0.0 similarity");

    // C: Neutral baseline (no student skills provided)
    const neutralSkillsResult = calculateCourseAffinityScore(targetCourse, {
      completedCourseIds: ["req-1", "req-2"],
      studentSkills: [],
      currentSemesterCredits: 12,
      maxSemesterCredits: 24,
      prerequisites: targetPrereqs,
      courseConcepts: targetConcepts,
    });
    assert.equal(neutralSkillsResult.topicSimilarity, 0.5, "Empty skills must default to neutral 0.5 baseline");

    // Check contribution difference: 0.3 * (1.0 - 0.0) = 0.30
    const skillsDelta = maxSkillsResult.score - zeroSkillsResult.score;
    assert.ok(
      Math.abs(skillsDelta - 0.3) <= 0.02,
      `Topic similarity weight (0.30) must account for score delta. Got delta=${skillsDelta.toFixed(2)}`
    );

    recordPass(`3.2 Topic similarity boundaries verified: Max (1.0), Disjoint (0.0), Neutral baseline (0.5)`);
  } catch (err) {
    recordFail("3.2 Skills similarity boundaries", err);
  }

  // Test 3.3: Workload balance across extreme credit ranges
  try {
    // Current credits: 0 -> projected 3 (Underload)
    const underload = calculateCourseAffinityScore(targetCourse, {
      completedCourseIds: ["req-1", "req-2"],
      studentSkills: [],
      currentSemesterCredits: 0,
      maxSemesterCredits: 24,
      prerequisites: targetPrereqs,
    });
    // 1.0 - (15 - 3) * 0.04 = 1.0 - 0.48 = 0.52
    assert.equal(underload.workloadBalance, 0.52, "Underload balance for 3 credits must be 0.52");

    // Current credits: 12 -> projected 15 (Ideal balance)
    const ideal = calculateCourseAffinityScore(targetCourse, {
      completedCourseIds: ["req-1", "req-2"],
      studentSkills: [],
      currentSemesterCredits: 12,
      maxSemesterCredits: 24,
      prerequisites: targetPrereqs,
    });
    assert.equal(ideal.workloadBalance, 1.0, "Ideal balance (15 credits) must be 1.0");

    // Current credits: 18 -> projected 21 (Moderate overload)
    const moderateOverload = calculateCourseAffinityScore(targetCourse, {
      completedCourseIds: ["req-1", "req-2"],
      studentSkills: [],
      currentSemesterCredits: 18,
      maxSemesterCredits: 24,
      prerequisites: targetPrereqs,
    });
    // 0.85 - (21 - 18) * 0.1 = 0.85 - 0.3 = 0.55
    assert.equal(moderateOverload.workloadBalance, 0.55, "Moderate overload (21 credits) must be 0.55");

    // Current credits: 21 -> projected 24 (Max allowed cap)
    const severeOverload = calculateCourseAffinityScore(targetCourse, {
      completedCourseIds: ["req-1", "req-2"],
      studentSkills: [],
      currentSemesterCredits: 21,
      maxSemesterCredits: 24,
      prerequisites: targetPrereqs,
    });
    // 0.5 - (24 - 21) * 0.12 = 0.5 - 0.36 = 0.14
    assert.equal(severeOverload.workloadBalance, 0.14, "Max cap (24 credits) must be 0.14");

    // Current credits: 24 -> projected 27 (Exceeds maxSemesterCredits)
    const extremeOverload = calculateCourseAffinityScore(targetCourse, {
      completedCourseIds: ["req-1", "req-2"],
      studentSkills: [],
      currentSemesterCredits: 24,
      maxSemesterCredits: 24,
      prerequisites: targetPrereqs,
    });
    assert.equal(extremeOverload.workloadBalance, 0.0, "Exceeding max credits must yield 0.0 workload balance");

    recordPass(`3.3 Extreme workload balances verified: Underload (0.52), Ideal (1.0), Moderate (0.55), Cap (0.14), Over-cap (0.0)`);
  } catch (err) {
    recordFail("3.3 Workload balance extreme ranges", err);
  }

  // Test 3.4: Recommendation engine ranking & filtering
  try {
    const candidateCourses = [
      { id: "c-ideal", course_code: "IDEAL101", course_name: "Ideal Course", credits: 3, semester_id: "s1" },
      { id: "c-ineligible", course_code: "INEL101", course_name: "Ineligible Course", credits: 3, semester_id: "s1" },
      { id: "c-completed", course_code: "DONE101", course_name: "Already Done Course", credits: 3, semester_id: "s1" },
    ];

    const testPrereqs = [
      { id: "p-inel", course_id: "c-ineligible", prerequisite_course_id: "missing-req" },
    ];

    const recsAll = getRecommendedCourses(candidateCourses, {
      completedCourseIds: ["c-completed"],
      studentSkills: [],
      currentSemesterCredits: 12,
      maxSemesterCredits: 24,
      prerequisites: testPrereqs,
    });

    // Completed course must be excluded
    assert.equal(recsAll.some((r) => r.courseId === "c-completed"), false, "Completed course must be excluded");
    // Sorted descending by score
    assert.ok(recsAll[0].score >= recsAll[1].score);
    assert.equal(recsAll[0].courseId, "c-ideal");

    // Filter only eligible
    const recsEligible = getRecommendedCourses(
      candidateCourses,
      {
        completedCourseIds: ["c-completed"],
        studentSkills: [],
        currentSemesterCredits: 12,
        maxSemesterCredits: 24,
        prerequisites: testPrereqs,
      },
      { onlyEligible: true }
    );

    assert.equal(recsEligible.length, 1);
    assert.equal(recsEligible[0].courseId, "c-ideal");
    assert.equal(recsEligible[0].isEligible, true);

    recordPass(`3.4 Recommendation engine correctly filters completed courses, sorts descending, and enforces eligibility`);
  } catch (err) {
    recordFail("3.4 Recommendation engine test", err);
  }

  // Test 3.5: Absolute score bounds invariant [0.00, 1.00]
  try {
    // Absolute worst case: prereq 0, skills 0, workload 0
    const worstCase = calculateCourseAffinityScore(targetCourse, {
      completedCourseIds: [],
      studentSkills: ["Completely Unrelated"],
      currentSemesterCredits: 30, // Way over cap
      maxSemesterCredits: 24,
      prerequisites: targetPrereqs,
    });
    assert.equal(worstCase.score, 0.0, "Worst-case score must be 0.00");

    // Absolute best case: prereq 1.0, skills 1.0, workload 1.0
    const bestCase = calculateCourseAffinityScore(targetCourse, {
      completedCourseIds: ["req-1", "req-2"],
      studentSkills: ["Smart Grid", "High Voltage", "SCADA"],
      currentSemesterCredits: 12, // 12 + 3 = 15 -> 1.0
      maxSemesterCredits: 24,
      prerequisites: targetPrereqs,
      courseConcepts: targetConcepts,
    });
    assert.equal(bestCase.score, 1.0, "Best-case score must be 1.00");

    recordPass(`3.5 Composite affinity scores strictly bounded within [0.00, 1.00] under extreme limits`);
  } catch (err) {
    recordFail("3.5 Absolute score bounds invariant", err);
  }

  console.log("\n================================================================================");
  console.log(`  ALL ${totalTests} ADVERSARIAL STRESS TESTS PASSED SUCCESSFULLY (100%)         `);
  console.log("================================================================================\n");
}

runAdversarialM2StressTests().catch((err) => {
  console.error("Adversarial stress harness failed with fatal error:", err);
  process.exit(1);
});
