"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SemesterCalendar } from "@/components/calendar/semester-calendar";

function CalendarContainer() {
  const searchParams = useSearchParams();
  const semesterId = searchParams.get("semesterId") || undefined;
  const courseId = searchParams.get("courseId") || undefined;
  const eventId = searchParams.get("eventId") || undefined;

  return (
    <SemesterCalendar
      initialSemesterId={semesterId}
      initialCourseId={courseId}
      initialEventId={eventId}
    />
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-xs text-muted-foreground">
          Loading semester schedule...
        </div>
      }
    >
      <CalendarContainer />
    </Suspense>
  );
}
