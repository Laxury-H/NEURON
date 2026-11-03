"use client";

import React, { useState, useEffect } from "react";
import { DocumentItem, DocumentCategory } from "@/types/database";
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
  ExternalLink,
} from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { toast } from "sonner";

interface DocumentDetailPanelProps {
  document: DocumentItem | null;
  courseId: string;
  onClose: () => void;
  onUpdateDocument: (
    documentId: string,
    data: { original_file_name: string; category: DocumentCategory; description?: string | null }
  ) => Promise<void>;
  onUnlinkFromCourse: (documentId: string) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
}

export function DocumentDetailPanel({
  document,
  courseId,
  onClose,
  onUpdateDocument,
  onUnlinkFromCourse,
  onDeleteDocument,
}: DocumentDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("Notes");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (document) {
      setFileName(document.original_file_name);
      setCategory(document.category);
      setDescription(document.description || "");
      setIsEditing(false);
    }
  }, [document]);

  if (!document) return null;

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
    <div className="absolute top-0 right-0 bottom-0 w-80 md:w-96 border-l border-border bg-background shadow-xl z-30 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4 bg-muted/40">
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
            size="iconSm"
            onClick={onClose}
            title="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {isEditing ? (
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
            <div className="flex items-center space-x-2">
              <Button
                variant="default"
                size="sm"
                className="w-full text-xs"
                onClick={handleDownload}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download File
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
    </div>
  );
}
