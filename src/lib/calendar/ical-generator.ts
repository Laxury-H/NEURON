import type { CalendarEvent, Semester } from "../../types/database.ts";

function formatUtcIcal(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeIcalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string for a semester and its events.
 */
export function generateICalendarFeed(
  semester: Semester,
  events: CalendarEvent[]
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NEURON Academic Intelligence//Semester Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:NEURON - ${semester.name}`,
    `X-WR-TIMEZONE:${events[0]?.timezone || "Asia/Ho_Chi_Minh"}`,
  ];

  for (const event of events) {
    const uid = `${event.id}@neuron.academic`;
    const dtStamp = formatUtcIcal(new Date());
    const dtStart = formatUtcIcal(new Date(event.start_at));
    const dtEnd = formatUtcIcal(new Date(event.end_at));

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:[${event.event_type}] ${escapeIcalText(event.title)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcalText(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeIcalText(event.location)}`);
    }
    if (event.recurrence_rule) {
      lines.push(`RRULE:${event.recurrence_rule}`);
    }
    lines.push(
      `STATUS:${event.deadline_status === "completed" ? "COMPLETED" : "CONFIRMED"}`
    );
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
