"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { Menu, Contrast } from "lucide-react";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pureBw, togglePureBw } = useTheme();

  return (
    <div className="flex min-h-screen max-w-full w-full overflow-x-hidden bg-background">
      <AppSidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden max-w-full w-full">
        {/* Mobile top bar */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3 sm:px-4 md:hidden bg-card">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setMobileOpen(true)}
            className="text-foreground h-8 w-8"
            aria-label="Open sidebar menu"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <span className="font-mono text-xs font-semibold tracking-wider">NEURON</span>

          <Button
            variant={pureBw ? "default" : "ghost"}
            size="sm"
            onClick={togglePureBw}
            className="h-7 px-2 text-[10px] font-mono border border-border"
            title="Toggle Pure 1-Bit Black & White Mode"
          >
            <Contrast className="h-3 w-3 mr-1" />
            <span>{pureBw ? "1-BIT" : "B&W"}</span>
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
