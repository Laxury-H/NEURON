"use client";

import React from "react";
import { DocumentItem } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentItem | null;
  onDownload: () => void;
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  document,
  onDownload,
}: DocumentPreviewDialogProps) {
  if (!document) return null;

  const ext = document.original_file_name.split(".").pop()?.toLowerCase() || "";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext) || document.mime_type.startsWith("image/");
  const isPdf = ext === "pdf" || document.mime_type === "application/pdf";
  const isText = ["txt", "md", "json", "csv", "ts", "js", "py"].includes(ext) || document.mime_type.startsWith("text/");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 bg-muted/30">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground font-mono text-xs">
              <FileText className="h-4 w-4" />
            </div>
            <div className="truncate">
              <DialogTitle className="text-sm font-semibold truncate">
                {document.original_file_name}
              </DialogTitle>
              <div className="flex items-center space-x-2 text-[10px] font-mono text-muted-foreground mt-0.5">
                <Badge variant="subtle" className="text-[9px] uppercase px-1 py-0 h-4">
                  {document.category}
                </Badge>
                <span>{(document.file_size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={onDownload}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-auto p-4 bg-muted/10 min-h-[400px] flex items-center justify-center">
          {isImage && document.download_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={document.download_url}
              alt={document.original_file_name}
              className="max-h-[65vh] max-w-full object-contain rounded border border-border"
            />
          ) : isPdf && document.download_url ? (
            <iframe
              src={document.download_url}
              title={document.original_file_name}
              className="w-full h-[65vh] rounded border border-border bg-white"
            />
          ) : isText && document.download_url ? (
            <div className="w-full h-[65vh] overflow-auto p-4 rounded border border-border bg-card font-mono text-xs whitespace-pre-wrap leading-relaxed">
              {document.description || "Text document preview content is available."}
            </div>
          ) : (
            <div className="text-center p-8 space-y-4 max-w-md">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border border-border bg-card">
                <FileText className="h-7 w-7 text-foreground" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-foreground">
                  {document.original_file_name}
                </h4>
                <p className="text-xs text-muted-foreground font-mono">
                  {document.category} • {(document.file_size / 1024 / 1024).toFixed(2)} MB
                </p>
                {document.description && (
                  <p className="text-xs text-muted-foreground pt-2 italic">
                    &ldquo;{document.description}&rdquo;
                  </p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Direct embedded preview is optimized for PDF, images, and text. Download this file to open in your native editor.
              </p>
              <Button size="sm" onClick={onDownload} className="text-xs">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download to View
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
