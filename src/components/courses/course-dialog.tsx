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
import { Course } from "@/types/database";

interface CourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: string;
  course?: Course | null;
  onSave: (data: {
    semester_id: string;
    course_code: string;
    course_name: string;
    lecturer?: string | null;
    credits?: number;
    description?: string | null;
  }) => Promise<void>;
}

export function CourseDialog({
  open,
  onOpenChange,
  semesterId,
  course,
  onSave,
}: CourseDialogProps) {
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [credits, setCredits] = useState<number>(3);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (course) {
      setCourseCode(course.course_code);
      setCourseName(course.course_name);
      setLecturer(course.lecturer || "");
      setCredits(course.credits || 3);
      setDescription(course.description || "");
    } else {
      setCourseCode("");
      setCourseName("");
      setLecturer("");
      setCredits(3);
      setDescription("");
    }
  }, [course, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseName.trim()) return;

    setLoading(true);
    try {
      await onSave({
        semester_id: semesterId,
        course_code: courseCode.trim().toUpperCase(),
        course_name: courseName.trim(),
        lecturer: lecturer.trim() || null,
        credits: Number(credits) || 3,
        description: description.trim() || null,
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
            {course ? "Edit Course" : "Add Course"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <Label htmlFor="course-code">Course Code</Label>
              <Input
                id="course-code"
                placeholder="EE4010"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="font-mono uppercase"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="course-name">Course Name</Label>
              <Input
                id="course-name"
                placeholder="Power System Analysis"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="lecturer">Lecturer / Instructor</Label>
              <Input
                id="lecturer"
                placeholder="Prof. Nguyen Van A"
                value={lecturer}
                onChange={(e) => setLecturer(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 col-span-1">
              <Label htmlFor="credits">Credits</Label>
              <Input
                id="credits"
                type="number"
                min="0"
                max="20"
                value={credits}
                onChange={(e) => setCredits(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Course Description</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Key topics, exam notes, syllabus overview..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
            <Button
              type="submit"
              size="sm"
              disabled={loading || !courseCode.trim() || !courseName.trim()}
            >
              {loading ? "Saving..." : course ? "Update Course" : "Create Course"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
