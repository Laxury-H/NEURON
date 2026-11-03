"use client";

import React from "react";
import { Course } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, BookOpen, Users, FileText, Edit2 } from "lucide-react";

interface CourseDetailPanelProps {
  course: Course | null;
  peopleCount: number;
  documentsCount: number;
  onClose: () => void;
  onEditCourse: () => void;
}

export function CourseDetailPanel({
  course,
  peopleCount,
  documentsCount,
  onClose,
  onEditCourse,
}: CourseDetailPanelProps) {
  if (!course) return null;

  return (
    <div className="absolute top-0 right-0 bottom-0 w-80 md:w-96 border-l border-border bg-background shadow-xl z-30 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4 bg-muted/40">
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-xs font-bold">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="truncate">
            <h3 className="font-semibold text-sm truncate font-mono">
              {course.course_code}
            </h3>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Central Knowledge Node
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onEditCourse}
            title="Edit Course"
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Course Title
          </span>
          <h2 className="text-base font-bold text-foreground mt-0.5">
            {course.course_name}
          </h2>
          <div className="flex items-center space-x-2 mt-2">
            <Badge variant="default" className="text-[10px] font-mono">
              {course.credits} Credits
            </Badge>
            {course.lecturer && (
              <Badge variant="subtle" className="text-[10px]">
                {course.lecturer}
              </Badge>
            )}
          </div>
        </div>

        {/* Network Metrics */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-3 rounded-md border border-border bg-card flex flex-col">
            <div className="flex items-center space-x-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span className="text-[10px] font-mono uppercase">People</span>
            </div>
            <span className="text-xl font-bold font-mono text-foreground mt-1">
              {String(peopleCount).padStart(2, "0")}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Connected contacts
            </span>
          </div>

          <div className="p-3 rounded-md border border-border bg-card flex flex-col">
            <div className="flex items-center space-x-1.5 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span className="text-[10px] font-mono uppercase">Materials</span>
            </div>
            <span className="text-xl font-bold font-mono text-foreground mt-1">
              {String(documentsCount).padStart(2, "0")}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Academic documents
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5 pt-2 border-t border-border">
          <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
            Course Syllabus / Description
          </span>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {course.description || "No description specified for this course."}
          </p>
        </div>
      </div>
    </div>
  );
}
