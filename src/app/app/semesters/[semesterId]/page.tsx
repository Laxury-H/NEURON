"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Semester, Course, DocumentItem } from "@/types/database";
import { DataRepository } from "@/lib/data/repository";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CourseDialog } from "@/components/courses/course-dialog";
import { SemesterDialog } from "@/components/semesters/semester-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DocumentPreviewDialog } from "@/components/graph/document-preview-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Search,
  Eye,
  Download,
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
  const [courseSearchQuery, setCourseSearchQuery] = useState("");

  const [semesterDialogOpen, setSemesterDialogOpen] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  // Course Documents Quick Inspection Dialog
  const [courseDocsModal, setCourseDocsModal] = useState<{
    course: Course;
    documents: DocumentItem[];
  } | null>(null);
  const [docForPreview, setDocForPreview] = useState<DocumentItem | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  const handleOpenCourseDocs = async (c: Course) => {
    try {
      const graphData = await DataRepository.getCourseGraphData(c.id);
      if (graphData) {
        setCourseDocsModal({
          course: c,
          documents: graphData.documents,
        });
      }
    } catch {
      toast.error("Failed to load course documents");
    }
  };

  const handleDownloadDoc = (doc: DocumentItem) => {
    if (doc.download_url) {
      const a = window.document.createElement("a");
      a.href = doc.download_url;
      a.download = doc.original_file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      toast.success(`Downloading ${doc.original_file_name}`);
    }
  };

  const loadData = React.useCallback(async () => {
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
  }, [semesterId, router]);

  useEffect(() => {
    if (semesterId) {
      loadData();
    }
  }, [semesterId, loadData]);

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

  const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);
  const filteredCourses = courses.filter((c) => {
    if (!courseSearchQuery.trim()) return true;
    const q = courseSearchQuery.toLowerCase();
    return (
      c.course_code.toLowerCase().includes(q) ||
      c.course_name.toLowerCase().includes(q) ||
      (c.lecturer && c.lecturer.toLowerCase().includes(q))
    );
  });

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

          <div className="flex flex-wrap items-center gap-2">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider font-mono text-muted-foreground">
              Courses ({courses.length})
            </h2>
            <Badge variant="subtle" className="text-[10px] font-mono">
              {totalCredits} Total Credits
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {courses.length > 2 && (
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={courseSearchQuery}
                  onChange={(e) => setCourseSearchQuery(e.target.value)}
                  placeholder="Filter courses..."
                  className="h-7 w-36 sm:w-48 text-xs pl-8 pr-2 bg-background"
                />
              </div>
            )}
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
        ) : filteredCourses.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            No courses match &ldquo;{courseSearchQuery}&rdquo;
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCourses.map((course) => (
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
                    <button
                      type="button"
                      onClick={() => handleOpenCourseDocs(course)}
                      className="flex items-center space-x-1 hover:text-foreground hover:underline transition-colors cursor-pointer"
                      title={`View ${course.documents_count ?? 0} files linked to ${course.course_code}`}
                    >
                      <FileText className="h-3 w-3" />
                      <span>{course.documents_count ?? 0}</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/app/calendar?semesterId=${semester.id}&courseId=${course.id}`}
                      className="inline-flex items-center space-x-1 px-2 py-1 rounded-sm border border-border bg-background text-[11px] text-muted-foreground hover:text-foreground hover:border-neutral-400 transition-colors"
                      title="View course schedule"
                    >
                      <Calendar className="h-3 w-3" />
                      <span className="hidden sm:inline">Schedule</span>
                    </Link>

                    <Link
                      href={`/app/semesters/${semester.id}/courses/${course.id}`}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-sm bg-primary text-primary-foreground font-medium text-[11px] hover:opacity-90 transition-opacity"
                    >
                      <Network className="h-3 w-3 mr-0.5" />
                      <span>Neural Graph</span>
                      <ArrowRight className="h-3 w-3 ml-0.5" />
                    </Link>
                  </div>
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

      {/* Course Linked Documents Vault Modal */}
      <Dialog
        open={!!courseDocsModal}
        onOpenChange={(open) => !open && setCourseDocsModal(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 border border-border">
          <DialogHeader className="p-4 border-b border-border bg-muted/20">
            <DialogTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>
                  {courseDocsModal?.course.course_code} — Course Documents Vault
                </span>
              </span>
              <Badge variant="subtle" className="text-[10px] font-mono">
                {courseDocsModal?.documents.length ?? 0} Files
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[60vh]">
            {!courseDocsModal?.documents || courseDocsModal.documents.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground font-mono">
                No documents currently attached to this course.
              </div>
            ) : (
              courseDocsModal.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border bg-card hover:border-neutral-500 transition-colors"
                >
                  <div className="flex items-center space-x-3 truncate min-w-0 pr-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-muted text-foreground border border-border font-mono text-xs">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="truncate">
                      <h4
                        className="text-xs font-semibold text-foreground truncate"
                        title={doc.original_file_name}
                      >
                        {doc.original_file_name}
                      </h4>
                      <div className="flex items-center space-x-2 text-[10px] font-mono text-muted-foreground mt-0.5">
                        <Badge variant="subtle" className="text-[9px] uppercase px-1 py-0 h-4">
                          {doc.category}
                        </Badge>
                        <span>{(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                        {doc.storage_path && (
                          <span className="hidden sm:inline truncate max-w-[200px]">
                            • {doc.storage_path}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2 font-mono"
                      onClick={() => {
                        setDocForPreview(doc);
                        setPreviewDialogOpen(true);
                      }}
                      title="Preview Document"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>

                    <Button
                      variant="ghost"
                      size="iconSm"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleDownloadDoc(doc)}
                      title="Download File"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono text-[11px]">
              Files mapped to <code>D:\2026.1</code>
            </span>
            {courseDocsModal && (
              <Link
                href={`/app/semesters/${semester.id}/courses/${courseDocsModal.course.id}`}
                className="inline-flex items-center space-x-1 text-xs font-medium text-foreground hover:underline"
              >
                <span>Open in Neural Graph</span>
                <ArrowRight className="h-3 w-3 ml-0.5" />
              </Link>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* In-App Document Preview Modal */}
      <DocumentPreviewDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        document={docForPreview}
        onDownload={() => docForPreview && handleDownloadDoc(docForPreview)}
      />
    </div>
  );
}
