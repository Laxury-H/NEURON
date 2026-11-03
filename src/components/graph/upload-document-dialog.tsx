"use client";

import React, { useState, useRef } from "react";
import { DocumentItem, DocumentCategory } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, FileUp, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableDocuments: DocumentItem[];
  courseId?: string;
  onUploadDocument: (data: {
    original_file_name: string;
    category: DocumentCategory;
    mime_type: string;
    file_size: number;
    description?: string | null;
    file_content_base64?: string;
  }) => Promise<void>;
  onLinkExistingDocument: (documentId: string) => Promise<void>;
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  availableDocuments,
  onUploadDocument,
  onLinkExistingDocument,
}: UploadDocumentDialogProps) {
  const [tab, setTab] = useState<"upload" | "existing">("upload");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>("Lecture");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Link existing state
  const [selectedDocId, setSelectedDocId] = useState("");

  const resetForm = () => {
    setSelectedFile(null);
    setCategory("Lecture");
    setDescription("");
    setSelectedDocId("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File is too large (maximum 50 MB)");
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setLoading(true);
    try {
      // Read file as base64 data URL for client storage/persistence
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Content = reader.result as string;
          await onUploadDocument({
            original_file_name: selectedFile.name,
            category,
            mime_type: selectedFile.type || "application/octet-stream",
            file_size: selectedFile.size,
            description: description.trim() || null,
            file_content_base64: base64Content,
          });
          resetForm();
          onOpenChange(false);
        } catch {
          toast.error("Failed to upload document");
        } finally {
          setLoading(false);
        }
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
        setLoading(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch {
      setLoading(false);
      toast.error("Upload error");
    }
  };

  const handleLinkExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId) return;

    setLoading(true);
    try {
      await onLinkExistingDocument(selectedDocId);
      resetForm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Add Document to Course
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(val) => setTab(val as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="text-xs">
              <FileUp className="h-3.5 w-3.5 mr-1.5" />
              Upload New
            </TabsTrigger>
            <TabsTrigger value="existing" className="text-xs">
              <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
              Document Library ({availableDocuments.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: UPLOAD NEW */}
          <TabsContent value="upload">
            <form onSubmit={handleUpload} className="space-y-3.5 pt-2 text-xs">
              <div className="space-y-1">
                <Label>Select File</Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-neutral-500 bg-secondary/30 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.md"
                  />
                  <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-sm bg-muted text-muted-foreground mb-2">
                    <Upload className="h-4 w-4" />
                  </div>
                  {selectedFile ? (
                    <div>
                      <p className="font-semibold text-foreground truncate max-w-xs mx-auto">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        Click or drag document to attach
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-1">
                        PDF, PPT, DOC, XLS, PNG, JPG, TXT (Max 50MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label>Document Category</Label>
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
                <Label>Description / Annotations</Label>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes on content, exam importance, chapters..."
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading || !selectedFile}>
                  {loading ? "Uploading..." : "Upload & Link"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* TAB 2: LINK EXISTING */}
          <TabsContent value="existing">
            <form onSubmit={handleLinkExisting} className="space-y-4 pt-2 text-xs">
              <div className="space-y-1">
                <Label>Select Document from Library</Label>
                <Select value={selectedDocId} onValueChange={setSelectedDocId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a document..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDocuments.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.original_file_name} ({doc.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading || !selectedDocId}>
                  {loading ? "Linking..." : "Attach Document"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
