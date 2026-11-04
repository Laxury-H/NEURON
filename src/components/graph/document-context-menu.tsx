"use client";

import React, { useEffect, useRef, useState } from "react";
import { DocumentItem, DocumentCategory } from "@/types/database";
import {
  Eye,
  Edit2,
  FolderInput,
  Tag,
  Settings2,
  Copy,
  Download,
  Unlink,
  Trash2,
  ChevronRight,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface DocumentContextMenuProps {
  x: number;
  y: number;
  document: DocumentItem;
  onClose: () => void;
  onPreview: (doc: DocumentItem) => void;
  onRename: (doc: DocumentItem) => void;
  onMove: (doc: DocumentItem) => void;
  onChangeCategory: (doc: DocumentItem, newCategory: DocumentCategory) => void;
  onAdvanced: (doc: DocumentItem) => void;
  onDownload: (doc: DocumentItem) => void;
  onUnlink: (docId: string) => void;
  onDelete: (docId: string) => void;
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

export function DocumentContextMenu({
  x,
  y,
  document: doc,
  onClose,
  onPreview,
  onRename,
  onMove,
  onChangeCategory,
  onAdvanced,
  onDownload,
  onUnlink,
  onDelete,
}: DocumentContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [categorySubmenuOpen, setCategorySubmenuOpen] = useState(false);
  const [adjustedPos, setAdjustedPos] = useState({ top: y, left: x });

  // Boundary detection so the context menu doesn't clip offscreen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left = x;
      let top = y;

      if (x + rect.width > viewportWidth - 10) {
        left = Math.max(10, viewportWidth - rect.width - 15);
      }
      if (y + rect.height > viewportHeight - 10) {
        top = Math.max(10, viewportHeight - rect.height - 15);
      }

      setAdjustedPos({ top, left });
    }
  }, [x, y]);

  // Click outside and escape handler
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleCopyName = () => {
    navigator.clipboard.writeText(doc.original_file_name);
    toast.success("Copied file name to clipboard");
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ top: adjustedPos.top, left: adjustedPos.left }}
      className="fixed z-50 w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg text-xs font-sans animate-in fade-in-50 zoom-in-95 duration-100 select-none"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* File Header Info */}
      <div className="px-2.5 py-1.5 border-b border-border mb-1">
        <p className="font-semibold text-foreground truncate font-mono text-[11px]">
          {doc.original_file_name}
        </p>
        <span className="text-[10px] text-muted-foreground uppercase font-mono">
          {doc.category} • {(doc.file_size / 1024).toFixed(0)} KB
        </span>
      </div>

      {/* Primary Actions */}
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            onPreview(doc);
          }}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground text-left transition-colors"
        >
          <span className="flex items-center space-x-2">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Preview Document</span>
          </span>
          <kbd className="font-mono text-[9px] text-muted-foreground">Space</kbd>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onRename(doc);
          }}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground text-left transition-colors"
        >
          <span className="flex items-center space-x-2">
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Rename File...</span>
          </span>
          <kbd className="font-mono text-[9px] text-muted-foreground">F2</kbd>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onMove(doc);
          }}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground text-left transition-colors"
        >
          <span className="flex items-center space-x-2">
            <FolderInput className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Move to Course...</span>
          </span>
        </button>

        {/* Change Category Submenu Toggle */}
        <div
          className="relative"
          onMouseEnter={() => setCategorySubmenuOpen(true)}
          onMouseLeave={() => setCategorySubmenuOpen(false)}
        >
          <button
            type="button"
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground text-left transition-colors"
          >
            <span className="flex items-center space-x-2">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Category</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {categorySubmenuOpen && (
            <div className="absolute left-full top-0 ml-1 w-36 rounded-md border border-border bg-popover p-1 shadow-md space-y-0.5 animate-in fade-in-50">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    onChangeCategory(doc, cat);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-2 py-1 rounded-sm text-[11px] hover:bg-accent hover:text-accent-foreground text-left transition-colors"
                >
                  <span>{cat}</span>
                  {doc.category === cat && <Check className="h-3 w-3 text-foreground" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onAdvanced(doc);
          }}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground text-left transition-colors"
        >
          <span className="flex items-center space-x-2">
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Advanced Settings...</span>
          </span>
        </button>

        <button
          type="button"
          onClick={handleCopyName}
          className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground text-left transition-colors"
        >
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Copy File Name</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onDownload(doc);
          }}
          className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground text-left transition-colors"
        >
          <Download className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Download File</span>
        </button>
      </div>

      <div className="h-px bg-border my-1" />

      {/* Danger Zone Actions */}
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            onUnlink(doc.id);
          }}
          className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-sm hover:bg-accent text-left transition-colors"
        >
          <Unlink className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Remove from Course</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onDelete(doc.id);
          }}
          className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-sm hover:bg-destructive/10 text-left transition-colors text-foreground hover:text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Delete Permanently</span>
        </button>
      </div>
    </div>
  );
}
