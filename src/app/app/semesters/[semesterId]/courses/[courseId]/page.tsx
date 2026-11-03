"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Semester, Course } from "@/types/database";
import { DataRepository } from "@/lib/data/repository";
import { CourseGraphCanvas } from "@/components/graph/course-graph-canvas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, ChevronRight } from "lucide-react";

export default function CourseGraphPage() {
  const params = useParams();
  const router = useRouter();
  const semesterId = params.semesterId as string;
  const courseId = params.courseId as string;

  const [semester, setSemester] = useState<Semester | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInfo() {
      setLoading(true);
      try {
        const [sem, crs] = await Promise.all([
          DataRepository.getSemester(semesterId),
          DataRepository.getCourse(courseId),
        ]);
        if (!crs) {
          router.push(`/app/semesters/${semesterId}`);
          return;
        }
        setSemester(sem);
        setCourse(crs);
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
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        Initializing neural knowledge graph...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-screen overflow-hidden">
      {/* Top Navigation & Breadcrumbs Bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4 text-xs">
        <div className="flex items-center space-x-2 truncate">
          <Link
            href={`/app/semesters/${semesterId}`}
            className="flex items-center space-x-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{semester?.name || "Semester"}</span>
          </Link>

          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

          <div className="flex items-center space-x-2 truncate">
            <span className="font-mono font-bold text-foreground">
              {course.course_code}
            </span>
            <span className="text-muted-foreground truncate hidden md:inline">
              — {course.course_name}
            </span>
            <Badge variant="subtle" className="text-[10px] font-mono shrink-0">
              {course.credits} CR
            </Badge>
          </div>
        </div>

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
