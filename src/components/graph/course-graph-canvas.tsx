"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Course, Person, DocumentItem, CourseGraphLayout, RelationshipType, DocumentCategory } from "@/types/database";
import { DataRepository } from "@/lib/data/repository";
import { CourseNode } from "./nodes/course-node";
import { RelationshipGroupNode } from "./nodes/relationship-group-node";
import { FilesGroupNode } from "./nodes/files-group-node";
import { PersonNode } from "./nodes/person-node";
import { DocumentNode } from "./nodes/document-node";

import { CourseDetailPanel } from "./course-detail-panel";
import { PersonDetailPanel } from "./person-detail-panel";
import { DocumentDetailPanel } from "./document-detail-panel";
import { AddPersonDialog } from "./add-person-dialog";
import { UploadDocumentDialog } from "./upload-document-dialog";
import { CourseDialog } from "@/components/courses/course-dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Maximize2,
  RotateCcw,
  UserPlus,
  FileUp,
  Search,
  Filter,
} from "lucide-react";

interface CourseGraphCanvasProps {
  courseId: string;
  semesterId: string;
}

const nodeTypes = {
  courseNode: CourseNode,
  relationshipGroupNode: RelationshipGroupNode,
  filesGroupNode: FilesGroupNode,
  personNode: PersonNode,
  documentNode: DocumentNode,
};

function InnerGraphCanvas({ courseId, semesterId }: CourseGraphCanvasProps) {
  const { fitView, setViewport } = useReactFlow();

  const [course, setCourse] = useState<Course | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [allDocuments, setAllDocuments] = useState<DocumentItem[]>([]);
  const [savedLayout, setSavedLayout] = useState<CourseGraphLayout | null>(null);

  // Expansion state
  const [expandRelationships, setExpandRelationships] = useState<boolean>(false);
  const [expandFiles, setExpandFiles] = useState<boolean>(false);

  // Inspector Panel State
  const [selectedCourse, setSelectedCourse] = useState<boolean>(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);

  // Dialogs
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [editCourseOpen, setEditCourseOpen] = useState(false);

  // Search filter inside canvas
  const [graphSearchQuery, setGraphSearchQuery] = useState("");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Load Graph Data
  const loadData = useCallback(async () => {
    try {
      const data = await DataRepository.getCourseGraphData(courseId);
      if (data) {
        setCourse(data.course);
        setPeople(data.people);
        setDocuments(data.documents);
        setAllPeople(data.allPeople);
        setAllDocuments(data.allDocuments);
        setSavedLayout(data.layout);
      }
    } catch (err) {
      toast.error("Failed to load course graph data");
    }
  }, [courseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check URL query parameters for direct inspection (from Global Search)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const inspectPerson = params.get("inspectPerson");
      const inspectDoc = params.get("inspectDoc");
      if (inspectPerson && people.length > 0) {
        const found = people.find((p) => p.id === inspectPerson);
        if (found) {
          setExpandRelationships(true);
          setSelectedPerson(found);
        }
      }
      if (inspectDoc && documents.length > 0) {
        const found = documents.find((d) => d.id === inspectDoc);
        if (found) {
          setExpandFiles(true);
          setSelectedDocument(found);
        }
      }
    }
  }, [people, documents]);

  // Construct Nodes & Edges
  useEffect(() => {
    if (!course) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const positions = savedLayout?.positions || {};

    // 1. Central Course Node
    const coursePos = positions["course"] || { x: 380, y: 220 };
    newNodes.push({
      id: "course",
      type: "courseNode",
      position: coursePos,
      data: {
        courseCode: course.course_code,
        courseName: course.course_name,
        credits: course.credits,
        lecturer: course.lecturer,
      },
    });

    // 2. Relationships Group Node
    const relPos = positions["relationships"] || { x: 80, y: 140 };
    newNodes.push({
      id: "relationships",
      type: "relationshipGroupNode",
      position: relPos,
      data: {
        count: people.length,
        expanded: expandRelationships,
        onToggleExpand: () => setExpandRelationships((prev) => !prev),
      },
    });

    // Edge Course -> Relationships
    newEdges.push({
      id: "edge-course-relationships",
      source: "course",
      target: "relationships",
      type: "smoothstep",
      animated: true,
      style: { stroke: "#737373", strokeWidth: 1.5 },
    });

    // 3. Files Group Node
    const filesPos = positions["files"] || { x: 680, y: 140 };
    newNodes.push({
      id: "files",
      type: "filesGroupNode",
      position: filesPos,
      data: {
        count: documents.length,
        expanded: expandFiles,
        onToggleExpand: () => setExpandFiles((prev) => !prev),
      },
    });

    // Edge Course -> Files
    newEdges.push({
      id: "edge-course-files",
      source: "course",
      target: "files",
      type: "smoothstep",
      animated: true,
      style: { stroke: "#737373", strokeWidth: 1.5 },
    });

    // 4. Render Person Nodes if Relationships is expanded
    if (expandRelationships) {
      people.forEach((p, index) => {
        const nodeId = `person-${p.id}`;
        // Spread evenly in an arc/column on the left
        const defaultX = relPos.x - 220;
        const defaultY = relPos.y - 120 + index * 75;
        const pPos = positions[nodeId] || { x: defaultX, y: defaultY };

        const matchesSearch =
          !graphSearchQuery ||
          p.full_name.toLowerCase().includes(graphSearchQuery.toLowerCase()) ||
          (p.course_relationship?.relationship_type || "").toLowerCase().includes(graphSearchQuery.toLowerCase());

        newNodes.push({
          id: nodeId,
          type: "personNode",
          position: pPos,
          data: {
            id: p.id,
            fullName: p.full_name,
            nickname: p.nickname,
            relationshipType: p.course_relationship?.relationship_type || "Contact",
            major: p.major,
          },
          selected: selectedPerson?.id === p.id,
          style: { opacity: matchesSearch ? 1 : 0.3 },
        });

        newEdges.push({
          id: `edge-rel-${p.id}`,
          source: "relationships",
          target: nodeId,
          type: "smoothstep",
          style: { stroke: "#A3A3A3", strokeWidth: 1 },
        });
      });
    }

    // 5. Render Document Nodes if Files is expanded
    if (expandFiles) {
      documents.forEach((d, index) => {
        const nodeId = `doc-${d.id}`;
        // Spread evenly in an arc/column on the right
        const defaultX = filesPos.x + 220;
        const defaultY = filesPos.y - 120 + index * 75;
        const dPos = positions[nodeId] || { x: defaultX, y: defaultY };

        const matchesSearch =
          !graphSearchQuery ||
          d.original_file_name.toLowerCase().includes(graphSearchQuery.toLowerCase()) ||
          d.category.toLowerCase().includes(graphSearchQuery.toLowerCase());

        newNodes.push({
          id: nodeId,
          type: "documentNode",
          position: dPos,
          data: {
            id: d.id,
            originalFileName: d.original_file_name,
            category: d.category,
            mimeType: d.mime_type,
            fileSize: d.file_size,
          },
          selected: selectedDocument?.id === d.id,
          style: { opacity: matchesSearch ? 1 : 0.3 },
        });

        newEdges.push({
          id: `edge-files-${d.id}`,
          source: "files",
          target: nodeId,
          type: "smoothstep",
          style: { stroke: "#A3A3A3", strokeWidth: 1 },
        });
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [
    course,
    people,
    documents,
    expandRelationships,
    expandFiles,
    savedLayout,
    graphSearchQuery,
    selectedPerson,
    selectedDocument,
    setNodes,
    setEdges,
  ]);

  // Node Drag Stop -> Save Positions
  const onNodeDragStop = useCallback(
    (_: MouseEvent | TouchEvent, node: Node) => {
      setNodes((currentNodes) => {
        const updatedPositions: Record<string, { x: number; y: number }> = {
          ...(savedLayout?.positions || {}),
        };
        currentNodes.forEach((n) => {
          updatedPositions[n.id] = { x: n.position.x, y: n.position.y };
        });

        const currentViewport = savedLayout?.viewport || { x: 0, y: 0, zoom: 1 };
        DataRepository.saveCourseGraphLayout(courseId, updatedPositions, currentViewport);

        setSavedLayout((prev) => ({
          course_id: courseId,
          user_id: prev?.user_id || "",
          positions: updatedPositions,
          viewport: currentViewport,
          updated_at: new Date().toISOString(),
        }));

        return currentNodes;
      });
    },
    [courseId, savedLayout, setNodes]
  );

  // Handle Node Click
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id === "course") {
        setSelectedCourse(true);
        setSelectedPerson(null);
        setSelectedDocument(null);
      } else if (node.id === "relationships") {
        setExpandRelationships((prev) => !prev);
      } else if (node.id === "files") {
        setExpandFiles((prev) => !prev);
      } else if (node.id.startsWith("person-")) {
        const personId = node.id.replace("person-", "");
        const p = people.find((item) => item.id === personId);
        if (p) {
          setSelectedPerson(p);
          setSelectedCourse(false);
          setSelectedDocument(null);
        }
      } else if (node.id.startsWith("doc-")) {
        const docId = node.id.replace("doc-", "");
        const d = documents.find((item) => item.id === docId);
        if (d) {
          setSelectedDocument(d);
          setSelectedCourse(false);
          setSelectedPerson(null);
        }
      }
    },
    [people, documents]
  );

  // Reset Layout to balanced structure
  const handleResetLayout = () => {
    const defaultPositions: Record<string, { x: number; y: number }> = {
      course: { x: 380, y: 220 },
      relationships: { x: 80, y: 140 },
      files: { x: 680, y: 140 },
    };

    people.forEach((p, idx) => {
      defaultPositions[`person-${p.id}`] = { x: -140, y: 40 + idx * 75 };
    });

    documents.forEach((d, idx) => {
      defaultPositions[`doc-${d.id}`] = { x: 900, y: 40 + idx * 75 };
    });

    const defaultViewport = { x: 50, y: 50, zoom: 0.9 };
    DataRepository.saveCourseGraphLayout(courseId, defaultPositions, defaultViewport);
    setSavedLayout({
      course_id: courseId,
      user_id: "",
      positions: defaultPositions,
      viewport: defaultViewport,
      updated_at: new Date().toISOString(),
    });

    fitView({ duration: 500 });
    toast.success("Graph layout reset");
  };

  // Node CRUD & Relationship Handlers
  const handleAddNewPerson = async (data: any) => {
    try {
      const newPerson = await DataRepository.createPerson(data.personData);
      await DataRepository.linkPersonToCourse({
        course_id: courseId,
        person_id: newPerson.id,
        relationship_type: data.relationship.relationship_type,
        knowledge_topics: data.relationship.knowledge_topics,
        context_note: data.relationship.context_note,
      });
      setExpandRelationships(true);
      await loadData();
      toast.success("Contact added and connected to course");
    } catch {
      toast.error("Failed to add person");
    }
  };

  const handleLinkExistingPerson = async (personId: string, relationship: any) => {
    try {
      await DataRepository.linkPersonToCourse({
        course_id: courseId,
        person_id: personId,
        relationship_type: relationship.relationship_type,
        knowledge_topics: relationship.knowledge_topics,
        context_note: relationship.context_note,
      });
      setExpandRelationships(true);
      await loadData();
      toast.success("Person linked to course");
    } catch {
      toast.error("Failed to link person");
    }
  };

  const handleUpdatePerson = async (personId: string, data: any) => {
    try {
      await DataRepository.updatePerson(personId, data);
      await loadData();
      const updated = await DataRepository.getPerson(personId);
      if (updated) setSelectedPerson(updated);
      toast.success("Person information updated");
    } catch {
      toast.error("Failed to update person");
    }
  };

  const handleUpdateRelationship = async (
    personId: string,
    relType: RelationshipType,
    topics: string[],
    contextNote: string
  ) => {
    try {
      await DataRepository.linkPersonToCourse({
        course_id: courseId,
        person_id: personId,
        relationship_type: relType,
        knowledge_topics: topics,
        context_note: contextNote,
      });
      await loadData();
    } catch {
      toast.error("Failed to update relationship");
    }
  };

  const handleUnlinkPerson = async (personId: string) => {
    try {
      await DataRepository.unlinkPersonFromCourse(courseId, personId);
      setSelectedPerson(null);
      await loadData();
      toast.success("Person removed from course");
    } catch {
      toast.error("Failed to unlink person");
    }
  };

  const handleDeletePerson = async (personId: string) => {
    try {
      await DataRepository.deletePerson(personId);
      setSelectedPerson(null);
      await loadData();
      toast.success("Person deleted permanently");
    } catch {
      toast.error("Failed to delete person");
    }
  };

  // Document Handlers
  const handleUploadDocument = async (docData: any) => {
    try {
      await DataRepository.uploadDocument(docData, courseId);
      setExpandFiles(true);
      await loadData();
      toast.success("Document uploaded and attached");
    } catch {
      toast.error("Failed to upload document");
    }
  };

  const handleLinkExistingDocument = async (documentId: string) => {
    try {
      await DataRepository.linkDocumentToCourse(courseId, documentId);
      setExpandFiles(true);
      await loadData();
      toast.success("Document attached to course");
    } catch {
      toast.error("Failed to link document");
    }
  };

  const handleUpdateDocument = async (docId: string, data: any) => {
    try {
      await DataRepository.updateDocument(docId, data);
      await loadData();
      const updated = await DataRepository.getDocument(docId);
      if (updated) setSelectedDocument(updated);
      toast.success("Document metadata updated");
    } catch {
      toast.error("Failed to update document");
    }
  };

  const handleUnlinkDocument = async (docId: string) => {
    try {
      await DataRepository.unlinkDocumentFromCourse(courseId, docId);
      setSelectedDocument(null);
      await loadData();
      toast.success("Document removed from course");
    } catch {
      toast.error("Failed to remove document");
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await DataRepository.deleteDocument(docId);
      setSelectedDocument(null);
      await loadData();
      toast.success("Document deleted permanently");
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const handleUpdateCourse = async (data: any) => {
    try {
      await DataRepository.updateCourse(courseId, data);
      await loadData();
      toast.success("Course details updated");
    } catch {
      toast.error("Failed to update course");
    }
  };

  // Compute unlinked contacts and documents for the dialogs
  const availablePeopleToLink = useMemo(() => {
    const connectedIds = new Set(people.map((p) => p.id));
    return allPeople.filter((p) => !connectedIds.has(p.id));
  }, [allPeople, people]);

  const availableDocsToLink = useMemo(() => {
    const connectedIds = new Set(documents.map((d) => d.id));
    return allDocuments.filter((d) => !connectedIds.has(d.id));
  }, [allDocuments, documents]);

  if (!course) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        Loading neural network...
      </div>
    );
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-background">
      {/* Top Floating Graph Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-card/90 backdrop-blur-sm border border-border p-1.5 rounded-md shadow-sm">
        <div className="flex items-center space-x-1.5 px-2 border-r border-border">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={graphSearchQuery}
            onChange={(e) => setGraphSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="h-7 w-32 md:w-44 border-0 shadow-none px-1 text-xs focus-visible:ring-0 bg-transparent"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setAddPersonOpen(true)}
        >
          <UserPlus className="h-3 w-3 mr-1" />
          Connect Person
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setUploadDocOpen(true)}
        >
          <FileUp className="h-3 w-3 mr-1" />
          Attach File
        </Button>

        <Button
          variant="ghost"
          size="iconSm"
          className="h-7 w-7"
          onClick={() => fitView({ duration: 400 })}
          title="Fit view to screen"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="iconSm"
          className="h-7 w-7"
          onClick={handleResetLayout}
          title="Reset neural layout"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2.5}
        defaultEdgeOptions={{
          style: { stroke: "#A3A3A3", strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} color="#D4D4D4" className="dark:!opacity-20" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>

      {/* Inspector Detail Panels */}
      {selectedCourse && (
        <CourseDetailPanel
          course={course}
          peopleCount={people.length}
          documentsCount={documents.length}
          onClose={() => setSelectedCourse(false)}
          onEditCourse={() => setEditCourseOpen(true)}
        />
      )}

      {selectedPerson && (
        <PersonDetailPanel
          person={selectedPerson}
          courseId={courseId}
          onClose={() => setSelectedPerson(null)}
          onUpdatePerson={handleUpdatePerson}
          onUpdateRelationship={handleUpdateRelationship}
          onUnlinkFromCourse={handleUnlinkPerson}
          onDeletePerson={handleDeletePerson}
        />
      )}

      {selectedDocument && (
        <DocumentDetailPanel
          document={selectedDocument}
          courseId={courseId}
          onClose={() => setSelectedDocument(null)}
          onUpdateDocument={handleUpdateDocument}
          onUnlinkFromCourse={handleUnlinkDocument}
          onDeleteDocument={handleDeleteDocument}
        />
      )}

      {/* Dialogs */}
      <AddPersonDialog
        open={addPersonOpen}
        onOpenChange={setAddPersonOpen}
        availablePeople={availablePeopleToLink}
        courseId={courseId}
        onAddNewPerson={handleAddNewPerson}
        onLinkExistingPerson={handleLinkExistingPerson}
      />

      <UploadDocumentDialog
        open={uploadDocOpen}
        onOpenChange={setUploadDocOpen}
        availableDocuments={availableDocsToLink}
        courseId={courseId}
        onUploadDocument={handleUploadDocument}
        onLinkExistingDocument={handleLinkExistingDocument}
      />

      <CourseDialog
        open={editCourseOpen}
        onOpenChange={setEditCourseOpen}
        semesterId={semesterId}
        course={course}
        onSave={handleUpdateCourse}
      />
    </div>
  );
}

export function CourseGraphCanvas(props: CourseGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <InnerGraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
