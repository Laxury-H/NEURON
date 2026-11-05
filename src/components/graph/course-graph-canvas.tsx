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
  OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Course, Person, DocumentItem, DocumentCategory, CourseGraphLayout, RelationshipType, Concept } from "@/types/database";
import { DataRepository } from "@/lib/data/repository";
import { useTheme } from "@/components/theme-provider";
import { CourseNode } from "./nodes/course-node";
import { RelationshipGroupNode } from "./nodes/relationship-group-node";
import { FilesGroupNode } from "./nodes/files-group-node";
import { PersonNode } from "./nodes/person-node";
import { DocumentNode } from "./nodes/document-node";
import { ConceptNode } from "./nodes/concept-node";
import { computeConcentricLayout } from "./layout/radial-layout";

import { CourseDetailPanel } from "./course-detail-panel";
import { PersonDetailPanel } from "./person-detail-panel";
import { DocumentDetailPanel } from "./document-detail-panel";
import { AddPersonDialog } from "./add-person-dialog";
import { UploadDocumentDialog } from "./upload-document-dialog";
import { CourseDialog } from "@/components/courses/course-dialog";
import { DocumentContextMenu } from "./document-context-menu";
import { RenameDocumentDialog } from "./rename-document-dialog";
import { MoveDocumentDialog } from "./move-document-dialog";
import { AdvancedDocumentDialog } from "./advanced-document-dialog";
import { DocumentPreviewDialog } from "./document-preview-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Maximize2,
  RotateCcw,
  UserPlus,
  FileUp,
  Search,
  UnfoldHorizontal,
  FoldHorizontal,
  Map,
  HelpCircle,
  Keyboard,
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
  conceptNode: ConceptNode,
};

function InnerGraphCanvas({ courseId, semesterId }: CourseGraphCanvasProps) {
  const { fitView, getViewport, setViewport } = useReactFlow();
  const { theme, pureBw } = useTheme();

  const [course, setCourse] = useState<Course | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [allDocuments, setAllDocuments] = useState<DocumentItem[]>([]);
  const [savedLayout, setSavedLayout] = useState<CourseGraphLayout | null>(null);

  // Expansion state — default to expanded so all files & people nodes are immediately visible
  const [expandRelationships, setExpandRelationships] = useState<boolean>(true);
  const [expandFiles, setExpandFiles] = useState<boolean>(true);
  const [showMiniMap, setShowMiniMap] = useState<boolean>(false);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);

  // Responsive MiniMap default: only show by default on tablet/desktop (>= 768px), default hidden on mobile
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setShowMiniMap(true);
    }
  }, []);

  // Inspector Panel State
  const [selectedCourse, setSelectedCourse] = useState<boolean>(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);

  // Dialogs
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [editCourseOpen, setEditCourseOpen] = useState(false);

  // Document Context Menu & Dialogs State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    document: DocumentItem;
  } | null>(null);
  const [docForRename, setDocForRename] = useState<DocumentItem | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [docForMove, setDocForMove] = useState<DocumentItem | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [docForAdvanced, setDocForAdvanced] = useState<DocumentItem | null>(null);
  const [advancedDialogOpen, setAdvancedDialogOpen] = useState(false);
  const [docForPreview, setDocForPreview] = useState<DocumentItem | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

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
        setConcepts(data.concepts || []);
        setAllPeople(data.allPeople);
        setAllDocuments(data.allDocuments);
        setSavedLayout(data.layout);
        if (data.layout?.viewport) {
          setTimeout(() => {
            setViewport(data.layout!.viewport, { duration: 300 });
          }, 80);
        }
      }
    } catch {
      toast.error("Failed to load course graph data");
    }
  }, [courseId, setViewport]);

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

    const centralEdgeStroke = pureBw
      ? (theme === "dark" ? "#FFFFFF" : "#000000")
      : "#737373";
    const clusterEdgeStroke = pureBw
      ? (theme === "dark" ? "#FFFFFF" : "#000000")
      : "#A3A3A3";

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
      style: { stroke: centralEdgeStroke, strokeWidth: pureBw ? 2 : 1.5 },
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
      style: { stroke: centralEdgeStroke, strokeWidth: pureBw ? 2 : 1.5 },
    });

    // Calculate radial concentric coordinates for leaf nodes
    const concentric = computeConcentricLayout(coursePos, people.length, documents.length, concepts.length);

    // 4. Render Person Nodes if Relationships is expanded
    if (expandRelationships) {
      people.forEach((p, index) => {
        const nodeId = `person-${p.id}`;
        const defaultX = concentric.people[index]?.x ?? (relPos.x - 220);
        const defaultY = concentric.people[index]?.y ?? (relPos.y - 120 + index * 75);
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
          style: { stroke: clusterEdgeStroke, strokeWidth: pureBw ? 2 : 1 },
        });
      });
    }

    // 5. Render Document Nodes if Files is expanded
    if (expandFiles) {
      documents.forEach((d, index) => {
        const nodeId = `doc-${d.id}`;
        const defaultX = concentric.docs[index]?.x ?? (filesPos.x + 220);
        const defaultY = concentric.docs[index]?.y ?? (filesPos.y - 120 + index * 75);
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
            onPreviewClick: () => {
              setDocForPreview(d);
              setPreviewDialogOpen(true);
            },
            onContextMenuTrigger: (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                document: d,
              });
            },
          },
          selected: selectedDocument?.id === d.id,
          style: { opacity: matchesSearch ? 1 : 0.3 },
        });

        newEdges.push({
          id: `edge-files-${d.id}`,
          source: "files",
          target: nodeId,
          type: "smoothstep",
          style: { stroke: clusterEdgeStroke, strokeWidth: pureBw ? 2 : 1 },
        });
      });
    }

    // 6. Render Concept Nodes (North Arc / Top Sector)
    concepts.forEach((concept, index) => {
      const nodeId = `concept-${concept.id}`;
      const defaultX = concentric.concepts[index]?.x ?? (coursePos.x - 120 + index * 120);
      const defaultY = concentric.concepts[index]?.y ?? (coursePos.y - 180);
      const cPos = positions[nodeId] || { x: defaultX, y: defaultY };

      const matchesSearch =
        !graphSearchQuery ||
        concept.name.toLowerCase().includes(graphSearchQuery.toLowerCase()) ||
        (concept.description && concept.description.toLowerCase().includes(graphSearchQuery.toLowerCase()));

      newNodes.push({
        id: nodeId,
        type: "conceptNode",
        position: cPos,
        data: {
          id: concept.id,
          label: concept.name,
          description: concept.description,
          courseCount: 1,
          docCount: 0,
        },
        style: { opacity: matchesSearch ? 1 : 0.3 },
      });

      newEdges.push({
        id: `edge-course-${concept.id}`,
        source: "course",
        target: nodeId,
        type: "smoothstep",
        animated: true,
        style: { stroke: centralEdgeStroke, strokeWidth: pureBw ? 2 : 1.5 },
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [
    course,
    people,
    documents,
    concepts,
    expandRelationships,
    expandFiles,
    savedLayout,
    graphSearchQuery,
    selectedPerson,
    selectedDocument,
    pureBw,
    theme,
    setNodes,
    setEdges,
  ]);

  // Auto-fit view when nodes are first populated or clusters toggled
  useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.25, duration: 300 });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [courseId, fitView, nodes.length, expandRelationships, expandFiles]);

  // Node Drag Stop -> Save Positions
  const onNodeDragStop: OnNodeDrag = useCallback(
    (_, node) => {
      setNodes((currentNodes) => {
        const updatedPositions: Record<string, { x: number; y: number }> = {
          ...(savedLayout?.positions || {}),
        };
        currentNodes.forEach((n) => {
          updatedPositions[n.id] = { x: n.position.x, y: n.position.y };
        });
        if (node) {
          updatedPositions[node.id] = { x: node.position.x, y: node.position.y };
        }

        const currentViewport = getViewport();
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
    [courseId, savedLayout, getViewport, setNodes]
  );

  // Pan / Zoom change -> Save Viewport
  const onMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
      if (!course) return;
      const positions = savedLayout?.positions || {};
      DataRepository.saveCourseGraphLayout(courseId, positions, viewport);
      setSavedLayout((prev) => ({
        course_id: courseId,
        user_id: prev?.user_id || "",
        positions: prev?.positions || {},
        viewport,
        updated_at: new Date().toISOString(),
      }));
    },
    [courseId, course, savedLayout]
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

  // Handle Node Context Menu (Right Click)
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.type === "documentNode" || node.id.startsWith("doc-")) {
        event.preventDefault();
        event.stopPropagation();
        const docId = (node.data as any)?.id || node.id.replace("doc-", "");
        const doc = documents.find((d) => d.id === docId);
        if (doc) {
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            document: doc,
          });
        }
      }
    },
    [documents]
  );

  // Reset Layout to balanced structure
  const handleResetLayout = useCallback(() => {
    const courseCenter = { x: 380, y: 220 };
    const defaultPositions: Record<string, { x: number; y: number }> = {
      course: courseCenter,
      relationships: { x: 80, y: 140 },
      files: { x: 680, y: 140 },
    };

    const concentric = computeConcentricLayout(courseCenter, people.length, documents.length);

    people.forEach((p, idx) => {
      defaultPositions[`person-${p.id}`] = concentric.people[idx] || { x: -140, y: 40 + idx * 75 };
    });

    documents.forEach((d, idx) => {
      defaultPositions[`doc-${d.id}`] = concentric.docs[idx] || { x: 900, y: 40 + idx * 75 };
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
  }, [courseId, people, documents, fitView]);

  // Keyboard Shortcuts for Canvas Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        fitView({ duration: 400 });
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleResetLayout();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setShowMiniMap((prev) => !prev);
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        const nextState = !(expandRelationships && expandFiles);
        setExpandRelationships(nextState);
        setExpandFiles(nextState);
      } else if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      } else if (e.key === "F2" && selectedDocument) {
        e.preventDefault();
        setDocForRename(selectedDocument);
        setRenameDialogOpen(true);
      } else if (e.key === " " && selectedDocument) {
        e.preventDefault();
        setDocForPreview(selectedDocument);
        setPreviewDialogOpen(true);
      } else if (e.key === "Escape") {
        setSelectedCourse(false);
        setSelectedPerson(null);
        setSelectedDocument(null);
        setShortcutsOpen(false);
        setContextMenu(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fitView, handleResetLayout, expandRelationships, expandFiles, selectedDocument]);

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

  const handleRenameSubmit = async (newName: string) => {
    if (!docForRename) return;
    try {
      await handleUpdateDocument(docForRename.id, {
        original_file_name: newName,
        category: docForRename.category,
        description: docForRename.description,
      });
      toast.success("Document renamed");
    } catch {
      toast.error("Failed to rename document");
    }
  };

  const handleMoveSubmit = async (targetCourseId: string) => {
    if (!docForMove) return;
    try {
      await DataRepository.moveDocument(docForMove.id, courseId, targetCourseId);
      toast.success("Document moved to destination course");
      await loadData();
      setSelectedDocument(null);
    } catch {
      toast.error("Failed to move document");
    }
  };

  const handleLinkAlsoSubmit = async (targetCourseId: string) => {
    if (!docForMove) return;
    try {
      await DataRepository.linkDocumentToCourse(targetCourseId, docForMove.id);
      toast.success("Document linked to additional course");
      await loadData();
    } catch {
      toast.error("Failed to link document");
    }
  };

  const handleQuickChangeCategory = async (doc: DocumentItem, newCategory: DocumentCategory) => {
    try {
      await handleUpdateDocument(doc.id, {
        original_file_name: doc.original_file_name,
        category: newCategory,
        description: doc.description,
      });
      toast.success(`Category updated to ${newCategory}`);
    } catch {
      toast.error("Failed to update category");
    }
  };

  const handleDownloadDoc = (doc: DocumentItem) => {
    if (doc.download_url) {
      const a = window.document.createElement("a");
      a.href = doc.download_url;
      a.download = doc.original_file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      toast.success(`Downloading ${doc.original_file_name}`);
    } else {
      const dummyContent = `NEURON Document Export\n\nTitle: ${doc.original_file_name}\nCategory: ${doc.category}\nUploaded: ${doc.uploaded_at}\nDescription: ${doc.description || "N/A"}`;
      const blob = new Blob([dummyContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = doc.original_file_name.endsWith(".txt")
        ? doc.original_file_name
        : `${doc.original_file_name}.txt`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${doc.original_file_name}`);
    }
  };

  const handleAdvancedSave = async (
    docId: string,
    data: { original_file_name: string; category: DocumentCategory; description?: string | null }
  ) => {
    try {
      await handleUpdateDocument(docId, data);
      toast.success("Advanced settings saved");
    } catch {
      toast.error("Failed to save advanced settings");
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
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex max-w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-2rem)] items-center gap-1.5 bg-card/90 backdrop-blur-sm border border-border p-1 sm:p-1.5 rounded-md shadow-sm overflow-x-auto scrollbar-none">
        <div className="flex items-center space-x-1 sm:space-x-1.5 px-1.5 sm:px-2 border-r border-border shrink-0">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={graphSearchQuery}
            onChange={(e) => setGraphSearchQuery(e.target.value)}
            placeholder="Search..."
            className="h-7 w-28 sm:w-44 md:w-56 border-0 shadow-none px-1 text-xs focus-visible:ring-0 bg-transparent shrink-0"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2 shrink-0"
          onClick={() => setAddPersonOpen(true)}
          title="Connect Person"
        >
          <UserPlus className="h-3 w-3 sm:mr-1 shrink-0" />
          <span className="hidden sm:inline">Connect Person</span>
          <span className="sm:hidden text-[11px]">Person</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2 shrink-0"
          onClick={() => setUploadDocOpen(true)}
          title="Attach File"
        >
          <FileUp className="h-3 w-3 sm:mr-1 shrink-0" />
          <span className="hidden sm:inline">Attach File</span>
          <span className="sm:hidden text-[11px]">File</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2 shrink-0"
          onClick={() => {
            const nextState = !(expandRelationships && expandFiles);
            setExpandRelationships(nextState);
            setExpandFiles(nextState);
          }}
          title={expandRelationships && expandFiles ? "Collapse clusters (E)" : "Expand all clusters (E)"}
        >
          {expandRelationships && expandFiles ? (
            <>
              <FoldHorizontal className="h-3 w-3 sm:mr-1 shrink-0" />
              <span className="hidden md:inline">Collapse</span>
            </>
          ) : (
            <>
              <UnfoldHorizontal className="h-3 w-3 sm:mr-1 shrink-0" />
              <span className="hidden md:inline">Expand</span>
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          size="iconSm"
          className="h-7 w-7 shrink-0"
          onClick={() => fitView({ duration: 400 })}
          title="Fit view to screen (F)"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="iconSm"
          className="h-7 w-7 shrink-0"
          onClick={handleResetLayout}
          title="Reset neural layout (R)"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant={showMiniMap ? "secondary" : "ghost"}
          size="iconSm"
          className="h-7 w-7 shrink-0"
          onClick={() => setShowMiniMap((prev) => !prev)}
          title="Toggle MiniMap (M)"
        >
          <Map className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="iconSm"
          className="h-7 w-7 shrink-0"
          onClick={() => setShortcutsOpen(true)}
          title="Keyboard Shortcuts (?)"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        className="w-full h-full"
        style={{ width: "100%", height: "100%" }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onMoveEnd={onMoveEnd}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2.5}
        defaultEdgeOptions={{
          style: { stroke: "#A3A3A3", strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          gap={24}
          size={1}
          color={pureBw ? (theme === "dark" ? "#FFFFFF" : "#000000") : (theme === "dark" ? "#404040" : "#D4D4D4")}
          className={pureBw ? "!opacity-100" : "dark:!opacity-20"}
        />
        <Controls showInteractive={false} position="bottom-left" className="!bottom-3 !left-3 sm:!bottom-4 sm:!left-4" />
        {showMiniMap && (
          <MiniMap
            nodeStrokeColor={pureBw ? (theme === "dark" ? "#FFFFFF" : "#000000") : "#737373"}
            nodeColor={pureBw ? (theme === "dark" ? "#FFFFFF" : "#000000") : (theme === "dark" ? "#FFFFFF" : "#171717")}
            nodeBorderRadius={pureBw ? 0 : 3}
            maskColor={pureBw ? (theme === "dark" ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)") : "rgba(0, 0, 0, 0.45)"}
            className="!bottom-3 !right-3 sm:!bottom-4 sm:!right-4 !w-28 !h-20 sm:!w-44 sm:!h-28 !bg-card/90 !border !border-border !rounded-md !shadow-md backdrop-blur-sm"
          />
        )}
      </ReactFlow>

      {/* Mobile Backdrop for Inspector Panels */}
      {(selectedCourse || selectedPerson || selectedDocument) && (
        <div
          className="fixed inset-0 z-30 bg-black/40 sm:hidden"
          onClick={() => {
            setSelectedCourse(false);
            setSelectedPerson(null);
            setSelectedDocument(null);
          }}
        />
      )}

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
          onMoveDocument={(doc) => {
            setDocForMove(doc);
            setMoveDialogOpen(true);
          }}
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

      {/* Bottom Status Pill — Safely positioned on bottom-left beside canvas controls */}
      <div className="absolute bottom-3 left-14 sm:bottom-4 sm:left-14 z-10 flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-2.5 py-1 rounded-full border border-border bg-card/90 backdrop-blur-sm text-[10px] font-mono text-muted-foreground shadow-sm pointer-events-none max-w-[calc(100vw-12rem)] truncate">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-pulse shrink-0" />
        <span className="hidden xs:inline">{people.length} People</span>
        <span className="hidden xs:inline">•</span>
        <span className="hidden xs:inline">{documents.length} Files</span>
        <span className="hidden xs:inline">•</span>
        <span className="truncate">Auto-saved</span>
      </div>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-md border border-border p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono flex items-center space-x-2">
              <Keyboard className="h-4 w-4" />
              <span>Canvas Shortcuts & Gestures</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Pan Canvas</span>
              <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">Space + Drag / Scroll</kbd>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Zoom In / Out</span>
              <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">Pinch / Ctrl + Scroll</kbd>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Fit View to Screen</span>
              <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">F</kbd>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Reset Layout Coordinates</span>
              <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">R</kbd>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Toggle Expand / Collapse All</span>
              <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">E</kbd>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Toggle MiniMap</span>
              <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">M</kbd>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Rename Selected File</span>
              <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">F2 / Right Click</kbd>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Quick Preview Selected File</span>
              <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">Space / Eye Icon</kbd>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Global Spotlight Search</span>
              <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">⌘K / Ctrl+K</kbd>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Close Active Panel</span>
              <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">ESC</kbd>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Document Context Menu (Right Click & Quick Trigger) */}
      {contextMenu && (
        <DocumentContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          document={contextMenu.document}
          onClose={() => setContextMenu(null)}
          onPreview={(doc) => {
            setDocForPreview(doc);
            setPreviewDialogOpen(true);
          }}
          onRename={(doc) => {
            setDocForRename(doc);
            setRenameDialogOpen(true);
          }}
          onMove={(doc) => {
            setDocForMove(doc);
            setMoveDialogOpen(true);
          }}
          onChangeCategory={handleQuickChangeCategory}
          onAdvanced={(doc) => {
            setDocForAdvanced(doc);
            setAdvancedDialogOpen(true);
          }}
          onDownload={handleDownloadDoc}
          onUnlink={handleUnlinkDocument}
          onDelete={handleDeleteDocument}
        />
      )}

      {/* Rename Document Dialog */}
      <RenameDocumentDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        currentName={docForRename?.original_file_name || ""}
        onRename={handleRenameSubmit}
      />

      {/* Move / Reassign Document Dialog */}
      <MoveDocumentDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        documentTitle={docForMove?.original_file_name || ""}
        currentCourseId={courseId}
        onMove={handleMoveSubmit}
        onLinkAlso={handleLinkAlsoSubmit}
      />

      {/* Advanced Settings Document Dialog */}
      <AdvancedDocumentDialog
        open={advancedDialogOpen}
        onOpenChange={setAdvancedDialogOpen}
        document={docForAdvanced}
        onSave={handleAdvancedSave}
      />

      {/* In-App Document Preview Modal */}
      <DocumentPreviewDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        document={docForPreview}
        onDownload={() => docForPreview && handleDownloadDoc(docForPreview)}
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
