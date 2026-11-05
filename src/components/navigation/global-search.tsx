"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataRepository } from "@/lib/data/repository";
import { GlobalSearchResult } from "@/types/database";
import {
  Search,
  FolderTree,
  BookOpen,
  User,
  FileText,
  Calendar,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: () => void;
}

interface AcademicQueryIntent {
  title: string;
  subtitle: string;
  url: string;
}

function parseAcademicIntent(query: string): AcademicQueryIntent | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  if (
    q.startsWith("?") ||
    q.includes("when") ||
    q.includes("exam") ||
    q.includes("due") ||
    q.includes("deadline") ||
    q.includes("schedule")
  ) {
    const isExam = q.includes("exam");
    const isDeadline = q.includes("due") || q.includes("deadline");
    return {
      title: isExam
        ? "Ask NEURON: View Upcoming Exams"
        : isDeadline
        ? "Ask NEURON: View Assignment Deadlines"
        : "Ask NEURON: Open Semester Calendar",
      subtitle: "Filter calendar schedule directly",
      url: "/app/calendar",
    };
  }

  if (
    q.startsWith("who") ||
    q.includes("expert") ||
    q.includes("knows") ||
    q.includes("teammate") ||
    q.includes("partner")
  ) {
    const topic = q
      .replace(/who knows|expert in|teammate for|partner for|\?|who/g, "")
      .trim();
    return {
      title: topic
        ? `Ask NEURON: Find classmates or experts in "${topic}"`
        : "Ask NEURON: Browse Academic Contact Directory",
      subtitle: "Locate skills, research areas, and study partners",
      url: "/app/semesters",
    };
  }

  return null;
}

function extractSearchTerm(query: string): string {
  let q = query.replace(/^\?\s*/, "").trim();
  q = q.replace(
    /^(who knows|who is expert in|who is|expert in|experts in|teammate for|partner for|when is|when are|what is|find)\s+/i,
    ""
  );
  return q.replace(/[?!.]+$/, "").trim();
}

export function GlobalSearch({ open, onOpenChange, onSelect }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const intent = useMemo(() => parseAcademicIntent(query), [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const cleaned = extractSearchTerm(query);
        const res = await DataRepository.globalSearch(cleaned || query.trim());
        setResults(res);
        setSelectedIndex(0);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const totalItems = (intent ? 1 : 0) + results.length;

  const handleSelect = (url: string) => {
    onOpenChange(false);
    if (onSelect) onSelect();
    router.push(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (totalItems === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (intent && selectedIndex === 0) {
        handleSelect(results[0]?.url || intent.url);
      } else {
        const resIdx = intent ? selectedIndex - 1 : selectedIndex;
        if (results[resIdx]) {
          handleSelect(results[resIdx].url);
        }
      }
    }
  };

  const getIcon = (type: GlobalSearchResult["type"]) => {
    switch (type) {
      case "semester":
        return <FolderTree className="h-4 w-4 text-muted-foreground" />;
      case "course":
        return <BookOpen className="h-4 w-4 text-muted-foreground" />;
      case "person":
        return <User className="h-4 w-4 text-muted-foreground" />;
      case "document":
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case "event":
        return <Calendar className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden border border-border">
        <DialogHeader className="sr-only">
          <DialogTitle>Search NEURON</DialogTitle>
        </DialogHeader>

        <div className="flex items-center px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0 mr-2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search semesters, courses, people, files, events... or type '?'"
            className="border-0 shadow-none focus-visible:ring-0 text-sm h-12 px-0 bg-transparent font-sans"
            autoFocus
          />
          <kbd className="hidden sm:inline-block pointer-events-none select-none rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-2 space-y-1">
          {loading && (
            <div className="p-4 text-center text-xs text-muted-foreground font-mono animate-pulse">
              Searching knowledge index...
            </div>
          )}

          {/* Ask NEURON Action Card */}
          {intent && (
            <button
              onClick={() => handleSelect(results[0]?.url || intent.url)}
              onMouseEnter={() => setSelectedIndex(0)}
              className={`w-full text-left flex items-center justify-between p-2.5 rounded-sm transition-colors text-xs border ${
                selectedIndex === 0
                  ? "bg-accent border-foreground font-medium"
                  : "bg-muted/40 border-border hover:bg-muted"
              }`}
            >
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="h-7 w-7 rounded-sm bg-foreground text-background flex items-center justify-center shrink-0 font-mono text-xs font-bold">
                  AI
                </div>
                <div className="truncate">
                  <p className="font-semibold text-foreground truncate">
                    {intent.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {intent.subtitle}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                <Badge variant="default" className="text-[9px] font-mono">
                  ACTION
                </Badge>
                {selectedIndex === 0 && (
                  <kbd className="hidden sm:inline font-mono text-[9px] bg-muted px-1 rounded border border-border">
                    ↵
                  </kbd>
                )}
              </div>
            </button>
          )}

          {!loading && query && !intent && results.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && !query && (
            <div className="p-3 space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2">
                Quick Navigation
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleSelect("/app/semesters")}
                  className="flex items-center justify-between p-2 rounded-sm border border-border bg-muted/30 hover:bg-muted text-xs transition-colors text-left"
                >
                  <span className="flex items-center space-x-2">
                    <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>All Semesters</span>
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </button>
                <button
                  onClick={() => handleSelect("/app/calendar")}
                  className="flex items-center justify-between p-2 rounded-sm border border-border bg-muted/30 hover:bg-muted text-xs transition-colors text-left"
                >
                  <span className="flex items-center space-x-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Semester Calendar</span>
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </button>
                <button
                  onClick={() => handleSelect("/app/settings")}
                  className="flex items-center justify-between p-2 rounded-sm border border-border bg-muted/30 hover:bg-muted text-xs transition-colors text-left"
                >
                  <span className="flex items-center space-x-2">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Settings & Backup</span>
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>

              {/* Natural Language Query Examples */}
              <div className="pt-2 border-t border-border/50 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-1">
                  Ask NEURON (Natural Queries)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "when is my next exam?",
                    "who knows Newton-Raphson?",
                    "Power System",
                    "Midterm",
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => setQuery(example)}
                      className="px-2 py-0.5 rounded-sm border border-border bg-background text-[11px] text-muted-foreground hover:text-foreground font-mono transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading &&
            results.map((result, idx) => {
              const itemIdx = intent ? idx + 1 : idx;
              const isSelected = itemIdx === selectedIndex;
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result.url)}
                  onMouseEnter={() => setSelectedIndex(itemIdx)}
                  className={`w-full text-left flex items-center justify-between p-2.5 rounded-sm transition-colors text-xs group ${
                    isSelected
                      ? "bg-accent text-accent-foreground font-medium"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="shrink-0">{getIcon(result.type)}</div>
                    <div className="truncate">
                      <p className="font-medium text-foreground truncate">
                        {result.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {result.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                    <Badge variant="subtle" className="uppercase text-[9px]">
                      {result.type}
                    </Badge>
                    {isSelected && (
                      <kbd className="hidden sm:inline font-mono text-[9px] bg-muted px-1 rounded border border-border">
                        ↵
                      </kbd>
                    )}
                  </div>
                </button>
              );
            })}
        </div>

        {totalItems > 0 && (
          <div className="border-t border-border px-3 py-1.5 flex items-center justify-between text-[10px] font-mono text-muted-foreground bg-muted/40">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
