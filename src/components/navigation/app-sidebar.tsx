"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Semester, Course } from "@/types/database";
import { DataRepository } from "@/lib/data/repository";
import { useTheme } from "@/components/theme-provider";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Network,
  FolderTree,
  Calendar,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Moon,
  Sun,
  LogOut,
  Folder,
  CircleDot,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "./global-search";

interface AppSidebarProps {
  onRefreshNeeded?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function AppSidebar({ mobileOpen, onCloseMobile }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [expandedSemesters, setExpandedSemesters] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);

  const fetchNavData = async () => {
    try {
      const data = await DataRepository.getSemesters();
      setSemesters(data);
      // Auto-expand current or first active semester
      const initialExpanded: Record<string, boolean> = {};
      data.forEach((s) => {
        if (s.is_active || pathname.includes(s.id)) {
          initialExpanded[s.id] = true;
        }
      });
      setExpandedSemesters((prev) => ({ ...initialExpanded, ...prev }));
    } catch (err) {
      console.error("Failed to load sidebar navigation data", err);
    }
  };

  useEffect(() => {
    fetchNavData();
    // Listen for custom refresh events
    const handleDataChange = () => fetchNavData();
    window.addEventListener("neuron_data_changed", handleDataChange);
    return () => window.removeEventListener("neuron_data_changed", handleDataChange);
  }, [pathname]);

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleSemester = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedSemesters((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    }
    router.push("/login");
  };

  const isSemesterActive = (id: string) =>
    pathname === `/app/semesters/${id}` || pathname.startsWith(`/app/semesters/${id}/`);

  const isCourseActive = (courseId: string) =>
    pathname.includes(`/courses/${courseId}`);

  return (
    <>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar transition-transform duration-200 ease-in-out md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link
            href="/app/semesters"
            className="flex items-center space-x-2.5 font-mono text-sm font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity"
            onClick={onCloseMobile}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <Network className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="leading-none text-base">NEURON</span>
              <span className="text-[9px] font-normal tracking-widest text-muted-foreground uppercase">
                Academic
              </span>
            </div>
          </Link>

          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setSearchOpen(true)}
            className="text-muted-foreground hover:text-foreground"
            title="Search (Ctrl+K)"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Search Bar Trigger */}
        <div className="p-3 pb-1">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:border-neutral-400 transition-colors"
          >
            <span className="flex items-center space-x-2">
              <Search className="h-3.5 w-3.5" />
              <span>Search...</span>
            </span>
            <kbd className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded border border-border">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {/* Main Links */}
          <div className="space-y-0.5">
            <Link
              href="/app/semesters"
              onClick={onCloseMobile}
              className={cn(
                "flex items-center space-x-2 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors",
                pathname === "/app/semesters"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <FolderTree className="h-4 w-4 shrink-0" />
              <span>All Semesters</span>
            </Link>

            <Link
              href="/app/calendar"
              onClick={onCloseMobile}
              className={cn(
                "flex items-center space-x-2 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors",
                pathname.startsWith("/app/calendar")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Semester Calendar</span>
            </Link>
          </div>

          {/* Semesters & Courses Tree */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2.5 pt-2">
              <span className="text-[10px] font-semibold font-mono uppercase tracking-wider text-muted-foreground">
                Folders & Courses
              </span>
              <Link
                href="/app/semesters"
                className="text-muted-foreground hover:text-foreground"
                title="Create semester"
              >
                <Plus className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-0.5 pt-1">
              {semesters.map((semester) => {
                const isExpanded = !!expandedSemesters[semester.id];
                const active = isSemesterActive(semester.id);

                return (
                  <div key={semester.id} className="space-y-0.5">
                    {/* Semester Item */}
                    <div
                      className={cn(
                        "group flex items-center justify-between rounded-sm px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                        active && !pathname.includes("/courses/")
                          ? "bg-accent text-foreground font-semibold"
                          : "text-foreground hover:bg-muted"
                      )}
                      onClick={() => {
                        router.push(`/app/semesters/${semester.id}`);
                        if (onCloseMobile) onCloseMobile();
                      }}
                    >
                      <div className="flex items-center space-x-1.5 truncate">
                        <button
                          type="button"
                          onClick={(e) => toggleSemester(semester.id, e)}
                          className="p-0.5 hover:bg-muted rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                        </button>
                        <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{semester.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {semester.courses?.length ?? 0}
                      </span>
                    </div>

                    {/* Courses Sublist */}
                    {isExpanded && semester.courses && semester.courses.length > 0 && (
                      <div className="ml-5 pl-2 border-l border-border space-y-0.5 py-0.5">
                        {semester.courses.map((course: Course) => {
                          const courseActive = isCourseActive(course.id);
                          return (
                            <Link
                              key={course.id}
                              href={`/app/semesters/${semester.id}/courses/${course.id}`}
                              onClick={onCloseMobile}
                              className={cn(
                                "flex items-center space-x-2 rounded-sm px-2 py-1 text-[11px] transition-colors truncate",
                                courseActive
                                  ? "bg-primary text-primary-foreground font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                            >
                              <CircleDot className="h-3 w-3 shrink-0" />
                              <span className="font-mono font-semibold shrink-0">
                                {course.course_code}
                              </span>
                              <span className="truncate">{course.course_name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {semesters.length === 0 && (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No semesters added.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Settings & Theme */}
        <div className="border-t border-border p-3 space-y-1">
          <Link
            href="/app/settings"
            onClick={onCloseMobile}
            className={cn(
              "flex items-center space-x-2 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors",
              pathname === "/app/settings"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </Link>

          <div className="flex items-center justify-between pt-1 px-2 text-xs">
            <button
              onClick={toggleTheme}
              className="flex items-center space-x-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Toggle theme"
            >
              {theme === "light" ? (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Light Mode</span>
                </>
              )}
            </button>

            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
