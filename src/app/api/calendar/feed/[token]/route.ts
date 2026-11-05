import { DataRepository } from "../../../../../lib/data/repository.ts";
import { generateICalendarFeed } from "../../../../../lib/calendar/ical-generator.ts";
import { isSupabaseConfigured, createClient } from "../../../../../lib/supabase/client.ts";
import type { Semester, CalendarEvent } from "../../../../../types/database.ts";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || !token.trim()) {
      return new Response("Invalid or missing WebCal subscription token", {
        status: 401,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const cleanToken = token.trim();

    let targetSemester: Semester | null = null;
    let targetEvents: CalendarEvent[] = [];

    // 1. Supabase Mode: Authenticate token against profiles.webcal_token
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, webcal_token")
          .eq("webcal_token", cleanToken)
          .maybeSingle();

        if (!profile) {
          return new Response("Unauthorized WebCal token", {
            status: 401,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }

        const { data: semesters } = await supabase
          .from("semesters")
          .select("*")
          .eq("user_id", profile.id)
          .order("sort_order", { ascending: true });

        if (semesters && semesters.length > 0) {
          targetSemester = semesters.find((s) => s.is_active) || semesters[0];
        }

        const { data: dbEvents } = await supabase
          .from("events")
          .select("*, course:courses(*)")
          .eq("user_id", profile.id);

        if (dbEvents) {
          targetEvents = dbEvents as CalendarEvent[];
        }
      }
    }

    // 2. LocalStore Fallback: If unconfigured or token matches local session
    if (!targetSemester) {
      const semesters = await DataRepository.getSemesters();
      if (semesters.length > 0) {
        targetSemester = semesters.find((s) => s.is_active) || semesters[0];
        targetEvents = await DataRepository.getEvents(targetSemester.id);
      } else {
        targetSemester = {
          id: "sem-feed-default",
          user_id: "local-user",
          name: "NEURON Academic Schedule",
          academic_year: "2026–2027",
          start_date: "2026-01-01",
          end_date: "2026-12-31",
          is_active: true,
          sort_order: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        targetEvents = [];
      }
    }

    const icsContent = generateICalendarFeed(targetSemester, targetEvents);
    const safeName = targetSemester.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_\-\.]/g, "_")
      .replace(/_+/g, "_");

    return new Response(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="neuron_calendar_${safeName || "schedule"}.ics"`,
        "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
        "X-Published-TTL": "PT1H",
      },
    });
  } catch (err: any) {
    console.error("Error serving WebCal subscription feed:", err);
    return new Response("Error generating calendar feed", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
