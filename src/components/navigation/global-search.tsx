"use client";

import React, { useState, useEffect, useRef } from "react";
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
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

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
        const res = await DataRepository.globalSearch(query);
        setResults(res);
        setSelectedIndex(0);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (url: string) => {
    onOpenChange(false);
    router.push(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex].url);
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
            placeholder="Search semesters, courses, people, files, events..."
            className="border-0 shadow-none focus-visible:ring-0 text-sm h-12 px-0 bg-transparent"
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

          {!loading && query && results.length === 0 && (
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
              <div className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border/50">
                Type keywords like <span className="font-mono text-foreground">Power System</span>, <span className="font-mono text-foreground">Newton-Raphson</span>, or <span className="font-mono text-foreground">Midterm</span>
              </div>
            </div>
          )}

          {!loading &&
            results.map((result, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result.url)}
                  onMouseEnter={() => setSelectedIndex(idx)}
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

        {results.length > 0 && (
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
