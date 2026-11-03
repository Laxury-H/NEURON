"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";

import { CalendarEvent, Course, Semester, EventType } from "@/types/database";
import { DataRepository } from "@/lib/data/repository";
import { CalendarEventDialog } from "./calendar-event-dialog";
import { EventDetailPanel } from "./event-detail-panel";
import { Button } from "@/components/ui/button";
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

  // Load Semesters
  useEffect(() => {
    async function initSemesters() {
      try {
        const sems = await DataRepository.getSemesters();
        setSemesters(sems);
        if (sems.length > 0) {
          // If initialSemesterId provided in props or active semester exists
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
    } catch {
      toast.error("Failed to save event");
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

  const toggleTypeFilter = (type: EventType) => {
    setActiveTypeFilters((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  // Filtered Events for Calendar
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Course filter
      if (selectedCourseFilter !== "all") {
        if (ev.course_id !== selectedCourseFilter) return false;
      }
      // Type filter
      if (!activeTypeFilters[ev.event_type]) return false;
      return true;
    });
  }, [events, selectedCourseFilter, activeTypeFilters]);

  // Map to FullCalendar event format with weekly recurrence expansion
  const calendarEvents = useMemo(() => {
    return filteredEvents.map((ev) => {
      let className = "fc-event-default";
      if (ev.event_type === "CLASS") className = "fc-event-class";
      if (ev.event_type === "EXAM") className = "fc-event-exam";
      if (ev.event_type === "DEADLINE") className = "fc-event-deadline";
      if (ev.event_type === "PERSONAL") className = "fc-event-personal";

      const titlePrefix = ev.course?.course_code ? `[${ev.course.course_code}] ` : "";

      // Check for weekly recurrence
      if (ev.recurrence_rule && ev.recurrence_rule.includes("FREQ=WEEKLY")) {
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

        // Format times in Asia/Ho_Chi_Minh
        const startTimeStr = startDateObj.toLocaleTimeString("en-GB", {
          timeZone: "Asia/Ho_Chi_Minh",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        const endTimeStr = endDateObj.toLocaleTimeString("en-GB", {
          timeZone: "Asia/Ho_Chi_Minh",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });

        const startRecurStr = startDateObj.toLocaleDateString("en-CA", {
          timeZone: "Asia/Ho_Chi_Minh",
        });
        const endRecurStr = currentSemester?.end_date || "2027-12-31";

        return {
          id: ev.id,
          groupId: ev.id,
          title: `${titlePrefix}${ev.title}`,
          daysOfWeek: [dayNumber],
          startTime: ev.all_day ? undefined : startTimeStr,
          endTime: ev.all_day ? undefined : endTimeStr,
          startRecur: startRecurStr,
          endRecur: endRecurStr,
          allDay: ev.all_day,
          className,
          extendedProps: {
            originalEvent: ev,
          },
        };
      }

      return {
        id: ev.id,
        title: `${titlePrefix}${ev.title}`,
        start: ev.start_at,
        end: ev.end_at,
        allDay: ev.all_day,
        className,
        extendedProps: {
          originalEvent: ev,
        },
      };
    });
  }, [filteredEvents, currentSemester]);

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
    const original = info.event.extendedProps.originalEvent as CalendarEvent;
    if (original) {
      setInspectingEvent(original);
    }
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-3.5rem)] md:h-screen p-4 md:p-6 space-y-4 overflow-hidden">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border pb-4">
        {/* Semester selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Semester:
            </span>
          </div>

          <div className="w-56">
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
          <div className="flex items-center rounded-md border border-border p-0.5 bg-muted">
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
        <div className="flex items-center space-x-2">
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

      {/* Filter Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs border border-border bg-card p-2.5 rounded-md">
        {/* Course Filter Dropdown */}
        <div className="flex items-center space-x-2">
          <span className="font-mono text-[10px] uppercase text-muted-foreground">
            Filter Course:
          </span>
          <div className="w-44">
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

        {/* Event Type Filter Chips (Strict Monochrome) */}
        <div className="flex items-center space-x-1.5 flex-wrap">
          <span className="font-mono text-[10px] uppercase text-muted-foreground mr-1 hidden sm:inline">
            Categories:
          </span>
          {(["CLASS", "EXAM", "DEADLINE", "PERSONAL"] as EventType[]).map((type) => {
            const active = activeTypeFilters[type];
            return (
              <button
                key={type}
                onClick={() => toggleTypeFilter(type)}
                className={cn(
                  "flex items-center space-x-1 px-2 py-0.5 rounded-sm border text-[11px] font-mono transition-colors",
                  active
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-semibold"
                    : "border-border bg-background text-muted-foreground hover:border-neutral-400"
                )}
              >
                <span>{type}</span>
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
          editable={false}
          selectable={true}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          height="100%"
          timeZone="Asia/Ho_Chi_Minh"
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
    </div>
  );
}
