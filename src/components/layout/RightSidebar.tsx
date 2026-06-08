"use client";

import { useState } from "react";
import { Watchlist } from "@/components/watchlist/Watchlist";
import { OrderbookPanel } from "@/components/orderbook/OrderbookPanel";
import { cn } from "@/lib/utils";

type SidebarTab = "watchlist" | "orderbook";

export function RightSidebar({ hidden = false }: { hidden?: boolean }) {
  const [tab, setTab] = useState<SidebarTab>("watchlist");

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col overflow-hidden border-l border-tv-border bg-tv-panel transition-[width] duration-150",
        hidden ? "w-0 border-l-0" : "w-88",
      )}
      aria-hidden={hidden}
    >
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
          onClick={() => setTab("orderbook")}
          className={cn(
            "h-7 rounded text-[11px] font-medium text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
            tab === "orderbook" && "bg-tv-panel-hover text-tv-text",
          )}
        >
          Orderbook
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {tab === "watchlist" && <Watchlist />}
        {tab === "orderbook" && <OrderbookPanel />}
      </div>
    </aside>
  );
}
