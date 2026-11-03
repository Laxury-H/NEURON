"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CalendarEvent } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  Bell,
  RotateCw,
  Edit2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

interface EventDetailPanelProps {
  event: CalendarEvent | null;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => Promise<void>;
}

export function EventDetailPanel({
  event,
  onClose,
  onEdit,
  onDelete,
}: EventDetailPanelProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  if (!event) return null;

  const startDate = new Date(event.start_at);
  const endDate = new Date(event.end_at);

  const getReminderLabel = (mins: number) => {
    if (mins === 15) return "15 minutes before";
    if (mins === 30) return "30 minutes before";
    if (mins === 60) return "1 hour before";
    if (mins === 1440) return "1 day before";
    if (mins === 4320) return "3 days before";
    return `${mins} minutes before`;
  };

  return (
    <div className="absolute top-0 right-0 bottom-0 w-80 md:w-96 border-l border-border bg-background shadow-xl z-30 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4 bg-muted/40">
        <div className="flex items-center space-x-2 truncate">
          <Badge variant="default" className="text-[10px] font-mono uppercase">
            {event.event_type}
          </Badge>
          <span className="text-[10px] font-mono text-muted-foreground uppercase">
            Academic Schedule
          </span>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => onEdit(event)}
            title="Edit event"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onClose}
            title="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        <div>
          <h2 className="text-base font-bold text-foreground leading-snug">
            {event.title}
          </h2>
          {event.course && (
            <div className="flex items-center space-x-2 mt-2">
              <span className="font-mono text-xs font-semibold text-foreground">
                {event.course.course_code}
              </span>
              <span className="text-muted-foreground truncate">
                {event.course.course_name}
              </span>
            </div>
          )}
        </div>

        {/* Date & Time Info */}
        <div className="p-3 rounded-md border border-border bg-card space-y-2.5">
          <div className="flex items-start space-x-2.5 text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0 text-foreground mt-0.5" />
            <div>
              <p className="font-medium text-foreground">
                {startDate.toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              {!event.all_day ? (
                <p className="text-[11px] font-mono mt-0.5">
                  {startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                  {endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              ) : (
                <p className="text-[11px] font-mono mt-0.5">All Day Event</p>
              )}
            </div>
          </div>

          {event.location && (
            <div className="flex items-center space-x-2.5 text-muted-foreground pt-1 border-t border-border/60">
              <MapPin className="h-4 w-4 shrink-0 text-foreground" />
              <span className="text-foreground">{event.location}</span>
            </div>
          )}

          {event.recurrence_rule && (
            <div className="flex items-center space-x-2.5 text-muted-foreground pt-1 border-t border-border/60">
              <RotateCw className="h-4 w-4 shrink-0 text-foreground" />
              <span className="text-foreground font-mono text-[11px]">
                Repeats weekly ({event.recurrence_rule})
              </span>
            </div>
          )}

          {event.reminder_offsets_minutes && event.reminder_offsets_minutes.length > 0 && (
            <div className="flex items-center space-x-2.5 text-muted-foreground pt-1 border-t border-border/60">
              <Bell className="h-4 w-4 shrink-0 text-foreground" />
              <span className="text-foreground">
                Reminder: {getReminderLabel(event.reminder_offsets_minutes[0])}
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div className="space-y-1">
            <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
              Event Description & Syllabus
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {event.description}
            </p>
          </div>
        )}

        {/* Open Linked Course Action */}
        {event.course && (
          <div className="pt-2">
            <Link
              href={`/app/semesters/${event.semester_id}/courses/${event.course.id}`}
              className="w-full flex items-center justify-between p-2.5 rounded border border-border bg-card hover:bg-muted transition-colors text-xs font-medium text-foreground"
            >
              <div className="flex items-center space-x-2">
                <BookOpen className="h-4 w-4" />
                <span>Open {event.course.course_code} Neural Graph</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-border p-3 bg-muted/20 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8"
          onClick={() => onEdit(event)}
        >
          <Edit2 className="h-3.5 w-3.5 mr-1.5" />
          Edit Event
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 h-8"
          onClick={() => setDeleteConfirmOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Delete
        </Button>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Calendar Event?"
        description={`Are you sure you want to delete "${event.title}"?`}
        confirmLabel="Delete Event"
        onConfirm={() => onDelete(event.id)}
      />
    </div>
  );
}
