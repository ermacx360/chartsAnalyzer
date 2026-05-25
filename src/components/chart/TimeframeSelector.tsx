"use client";

import { useChartStore } from "@/lib/store/chart-store";
import type { Timeframe } from "@/lib/binance/types";
import { cn } from "@/lib/utils";

const TIMEFRAMES: Timeframe[] = [
  "1s",
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
];

export function TimeframeSelector() {
  const tf = useChartStore((s) => s.timeframe);
  const setTf = useChartStore((s) => s.setTimeframe);
  return (
    <div className="flex max-w-[48vw] items-center gap-0.5 overflow-x-auto rounded bg-tv-bg p-0.5">
      {TIMEFRAMES.map((t) => (
        <button
          key={t}
          onClick={() => setTf(t)}
          className={cn(
            "shrink-0 rounded px-1.5 py-1 text-xs font-medium uppercase transition-colors",
            tf === t
              ? "bg-tv-panel-hover text-tv-text"
              : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
