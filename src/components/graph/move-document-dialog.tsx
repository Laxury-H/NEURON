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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderInput, ArrowRight, Copy } from "lucide-react";
import { Semester, Course } from "@/types/database";
import { DataRepository } from "@/lib/data/repository";

interface MoveDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentTitle: string;
  currentCourseId: string;
  onMove: (targetCourseId: string) => Promise<void>;
  onLinkAlso: (targetCourseId: string) => Promise<void>;
}

export function MoveDocumentDialog({
  open,
  onOpenChange,
  documentTitle,
  currentCourseId,
  onMove,
  onLinkAlso,
}: MoveDocumentDialogProps) {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedTargetCourseId, setSelectedTargetCourseId] = useState<string>("");
  const [operationMode, setOperationMode] = useState<"move" | "link">("move");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!open) return;
      setLoading(true);
      try {
        const sems = await DataRepository.getSemesters();
        setSemesters(sems);
        // Find first available target course not equal to currentCourseId
        let firstAvailable = "";
        for (const s of sems) {
          if (s.courses) {
            const match = s.courses.find((c) => c.id !== currentCourseId);
            if (match) {
              firstAvailable = match.id;
              break;
            }
          }
        }
        setSelectedTargetCourseId(firstAvailable);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [open, currentCourseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetCourseId) return;
    setSaving(true);
    try {
      if (operationMode === "move") {
        await onMove(selectedTargetCourseId);
      } else {
        await onLinkAlso(selectedTargetCourseId);
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  // Flatten available target courses
  const allTargetCourses: { course: Course; semesterName: string }[] = [];
  semesters.forEach((s) => {
    (s.courses || []).forEach((c) => {
      if (c.id !== currentCourseId) {
        allTargetCourses.push({ course: c, semesterName: s.name });
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border border-border p-5">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center space-x-2">
            <FolderInput className="h-4 w-4" />
            <span>Move or Reassign Document</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Document:</div>
            <div className="text-xs font-mono font-medium truncate p-2 rounded bg-muted/40 border border-border">
              {documentTitle}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Operation Mode</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOperationMode("move")}
                className={`p-2.5 rounded-sm border text-left text-xs transition-colors flex flex-col justify-between ${
                  operationMode === "move"
                    ? "border-foreground bg-accent text-foreground font-semibold"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span>Move Document</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-normal mt-1">
                  Remove from this course and place into target course.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setOperationMode("link")}
                className={`p-2.5 rounded-sm border text-left text-xs transition-colors flex flex-col justify-between ${
                  operationMode === "link"
                    ? "border-foreground bg-accent text-foreground font-semibold"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Copy className="h-3.5 w-3.5" />
                  <span>Link Also</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-normal mt-1">
                  Keep in this course and also attach to target course.
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="targetCourseSelect" className="text-xs">
              Destination Course
            </Label>
            {loading ? (
              <div className="h-8 rounded bg-muted animate-pulse" />
            ) : allTargetCourses.length === 0 ? (
              <div className="text-xs text-muted-foreground p-3 border border-dashed rounded text-center">
                No other courses found. Create another course first to move files.
              </div>
            ) : (
              <Select
                value={selectedTargetCourseId}
                onValueChange={setSelectedTargetCourseId}
              >
                <SelectTrigger id="targetCourseSelect" className="text-xs h-8">
                  <SelectValue placeholder="Select destination course..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {allTargetCourses.map(({ course, semesterName }) => (
                    <SelectItem key={course.id} value={course.id} className="text-xs">
                      <span className="font-mono font-bold mr-1.5">{course.course_code}</span>
                      <span>{course.course_name}</span>
                      <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">
                        ({semesterName})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
              disabled={saving || !selectedTargetCourseId}
            >
              {saving ? "Processing..." : operationMode === "move" ? "Move Document" : "Attach to Course"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
