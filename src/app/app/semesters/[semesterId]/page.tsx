"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Semester, Course } from "@/types/database";
import { DataRepository } from "@/lib/data/repository";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourseDialog } from "@/components/courses/course-dialog";
import { SemesterDialog } from "@/components/semesters/semester-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { toast } from "sonner";
import {
  Folder,
  Plus,
  Calendar,
  BookOpen,
  ArrowRight,
  MoreVertical,
  Edit2,
  Trash2,
  ArrowLeft,
  Users,
  FileText,
  Network,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function SemesterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const semesterId = params.semesterId as string;

  const [semester, setSemester] = useState<Semester | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const [semesterDialogOpen, setSemesterDialogOpen] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const sem = await DataRepository.getSemester(semesterId);
      if (!sem) {
        toast.error("Semester not found");
        router.push("/app/semesters");
        return;
      }
      setSemester(sem);
      const cList = await DataRepository.getCourses(semesterId);
      setCourses(cList);
    } catch {
      toast.error("Failed to load semester");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (semesterId) {
      loadData();
    }
  }, [semesterId]);

  const notifyChange = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("neuron_data_changed"));
    }
  };

  const handleSaveCourse = async (data: any) => {
    try {
      if (editingCourse) {
        await DataRepository.updateCourse(editingCourse.id, data);
        toast.success("Course updated");
      } else {
        await DataRepository.createCourse(data);
        toast.success("Course created");
      }
      await loadData();
      notifyChange();
    } catch {
      toast.error("Failed to save course");
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    try {
      await DataRepository.deleteCourse(courseToDelete.id);
      toast.success("Course deleted");
      await loadData();
      notifyChange();
    } catch {
      toast.error("Failed to delete course");
    }
  };

  const handleUpdateSemester = async (data: any) => {
    if (!semester) return;
    try {
      await DataRepository.updateSemester(semester.id, data);
      toast.success("Semester updated");
      await loadData();
      notifyChange();
    } catch {
      toast.error("Failed to update semester");
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-20 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 bg-muted rounded animate-pulse" />
          <div className="h-32 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!semester) return null;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      {/* Breadcrumb / Back button */}
      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
        <Link
          href="/app/semesters"
          className="hover:text-foreground flex items-center space-x-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Semesters</span>
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{semester.name}</span>
      </div>

      {/* Semester Heading Banner */}
      <div className="border border-border rounded-md p-6 bg-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <Folder className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {semester.name}
                </h1>
                {semester.is_active && (
                  <Badge variant="subtle" className="text-[10px] font-mono">
                    ACTIVE
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {semester.academic_year} •{" "}
                {new Date(semester.start_date).toLocaleDateString(undefined, {
                  month: "short",
                  year: "numeric",
                })}{" "}
                –{" "}
                {new Date(semester.end_date).toLocaleDateString(undefined, {
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Link href={`/app/calendar?semesterId=${semester.id}`}>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                Semester Calendar
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSemesterDialogOpen(true)}
            >
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />
              Edit Semester
            </Button>

            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setEditingCourse(null);
                setCourseDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Course
            </Button>
          </div>
        </div>
      </div>

      {/* Courses Collection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-muted-foreground">
            Courses ({courses.length})
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              setEditingCourse(null);
              setCourseDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Course
          </Button>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-10 text-center space-y-2">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-sm bg-muted text-muted-foreground">
              <BookOpen className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold">No courses in this semester yet.</p>
            <p className="text-xs text-muted-foreground">
              Add a course to unlock its interactive neural knowledge graph.
            </p>
            <div className="pt-2">
              <Button
                size="sm"
                onClick={() => {
                  setEditingCourse(null);
                  setCourseDialogOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Course
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((course) => (
              <div
                key={course.id}
                className="group relative rounded-md border border-border bg-card p-5 transition-colors hover:border-neutral-400 dark:hover:border-neutral-600 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {course.course_code}
                        </span>
                        <Badge variant="subtle" className="text-[10px]">
                          {course.credits} Credits
                        </Badge>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground mt-1">
                        {course.course_name}
                      </h3>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="iconSm"
                          className="h-7 w-7 text-muted-foreground"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingCourse(course);
                            setCourseDialogOpen(true);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-2" />
                          Edit Course
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-neutral-900 dark:text-neutral-100"
                          onClick={() => {
                            setCourseToDelete(course);
                            setDeleteConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete Course
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {course.lecturer && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Lecturer: {course.lecturer}
                    </p>
                  )}

                  {course.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {course.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-border flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3 text-muted-foreground font-mono text-[11px]">
                    <span className="flex items-center space-x-1">
                      <Users className="h-3 w-3" />
                      <span>{course.people_count ?? 0}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <FileText className="h-3 w-3" />
                      <span>{course.documents_count ?? 0}</span>
                    </span>
                  </div>

                  <Link
                    href={`/app/semesters/${semester.id}/courses/${course.id}`}
                    className="flex items-center space-x-1 font-medium text-foreground hover:underline underline-offset-4 group-hover:translate-x-0.5 transition-transform"
                  >
                    <Network className="h-3.5 w-3.5 mr-1" />
                    <span>Open Neural Graph</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CourseDialog
        open={courseDialogOpen}
        onOpenChange={setCourseDialogOpen}
        semesterId={semester.id}
        course={editingCourse}
        onSave={handleSaveCourse}
      />

      <SemesterDialog
        open={semesterDialogOpen}
        onOpenChange={setSemesterDialogOpen}
        semester={semester}
        onSave={handleUpdateSemester}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Course?"
        description="Are you sure you want to delete this course? Associated graph records, links to people and documents will be removed."
        confirmLabel="Delete Course"
        onConfirm={handleDeleteCourse}
      />
    </div>
  );
}
