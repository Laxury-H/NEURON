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
import { Edit2 } from "lucide-react";

interface RenameDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onRename: (newName: string) => Promise<void>;
}

export function RenameDocumentDialog({
  open,
  onOpenChange,
  currentName,
  onRename,
}: RenameDocumentDialogProps) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(currentName);
  }, [currentName, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === currentName) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(name.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border border-border p-5">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center space-x-2">
            <Edit2 className="h-4 w-4" />
            <span>Rename Document</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="fileNameInput" className="text-xs">
              File Name
            </Label>
            <Input
              id="fileNameInput"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lecture_01_Introduction.pdf"
              className="text-xs h-8 font-mono"
              autoFocus
            />
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
              {saving ? "Saving..." : "Save Name"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
