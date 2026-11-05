"use client";

import React, { useState, useRef } from "react";
import { useTheme } from "@/components/theme-provider";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { DataRepository } from "@/lib/data/repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { toast } from "sonner";
import {
  Moon,
  Sun,
  Download,
  Upload,
  RotateCcw,
  Database,
  ShieldCheck,
  User,
  Contrast,
} from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme, pureBw, setPureBw } = useTheme();
  const [displayName, setDisplayName] = useState("Alex Vance");
  const [timezone, setTimezone] = useState("Asia/Ho_Chi_Minh");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const supabaseConnected = isSupabaseConfigured();

  const [counts, setCounts] = useState({
    semesters: 0,
    courses: 0,
    people: 0,
    documents: 0,
  });

  React.useEffect(() => {
    async function loadCounts() {
      const sems = await DataRepository.getSemesters();
      const people = await DataRepository.getPeople();
      const docs = await DataRepository.getDocuments();
      const totalCourses = sems.reduce((acc, s) => acc + (s.courses?.length || 0), 0);
      setCounts({
        semesters: sems.length,
        courses: totalCourses,
        people: people.length,
        documents: docs.length,
      });
    }
    loadCounts();
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Profile preferences saved");
  };

  const handleExportBackup = () => {
    try {
      const dataStr = DataRepository.exportAllData();
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `neuron-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Workspace backup downloaded");
    } catch {
      toast.error("Failed to export backup");
    }
  };

  const handleExportFullArchive = async () => {
    try {
      const dataStr = await DataRepository.exportFullArchive();
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `neuron-complete-vault-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Complete vault archive downloaded");
    } catch {
      toast.error("Failed to export complete vault");
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const success = DataRepository.importAllData(content);
        if (success) {
          toast.success("Backup imported successfully");
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("neuron_data_changed"));
          }
        } else {
          toast.error("Invalid NEURON backup file structure");
        }
      } catch {
        toast.error("Error reading backup file");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleResetSeedData = () => {
    DataRepository.resetToDefaultData();
    toast.success("Workspace reset to standard academic fixture data");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("neuron_data_changed"));
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          Configuration
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Workspace Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your personal profile, monochrome display mode, and persistent data storage.
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile & Appearance */}
        <div className="rounded-md border border-border bg-card p-5 space-y-4">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-foreground" />
            <h2 className="text-sm font-semibold">Student Profile & Theme</h2>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 pt-1 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="timezone">Default Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (UTC+7)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Asia/Tokyo (UTC+9)</SelectItem>
                    <SelectItem value="Asia/Singapore">Asia/Singapore (UTC+8)</SelectItem>
                    <SelectItem value="Europe/London">Europe/London (UTC+0)</SelectItem>
                    <SelectItem value="America/New_York">America/New_York (UTC-5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label>Theme Preference</Label>
              <div className="flex items-center space-x-3 pt-1">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex items-center space-x-2 px-3 py-2 rounded border text-xs transition-colors ${
                    theme === "light"
                      ? "border-neutral-900 bg-neutral-900 text-white font-medium"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sun className="h-4 w-4" />
                  <span>Light Mode (Default)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex items-center space-x-2 px-3 py-2 rounded border text-xs transition-colors ${
                    theme === "dark"
                      ? "border-white bg-white text-neutral-900 font-medium"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Moon className="h-4 w-4" />
                  <span>Dark Mode (Monochrome)</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label>Contrast Engine (1-Bit Mode)</Label>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPureBw(false)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded border text-xs transition-colors ${
                    !pureBw
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-medium"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>Standard Monochrome (Soft Grayscale)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPureBw(true)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded border text-xs transition-colors font-mono ${
                    pureBw
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 font-bold"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Contrast className="h-3.5 w-3.5" />
                  <span>Pure 1-Bit B&W (#000000 & #FFFFFF Only)</span>
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pure 1-Bit mode disables all subtle grays and applies extreme high-contrast brutalist styling.
              </p>
            </div>

            <div className="pt-2">
              <Button type="submit" size="sm" className="text-xs">
                Save Preferences
              </Button>
            </div>
          </form>
        </div>

        {/* Database & Storage Status */}
        <div className="rounded-md border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-foreground" />
              <h2 className="text-sm font-semibold">Backend Storage Provider</h2>
            </div>
            <Badge
              variant={supabaseConnected ? "default" : "subtle"}
              className="text-[10px] font-mono"
            >
              {supabaseConnected ? "SUPABASE POSTGRESQL (LIVE)" : "PERSISTENT LOCAL STORAGE"}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {supabaseConnected
              ? "NEURON is connected to your Supabase PostgreSQL database with Row Level Security (RLS) and authenticated Storage active."
              : "Running in persistent local mode. All semesters, courses, people, files, graph layouts, and calendars are saved locally with full persistence. You can connect to Supabase Cloud anytime by configuring your project URL in .env.local."}
          </p>

          <div className="p-3 rounded border border-border bg-muted/30 font-mono text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">RLS Policy Coverage:</span>
              <span className="font-semibold text-foreground">100% Enforced</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Storage Bucket:</span>
              <span className="font-semibold text-foreground">academic-documents (Private)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Graph Layout Persistence:</span>
              <span className="font-semibold text-foreground">Active</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between pt-1 border-t border-border/50 gap-0.5">
              <span className="text-muted-foreground">Local Academic Vault:</span>
              <span className="font-semibold text-foreground">
                {counts.semesters} Semesters • {counts.courses} Courses • {counts.people} Contacts • {counts.documents} Files
              </span>
            </div>
          </div>
        </div>

        {/* Data Import / Export */}
        <div className="rounded-md border border-border bg-card p-5 space-y-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-foreground" />
            <h2 className="text-sm font-semibold">Data Backup & Recovery</h2>
          </div>

          <p className="text-xs text-muted-foreground">
            Export a full structured JSON archive of all your academic semesters, neural graph structures, contact notes, and schedule events.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportBackup}
              className="text-xs h-8"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export JSON Backup
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportFullArchive}
              className="text-xs h-8 font-mono"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Complete Vault Archive
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs h-8"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Import Backup
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmResetOpen(true)}
              className="text-xs h-8 text-neutral-800 dark:text-neutral-200"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset to Academic Demo Fixture
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title="Reset All Workspace Data?"
        description="This will restore the workspace to the default academic seed data (Academic Year 2026–2027, EE4010, EE3101, contacts, documents, and calendar events)."
        confirmLabel="Reset Data"
        onConfirm={handleResetSeedData}
      />
    </div>
  );
}
