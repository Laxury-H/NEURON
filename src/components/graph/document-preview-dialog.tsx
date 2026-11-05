"use client";

import React, { useState } from "react";
import { DocumentItem } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, ExternalLink } from "lucide-react";

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
  const [iframeLoading, setIframeLoading] = useState(true);

  if (!document) return null;

  const ext = document.original_file_name.split(".").pop()?.toLowerCase() || "";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext) || document.mime_type.startsWith("image/");
  const isPdf = ext === "pdf" || document.mime_type === "application/pdf";
  const isText = ["txt", "md", "json", "csv", "ts", "js", "py"].includes(ext) || document.mime_type.startsWith("text/");

  const handleOpenExternal = () => {
    if (document.download_url) {
      window.open(document.download_url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden border border-border">
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
                {document.storage_path && (
                  <span className="hidden md:inline text-muted-foreground truncate max-w-[280px]">
                    • {document.storage_path}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {document.download_url && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-mono"
                onClick={handleOpenExternal}
                title="Open in standalone browser tab"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Open Tab
              </Button>
            )}

            <Button
              variant="default"
              size="sm"
              className="h-8 text-xs font-mono"
              onClick={onDownload}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-auto p-3 sm:p-4 bg-muted/10 min-h-[460px] flex items-center justify-center relative">
          {isImage && document.download_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={document.download_url}
              alt={document.original_file_name}
              className="max-h-[70vh] max-w-full object-contain rounded border border-border"
            />
          ) : (isPdf || document.download_url) ? (
            <div className="relative w-full h-[70vh]">
              {iframeLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-card text-muted-foreground text-xs font-mono space-y-2 z-10">
                  <div className="h-4 w-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                  <span>Loading document view...</span>
                </div>
              )}
              <iframe
                src={document.download_url}
                title={document.original_file_name}
                onLoad={() => setIframeLoading(false)}
                className="w-full h-full rounded border border-border bg-card"
              />
            </div>
          ) : isText && document.download_url ? (
            <div className="w-full h-[70vh] overflow-auto p-4 rounded border border-border bg-card font-mono text-xs whitespace-pre-wrap leading-relaxed">
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
                  <p className="text-xs text-muted-foreground pt-1">
                    {document.description}
                  </p>
                )}
                {document.storage_path && (
                  <p className="text-[10px] text-muted-foreground font-mono pt-2">
                    Location: {document.storage_path}
                  </p>
                )}
              </div>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDownload}
                  className="text-xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download File
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
