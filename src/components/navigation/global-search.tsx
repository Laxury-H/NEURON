"use client";

import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await DataRepository.globalSearch(query);
        setResults(res);
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
            placeholder="Search semesters, courses, people, files, events..."
            className="border-0 shadow-none focus-visible:ring-0 text-sm h-12 px-0 bg-transparent"
            autoFocus
          />
          <kbd className="hidden sm:inline-block pointer-events-none select-none rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {loading && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Searching knowledge index...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && !query && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Type keywords such as course names, professors, topics, or deadlines.
            </div>
          )}

          {!loading &&
            results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelect(result.url)}
                className="w-full text-left flex items-center justify-between p-2.5 rounded-sm hover:bg-muted transition-colors text-xs group"
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
                <Badge variant="subtle" className="uppercase text-[9px] shrink-0 ml-2">
                  {result.type}
                </Badge>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
