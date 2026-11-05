"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import type { EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";

import { CalendarEvent, Course, Semester, EventType, DeadlineStatus } from "@/types/database";
import { DataRepository } from "@/lib/data/repository";
import {
  detectScheduleConflicts,
  detectExamCrunches,
  expandRecurringOccurrences,
  ConflictPair,
  CrunchWindow,
} from "@/lib/calendar/conflict-detector";
import { generateICalendarFeed } from "@/lib/calendar/ical-generator";
import { CalendarEventDialog } from "./calendar-event-dialog";
import { EventDetailPanel } from "./event-detail-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Calendar as CalendarIcon,
  Download,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SemesterCalendarProps {
  initialSemesterId?: string;
  initialCourseId?: string;
  initialEventId?: string;
}

export function SemesterCalendar({
  initialSemesterId,
  initialCourseId,
  initialEventId,
}: SemesterCalendarProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const searchParams = useSearchParams();

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("all");
  const [activeTypeFilters, setActiveTypeFilters] = useState<Record<EventType, boolean>>({
    CLASS: true,
    EXAM: true,
    DEADLINE: true,
    PERSONAL: true,
  });

  // Calendar View
  const [currentView, setCurrentView] = useState<"dayGridMonth" | "timeGridWeek" | "listMonth">("dayGridMonth");

  // Dialog & Detail Panels
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<CalendarEvent | null>(null);
  const [inspectingEvent, setInspectingEvent] = useState<CalendarEvent | null>(null);
  const [clickedDate, setClickedDate] = useState<Date | null>(null);
  const [conflictsDialogOpen, setConflictsDialogOpen] = useState(false);

  // Handle URL Query Parameters (from Spotlight Search natural language deep links)
  useEffect(() => {
    if (!searchParams) return;

    // View param
    const viewParam = searchParams.get("view");
    if (
      viewParam &&
      (viewParam === "dayGridMonth" ||
        viewParam === "timeGridWeek" ||
        viewParam === "listMonth")
    ) {
      setCurrentView(viewParam);
      if (calendarRef.current) {
        calendarRef.current.getApi().changeView(viewParam);
      }
    }

    // Filter param (e.g. EXAM, DEADLINE, CLASS, PERSONAL)
    const filterParam = searchParams.get("filter");
    if (filterParam) {
      const upper = filterParam.toUpperCase();
      if (["CLASS", "EXAM", "DEADLINE", "PERSONAL"].includes(upper)) {
        setActiveTypeFilters({
          CLASS: upper === "CLASS",
          EXAM: upper === "EXAM",
          DEADLINE: upper === "DEADLINE",
          PERSONAL: upper === "PERSONAL",
        });
      }
    }

    // 72-Hour Exam Crunch inspection trigger
    const showCrunchParam = searchParams.get("showCrunch");
    if (showCrunchParam === "true" || showCrunchParam === "1") {
      setConflictsDialogOpen(true);
    }
  }, [searchParams]);

  // Load Semesters
  useEffect(() => {
    async function initSemesters() {
      try {
        const sems = await DataRepository.getSemesters();
        setSemesters(sems);
        if (sems.length > 0) {
          let target = sems.find((s) => s.id === initialSemesterId);
          if (!target) target = sems.find((s) => s.is_active);
          if (!target) target = sems[0];
          setSelectedSemesterId(target.id);
        }
      } finally {
        setLoading(false);
      }
    }
    initSemesters();
  }, [initialSemesterId]);

  // Current selected semester object
  const currentSemester = useMemo(() => {
    return semesters.find((s) => s.id === selectedSemesterId);
  }, [semesters, selectedSemesterId]);

  // Load Courses and Events for selected semester
  const loadSemesterData = useCallback(async () => {
    if (!selectedSemesterId) return;
    setLoading(true);
    try {
      const [crs, evs] = await Promise.all([
        DataRepository.getCourses(selectedSemesterId),
        DataRepository.getEvents(selectedSemesterId),
      ]);
      setCourses(crs);
      setEvents(evs);

      if (initialCourseId) {
        setSelectedCourseFilter(initialCourseId);
      }
      if (initialEventId) {
        const ev = evs.find((e) => e.id === initialEventId);
        if (ev) setInspectingEvent(ev);
      }
    } catch {
      toast.error("Failed to load semester events");
    } finally {
      setLoading(false);
    }
  }, [selectedSemesterId, initialCourseId, initialEventId]);

  useEffect(() => {
    if (selectedSemesterId) {
      loadSemesterData();
    }
  }, [selectedSemesterId, loadSemesterData]);

  // Schedule Conflicts & Exam Crunch Calculation
  const scheduleConflicts = useMemo<ConflictPair[]>(() => {
    if (!currentSemester) return [];
    const range = {
      start: new Date(currentSemester.start_date),
      end: new Date(currentSemester.end_date),
    };
    return detectScheduleConflicts(events, range);
  }, [events, currentSemester]);

  const examCrunches = useMemo<CrunchWindow[]>(() => {
    return detectExamCrunches(events);
  }, [events]);

  const conflictingEventIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of scheduleConflicts) {
      ids.add(c.eventA.id.split("_occ_")[0]);
      ids.add(c.eventB.id.split("_occ_")[0]);
    }
    return ids;
  }, [scheduleConflicts]);

  // Event handlers
  const handleSaveEvent = async (data: any) => {
    try {
      if (selectedEventForEdit) {
        await DataRepository.updateEvent(selectedEventForEdit.id, data);
        toast.success("Event updated");
      } else {
        await DataRepository.createEvent(data);
        toast.success("Event created");
      }
      await loadSemesterData();
      if (inspectingEvent) {
        const updated = await DataRepository.getEvents(selectedSemesterId);
        const match = updated.find((e) => e.id === inspectingEvent.id);
        setInspectingEvent(match || null);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save event");
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await DataRepository.deleteEvent(eventId);
      setInspectingEvent(null);
      await loadSemesterData();
      toast.success("Event deleted");
    } catch {
      toast.error("Failed to delete event");
    }
  };

  const handleUpdateDeadlineStatus = async (eventId: string, newStatus: DeadlineStatus) => {
    try {
      await DataRepository.updateEvent(eventId, { deadline_status: newStatus });
      toast.success(`Deadline marked as ${newStatus}`);
      await loadSemesterData();
      if (inspectingEvent?.id === eventId) {
        setInspectingEvent((prev) => (prev ? { ...prev, deadline_status: newStatus } : null));
      }
    } catch {
      toast.error("Failed to update deadline status");
    }
  };

  // Drag-to-Reschedule Handler
  const handleEventDrop = async (info: any) => {
    const originalEvent = info.event.extendedProps?.originalEvent as CalendarEvent;
    if (!originalEvent) return;
    const { start, end, allDay } = info.event;
    if (!start) return;

    try {
      const startIso = start.toISOString();
      const endIso = end
        ? end.toISOString()
        : new Date(start.getTime() + (allDay ? 86400000 : 7200000)).toISOString();

      let updatedRecurrenceRule = originalEvent.recurrence_rule;
      if (originalEvent.recurrence_rule && originalEvent.recurrence_rule.includes("FREQ=WEEKLY")) {
        const dayTokens = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
        const newDayToken = dayTokens[start.getDay()];
        if (originalEvent.recurrence_rule.includes("BYDAY=")) {
          updatedRecurrenceRule = originalEvent.recurrence_rule.replace(
            /BYDAY=[A-Z,]+/,
            `BYDAY=${newDayToken}`
          );
        } else {
          updatedRecurrenceRule = `${originalEvent.recurrence_rule};BYDAY=${newDayToken}`;
        }
      }

      await DataRepository.updateEvent(originalEvent.id, {
        start_at: startIso,
        end_at: endIso,
        all_day: allDay,
        ...(updatedRecurrenceRule !== originalEvent.recurrence_rule
          ? { recurrence_rule: updatedRecurrenceRule }
          : {}),
      });
      toast.success("Event rescheduled");
      await loadSemesterData();
      if (inspectingEvent?.id === originalEvent.id) {
        setInspectingEvent((prev) =>
          prev
            ? {
                ...prev,
                start_at: startIso,
                end_at: endIso,
                all_day: allDay,
                recurrence_rule: updatedRecurrenceRule,
              }
            : null
        );
      }
    } catch (err: any) {
      info.revert();
      toast.error(err?.message || "Failed to reschedule event");
    }
  };

  // Drag-to-Resize Handler
  const handleEventResize = async (info: any) => {
    const originalEvent = info.event.extendedProps?.originalEvent as CalendarEvent;
    if (!originalEvent) return;
    const { start, end, allDay } = info.event;
    if (!start || !end) return;

    try {
      await DataRepository.updateEvent(originalEvent.id, {
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        all_day: allDay,
      });
      toast.success("Event duration updated");
      await loadSemesterData();
    } catch (err: any) {
      info.revert();
      toast.error(err?.message || "Failed to update duration");
    }
  };

  // RFC 5545 iCalendar (.ics) Export
  const handleExportIcs = () => {
    if (!currentSemester) return;
    try {
      const icsContent = generateICalendarFeed(currentSemester, events);
      const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentSemester.name.replace(/\s+/g, "_")}_schedule.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("iCalendar (.ics) exported");
    } catch {
      toast.error("Failed to export iCalendar");
    }
  };

  const toggleTypeFilter = (type: EventType) => {
    setActiveTypeFilters((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  // Filtered Events for Calendar
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (selectedCourseFilter !== "all") {
        if (ev.course_id !== selectedCourseFilter) return false;
      }
      if (!activeTypeFilters[ev.event_type]) return false;
      return true;
    });
  }, [events, selectedCourseFilter, activeTypeFilters]);

  // Workload counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<EventType, number> = { CLASS: 0, EXAM: 0, DEADLINE: 0, PERSONAL: 0 };
    events.forEach((ev) => {
      if (selectedCourseFilter !== "all" && ev.course_id !== selectedCourseFilter) return;
      if (counts[ev.event_type] !== undefined) {
        counts[ev.event_type]++;
      }
    });
    return counts;
  }, [events, selectedCourseFilter]);

  // Map to FullCalendar event format with weekly recurrence expansion
  const calendarEvents = useMemo<EventInput[]>(() => {
    return filteredEvents.flatMap((ev): EventInput[] => {
      const hasConflict = conflictingEventIds.has(ev.id);
      const isCompleted = ev.deadline_status === "completed";
      const isOverdue =
        ev.event_type === "DEADLINE" &&
        ev.deadline_status !== "completed" &&
        new Date(ev.end_at).getTime() < Date.now();

      let className = "fc-event-default";
      if (ev.event_type === "CLASS") className = "fc-event-class";
      if (ev.event_type === "EXAM") className = "fc-event-exam";
      if (ev.event_type === "DEADLINE") className = "fc-event-deadline";
      if (ev.event_type === "PERSONAL") className = "fc-event-personal";

      if (hasConflict) {
        className += " fc-event-conflict";
      }
      if (isCompleted) {
        className += " fc-event-completed";
      }
      if (isOverdue) {
        className += " fc-event-overdue";
      }

      const titlePrefix = ev.course?.course_code ? `[${ev.course.course_code}] ` : "";
      const statusPrefix = isCompleted ? "[✓] " : isOverdue ? "[!] " : "";
      const conflictSuffix = hasConflict ? " [! CONFLICT]" : "";
      const displayTitle = `${statusPrefix}${titlePrefix}${ev.title}${conflictSuffix}`;

      // Check for weekly recurrence
      if (ev.recurrence_rule && ev.recurrence_rule.includes("FREQ=WEEKLY")) {
        const hasInterval = /INTERVAL=\d+/.test(ev.recurrence_rule);
        const hasUntil = /UNTIL=/.test(ev.recurrence_rule);

        // If interval > 1 or has UNTIL, FullCalendar simple recurrence cannot handle it correctly.
        // We expand into individual concrete occurrences using expandRecurringOccurrences.
        if (hasInterval || hasUntil) {
          const semesterStart = currentSemester ? new Date(currentSemester.start_date) : new Date(ev.start_at);
          const semesterEnd = currentSemester ? new Date(currentSemester.end_date) : new Date("2027-12-31");
          const occurrences = expandRecurringOccurrences(ev, semesterStart, semesterEnd);

          return occurrences.map((occ) => ({
            id: occ.id,
            groupId: ev.id,
            title: displayTitle,
            start: occ.start_at,
            end: occ.end_at,
            allDay: occ.all_day,
            className,
            extendedProps: {
              originalEvent: ev,
              hasConflict,
            },
          }));
        }

        const byDayMap: Record<string, number> = {
          SU: 0,
          MO: 1,
          TU: 2,
          WE: 3,
          TH: 4,
          FR: 5,
          SA: 6,
        };
        const byDayMatch = ev.recurrence_rule.match(/BYDAY=([A-Z]+)/);
        const startDateObj = new Date(ev.start_at);
        const endDateObj = new Date(ev.end_at);

        const dayNumber =
          byDayMatch && byDayMap[byDayMatch[1]] !== undefined
            ? byDayMap[byDayMatch[1]]
            : startDateObj.getDay();

        const startTimeStr = startDateObj.toLocaleTimeString("en-GB", {
          timeZone: ev.timezone || "Asia/Ho_Chi_Minh",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        const endTimeStr = endDateObj.toLocaleTimeString("en-GB", {
          timeZone: ev.timezone || "Asia/Ho_Chi_Minh",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });

        const startRecurStr = startDateObj.toLocaleDateString("en-CA", {
          timeZone: ev.timezone || "Asia/Ho_Chi_Minh",
        });
        const endRecurStr = currentSemester?.end_date || "2027-12-31";

        return [
          {
            id: ev.id,
            groupId: ev.id,
            title: displayTitle,
            daysOfWeek: [dayNumber],
            startTime: ev.all_day ? undefined : startTimeStr,
            endTime: ev.all_day ? undefined : endTimeStr,
            startRecur: startRecurStr,
            endRecur: endRecurStr,
            allDay: ev.all_day,
            className,
            extendedProps: {
              originalEvent: ev,
              hasConflict,
            },
          },
        ];
      }

      return [
        {
          id: ev.id,
          title: displayTitle,
          start: ev.start_at,
          end: ev.end_at,
          allDay: ev.all_day,
          className,
          extendedProps: {
            originalEvent: ev,
            hasConflict,
          },
        },
      ];
    });
  }, [filteredEvents, currentSemester, conflictingEventIds]);

  // Switch Calendar View
  const handleViewChange = (view: "dayGridMonth" | "timeGridWeek" | "listMonth") => {
    setCurrentView(view);
    const api = calendarRef.current?.getApi();
    if (api) {
      api.changeView(view);
    }
  };

  const handleDateClick = (arg: { date: Date }) => {
    setClickedDate(arg.date);
    setSelectedEventForEdit(null);
    setEventDialogOpen(true);
  };

  const handleEventClick = (info: any) => {
    const original = info.event.extendedProps?.originalEvent as CalendarEvent;
    if (original) {
      setInspectingEvent(original);
    }
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-3.5rem)] md:h-screen p-4 md:p-6 space-y-3 sm:space-y-4 overflow-hidden">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3 sm:pb-4 shrink-0">
        {/* Semester selector */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center space-x-2 shrink-0">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Semester:
            </span>
          </div>

          <div className="w-44 xs:w-52 sm:w-56 shrink-0">
            <Select
              value={selectedSemesterId}
              onValueChange={setSelectedSemesterId}
              disabled={semesters.length === 0}
            >
              <SelectTrigger className="h-8 text-xs font-medium">
                <SelectValue placeholder="Select semester..." />
              </SelectTrigger>
              <SelectContent>
                {semesters.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name} {s.is_active ? "(Active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading && (
            <span className="text-[10px] font-mono text-muted-foreground animate-pulse hidden sm:inline">
              Updating...
            </span>
          )}

          {/* View switcher buttons */}
          <div className="flex items-center rounded-md border border-border p-0.5 bg-muted shrink-0">
            <button
              onClick={() => handleViewChange("dayGridMonth")}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                currentView === "dayGridMonth"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Month
            </button>
            <button
              onClick={() => handleViewChange("timeGridWeek")}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                currentView === "timeGridWeek"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Week
            </button>
            <button
              onClick={() => handleViewChange("listMonth")}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                currentView === "listMonth"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Agenda
            </button>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center space-x-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-mono"
            onClick={handleExportIcs}
            title="Export RFC 5545 iCalendar feed (.ics) for Google/Apple/Outlook"
          >
            <Download className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
            <span className="hidden sm:inline">Export</span> .ICS
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setClickedDate(new Date());
              setSelectedEventForEdit(null);
              setEventDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Conflict & Exam Crunch Warning Strip */}
      {(scheduleConflicts.length > 0 || examCrunches.length > 0) && (
        <div className="flex items-center justify-between px-3 py-2 rounded-md border border-border bg-card text-xs font-mono shrink-0 gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {scheduleConflicts.length > 0 && (
              <span className="flex items-center space-x-1.5 font-semibold text-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-foreground shrink-0" />
                <span>
                  [{scheduleConflicts.length}{" "}
                  {scheduleConflicts.length === 1 ? "CONFLICT" : "CONFLICTS"} DETECTED]
                </span>
              </span>
            )}
            {examCrunches.length > 0 && (
              <span className="flex items-center space-x-1.5 text-muted-foreground">
                <Zap className="h-3.5 w-3.5 shrink-0" />
                <span>
                  [{examCrunches.length} CRUNCH WINDOW
                  {examCrunches.length === 1 ? "" : "S"}]
                </span>
              </span>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[11px] font-mono px-2 shrink-0"
            onClick={() => setConflictsDialogOpen(true)}
          >
            Inspect Issues
          </Button>
        </div>
      )}

      {/* Filter Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs border border-border bg-card p-2 sm:p-2.5 rounded-md max-w-full overflow-hidden shrink-0">
        {/* Course Filter Dropdown */}
        <div className="flex items-center space-x-2 shrink-0">
          <span className="font-mono text-[10px] uppercase text-muted-foreground shrink-0">
            Filter Course:
          </span>
          <div className="w-36 xs:w-44">
            <Select
              value={selectedCourseFilter}
              onValueChange={setSelectedCourseFilter}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.course_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Event Type Filter Chips (Strict Monochrome, horizontally scrollable on mobile) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full scrollbar-none shrink-0">
          <span className="font-mono text-[10px] uppercase text-muted-foreground mr-0.5 shrink-0 hidden lg:inline">
            Categories:
          </span>
          {(["CLASS", "EXAM", "DEADLINE", "PERSONAL"] as EventType[]).map((type) => {
            const active = activeTypeFilters[type];
            return (
              <button
                key={type}
                onClick={() => toggleTypeFilter(type)}
                className={cn(
                  "flex items-center space-x-1.5 px-2 py-0.5 rounded-sm border text-[11px] font-mono transition-colors shrink-0 whitespace-nowrap",
                  active
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-semibold"
                    : "border-border bg-background text-muted-foreground hover:border-neutral-400"
                )}
              >
                <span>{type}</span>
                <span
                  className={cn(
                    "text-[9px] opacity-75",
                    active
                      ? "text-white/90 dark:text-neutral-900/90"
                      : "text-muted-foreground"
                  )}
                >
                  ({categoryCounts[type]})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main FullCalendar Area */}
      <div className="flex-1 rounded-md border border-border bg-card p-3 overflow-hidden shadow-none">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={currentView}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}
          events={calendarEvents}
          editable={true}
          eventDurationEditable={true}
          droppable={true}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          selectable={true}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          height="100%"
          timeZone="local"
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            meridiem: false,
          }}
          slotLabelFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          dayMaxEvents={3}
          allDaySlot={true}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
        />
      </div>

      {/* Event Details Panel */}
      {inspectingEvent && (
        <EventDetailPanel
          event={inspectingEvent}
          onClose={() => setInspectingEvent(null)}
          onEdit={(ev) => {
            setSelectedEventForEdit(ev);
            setEventDialogOpen(true);
          }}
          onDelete={handleDeleteEvent}
          onToggleStatus={handleUpdateDeadlineStatus}
        />
      )}

      {/* Event Dialog */}
      <CalendarEventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        semesterId={selectedSemesterId}
        courses={courses}
        initialCourseId={selectedCourseFilter !== "all" ? selectedCourseFilter : null}
        initialDate={clickedDate}
        event={selectedEventForEdit}
        onSave={handleSaveEvent}
      />

      {/* Conflicts & Crunch Review Dialog */}
      <Dialog open={conflictsDialogOpen} onOpenChange={setConflictsDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-mono flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Academic Schedule Analysis</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Schedule Conflicts */}
            <div>
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground mb-2">
                Interval Overlap Conflicts ({scheduleConflicts.length})
              </h4>
              {scheduleConflicts.length === 0 ? (
                <p className="text-muted-foreground font-mono text-[11px]">
                  No overlapping schedule collisions detected.
                </p>
              ) : (
                <div className="space-y-2">
                  {scheduleConflicts.map((c, i) => (
                    <div
                      key={i}
                      className="p-3 rounded border border-border bg-card space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="font-bold uppercase text-foreground">
                          [{c.severity} COLLISION]
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(c.overlapStart).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}{" "}
                          –{" "}
                          {new Date(c.overlapEnd).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </span>
                      </div>
                      <div className="space-y-1 text-foreground">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">• {c.eventA.title}</span>
                          <button
                            onClick={() => {
                              setConflictsDialogOpen(false);
                              setInspectingEvent(c.eventA);
                            }}
                            className="text-[11px] underline text-muted-foreground hover:text-foreground"
                          >
                            Inspect
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">• {c.eventB.title}</span>
                          <button
                            onClick={() => {
                              setConflictsDialogOpen(false);
                              setInspectingEvent(c.eventB);
                            }}
                            className="text-[11px] underline text-muted-foreground hover:text-foreground"
                          >
                            Inspect
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Exam & Deadline Crunch Windows */}
            <div>
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground mb-2">
                72-Hour Exam & Deadline Crunch Windows ({examCrunches.length})
              </h4>
              {examCrunches.length === 0 ? (
                <p className="text-muted-foreground font-mono text-[11px]">
                  No consecutive exam crunches detected within 72-hour windows.
                </p>
              ) : (
                <div className="space-y-2">
                  {examCrunches.map((w, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded border border-border bg-card space-y-1.5 font-mono text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold uppercase text-foreground">
                          [{w.severity} CRUNCH: {w.events.length} HIGH-STAKES EVENTS]
                        </span>
                        <span className="text-muted-foreground">
                          Est. Study: {w.recommendedPreparationHours}h
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {w.startDate.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        –{" "}
                        {w.endDate.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <ul className="space-y-0.5 text-[11px] text-foreground font-sans pt-1">
                        {w.events.map((ev) => (
                          <li key={ev.id}>
                            • [{ev.event_type}] {ev.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
