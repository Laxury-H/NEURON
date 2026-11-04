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
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Layers,
} from "lucide-react";

export default function CourseGraphPage() {
  const params = useParams();
  const router = useRouter();
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
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4 text-xs z-30">
        <div className="flex items-center space-x-2 truncate">
          <Link
            href={`/app/semesters/${semesterId}`}
            className="flex items-center space-x-1.5 text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{semester?.name || "Semester"}</span>
          </Link>

          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

          {/* Sibling Course Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center space-x-1.5 px-2 py-1 rounded-sm border border-border bg-background hover:bg-muted transition-colors font-mono font-bold text-foreground max-w-[280px] sm:max-w-none">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{course.course_code}</span>
                <span className="font-normal text-muted-foreground truncate hidden md:inline">
                  — {course.course_name}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
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
            <span className="text-[11px] text-muted-foreground truncate hidden lg:inline">
              Prof. {course.lecturer}
            </span>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          <Link href={`/app/calendar?semesterId=${semesterId}&courseId=${course.id}`}>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
              <span className="hidden sm:inline">Course</span> Schedule
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Graph Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <CourseGraphCanvas courseId={courseId} semesterId={semesterId} />
      </div>
    </div>
  );
}
