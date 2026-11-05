"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Semester, Course } from "@/types/database";
import { DataRepository } from "@/lib/data/repository";
import { CourseGraphCanvas } from "@/components/graph/course-graph-canvas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Layers,
  Contrast,
} from "lucide-react";

export default function CourseGraphPage() {
  const params = useParams();
  const router = useRouter();
  const { pureBw, togglePureBw } = useTheme();
  const semesterId = params.semesterId as string;
  const courseId = params.courseId as string;

  const [semester, setSemester] = useState<Semester | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [siblingCourses, setSiblingCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInfo() {
      setLoading(true);
      try {
        const [sem, crs, allCrs] = await Promise.all([
          DataRepository.getSemester(semesterId),
          DataRepository.getCourse(courseId),
          DataRepository.getCourses(semesterId),
        ]);
        if (!crs) {
          router.push(`/app/semesters/${semesterId}`);
          return;
        }
        setSemester(sem);
        setCourse(crs);
        setSiblingCourses(allCrs);
      } finally {
        setLoading(false);
      }
    }

    if (semesterId && courseId) {
      loadInfo();
    }
  }, [semesterId, courseId, router]);

  if (loading || !course) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-2 text-xs text-muted-foreground font-mono">
        <div className="h-4 w-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
        <span>Initializing neural knowledge graph...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-screen overflow-hidden">
      {/* Top Navigation & Breadcrumbs Bar */}
      <header className="flex min-h-12 h-auto py-2 flex-wrap items-center justify-between border-b border-border bg-card px-3 sm:px-4 text-xs z-30 gap-2 shrink-0 max-w-full">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 max-w-full">
          <Link
            href={`/app/semesters/${semesterId}`}
            className="flex items-center space-x-1 text-muted-foreground hover:text-foreground transition-colors font-medium shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline truncate max-w-[120px]">{semester?.name || "Semester"}</span>
          </Link>

          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

          {/* Sibling Course Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center space-x-1.5 px-2 py-1 rounded-sm border border-border bg-background hover:bg-muted transition-colors font-mono font-bold text-foreground max-w-[190px] xs:max-w-[260px] sm:max-w-none truncate">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{course.course_code}</span>
                <span className="font-normal text-muted-foreground truncate hidden md:inline max-w-[200px] lg:max-w-[320px]">
                  — {course.course_name}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-w-[90vw]">
              <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Switch Course ({siblingCourses.length})
              </div>
              <DropdownMenuSeparator />
              {siblingCourses.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  className={`text-xs flex items-center justify-between cursor-pointer ${
                    c.id === course.id ? "bg-accent font-semibold" : ""
                  }`}
                  onClick={() => router.push(`/app/semesters/${semesterId}/courses/${c.id}`)}
                >
                  <span className="font-mono">{c.course_code}</span>
                  <span className="truncate ml-2 text-muted-foreground">{c.course_name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs text-muted-foreground cursor-pointer"
                onClick={() => router.push(`/app/semesters/${semesterId}`)}
              >
                <Layers className="h-3.5 w-3.5 mr-1.5" />
                View all courses in semester
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Badge variant="subtle" className="text-[10px] font-mono shrink-0 hidden sm:inline-flex">
            {course.credits} CR
          </Badge>

          {course.lecturer && (
            <span className="text-[11px] text-muted-foreground truncate hidden lg:inline max-w-[150px]">
              Prof. {course.lecturer}
            </span>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <Button
            variant={pureBw ? "default" : "outline"}
            size="sm"
            onClick={togglePureBw}
            className="h-7 text-xs px-2 font-mono shrink-0"
            title="Toggle Pure 1-Bit Black & White Mode (#000000 & #FFFFFF only)"
          >
            <Contrast className="h-3 w-3 sm:mr-1 shrink-0" />
            <span className="hidden sm:inline">{pureBw ? "1-BIT ON" : "1-BIT B&W"}</span>
          </Button>

          <Link href={`/app/calendar?semesterId=${semesterId}&courseId=${course.id}`}>
            <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 shrink-0">
              <Calendar className="h-3 w-3 sm:mr-1 text-muted-foreground" />
              <span className="hidden sm:inline">Course</span> Schedule
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Graph Canvas */}
      <div className="flex-1 min-h-0 w-full h-full relative overflow-hidden">
        <CourseGraphCanvas courseId={courseId} semesterId={semesterId} />
      </div>
    </div>
  );
}
