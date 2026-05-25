"use client";

import { useState } from "react";
import { Watchlist } from "@/components/watchlist/Watchlist";
import { ScannerPanel } from "@/components/scanner/ScannerPanel";
import { cn } from "@/lib/utils";

type SidebarTab = "watchlist" | "scanner";

export function RightSidebar() {
  const [tab, setTab] = useState<SidebarTab>("watchlist");

  return (
    <aside className="flex w-64 flex-col border-l border-tv-border bg-tv-panel">
      <div className="grid grid-cols-2 border-b border-tv-border p-1">
        <button
          type="button"
          onClick={() => setTab("watchlist")}
          className={cn(
            "h-7 rounded text-[11px] font-medium text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
            tab === "watchlist" && "bg-tv-panel-hover text-tv-text",
          )}
        >
          Watchlist
        </button>
        <button
          type="button"
          onClick={() => setTab("scanner")}
          className={cn(
            "h-7 rounded text-[11px] font-medium text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
            tab === "scanner" && "bg-tv-panel-hover text-tv-text",
          )}
        >
          Scanner
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {tab === "watchlist" ? <Watchlist /> : <ScannerPanel />}
      </div>
    </aside>
  );
}
