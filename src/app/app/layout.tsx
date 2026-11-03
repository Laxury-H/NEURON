"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-12 items-center justify-between border-b border-border px-4 md:hidden bg-card">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setMobileOpen(true)}
            className="text-foreground"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <span className="font-mono text-xs font-semibold tracking-wider">NEURON</span>
          <div className="w-7" />
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
