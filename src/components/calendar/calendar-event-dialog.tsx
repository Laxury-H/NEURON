"use client";

import React, { useState, useEffect } from "react";
import { CalendarEvent, Course, EventType } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: string;
  courses: Course[];
  initialCourseId?: string | null;
  initialDate?: Date | null;
  event?: CalendarEvent | null;
  onSave: (data: {
    semester_id: string;
    course_id?: string | null;
    title: string;
    description?: string | null;
    event_type: EventType;
    location?: string | null;
    start_at: string;
    end_at: string;
    all_day?: boolean;
    recurrence_rule?: string | null;
    timezone?: string;
    reminder_offsets_minutes?: number[];
  }) => Promise<void>;
}

export function CalendarEventDialog({
  open,
  onOpenChange,
  semesterId,
  courses,
  initialCourseId,
  initialDate,
  event,
  onSave,
}: CalendarEventDialogProps) {
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<EventType>("CLASS");
  const [courseId, setCourseId] = useState<string>("none");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [repeatsWeekly, setRepeatsWeekly] = useState(false);
  const [reminderOffset, setReminderOffset] = useState("15");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setEventType(event.event_type);
      setCourseId(event.course_id || "none");
      const s = new Date(event.start_at);
      const e = new Date(event.end_at);
      setStartDate(s.toISOString().split("T")[0]);
      setStartTime(s.toTimeString().slice(0, 5));
      setEndDate(e.toISOString().split("T")[0]);
      setEndTime(e.toTimeString().slice(0, 5));
      setAllDay(event.all_day);
      setLocation(event.location || "");
      setDescription(event.description || "");
      setRepeatsWeekly(!!event.recurrence_rule);
      setReminderOffset(
        event.reminder_offsets_minutes?.[0]
          ? String(event.reminder_offsets_minutes[0])
          : "15"
      );
    } else {
      const defaultDate = initialDate ? new Date(initialDate) : new Date();
      const dateStr = defaultDate.toISOString().split("T")[0];
      setTitle("");
      setEventType("CLASS");
      setCourseId(initialCourseId || "none");
      setStartDate(dateStr);
      setStartTime("08:00");
      setEndDate(dateStr);
      setEndTime("10:00");
      setAllDay(false);
      setLocation("");
      setDescription("");
      setRepeatsWeekly(false);
      setReminderOffset("15");
    }
  }, [event, initialDate, initialCourseId, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) return;

    setLoading(true);
    try {
      const startDateTime = allDay
        ? `${startDate}T00:00:00+07:00`
        : `${startDate}T${startTime}:00+07:00`;
      const endDateTime = allDay
        ? `${endDate || startDate}T23:59:59+07:00`
        : `${endDate || startDate}T${endTime}:00+07:00`;

      const dayOfWeekStr = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][
        new Date(startDate).getDay()
      ];
      const recurrenceRule = repeatsWeekly ? `FREQ=WEEKLY;BYDAY=${dayOfWeekStr}` : null;

      await onSave({
        semester_id: semesterId,
        course_id: courseId === "none" ? null : courseId,
        title: title.trim(),
        description: description.trim() || null,
        event_type: eventType,
        location: location.trim() || null,
        start_at: new Date(startDateTime).toISOString(),
        end_at: new Date(endDateTime).toISOString(),
        all_day: allDay,
        recurrence_rule: recurrenceRule,
        timezone: "Asia/Ho_Chi_Minh",
        reminder_offsets_minutes: [parseInt(reminderOffset) || 15],
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {event ? "Edit Calendar Event" : "Create Calendar Event"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1 text-xs">
          <div className="space-y-1">
            <Label>Event Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. EE4010 Lecture: Load Flow Methods"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={eventType}
                onValueChange={(val) => setEventType(val as EventType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLASS">Class / Lecture</SelectItem>
                  <SelectItem value="EXAM">Exam / Quiz</SelectItem>
                  <SelectItem value="DEADLINE">Assignment Deadline</SelectItem>
                  <SelectItem value="PERSONAL">Personal Semester Event</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Associated Course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select course..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (General / Personal)</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.course_code} – {c.course_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            {!allDay && (
              <div className="space-y-1">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
            {!allDay && (
              <div className="space-y-1">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4 pt-1">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="rounded border-border text-primary"
              />
              <span className="text-xs">All Day Event</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={repeatsWeekly}
                onChange={(e) => setRepeatsWeekly(e.target.checked)}
                className="rounded border-border text-primary"
              />
              <span className="text-xs">Repeats Weekly</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Location / Room</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Hall C2-101 or Online"
              />
            </div>

            <div className="space-y-1">
              <Label>Reminder</Label>
              <Select value={reminderOffset} onValueChange={setReminderOffset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes before</SelectItem>
                  <SelectItem value="30">30 minutes before</SelectItem>
                  <SelectItem value="60">1 hour before</SelectItem>
                  <SelectItem value="1440">1 day before</SelectItem>
                  <SelectItem value="4320">3 days before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Description / Syllabus Note</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Exam topics, submission link, materials to bring..."
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading || !title.trim()}>
              {loading ? "Saving..." : event ? "Update Event" : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
