"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchExchangeSymbols,
  fetchStockSearchSymbols,
  getLocalMarketSymbols,
} from "@/lib/market/data";
import { useChartStore } from "@/lib/store/chart-store";
import { cn } from "@/lib/utils";
import type { MarketKind, SymbolInfo } from "@/lib/binance/types";

type MarketFilter = "all" | MarketKind;

export function SymbolSelector() {
  const symbol = useChartStore((s) => s.symbol);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const addToWatchlist = useChartStore((s) => s.addToWatchlist);
  const open = useChartStore((s) => s.symbolDialogOpen);
  const setOpen = useChartStore((s) => s.setSymbolDialogOpen);

  const [query, setQuery] = useState("");
  const [allSymbols, setAllSymbols] = useState<SymbolInfo[]>(() =>
    getLocalMarketSymbols(),
  );
  const [stockSearchSymbols, setStockSearchSymbols] = useState<SymbolInfo[]>([]);
  const [stockSearchLoading, setStockSearchLoading] = useState(false);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const trimmedQuery = query.trim();
  const shouldSearchStocks =
    open &&
    trimmedQuery.length >= 2 &&
    (marketFilter === "all" || marketFilter === "stock");

  useEffect(() => {
    if (open) {
      fetchExchangeSymbols()
        .then(setAllSymbols)
        .catch(() => setAllSymbols(getLocalMarketSymbols()));
    }
  }, [open]);

  useEffect(() => {
    if (!shouldSearchStocks) {
      return;
    }

    let cancelled = false;
    const id = window.setTimeout(() => {
      setStockSearchLoading(true);
      fetchStockSearchSymbols(trimmedQuery)
        .then((symbols) => {
          if (!cancelled) setStockSearchSymbols(symbols);
        })
        .catch(() => {
          if (!cancelled) setStockSearchSymbols([]);
        })
        .finally(() => {
          if (!cancelled) setStockSearchLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [shouldSearchStocks, trimmedQuery]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const symbolMap = new Map<string, SymbolInfo>();

    function addSymbol(symbol: SymbolInfo) {
      const existing = symbolMap.get(symbol.symbol);
      symbolMap.set(symbol.symbol, {
        ...symbol,
        name: symbol.name ?? existing?.name,
        region: symbol.region ?? existing?.region,
      });
    }

    getLocalMarketSymbols().forEach(addSymbol);
    allSymbols.forEach(addSymbol);
    getLocalMarketSymbols().forEach(addSymbol);
    if (shouldSearchStocks) {
      stockSearchSymbols.forEach(addSymbol);
    }

    return Array.from(symbolMap.values())
      .filter((s) => marketFilter === "all" || s.market === marketFilter)
      .filter(
        (s) =>
          !q ||
          s.symbol.includes(q) ||
          s.baseAsset.includes(q) ||
          s.quoteAsset.includes(q) ||
          s.name?.toUpperCase().includes(q) ||
          s.region?.toUpperCase().includes(q),
      )
      .slice(0, 100);
  }, [query, allSymbols, stockSearchSymbols, marketFilter, shouldSearchStocks]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="group flex items-center gap-2 rounded px-3 py-1.5 text-sm font-semibold hover:bg-tv-panel-hover">
        <Search className="h-3.5 w-3.5 text-tv-text-muted group-hover:text-tv-text" />
        <span className="tabular-nums">{symbol}</span>
        <ChevronDown className="h-3.5 w-3.5 text-tv-text-muted" />
      </DialogTrigger>
      <DialogContent className="max-w-md gap-0 bg-tv-panel p-0">
        <DialogHeader className="border-b border-tv-border px-4 py-3">
          <DialogTitle className="text-sm font-medium">Buscar símbolo</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 border-b border-tv-border p-3">
          <div className="grid grid-cols-6 rounded border border-tv-border bg-tv-bg p-0.5 text-[11px]">
            {[
              ["all", "Todo"],
              ["crypto", "Cripto"],
              ["index", "Índices"],
              ["commodity", "Commod."],
              ["forex", "Forex"],
              ["stock", "Acciones"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMarketFilter(value as MarketFilter)}
                className={cn(
                  "rounded px-2 py-1 text-tv-text-muted hover:text-tv-text",
                  marketFilter === value && "bg-tv-panel-hover text-tv-text",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Input
            autoFocus
            placeholder="BTC, SPX, Nasdaq…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-tv-bg"
          />
        </div>
        <ScrollArea className="h-[400px]">
          <div className="flex flex-col">
            {filtered.length === 0 && (
              <div className="p-4 text-center text-xs text-tv-text-muted">
                {shouldSearchStocks && stockSearchLoading
                  ? "Buscando acciones..."
                  : "Sin resultados"}
              </div>
            )}
            {filtered.map((s) => (
              <button
                key={s.symbol}
                onClick={() => {
                  setSymbol(s.symbol);
                  addToWatchlist(s.symbol, undefined, s.market);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex items-center justify-between border-b border-tv-border px-4 py-2 text-left text-xs hover:bg-tv-panel-hover",
                  s.symbol === symbol && "bg-tv-panel-hover",
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-tv-text">
                    {s.name ?? s.baseAsset}
                  </span>
                  <span className="text-tv-text-muted">
                    {s.market === "crypto" ? `/ ${s.quoteAsset}` : s.region}
                  </span>
                </div>
                <span className="shrink-0 text-tv-text-muted">{s.symbol}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
