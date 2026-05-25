"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ScannerRow {
  symbol: string;
  name: string;
  exchange: string;
  last: number;
  change_pct: number;
  range_pct: number;
  volume: number;
  type: string;
  market: string;
}

interface ScannerResponse {
  rows: ScannerRow[];
  updatedAt: number | null;
  missingDb?: boolean;
  error?: string;
}

type ScannerSide = "gainers" | "losers";
type ScannerMarket = "all" | "usa" | "tokyo" | "hong-kong" | "saudi-arabia";

const MARKET_OPTIONS: { label: string; value: ScannerMarket }[] = [
  { label: "Todos", value: "all" },
  { label: "USA", value: "usa" },
  { label: "Tokyo", value: "tokyo" },
  { label: "HK", value: "hong-kong" },
  { label: "Saudi", value: "saudi-arabia" },
];

function formatPrice(value: number) {
  if (value >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  if (value >= 100) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (value >= 1) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function formatVolume(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(0);
}

function formatUpdatedAt(value: number | null) {
  if (!value) return "Sin scan";
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value * 1000));
}

function useScannerSide(
  side: ScannerSide,
  refreshKey: number,
  market: ScannerMarket,
) {
  const [data, setData] = useState<ScannerResponse>({
    rows: [],
    updatedAt: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      side,
      limit: "25",
      market,
    });

    fetch(`/api/scanner?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => response.json() as Promise<ScannerResponse>)
      .then((payload) => setData(payload))
      .catch(() => {
        if (!controller.signal.aborted) {
          setData({ rows: [], updatedAt: null, error: "No se pudo leer la base" });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [side, refreshKey, market]);

  return { data, loading };
}

function ScannerTable({
  title,
  rows,
  loading,
  side,
  open,
  onToggle,
}: {
  title: string;
  rows: ScannerRow[];
  loading: boolean;
  side: ScannerSide;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="min-h-0 border-t border-tv-border/70">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-8 w-full items-center justify-between px-3 text-left hover:bg-tv-panel-hover"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-tv-text-muted transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-tv-text-muted">
            {title}
          </span>
        </span>
        <span className="text-[10px] tabular-nums text-tv-text-dim">
          {rows.length}
        </span>
      </button>
      {open && (
        <>
          <div className="grid grid-cols-[minmax(58px,1fr)_62px_54px] gap-1.5 border-y border-tv-border/70 px-3 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-dim">
            <span>Simbolo</span>
            <span className="text-right">Ultimo</span>
            <span className="text-right">%</span>
          </div>
          <div className="flex flex-col">
            {loading && rows.length === 0 ? (
              <div className="px-3 py-3 text-xs text-tv-text-muted">
                Cargando...
              </div>
            ) : rows.length === 0 ? (
              <div className="px-3 py-3 text-xs text-tv-text-muted">
                Sin datos
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={`${side}-${row.symbol}`}
                  className="grid grid-cols-[minmax(58px,1fr)_62px_54px] gap-1.5 border-b border-tv-border/70 px-3 py-1.5 text-[11px] hover:bg-tv-panel-hover"
                  title={`${row.name} | ${row.market} | Vol ${formatVolume(row.volume)}`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-tv-text">
                      {row.symbol}
                    </div>
                    <div className="truncate text-[10px] text-tv-text-dim">
                      {row.name}
                    </div>
                  </div>
                  <span className="self-center text-right tabular-nums text-tv-text">
                    {formatPrice(row.last)}
                  </span>
                  <span
                    className={cn(
                      "self-center text-right tabular-nums",
                      row.change_pct >= 0 ? "text-tv-green" : "text-tv-red",
                    )}
                  >
                    {row.change_pct.toFixed(2)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function ScannerPanel() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [market, setMarket] = useState<ScannerMarket>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<ScannerSide, boolean>>({
    gainers: true,
    losers: true,
  });
  const gainers = useScannerSide("gainers", refreshKey, market);
  const losers = useScannerSide("losers", refreshKey, market);
  const updatedAt = useMemo(
    () => Math.max(gainers.data.updatedAt ?? 0, losers.data.updatedAt ?? 0) || null,
    [gainers.data.updatedAt, losers.data.updatedAt],
  );
  const error = gainers.data.error ?? losers.data.error;

  async function refreshScanner() {
    if (refreshing) return;

    setRefreshing(true);
    setRefreshError(null);

    try {
      const response = await fetch("/api/scanner", {
        method: "POST",
        cache: "no-store",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "No se pudo actualizar el scanner");
      }

      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setRefreshError(
        caught instanceof Error ? caught.message : "No se pudo actualizar el scanner",
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-tv-border px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-tv-text-muted">
            Scanner
          </h2>
          <p className="truncate text-[10px] text-tv-text-dim">
            SQLite · {formatUpdatedAt(updatedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={refreshScanner}
          disabled={refreshing}
          className="rounded p-1 text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text disabled:cursor-wait disabled:opacity-60"
          title={refreshing ? "Escaneando acciones" : "Actualizar scanner"}
          aria-label={refreshing ? "Escaneando acciones" : "Actualizar scanner"}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        </button>
      </div>
      {(refreshError ?? error) && (
        <div className="border-b border-tv-border px-3 py-2 text-xs text-tv-red">
          {refreshError ?? error}
        </div>
      )}
      <div className="grid grid-cols-5 gap-1 border-b border-tv-border px-2 py-2">
        {MARKET_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMarket(option.value)}
            className={cn(
              "h-6 rounded text-[10px] font-medium text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
              market === option.value && "bg-tv-panel-hover text-tv-text",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ScannerTable
          title="Ganadoras"
          rows={gainers.data.rows}
          loading={gainers.loading}
          side="gainers"
          open={openSections.gainers}
          onToggle={() =>
            setOpenSections((sections) => ({
              ...sections,
              gainers: !sections.gainers,
            }))
          }
        />
        <ScannerTable
          title="Perdedoras"
          rows={losers.data.rows}
          loading={losers.loading}
          side="losers"
          open={openSections.losers}
          onToggle={() =>
            setOpenSections((sections) => ({
              ...sections,
              losers: !sections.losers,
            }))
          }
        />
      </ScrollArea>
    </div>
  );
}
