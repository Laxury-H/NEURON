"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DocumentItem, DocumentCategory } from "@/types/database";
import { Settings2, Download, HardDrive, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";

interface AdvancedDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentItem | null;
  onSave: (
    documentId: string,
    data: { original_file_name: string; category: DocumentCategory; description?: string | null }
  ) => Promise<void>;
}

const CATEGORIES: DocumentCategory[] = [
  "Lecture",
  "Assignment",
  "Past Exam",
  "Textbook",
  "Notes",
  "Reference",
  "Other",
];

export function AdvancedDocumentDialog({
  open,
  onOpenChange,
  document,
  onSave,
}: AdvancedDocumentDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("Notes");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (document) {
      setName(document.original_file_name);
      setCategory(document.category);
      setDescription(document.description || "");
    }
  }, [document, open]);

  if (!document) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(document.id, {
        original_file_name: name.trim(),
        category,
        description: description.trim() || null,
      });
      onOpenChange(false);
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
      const dummyContent = `NEURON Academic Document Export\n\nTitle: ${document.original_file_name}\nCategory: ${document.category}\nUploaded: ${document.uploaded_at}\nDescription: ${document.description || "N/A"}`;
      const blob = new Blob([dummyContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = document.original_file_name.endsWith(".txt")
        ? document.original_file_name
        : `${document.original_file_name}.txt`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${document.original_file_name}`);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border border-border p-5">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center space-x-2">
            <Settings2 className="h-4 w-4" />
            <span>Advanced Document Settings</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* File Name */}
          <div className="space-y-1.5">
            <Label htmlFor="advFileName" className="text-xs">
              File Name
            </Label>
            <Input
              id="advFileName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xs h-8 font-mono"
              required
            />
          </div>

          {/* Category Chips */}
          <div className="space-y-1.5">
            <Label className="text-xs">Academic Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-2.5 py-1 rounded-sm text-xs font-mono transition-colors border ${
                      isSelected
                        ? "border-foreground bg-primary text-primary-foreground font-semibold"
                        : "border-border bg-background text-muted-foreground hover:border-neutral-400 hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description / Study Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="advDesc" className="text-xs">
              Study Notes & Annotations
            </Label>
            <Textarea
              id="advDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add summary notes, exam coverage chapters, or formula references..."
              className="text-xs min-h-[75px] resize-none"
            />
          </div>

          {/* Metadata Section */}
          <div className="p-3 rounded-sm border border-border bg-muted/30 space-y-2 text-xs">
            <div className="font-mono text-[10px] uppercase text-muted-foreground font-semibold">
              File Metadata & Diagnostics
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center space-x-1.5 text-muted-foreground">
                <HardDrive className="h-3 w-3 shrink-0" />
                <span>Size:</span>
                <span className="font-mono text-foreground font-medium">
                  {formatFileSize(document.file_size)}
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-muted-foreground">
                <FileText className="h-3 w-3 shrink-0" />
                <span>Format:</span>
                <span className="font-mono text-foreground uppercase font-medium">
                  {document.mime_type?.split("/")[1] || "FILE"}
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-muted-foreground col-span-2">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>Uploaded:</span>
                <span className="font-mono text-foreground">
                  {new Date(document.uploaded_at).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between border-t border-border/50">
              <span className="text-[10px] text-muted-foreground font-mono">
                Storage: {document.storage_path ? "Cloud Attached" : "Local Vault"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 font-mono"
                onClick={handleDownload}
              >
                <Download className="h-3 w-3 mr-1" />
                Download Raw File
              </Button>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="text-xs h-7"
              disabled={saving || !name.trim()}
            >
              {saving ? "Saving..." : "Apply Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
