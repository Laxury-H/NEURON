"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  Semester,
  Course,
  Concept,
  CoursePrerequisite,
  CourseConcept,
} from "@/types/database";
import { DataRepository } from "@/lib/data/repository";
import { validatePrerequisiteDAG } from "@/lib/academic/prerequisites";
import { useTheme } from "@/components/theme-provider";
import { CourseNode } from "@/components/graph/nodes/course-node";
import { ConceptNode } from "@/components/graph/nodes/concept-node";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Network,
  Search,
  Maximize2,
  RotateCcw,
  BookOpen,
  Brain,
  ExternalLink,
  GitFork,
  ArrowRight,
  X,
  Map as MapIcon,
} from "lucide-react";

const nodeTypes = {
  courseNode: CourseNode,
  conceptNode: ConceptNode,
};

function InnerCurriculumGraph() {
  const { fitView } = useReactFlow();
  const { theme, pureBw } = useTheme();

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [prerequisites, setPrerequisites] = useState<CoursePrerequisite[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [courseConcepts, setCourseConcepts] = useState<CourseConcept[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);

  // Search & Timeline Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [timelineIndex, setTimelineIndex] = useState<number>(-1); // -1 = All Semesters
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [loading, setLoading] = useState(true);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Load all macroscopic curriculum data
  const loadCurriculumData = useCallback(async () => {
    try {
      setLoading(true);
      const [sems, allCourses, prereqs] = await Promise.all([
        DataRepository.getSemesters(),
        DataRepository.getCourses(),
        DataRepository.getCoursePrerequisites(),
      ]);

      setSemesters(sems || []);
      setCourses(allCourses || []);
      setPrerequisites(prereqs || []);

      // Extract relational concepts from repository store
      try {
        const rawStore = JSON.parse(DataRepository.exportAllData());
        setConcepts(rawStore.concepts || []);
        setCourseConcepts(rawStore.course_concepts || []);
      } catch {
        setConcepts([]);
        setCourseConcepts([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurriculumData();
  }, [loadCurriculumData]);

  // Construct Macroscopic Topology:
  // - Organizes courses into chronological progression tiers / semester clusters
  // - Emplaces Shared Concept Bridges between courses
  // - Generates Directed Prerequisite Edges with hairline arrows
  useEffect(() => {
    if (courses.length === 0) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const isDark = theme === "dark";
    const strokeColor = pureBw ? (isDark ? "#FFFFFF" : "#000000") : isDark ? "#E5E5E5" : "#171717";
    const bridgeStroke = pureBw ? (isDark ? "#FFFFFF" : "#000000") : "#737373";

    // 1. Group courses by prerequisite dependency depth (DAG Tiers) using Kahn's topological sort
    const dagResult = validatePrerequisiteDAG(courses, prerequisites);
    const courseTierMap = new Map<string, number>(Object.entries(dagResult.tiers));

    // Group courses by tier
    const tiers: Course[][] = [];
    courses.forEach((c) => {
      const tier = courseTierMap.get(c.id) ?? 0;
      if (!tiers[tier]) tiers[tier] = [];
      tiers[tier].push(c);
    });

    // Determine active timeline filter threshold
    // If timelineIndex >= 0, only courses up to that semester index are fully active
    const activeSemesterIds =
      timelineIndex === -1
        ? new Set(semesters.map((s) => s.id))
        : new Set(semesters.slice(0, timelineIndex + 1).map((s) => s.id));

    // Map course positions for connecting edges and shared concept placement
    const coursePositions = new Map<string, { x: number; y: number }>();

    // 2. Lay out Course Nodes in progressive columns from West to East
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
          data: {
            courseCode: course.course_code,
            courseName: course.course_name,
            credits: course.credits,
            lecturer: course.lecturer,
            isSelected: selectedCourse?.id === course.id,
          },
          style: { opacity, transition: "opacity 0.2s ease" },
        });
      });
    });

    // 3. Render Prerequisite Directed Edges (hairline solid arrows from prereq to dependent)
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
          animated: false,
          style: {
            stroke: strokeColor,
            strokeWidth: pureBw ? 2 : 1.5,
            opacity: isActive ? 1 : 0.15,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: strokeColor,
          },
        });
      }
    });

    // 4. Identify & Emplace Shared Concept Bridges:
    // Single concept nodes connecting simultaneously to multiple courses across distinct tiers/semesters
    const conceptToCoursesMap = new Map<string, string[]>();
    courseConcepts.forEach((cc) => {
      const list = conceptToCoursesMap.get(cc.concept_id) || [];
      if (!list.includes(cc.course_id)) {
        list.push(cc.course_id);
      }
      conceptToCoursesMap.set(cc.concept_id, list);
    });

    // Find shared concepts (linked to >= 2 courses)
    const sharedConceptEntries = Array.from(conceptToCoursesMap.entries()).filter(
      ([, courseIds]) => courseIds.length >= 2
    );

    // Also include top representative concepts if fewer than 2 shared concepts exist
    const bridgeConceptEntries =
      sharedConceptEntries.length > 0
        ? sharedConceptEntries
        : Array.from(conceptToCoursesMap.entries()).slice(0, 4);

    bridgeConceptEntries.forEach(([conceptId, linkedCourseIds], bridgeIdx) => {
      const concept = concepts.find((c) => c.id === conceptId);
      if (!concept) return;

      // Calculate centroid coordinates between connected courses
      const validCourseIds = linkedCourseIds.filter((courseId) =>
        coursePositions.has(courseId)
      );

      if (validCourseIds.length === 0) return;

      const validCoords = validCourseIds.map((cId) => coursePositions.get(cId)!);

      const avgX = Math.round(
        validCoords.reduce((acc, p) => acc + p.x, 0) / validCoords.length
      );
      const avgY = Math.round(
        validCoords.reduce((acc, p) => acc + p.y, 0) / validCoords.length
      );

      // Stagger bridge positions vertically to prevent overlapping concept cards
      const bridgePos = {
        x: avgX + (bridgeIdx % 2 === 0 ? 140 : -140),
        y: avgY + (bridgeIdx % 2 === 0 ? 120 : -120),
      };

      const nodeId = `global-concept-${concept.id}`;
      const matchesSearch =
        !searchQuery ||
        concept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (concept.description && concept.description.toLowerCase().includes(searchQuery.toLowerCase()));

      newNodes.push({
        id: nodeId,
        type: "conceptNode",
        position: bridgePos,
        data: {
          id: concept.id,
          label: concept.name,
          description: concept.description,
          courseCount: linkedCourseIds.length,
          docCount: 0,
          isSelected: selectedConcept?.id === concept.id,
          onFilterClick: (label: string) => {
            setSearchQuery((prev) => (prev === label ? "" : label));
          },
        },
        style: { opacity: matchesSearch ? 1 : 0.25 },
      });

      // Connect concept node simultaneously to each bridged course
      validCourseIds.forEach((courseId) => {
        newEdges.push({
          id: `edge-bridge-${concept.id}-${courseId}`,
          source: courseId,
          sourceHandle: "course-top",
          target: nodeId,
          targetHandle: "concept-bottom",
          type: "smoothstep",
          animated: false,
          style: {
            stroke: bridgeStroke,
            strokeWidth: pureBw ? 2 : 1,
            strokeDasharray: "4 4",
            opacity: 0.8,
          },
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [
    courses,
    semesters,
    prerequisites,
    concepts,
    courseConcepts,
    searchQuery,
    timelineIndex,
    selectedCourse,
    selectedConcept,
    theme,
    pureBw,
    setNodes,
    setEdges,
  ]);

  // Initial auto-fit once when nodes are populated
  const initialFitDoneRef = React.useRef(false);
  useEffect(() => {
    if (nodes.length > 0 && !initialFitDoneRef.current) {
      initialFitDoneRef.current = true;
      fitView({ padding: 0.2, duration: 300 });
    }
  }, [fitView, nodes.length]);

  // Node selection handlers
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "courseNode") {
        const found = courses.find((c) => c.id === node.id);
        setSelectedCourse(found || null);
        setSelectedConcept(null);
      } else if (node.type === "conceptNode") {
        const conceptId = node.id.replace("global-concept-", "");
        const found = concepts.find((c) => c.id === conceptId);
        setSelectedConcept(found || null);
        setSelectedCourse(null);
      }
    },
    [courses, concepts]
  );

  // Selected course details
  const coursePrereqs = useMemo(() => {
    if (!selectedCourse) return [];
    const pIds = prerequisites
      .filter((p) => p.course_id === selectedCourse.id)
      .map((p) => p.prerequisite_course_id);
    return courses.filter((c) => pIds.includes(c.id));
  }, [selectedCourse, prerequisites, courses]);

  const courseDependents = useMemo(() => {
    if (!selectedCourse) return [];
    const dIds = prerequisites
      .filter((p) => p.prerequisite_course_id === selectedCourse.id)
      .map((p) => p.course_id);
    return courses.filter((c) => dIds.includes(c.id));
  }, [selectedCourse, prerequisites, courses]);

  const courseConceptsList = useMemo(() => {
    if (!selectedCourse) return [];
    const concIds = courseConcepts
      .filter((cc) => cc.course_id === selectedCourse.id)
      .map((cc) => cc.concept_id);
    return concepts.filter((c) => concIds.includes(c.id));
  }, [selectedCourse, courseConcepts, concepts]);

  // Selected concept bridged courses
  const conceptBridgedCourses = useMemo(() => {
    if (!selectedConcept) return [];
    const cIds = courseConcepts
      .filter((cc) => cc.concept_id === selectedConcept.id)
      .map((cc) => cc.course_id);
    return courses.filter((c) => cIds.includes(c.id));
  }, [selectedConcept, courseConcepts, courses]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs font-mono text-muted-foreground bg-background">
        Loading curriculum knowledge topology...
      </div>
    );
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-background">
      {/* Top Floating Controls & Timeline Toolbar */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex max-w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-2rem)] items-center gap-1.5 bg-card/90 backdrop-blur-sm border border-border p-1.5 rounded-md shadow-sm overflow-x-auto scrollbar-none font-mono">
        <div className="flex items-center space-x-1.5 px-2 border-r border-border shrink-0">
          <Network className="h-3.5 w-3.5 text-foreground" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Curriculum
          </span>
        </div>

        {/* Global Search Filter */}
        <div className="flex items-center space-x-1 px-1.5 border-r border-border shrink-0">
          <Search className="h-3 w-3 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search curriculum..."
            className="h-7 w-28 sm:w-40 md:w-48 border-0 shadow-none px-1 text-xs focus-visible:ring-0 bg-transparent shrink-0"
          />
        </div>

        {/* Timeline Navigation: Step Buttons */}
        <div className="flex items-center space-x-1 px-1 border-r border-border shrink-0">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1 hidden md:inline">
            Timeline:
          </span>
          <Button
            variant={timelineIndex === -1 ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setTimelineIndex(-1)}
          >
            All
          </Button>
          {semesters.map((sem, idx) => (
            <Button
              key={sem.id}
              variant={timelineIndex === idx ? "default" : "outline"}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setTimelineIndex(idx)}
              title={sem.name}
            >
              Sem {idx + 1}
            </Button>
          ))}
        </div>

        {/* Camera Controls */}
        <Button
          variant="ghost"
          size="iconSm"
          className="h-7 w-7 shrink-0"
          onClick={() => fitView({ padding: 0.2, duration: 400 })}
          title="Fit view (F)"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="iconSm"
          className="h-7 w-7 shrink-0"
          onClick={() => {
            setTimelineIndex(-1);
            setSearchQuery("");
            fitView({ padding: 0.2, duration: 400 });
          }}
          title="Reset View (R)"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant={showMiniMap ? "secondary" : "ghost"}
          size="iconSm"
          className="h-7 w-7 shrink-0"
          onClick={() => setShowMiniMap((prev) => !prev)}
          title="Toggle MiniMap"
        >
          <MapIcon className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* React Flow Spatial Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        className="w-full h-full"
        style={{ width: "100%", height: "100%" }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        onlyRenderVisibleElements={true}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        minZoom={0.15}
        maxZoom={2.0}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          gap={24}
          size={1}
          color={pureBw ? (theme === "dark" ? "#FFFFFF" : "#000000") : theme === "dark" ? "#404040" : "#D4D4D4"}
          className={pureBw ? "!opacity-100" : "dark:!opacity-20"}
        />
        <Controls showInteractive={false} position="bottom-left" className="!bottom-3 !left-3 sm:!bottom-4 sm:!left-4" />
        {showMiniMap && (
          <MiniMap
            position="bottom-right"
            className="!bottom-3 !right-3 sm:!bottom-4 sm:!right-4 !bg-card !border !border-border rounded-md shadow-md"
            nodeColor={() => (theme === "dark" ? "#FFFFFF" : "#000000")}
          />
        )}
      </ReactFlow>

      {/* Selected Course Inspector Drawer */}
      {selectedCourse && (
        <div className="absolute top-16 right-4 z-30 w-80 max-w-[calc(100vw-2rem)] bg-card/95 backdrop-blur-md border border-border rounded-md shadow-lg p-4 font-mono select-text animate-in fade-in slide-in-from-right-4 duration-150">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4 text-foreground" />
              <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                Course Inspector
              </span>
            </div>
            <button
              onClick={() => setSelectedCourse(null)}
              className="text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-base font-bold text-foreground block">
                {selectedCourse.course_code}
              </span>
              <span className="text-xs text-muted-foreground block font-sans">
                {selectedCourse.course_name}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[10px]">
              <span className="px-1.5 py-0.5 rounded border border-border bg-muted">
                {selectedCourse.credits} Credits
              </span>
              {selectedCourse.lecturer && (
                <span className="px-1.5 py-0.5 rounded border border-border bg-muted truncate">
                  {selectedCourse.lecturer}
                </span>
              )}
            </div>

            {/* Prerequisites */}
            <div className="border-t border-border pt-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Prerequisites Required ({coursePrereqs.length}):
              </span>
              {coursePrereqs.length === 0 ? (
                <span className="text-[10px] text-muted-foreground italic">None (Foundation Course)</span>
              ) : (
                <div className="space-y-1">
                  {coursePrereqs.map((p) => (
                    <div key={p.id} className="flex items-center text-[10px] text-foreground">
                      <ArrowRight className="h-3 w-3 mr-1 text-muted-foreground shrink-0" />
                      <span className="font-semibold">{p.course_code}</span>
                      <span className="text-muted-foreground truncate ml-1 font-sans">
                        — {p.course_name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unlocks / Dependents */}
            <div className="border-t border-border pt-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Unlocks Subsequent Courses ({courseDependents.length}):
              </span>
              {courseDependents.length === 0 ? (
                <span className="text-[10px] text-muted-foreground italic">No subsequent dependencies</span>
              ) : (
                <div className="space-y-1">
                  {courseDependents.map((d) => (
                    <div key={d.id} className="flex items-center text-[10px] text-foreground">
                      <GitFork className="h-3 w-3 mr-1 text-muted-foreground shrink-0" />
                      <span className="font-semibold">{d.course_code}</span>
                      <span className="text-muted-foreground truncate ml-1 font-sans">
                        — {d.course_name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Concepts Taught */}
            {courseConceptsList.length > 0 && (
              <div className="border-t border-border pt-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                  Concepts Taught ({courseConceptsList.length}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {courseConceptsList.map((c) => (
                    <span
                      key={c.id}
                      className="text-[9px] px-1.5 py-0.5 rounded border border-border bg-card text-foreground"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation Button to Full Course Graph */}
            <div className="pt-2">
              <Link
                href={`/app/semesters/${selectedCourse.semester_id}/courses/${selectedCourse.id}`}
                className="w-full inline-flex items-center justify-center rounded-sm border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 transition-opacity"
              >
                <span>Open Course Canvas</span>
                <ExternalLink className="h-3 w-3 ml-1.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Selected Concept Inspector Drawer */}
      {selectedConcept && (
        <div className="absolute top-16 right-4 z-30 w-80 max-w-[calc(100vw-2rem)] bg-card/95 backdrop-blur-md border border-border rounded-md shadow-lg p-4 font-mono select-text animate-in fade-in slide-in-from-right-4 duration-150">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
            <div className="flex items-center space-x-2">
              <Brain className="h-4 w-4 text-foreground" />
              <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                Shared Concept Bridge
              </span>
            </div>
            <button
              onClick={() => setSelectedConcept(null)}
              className="text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-sm font-bold text-foreground block">
                {selectedConcept.name}
              </span>
              {selectedConcept.description && (
                <p className="text-[11px] text-muted-foreground mt-1 font-sans leading-relaxed">
                  {selectedConcept.description}
                </p>
              )}
            </div>

            <div className="border-t border-border pt-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Bridged Courses ({conceptBridgedCourses.length}):
              </span>
              <div className="space-y-1.5">
                {conceptBridgedCourses.map((c) => (
                  <Link
                    key={c.id}
                    href={`/app/semesters/${c.semester_id}/courses/${c.id}`}
                    className="flex items-center justify-between p-1.5 rounded border border-border/80 hover:bg-muted transition-colors text-xs text-foreground group"
                  >
                    <div>
                      <span className="font-bold">{c.course_code}</span>
                      <span className="text-muted-foreground font-sans ml-1 text-[11px] truncate">
                        {c.course_name}
                      </span>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-foreground shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Graph Legend Banner */}
      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-10 hidden sm:flex items-center gap-3 bg-card/85 backdrop-blur-sm border border-border px-3 py-1.5 rounded-md text-[10px] font-mono text-muted-foreground shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-foreground" />
          <span>Prerequisite Dependency</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 border-t border-dashed border-muted-foreground" />
          <span>Shared Concept Bridge</span>
        </div>
      </div>
    </div>
  );
}

export default function GlobalCurriculumGraphPage() {
  return (
    <ReactFlowProvider>
      <InnerCurriculumGraph />
    </ReactFlowProvider>
  );
}
