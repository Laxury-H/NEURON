"use client";

import React, { useState, useEffect } from "react";
import { DocumentItem, DocumentCategory, DocumentSummary } from "@/types/database";
import { DataRepository } from "@/lib/data/repository";
import { summarizeDocumentLocally } from "@/lib/ai/local-summarizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  FileText,
  Download,
  Calendar,
  HardDrive,
  BookOpen,
  Trash2,
  Unlink,
  Check,
  Edit2,
  Eye,
  FolderInput,
  Sparkles,
  Brain,
  RefreshCw,
} from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DocumentPreviewDialog } from "./document-preview-dialog";
import { KatexMath } from "@/components/ui/katex-math";
import { toast } from "sonner";

interface DocumentDetailPanelProps {
  document: DocumentItem | null;
  courseId?: string;
  onClose: () => void;
  onUpdateDocument: (
    documentId: string,
    data: { original_file_name: string; category: DocumentCategory; description?: string | null }
  ) => Promise<void>;
  onUnlinkFromCourse: (documentId: string) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
  onMoveDocument?: (document: DocumentItem) => void;
}

export function DocumentDetailPanel({
  document,
  courseId,
  onClose,
  onUpdateDocument,
  onUnlinkFromCourse,
  onDeleteDocument,
  onMoveDocument,
}: DocumentDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "ai">("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("Notes");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // AI Intelligence state
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [linkingConcept, setLinkingConcept] = useState<string | null>(null);
  const [linkedConcepts, setLinkedConcepts] = useState<Set<string>>(new Set());

  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (document) {
      setFileName(document.original_file_name);
      setCategory(document.category);
      setDescription(document.description || "");
      setIsEditing(false);

      // Load existing document summary from repository
      DataRepository.getDocumentSummary(document.id)
        .then((s) => {
          setSummary(s);
        })
        .catch(() => {});

      // Load linked concepts for this course
      if (courseId) {
        DataRepository.getCourseConcepts(courseId)
          .then((ccs) => {
            const names = new Set(
              ccs
                .map((c) => c.concept?.name?.toLowerCase())
                .filter(Boolean) as string[]
            );
            setLinkedConcepts(names);
          })
          .catch(() => {});
      }
    }
  }, [document, courseId]);

  if (!document) return null;

  const handleGenerateSynthesis = async () => {
    if (!document) return;
    setGeneratingSummary(true);
    try {
      let finalSummary: DocumentSummary;
      try {
        const res = await fetch("/api/ai/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: document.id,
            courseId: courseId || "general",
            fileName: document.original_file_name,
            rawTextContent: document.description || document.original_file_name,
            category: document.category,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          finalSummary = {
            id: crypto.randomUUID(),
            user_id: "",
            document_id: document.id,
            executive_summary: data.executiveSummary,
            key_takeaways: data.keyTakeaways,
            extracted_formulas: data.extractedFormulas,
            candidate_concepts: data.candidateConcepts,
            generated_at: data.generatedAt,
          };
        } else {
          throw new Error("Summarization API fallback");
        }
      } catch {
        // Deterministic local extraction fallback
        const local = summarizeDocumentLocally(
          document.description || document.original_file_name,
          document.original_file_name,
          document.category,
          document.id
        );
        finalSummary = {
          id: crypto.randomUUID(),
          user_id: "",
          document_id: document.id,
          executive_summary: local.executiveSummary,
          key_takeaways: local.keyTakeaways,
          extracted_formulas: local.extractedFormulas as any,
          candidate_concepts: local.candidateConcepts,
          generated_at: local.generatedAt,
        };
      }

      await DataRepository.saveDocumentSummary(finalSummary);
      setSummary(finalSummary);
      toast.success("AI synthesis generated and saved");
    } catch (err: any) {
      toast.error("Failed to generate synthesis", { description: err?.message });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleLinkConcept = async (conceptName: string) => {
    if (!courseId) {
      toast.error("Open a course view to link concepts");
      return;
    }
    setLinkingConcept(conceptName);
    try {
      const concept = await DataRepository.createConcept({
        name: conceptName,
        description: `Extracted from document ${document.original_file_name}`,
      });
      await DataRepository.linkConceptToCourse({
        course_id: courseId,
        concept_id: concept.id,
        source_type: "EXTRACTED_DOCUMENT",
        relevance_score: 0.95,
      });
      setLinkedConcepts((prev) => new Set([...prev, conceptName.toLowerCase()]));
      toast.success(`Linked concept "${conceptName}" to course`);
    } catch (err: any) {
      toast.error("Failed to link concept", { description: err?.message });
    } finally {
      setLinkingConcept(null);
    }
  };

  const handleSave = async () => {
    if (!fileName.trim()) return;
    setSaving(true);
    try {
      await onUpdateDocument(document.id, {
        original_file_name: fileName.trim(),
        category,
        description: description.trim() || null,
      });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (document.download_url) {
      const a = window.document.createElement("a");
      a.href = document.download_url;
      a.download = document.original_file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      toast.success(`Downloading ${document.original_file_name}`);
    } else {
      // Create a mock text blob download for demonstration if no raw URL
      const dummyContent = `NEURON Document Export\n\nTitle: ${document.original_file_name}\nCategory: ${document.category}\nUploaded: ${document.uploaded_at}\nDescription: ${document.description || "N/A"}`;
      const blob = new Blob([dummyContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = document.original_file_name.endsWith(".pdf")
        ? document.original_file_name.replace(".pdf", ".txt")
        : `${document.original_file_name}.txt`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Saved copy of ${document.original_file_name}`);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 max-w-full z-40 bg-background border-l border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-3.5 sm:p-4 bg-muted/40">
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border bg-card">
            <FileText className="h-4 w-4 text-foreground" />
          </div>
          <div className="truncate">
            <h3 className="font-semibold text-sm truncate" title={document.original_file_name}>
              {document.original_file_name}
            </h3>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {document.category}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setIsEditing(!isEditing)}
            title={isEditing ? "Cancel editing" : "Edit metadata"}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-foreground"
            title="Close panel"
            aria-label="Close detail panel"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-border bg-muted/20 px-4 pt-1 gap-4 text-xs font-mono shrink-0">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-2 border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-foreground text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`pb-2 border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === "ai"
              ? "border-foreground text-foreground font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-3 w-3" />
          <span>AI Intelligence</span>
          {summary && (
            <span className="h-1.5 w-1.5 rounded-full bg-foreground inline-block" />
          )}
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {activeTab === "ai" ? (
          <div className="space-y-4">
            {/* Header / Trigger Banner */}
            <div className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-3.5 w-3.5 text-foreground shrink-0" />
                <span className="font-mono text-[11px] font-semibold text-foreground">
                  Document Intelligence
                </span>
              </div>
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs font-mono"
                onClick={handleGenerateSynthesis}
                disabled={generatingSummary}
              >
                {generatingSummary ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Synthesizing...
                  </>
                ) : summary ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1" />
                    Generate Synthesis
                  </>
                )}
              </Button>
            </div>

            {generatingSummary && (
              <div className="p-6 text-center space-y-2 border border-border rounded-md bg-muted/20 animate-pulse">
                <div className="font-mono text-xs text-foreground font-semibold">
                  Extracting Academic Core &amp; Formulas...
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Running TF-IDF sentence extraction, LaTeX parsing, and concept tokenization.
                </p>
              </div>
            )}

            {!generatingSummary && !summary && (
              <div className="p-6 text-center space-y-3 border border-dashed border-border rounded-md bg-card">
                <Brain className="h-8 w-8 mx-auto text-muted-foreground opacity-60" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">No Synthesis Generated</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Generate an instant executive summary, 3-5 key takeaways, LaTeX mathematical equations, and candidate concept nodes.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs"
                  onClick={handleGenerateSynthesis}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Generate Synthesis
                </Button>
              </div>
            )}

            {!generatingSummary && summary && (
              <div className="space-y-4">
                {/* Executive Summary */}
                <div className="space-y-1.5 p-3 rounded-md border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border pb-1.5 mb-1.5">
                    <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                      [EXECUTIVE ABSTRACT]
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {new Date(summary.generated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">
                    {summary.executive_summary}
                  </p>
                </div>

                {/* Key Takeaways */}
                {summary.key_takeaways && summary.key_takeaways.length > 0 && (
                  <div className="space-y-2 p-3 rounded-md border border-border bg-card">
                    <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground block border-b border-border pb-1.5">
                      [KEY TAKEAWAYS] ({summary.key_takeaways.length})
                    </span>
                    <div className="space-y-2 pt-0.5">
                      {summary.key_takeaways.map((takeaway, idx) => (
                        <div key={idx} className="flex items-start space-x-2 text-xs">
                          <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5">
                            [{String(idx + 1).padStart(2, "0")}]
                          </span>
                          <span className="text-foreground leading-relaxed">{takeaway}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Formulas */}
                {summary.extracted_formulas && summary.extracted_formulas.length > 0 && (
                  <div className="space-y-2.5 p-3 rounded-md border border-border bg-card">
                    <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground block border-b border-border pb-1.5">
                      [CORE FORMULAS &amp; DEFINITIONS]
                    </span>
                    <div className="space-y-2">
                      {summary.extracted_formulas.map((form: any, idx: number) => {
                        const name = typeof form === "string" ? `Formula ${idx + 1}` : form.name;
                        const latex = typeof form === "string" ? form : form.latex;
                        const desc = typeof form === "object" ? form.description : null;
                        return (
                          <div
                            key={idx}
                            className="p-2 rounded border border-border bg-muted/30 space-y-1.5"
                          >
                            <div className="font-semibold text-xs text-foreground font-sans">
                              {name}
                            </div>
                            <div className="p-2 rounded border border-border bg-background overflow-x-auto text-foreground">
                              <KatexMath math={latex} displayMode={true} className="text-xs" />
                            </div>
                            {desc && (
                              <p className="text-[10px] text-muted-foreground leading-tight">
                                {desc}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Candidate Concepts */}
                {summary.candidate_concepts && summary.candidate_concepts.length > 0 && (
                  <div className="space-y-2 p-3 rounded-md border border-border bg-card">
                    <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground block border-b border-border pb-1.5">
                      [CANDIDATE CONCEPTS] ({summary.candidate_concepts.length})
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      Promote extracted topics into first-class knowledge graph nodes:
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {summary.candidate_concepts.map((concept, idx) => {
                        const isLinked = linkedConcepts.has(concept.toLowerCase());
                        const isProcessing = linkingConcept === concept;
                        return (
                          <button
                            key={idx}
                            onClick={() => !isLinked && handleLinkConcept(concept)}
                            disabled={isLinked || isProcessing || !courseId}
                            className={`flex items-center space-x-1 px-2 py-1 rounded-sm text-[11px] font-mono border transition-colors ${
                              isLinked
                                ? "bg-muted border-border text-foreground font-semibold cursor-default"
                                : "bg-card border-border hover:bg-muted text-foreground"
                            }`}
                            title={
                              isLinked
                                ? "Concept already linked to this course"
                                : courseId
                                ? "Click to link concept to this course graph"
                                : "Open course to link concept"
                            }
                          >
                            <Brain className="h-3 w-3 text-muted-foreground" />
                            <span>{concept}</span>
                            {isLinked ? (
                              <span className="text-[9px] text-muted-foreground ml-1">[✓ Linked]</span>
                            ) : (
                              <span className="text-[9px] text-muted-foreground ml-1">
                                {isProcessing ? "..." : "+ Link"}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : isEditing ? (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <Label>File Name</Label>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(val) => setCategory(val as DocumentCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lecture">Lecture</SelectItem>
                  <SelectItem value="Assignment">Assignment</SelectItem>
                  <SelectItem value="Past Exam">Past Exam</SelectItem>
                  <SelectItem value="Textbook">Textbook</SelectItem>
                  <SelectItem value="Notes">Notes</SelectItem>
                  <SelectItem value="Reference">Reference</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this document about? Key chapters or formulas..."
              />
            </div>

            <Button
              className="w-full mt-2"
              size="sm"
              onClick={handleSave}
              disabled={saving || !fileName.trim()}
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Quick Actions */}
            <div className={`grid ${onMoveDocument ? "grid-cols-3" : "grid-cols-2"} gap-1.5`}>
              <Button
                variant="default"
                size="sm"
                className="w-full text-xs"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                Preview
              </Button>
              {onMoveDocument && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => onMoveDocument(document)}
                >
                  <FolderInput className="h-3.5 w-3.5 mr-1" />
                  Move
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={handleDownload}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Download
              </Button>
            </div>

            {/* Document Metadata Card */}
            <div className="p-3 rounded-md border border-border bg-card space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Document Category
                </span>
                <Badge variant="default" className="text-[10px] font-mono uppercase">
                  {document.category}
                </Badge>
              </div>

              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center space-x-1.5">
                    <HardDrive className="h-3 w-3" />
                    <span>File Size</span>
                  </span>
                  <span className="font-mono text-foreground">
                    {formatSize(document.file_size)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center space-x-1.5">
                    <Calendar className="h-3 w-3" />
                    <span>Uploaded</span>
                  </span>
                  <span className="font-mono text-foreground">
                    {new Date(document.uploaded_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center space-x-1.5">
                    <FileText className="h-3 w-3" />
                    <span>Format</span>
                  </span>
                  <span className="font-mono text-foreground uppercase">
                    {document.mime_type.split("/")[1] || "Binary"}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                Description / Notes
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {document.description || "No description provided for this document."}
              </p>
            </div>

            {/* Associated Courses */}
            {document.associated_courses && document.associated_courses.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-border">
                <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground flex items-center space-x-1">
                  <BookOpen className="h-3 w-3" />
                  <span>Linked Courses ({document.associated_courses.length})</span>
                </span>
                <div className="space-y-1">
                  {document.associated_courses.map((ac) => (
                    <div
                      key={ac.id}
                      className="p-1.5 rounded border border-border bg-card flex items-center justify-between text-[11px]"
                    >
                      <span className="font-mono font-bold">{ac.course_code}</span>
                      <span className="text-muted-foreground truncate ml-2">
                        {ac.course_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-border p-3 bg-muted/20 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground h-8"
          onClick={() => setConfirmUnlinkOpen(true)}
          title="Remove from this course"
        >
          <Unlink className="h-3.5 w-3.5 mr-1" />
          Unlink Course
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 h-8"
          onClick={() => setConfirmDeleteOpen(true)}
          title="Delete document completely"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Delete
        </Button>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={confirmUnlinkOpen}
        onOpenChange={setConfirmUnlinkOpen}
        title="Remove Document from Course?"
        description={`This will unlink "${document.original_file_name}" from this course. The underlying file remains preserved in your library.`}
        confirmLabel="Unlink Document"
        onConfirm={() => onUnlinkFromCourse(document.id)}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete Document Permanently?"
        description={`Are you sure you want to permanently delete "${document.original_file_name}"? It will be removed from all associated courses and storage.`}
        confirmLabel="Delete Permanently"
        onConfirm={() => onDeleteDocument(document.id)}
      />

      <DocumentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        document={document}
        onDownload={handleDownload}
      />
    </div>
  );
}
