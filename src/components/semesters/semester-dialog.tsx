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
import { Semester } from "@/types/database";

interface SemesterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semester?: Semester | null;
  onSave: (data: {
    name: string;
    academic_year: string;
    start_date: string;
    end_date: string;
    sort_order?: number;
    is_active?: boolean;
  }) => Promise<void>;
}

export function SemesterDialog({
  open,
  onOpenChange,
  semester,
  onSave,
}: SemesterDialogProps) {
  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (semester) {
      setName(semester.name);
      setAcademicYear(semester.academic_year);
      setStartDate(semester.start_date.split("T")[0]);
      setEndDate(semester.end_date.split("T")[0]);
      setSortOrder(semester.sort_order);
      setIsActive(semester.is_active);
    } else {
      setName("");
      setAcademicYear("Academic Year 2026–2027");
      setStartDate("2026-09-01");
      setEndDate("2027-01-20");
      setSortOrder(1);
      setIsActive(false);
    }
  }, [semester, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        academic_year: academicYear.trim(),
        start_date: startDate,
        end_date: endDate,
        sort_order: Number(sortOrder) || 1,
        is_active: isActive,
      });
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
            {semester ? "Edit Semester" : "Create Semester"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="sem-name">Semester Name</Label>
            <Input
              id="sem-name"
              placeholder="e.g. Semester 1, Fall 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="academic-year">Academic Year</Label>
            <Input
              id="academic-year"
              placeholder="e.g. Academic Year 2026–2027"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-0"
            />
            <label htmlFor="is-active" className="text-xs text-foreground cursor-pointer">
              Set as current active semester
            </label>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading || !name.trim()}>
              {loading ? "Saving..." : semester ? "Update Semester" : "Create Semester"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
