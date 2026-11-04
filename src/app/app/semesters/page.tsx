"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Semester, Course } from "@/types/database";
import { DataRepository } from "@/lib/data/repository";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SemesterDialog } from "@/components/semesters/semester-dialog";
import { CourseDialog } from "@/components/courses/course-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { toast } from "sonner";
import {
  Folder,
  Plus,
  Calendar,
  MoreVertical,
  Edit2,
  Trash2,
  BookOpen,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function SemestersPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [semesterDialogOpen, setSemesterDialogOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);

  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [targetSemesterId, setTargetSemesterId] = useState<string>("");

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [semesterToDelete, setSemesterToDelete] = useState<Semester | null>(null);

  const loadSemesters = async () => {
    setLoading(true);
    try {
      const data = await DataRepository.getSemesters();
      setSemesters(data);
    } catch {
      toast.error("Failed to load semesters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSemesters();
  }, []);

  const notifyChange = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("neuron_data_changed"));
    }
  };

  const handleSaveSemester = async (data: any) => {
    try {
      if (editingSemester) {
        await DataRepository.updateSemester(editingSemester.id, data);
        toast.success("Semester updated");
      } else {
        await DataRepository.createSemester(data);
        toast.success("Semester created");
      }
      await loadSemesters();
      notifyChange();
    } catch {
      toast.error("Failed to save semester");
    }
  };

  const handleDeleteSemester = async () => {
    if (!semesterToDelete) return;
    try {
      await DataRepository.deleteSemester(semesterToDelete.id);
      toast.success("Semester deleted");
      await loadSemesters();
      notifyChange();
    } catch {
      toast.error("Failed to delete semester");
    }
  };

  const handleSetActive = async (sem: Semester) => {
    try {
      await DataRepository.updateSemester(sem.id, { is_active: true });
      toast.success(`${sem.name} set as active`);
      await loadSemesters();
      notifyChange();
    } catch {
      toast.error("Failed to set active semester");
    }
  };

  const handleSaveCourse = async (data: any) => {
    try {
      await DataRepository.createCourse(data);
      toast.success("Course added");
      await loadSemesters();
      notifyChange();
    } catch {
      toast.error("Failed to add course");
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            Academic Architecture
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Semesters
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Top-level organizational folders containing your academic courses, materials, and neural graphs.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Button
            size="sm"
            onClick={() => {
              setEditingSemester(null);
              setSemesterDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Semester
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          <div className="h-28 rounded-md border border-border bg-muted/30 animate-pulse" />
          <div className="h-28 rounded-md border border-border bg-muted/30 animate-pulse" />
        </div>
      )}

      {/* Empty State */}
      {!loading && semesters.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-12 text-center space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-sm bg-muted text-muted-foreground">
            <Folder className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold">Your academic workspace starts here.</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Create your first semester to start organizing courses, knowledge graphs, professors, and class schedules.
          </p>
          <div className="pt-2">
            <Button
              size="sm"
              onClick={() => {
                setEditingSemester(null);
                setSemesterDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Semester
            </Button>
          </div>
        </div>
      )}

      {/* Semester List */}
      {!loading && semesters.length > 0 && (
        <div className="space-y-6">
          {semesters.map((semester) => (
            <div
              key={semester.id}
              className="rounded-md border border-border bg-card transition-colors hover:border-neutral-400 dark:hover:border-neutral-600"
            >
              {/* Folder Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 border-b border-border bg-secondary/30 gap-3">
                <div className="flex items-start space-x-3.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border bg-background">
                    <Folder className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/app/semesters/${semester.id}`}
                        className="text-base font-semibold hover:underline underline-offset-4 tracking-tight"
                      >
                        {semester.name}
                      </Link>
                      {semester.is_active && (
                        <Badge variant="subtle" className="text-[10px] font-mono">
                          ACTIVE
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                      <span>{semester.academic_year}</span>
                      <span>•</span>
                      <span>
                        {new Date(semester.start_date).toLocaleDateString(undefined, {
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        –{" "}
                        {new Date(semester.end_date).toLocaleDateString(undefined, {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span>•</span>
                      <span className="font-mono">
                        {semester.courses?.length || 0} {semester.courses?.length === 1 ? "course" : "courses"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-1.5 self-end sm:self-auto shrink-0">
                  <Link
                    href={`/app/calendar?semesterId=${semester.id}`}
                    className="hidden sm:inline-flex"
                  >
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      Calendar
                    </Button>
                  </Link>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setTargetSemesterId(semester.id);
                      setCourseDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Course
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="iconSm" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!semester.is_active && (
                        <DropdownMenuItem onClick={() => handleSetActive(semester)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                          Set as Active
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingSemester(semester);
                          setSemesterDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-2" />
                        Edit Semester
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-neutral-900 dark:text-neutral-100"
                        onClick={() => {
                          setSemesterToDelete(semester);
                          setDeleteConfirmOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete Semester
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Course Collection */}
              <div className="p-4 divide-y divide-border">
                {semester.courses && semester.courses.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {semester.courses.map((course: Course) => (
                      <Link
                        key={course.id}
                        href={`/app/semesters/${semester.id}/courses/${course.id}`}
                        className="group flex items-center justify-between p-3 rounded border border-border bg-background hover:border-foreground transition-colors"
                      >
                        <div className="flex items-start space-x-3 overflow-hidden">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-muted text-foreground">
                            <BookOpen className="h-3.5 w-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono text-xs font-bold text-foreground">
                                {course.course_code}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono">
                                • {course.credits} cr
                              </span>
                            </div>
                            <h4 className="text-xs font-medium text-foreground truncate group-hover:underline underline-offset-2">
                              {course.course_name}
                            </h4>
                            {course.lecturer && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {course.lecturer}
                              </p>
                            )}
                          </div>
                        </div>

                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0 ml-2 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No courses in this semester yet.
                    <button
                      onClick={() => {
                        setTargetSemesterId(semester.id);
                        setCourseDialogOpen(true);
                      }}
                      className="ml-2 text-foreground underline font-medium"
                    >
                      Add a course
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <SemesterDialog
        open={semesterDialogOpen}
        onOpenChange={setSemesterDialogOpen}
        semester={editingSemester}
        onSave={handleSaveSemester}
      />

      <CourseDialog
        open={courseDialogOpen}
        onOpenChange={setCourseDialogOpen}
        semesterId={targetSemesterId}
        onSave={handleSaveCourse}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Semester?"
        description="This will permanently delete the semester, its courses, neural graphs, and calendar events. Are you sure you want to proceed?"
        confirmLabel="Delete Semester"
        onConfirm={handleDeleteSemester}
      />
    </div>
  );
}
