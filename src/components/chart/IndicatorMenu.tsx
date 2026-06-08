"use client";

import { Activity, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useChartStore,
  type DrawingTool,
  type IndicatorConfig,
  type IndicatorKey,
} from "@/lib/store/chart-store";

interface IndicatorEntry {
  type: "indicator";
  key: IndicatorKey;
  label: (cfg: IndicatorConfig) => string;
  group: string;
}

interface ToolEntry {
  type: "tool";
  key: DrawingTool;
  label: (cfg: IndicatorConfig) => string;
  group: string;
}

type Entry = IndicatorEntry | ToolEntry;

const ENTRIES: Entry[] = [
  {
    type: "indicator",
    key: "emaCross",
    group: "Medias moviles",
    label: (c) => `EMA Cross (${c.emaCross.map((line) => line.period).join(", ")})`,
  },
  {
    type: "indicator",
    key: "emaCross2",
    group: "Medias moviles",
    label: (c) => `EMA Cross 7/25 (${c.emaCross2.map((line) => line.period).join(", ")})`,
  },

  {
    type: "indicator",
    key: "vwapBands",
    group: "Medias moviles",
    label: () => "VWAP + Bandas",
  },
  { type: "indicator", key: "volume", group: "Volumen", label: () => "Volumen" },
  {
    type: "indicator",
    key: "volumeProfile",
    group: "Volumen",
    label: () => "Volume Profile Visible Range",
  },
  {
    type: "indicator",
    key: "liquidityBlocks",
    group: "Volumen",
    label: () => "Bloques de Liquidez",
  },
  {
    type: "tool",
    key: "fixedVolumeProfile",
    group: "Volumen",
    label: () => "Fixed Volume Profile",
  },
  {
    type: "indicator",
    key: "monthlyGann",
    group: "Gann",
    label: () => "Gann mensual",
  },
  {
    type: "indicator",
    key: "swingPatterns",
    group: "Patrones",
    label: (c) => `Swing Highs/Lows (${c.swingPatterns.length})`,
  },
  {
    type: "indicator",
    key: "pmRangeBreakout",
    group: "Sesiones",
    label: () => "PM Range Breakout PRO",
  },
  {
    type: "indicator",
    key: "sqzAdxTtm",
    group: "Osciladores",
    label: () => "SQZ + ADX + TTM",
  },
  { type: "indicator", key: "rsi", group: "Osciladores", label: (c) => `RSI (${c.rsi})` },
  {
    type: "indicator",
    key: "macd",
    group: "Osciladores",
    label: (c) => `MACD (${c.macdFast}, ${c.macdSlow}, ${c.macdSignal})`,
  },
];

export function IndicatorMenu() {
  const indicators = useChartStore((s) => s.indicators);
  const config = useChartStore((s) => s.config);
  const tool = useChartStore((s) => s.tool);
  const toggle = useChartStore((s) => s.toggleIndicator);
  const setTool = useChartStore((s) => s.setTool);

  const groups = ENTRIES.reduce<Record<string, Entry[]>>((acc, i) => {
    (acc[i.group] ||= []).push(i);
    return acc;
  }, {});

  const activeCount = Object.values(indicators).filter(Boolean).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-tv-text hover:bg-tv-panel-hover">
        <Activity className="h-3.5 w-3.5" />
        <span>Indicadores</span>
        {activeCount > 0 && (
          <span className="ml-1 rounded bg-tv-blue/20 px-1.5 py-0.5 text-[10px] font-semibold text-tv-blue">
            {activeCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 bg-tv-panel">
        {Object.entries(groups).map(([group, items], idx) => (
          <DropdownMenuGroup key={group}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-tv-text-muted">
              {group}
            </DropdownMenuLabel>
            {items.map((i) => (
              <DropdownMenuItem
                key={`${i.type}-${i.key}`}
                closeOnClick={false}
                onClick={() =>
                  i.type === "indicator" ? toggle(i.key) : setTool(i.key)
                }
                className="flex items-center justify-between text-xs"
              >
                <span>{i.label(config)}</span>
                {i.type === "indicator" && indicators[i.key] && (
                  <Check className="h-3.5 w-3.5 text-tv-blue" />
                )}
                {i.type === "tool" && tool === i.key && (
                  <Check className="h-3.5 w-3.5 text-tv-blue" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
