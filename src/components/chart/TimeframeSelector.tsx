"use client";

import { Settings2 } from "lucide-react";
import { useChartStore } from "@/lib/store/chart-store";
import type { Timeframe } from "@/lib/binance/types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const timeframeVisibility = useChartStore((s) => s.timeframeVisibility);
  const setTimeframeVisibility = useChartStore((s) => s.setTimeframeVisibility);
  const resetTimeframeVisibility = useChartStore(
    (s) => s.resetTimeframeVisibility,
  );
  const visibleTimeframes = TIMEFRAMES.filter(
    (timeframe) => timeframeVisibility[timeframe] || timeframe === tf,
  );

  return (
    <div className="flex max-w-[52vw] items-center rounded bg-tv-bg p-0.5">
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
        {visibleTimeframes.map((t) => (
          <button
            key={t}
            type="button"
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
      <DropdownMenu>
        <DropdownMenuTrigger
          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
          title="Temporalidades visibles"
          aria-label="Temporalidades visibles"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 bg-tv-panel">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-tv-text-muted">
              Temporalidades
            </DropdownMenuLabel>
            <div className="grid grid-cols-2 gap-0.5">
              {TIMEFRAMES.map((timeframe) => (
                <DropdownMenuCheckboxItem
                  key={timeframe}
                  checked={timeframeVisibility[timeframe]}
                  closeOnClick={false}
                  onCheckedChange={(checked) =>
                    setTimeframeVisibility(timeframe, checked === true)
                  }
                  className="text-xs uppercase"
                >
                  {timeframe}
                </DropdownMenuCheckboxItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <button
              type="button"
              onClick={resetTimeframeVisibility}
              className="flex h-8 w-full items-center rounded px-2 text-left text-xs text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
            >
              Restaurar default
            </button>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
