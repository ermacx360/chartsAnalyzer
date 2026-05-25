"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import type { Ticker24h } from "@/lib/binance/types";
import { fetchTickers24h } from "@/lib/market/data";
import { INDEX_INSTRUMENTS } from "@/lib/market/indices";
import { STOCK_INSTRUMENTS } from "@/lib/market/stocks";

type HeatmapMode = "all" | "winners" | "losers";
type MarketMode = "stocks" | "crypto" | "indices";
type CryptoRankMode = "marketCap" | "volume";
type SizeMode = "liquidity" | "price" | "equal";

interface HeatmapRow {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  marketCap?: number;
  size: number;
  logoUrl?: string;
}

interface HoveredTile {
  item: HeatmapRow;
  index: number;
  x: number;
  y: number;
}

interface MarketInstrument {
  symbol: string;
  name: string;
}

interface CryptoHeatmapTicker extends Ticker24h {
  marketCap?: number;
  logoUrl?: string;
}

interface CryptoHeatmapResponse {
  all?: CryptoHeatmapTicker[];
  winners?: CryptoHeatmapTicker[];
  losers?: CryptoHeatmapTicker[];
  sort?: CryptoRankMode;
}

const MARKET_LABELS: Record<MarketMode, string> = {
  stocks: "Acciones",
  crypto: "Criptos",
  indices: "Indices",
};

const INDEX_DISPLAY_NAMES: Record<string, string> = {
  AXJO: "ASX 200",
  BVSP: "Bovespa",
  DJI: "Dow Jones",
  FCHI: "CAC 40",
  FTSE: "FTSE 100",
  GDAXI: "DAX",
  HSI: "Hang Seng",
  IBEX: "IBEX 35",
  IXIC: "Nasdaq Composite",
  MERV: "Merval",
  MXX: "IPC Mexico",
  N225: "Nikkei 225",
  NDX: "Nasdaq 100",
  RUT: "Russell 2000",
  SPX: "S&P 500",
  STOXX50E: "Euro Stoxx 50",
  VIX: "VIX",
};

const INDEX_LOGO_URLS: Record<string, string> = {
  AXJO: "/heatmap/indices/axjo.png",
  BVSP: "/heatmap/indices/bvsp.png",
  DJI: "/heatmap/indices/dji.png",
  FCHI: "/heatmap/indices/fchi.png",
  FTSE: "/heatmap/indices/ftse.png",
  GDAXI: "/heatmap/indices/gdaxi.png",
  HSI: "/heatmap/indices/hsi.svg",
  IBEX: "/heatmap/indices/ibex.png",
  IXIC: "/heatmap/indices/ixic.png",
  MERV: "/heatmap/indices/merv.png",
  MXX: "/heatmap/indices/mxx.png",
  N225: "/heatmap/indices/n225.png",
  NDX: "/heatmap/indices/ndx.png",
  RUT: "/heatmap/indices/rut.png",
  SPX: "/heatmap/indices/spx.png",
  STOXX50E: "/heatmap/indices/stoxx50e.png",
  VIX: "/heatmap/indices/vix.png",
};

const MARKET_INSTRUMENTS: Record<Exclude<MarketMode, "crypto">, MarketInstrument[]> = {
  stocks: STOCK_INSTRUMENTS.map((stock) => ({
    symbol: stock.symbol,
    name: stock.name,
  })),
  indices: INDEX_INSTRUMENTS.map((index) => ({
    symbol: index.symbol,
    name: INDEX_DISPLAY_NAMES[index.symbol] ?? index.name,
  })),
};

function formatUsd(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "--";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "--";

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function getTileColor(changePct: number) {
  if (!Number.isFinite(changePct) || Math.abs(changePct) < 0.05) {
    return "#41445d";
  }

  const intensity = Math.min(1, Math.abs(changePct) / 5);

  if (changePct > 0) {
    const lightness = 24 + intensity * 18;
    return `hsl(145 68% ${lightness}%)`;
  }

  const lightness = 27 + intensity * 15;
  return `hsl(358 58% ${lightness}%)`;
}

function getSizeValue(ticker: Ticker24h | undefined, mode: SizeMode) {
  if (mode === "equal") return 1;
  if (mode === "price") return Math.max(1, ticker?.lastPrice ?? 1);

  return Math.max(
    1,
    ticker?.quoteVolume || (ticker?.volume ?? 0) * (ticker?.lastPrice ?? 0) || 1,
  );
}

function tickerToRow(ticker: CryptoHeatmapTicker, name?: string): HeatmapRow {
  const baseAsset = ticker.symbol.replace(/USDT$/, "");

  return {
    symbol: ticker.symbol,
    name: name ?? ticker.symbol.replace(/USDT$/, "/USDT"),
    price: ticker.lastPrice,
    changePct: ticker.priceChangePercent,
    volume: ticker.quoteVolume || ticker.volume,
    marketCap: ticker.marketCap,
    size: Math.max(
      1,
      ticker.marketCap ??
        (ticker.quoteVolume || ticker.volume * ticker.lastPrice || 1),
    ),
    logoUrl:
      ticker.logoUrl ??
      `https://assets.coincap.io/assets/icons/${baseAsset.toLowerCase()}@2x.png`,
  };
}

function getStockLogoUrl(symbol: string) {
  const normalizedSymbol = symbol.replace(".", "-").toUpperCase();
  return `https://financialmodelingprep.com/image-stock/${normalizedSymbol}.png`;
}

function getIndexLogoUrl(symbol: string) {
  return INDEX_LOGO_URLS[symbol.toUpperCase()];
}

async function fetchCryptoHeatmapRows(rankMode: CryptoRankMode) {
  const params = new URLSearchParams({
    sort: rankMode,
    t: String(Date.now()),
  });
  const response = await fetch(`/api/heatmap/crypto?${params}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`crypto heatmap ${response.status}`);

  const data = (await response.json()) as CryptoHeatmapResponse;
  const hasRows =
    (data.all?.length ?? 0) +
      (data.winners?.length ?? 0) +
      (data.losers?.length ?? 0) >
    0;

  if (!hasRows && rankMode === "marketCap") {
    return fetchCryptoHeatmapRows("volume");
  }

  const tickersBySymbol = new Map<string, CryptoHeatmapTicker>();

  (data.all ?? []).forEach((ticker) => tickersBySymbol.set(ticker.symbol, ticker));

  return {
    winners: data.winners ?? [],
    losers: data.losers ?? [],
    all: Array.from(tickersBySymbol.values()),
  };
}

function mergeRowsBySymbol(currentRows: HeatmapRow[], nextRows: HeatmapRow[]) {
  const nextRowsBySymbol = new Map(nextRows.map((row) => [row.symbol, row]));

  return currentRows.map((row) => ({
    ...row,
    ...(nextRowsBySymbol.get(row.symbol) ?? {}),
    size: row.size,
  }));
}

export function StockHeatmap() {
  const [market, setMarket] = useState<MarketMode>("stocks");
  const [rowsByMode, setRowsByMode] = useState<Record<HeatmapMode, HeatmapRow[]>>({
    all: [],
    winners: [],
    losers: [],
  });
  const [cryptoRankMode, setCryptoRankMode] =
    useState<CryptoRankMode>("marketCap");
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<HeatmapMode>("all");
  const [sizeMode, setSizeMode] = useState<SizeMode>("liquidity");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hoveredTile, setHoveredTile] = useState<HoveredTile | null>(null);

  const loadMarketRows = useCallback(async (selectedMarket = market, silent = false) => {
    if (!silent) {
      setLoading(true);
      setErrorMessage(null);
    }
    try {
      if (selectedMarket === "crypto") {
        const cryptoRows = await fetchCryptoHeatmapRows(cryptoRankMode);
        const nextRows = {
          all: cryptoRows.all.map((ticker) => tickerToRow(ticker)),
          winners: cryptoRows.winners.map((ticker) => tickerToRow(ticker)),
          losers: cryptoRows.losers.map((ticker) => tickerToRow(ticker)),
        };

        setRowsByMode((currentRows) =>
          silent
            ? {
                all: mergeRowsBySymbol(currentRows.all, nextRows.all),
                winners: mergeRowsBySymbol(currentRows.winners, nextRows.winners),
                losers: mergeRowsBySymbol(currentRows.losers, nextRows.losers),
              }
            : nextRows,
        );
      } else {
        const instruments = MARKET_INSTRUMENTS[selectedMarket];
        const tickers = await fetchTickers24h(
          instruments.map((instrument) => instrument.symbol),
        );
        const tickersBySymbol = new Map(
          tickers.map((ticker) => [ticker.symbol.toUpperCase(), ticker]),
        );
        const rows = instruments.map((instrument) => {
          const ticker = tickersBySymbol.get(instrument.symbol.toUpperCase());

          return {
            symbol: instrument.symbol,
            name: instrument.name,
            price: ticker?.lastPrice ?? 0,
            changePct: ticker?.priceChangePercent ?? 0,
            volume: ticker?.quoteVolume ?? ticker?.volume ?? 0,
            size: getSizeValue(ticker, sizeMode),
            logoUrl:
              selectedMarket === "indices"
                ? getIndexLogoUrl(instrument.symbol)
                : getStockLogoUrl(instrument.symbol),
          };
        });

        setRowsByMode({
          all: rows,
          winners: rows.filter((row) => row.changePct >= 0),
          losers: rows.filter((row) => row.changePct < 0),
        });
      }
      setUpdatedAt(new Date());
    } catch {
      if (!silent) setErrorMessage("No se pudieron cargar los datos del heatmap.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [cryptoRankMode, market, sizeMode]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadMarketRows();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadMarketRows]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadMarketRows(market, true);
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [loadMarketRows, market]);

  const rows = useMemo(() => {
    const selectedRows = rowsByMode[mode];
    const sortedRows = [...selectedRows].sort((a, b) => {
      if (market === "crypto" && mode === "winners") return b.changePct - a.changePct;
      if (market === "crypto" && mode === "losers") return a.changePct - b.changePct;

      return b.size - a.size;
    });

    const visibleRows =
      market === "crypto" && mode !== "all" ? sortedRows.slice(0, 30) : sortedRows;

    if (market !== "crypto") return visibleRows;

    return visibleRows.map((row, index) => ({
      ...row,
      size: Math.max(8, visibleRows.length - index),
    }));
  }, [market, mode, rowsByMode]);

  const marketRows = rowsByMode.all;
  const winners = rowsByMode.winners.length;
  const losers = rowsByMode.losers.length;
  const averageChange =
    marketRows.length > 0
      ? marketRows.reduce((sum, row) => sum + row.changePct, 0) / marketRows.length
      : 0;
  const title =
    market === "crypto"
      ? "Heatmap de criptos"
      : market === "indices"
        ? "Heatmap de indices"
        : "Heatmap de acciones";
  const gridColumns = market === "crypto" && rows.length > 30 ? 10 : 6;
  const gridRows = Math.max(1, Math.ceil(rows.length / gridColumns));

  function updateHoveredTile(
    event: MouseEvent<HTMLDivElement>,
    item: HeatmapRow,
    index: number,
  ) {
    const tooltipWidth = 204;
    const tooltipHeight = 224;
    const x = Math.min(
      event.clientX + 16,
      window.innerWidth - tooltipWidth - 12,
    );
    const y = Math.min(
      event.clientY + 16,
      window.innerHeight - tooltipHeight - 12,
    );

    setHoveredTile({ item, index, x: Math.max(12, x), y: Math.max(12, y) });
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#070911] text-white">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#0b0d17] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="flex h-8 items-center gap-2 rounded border border-white/10 px-2.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">{title}</div>
            <div className="truncate text-[11px] text-slate-400">
              {updatedAt
                ? `Actualizado ${updatedAt.toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Cargando precios"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadMarketRows()}
          className="flex h-8 items-center gap-2 rounded border border-white/10 px-2.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-50"
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refrescar
        </button>
      </header>

      <div className="grid shrink-0 grid-cols-2 border-b border-white/10 bg-[#0b0d17] sm:grid-cols-4">
        <div className="border-r border-white/10 px-4 py-3">
          <div className="text-[10px] uppercase text-slate-500">{MARKET_LABELS[market]}</div>
          <div className="text-sm font-semibold">{rows.length}</div>
        </div>
        <div className="border-r border-white/10 px-4 py-3">
          <div className="text-[10px] uppercase text-slate-500">Promedio</div>
          <div className={averageChange >= 0 ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-red-300"}>
            {averageChange >= 0 ? "+" : ""}
            {averageChange.toFixed(2)}%
          </div>
        </div>
        <div className="border-r border-white/10 px-4 py-3">
          <div className="text-[10px] uppercase text-slate-500">Winners</div>
          <div className="text-sm font-semibold text-emerald-300">{winners}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase text-slate-500">Losers</div>
          <div className="text-sm font-semibold text-red-300">{losers}</div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 bg-[#080a13] px-4 py-3">
        <div className="flex h-9 rounded border border-white/10 bg-[#0d1020] p-0.5">
          {(["stocks", "crypto", "indices"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setLoading(true);
                setMarket(option);
                setMode("all");
              }}
              className={`rounded px-3 text-xs font-medium ${
                market === option
                  ? "bg-[#11162b] text-white ring-1 ring-cyan-400/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {MARKET_LABELS[option]}
            </button>
          ))}
        </div>

        {market === "crypto" && (
          <div className="flex h-9 rounded border border-white/10 bg-[#0d1020] p-0.5">
            {(["marketCap", "volume"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setLoading(true);
                  setCryptoRankMode(option);
                  setMode("all");
                }}
                className={`rounded px-3 text-xs font-medium ${
                  cryptoRankMode === option
                    ? "bg-[#11162b] text-white ring-1 ring-amber-400/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {option === "marketCap" ? "Market Cap" : "Volumen"}
              </button>
            ))}
          </div>
        )}

        <div className="flex h-9 rounded border border-white/10 bg-[#0d1020] p-0.5">
          {(["all", "winners", "losers"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`rounded px-3 text-xs font-medium ${
                mode === option
                  ? "bg-[#11162b] text-white ring-1 ring-emerald-400/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {option === "all"
                ? market === "crypto"
                  ? "Top 50"
                  : "Todos"
                : option === "winners"
                  ? market === "crypto"
                    ? "Top 30 ganadoras"
                    : "Winners"
                  : market === "crypto"
                    ? "Top 30 perdedoras"
                    : "Losers"}
            </button>
          ))}
        </div>

        {market !== "crypto" && (
          <div className="flex h-9 rounded border border-white/10 bg-[#0d1020] p-0.5">
          {(["liquidity", "price", "equal"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setLoading(true);
                setSizeMode(option);
              }}
              className={`rounded px-3 text-xs font-medium ${
                sizeMode === option
                  ? "bg-[#11162b] text-white ring-1 ring-blue-400/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {option === "liquidity" ? "Liquidez" : option === "price" ? "Precio" : "Igual"}
            </button>
          ))}
          </div>
        )}
      </div>

      <main className="min-h-0 flex-1 p-2">
        <div
          className="grid h-full overflow-hidden rounded border border-[#05060b] bg-[#05060b]"
          style={{
            gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${gridRows}, minmax(0, 1fr))`,
          }}
        >
          {loading && rows.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Cargando mapa de calor...
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
              {errorMessage ?? "Sin datos disponibles para este filtro."}
            </div>
          ) : (
            rows.map((item, index) => {
              const compact = rows.length > 40;
              const isIndexTile = market === "indices";
              const symbolLabel =
                market === "crypto" ? item.symbol.replace(/USDT$/, "") : item.symbol;

              return (
                <div
                  key={item.symbol}
                  className="overflow-hidden rounded-[5px] border-2 border-[#05060b] p-1.5 text-center shadow-inner"
                  style={{ backgroundColor: getTileColor(item.changePct) }}
                  onMouseEnter={(event) => updateHoveredTile(event, item, index)}
                  onMouseMove={(event) => updateHoveredTile(event, item, index)}
                  onMouseLeave={() => setHoveredTile(null)}
                >
                  <div className="relative flex h-full min-h-0 flex-col items-center justify-center leading-none text-white">
                    <div className="absolute left-0 top-0 text-[10px] font-bold text-white/55">
                      #{index + 1}
                    </div>
                    {item.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.logoUrl}
                        alt=""
                        className={
                          isIndexTile
                            ? "mb-2 h-8 w-8 rounded-full bg-white/90 object-contain p-1"
                            : compact
                              ? "mb-1 h-5 w-5 rounded-full object-contain"
                              : "mb-2 h-8 w-8 rounded-full object-contain"
                        }
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    {isIndexTile ? (
                      <>
                        <div className="max-w-full px-2 text-balance text-xl font-bold leading-tight">
                          {item.name}
                        </div>
                        <div className="mt-1 max-w-full truncate text-xs font-bold uppercase tracking-wide text-white/60">
                          {symbolLabel}
                        </div>
                      </>
                    ) : (
                      <div
                        className={
                          compact
                            ? "max-w-full truncate text-base font-bold"
                            : "max-w-full truncate text-[28px] font-bold"
                        }
                      >
                        {symbolLabel}
                      </div>
                    )}
                    <div className={compact ? "mt-1 text-base font-bold" : "mt-2 text-2xl font-bold"}>
                      {item.changePct >= 0 ? "+" : ""}
                      {item.changePct.toFixed(2)}%
                    </div>
                    <div className={compact ? "mt-1 text-[11px] font-semibold text-white/60" : "mt-2 text-sm font-semibold text-white/60"}>
                      {formatUsd(item.price)}
                    </div>
                    <div className={compact ? "mt-0.5 text-[10px] font-semibold text-white/45" : "mt-1 text-[11px] font-semibold text-white/45"}>
                      Vol {formatCompact(item.volume)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {hoveredTile && (
        <div
          className="pointer-events-none fixed z-50 w-[204px] rounded-xl border border-white/10 bg-[#070712] p-3 text-white shadow-[0_18px_48px_rgba(0,0,0,0.55)]"
          style={{ left: hoveredTile.x, top: hoveredTile.y }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 ring-1 ring-white/10">
              {hoveredTile.item.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hoveredTile.item.logoUrl}
                  alt=""
                  className="h-6 w-6 rounded-full object-contain"
                />
              ) : (
                <span className="text-sm font-bold">
                  {hoveredTile.item.symbol.slice(0, 1)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold leading-tight">
                {market === "crypto"
                  ? hoveredTile.item.symbol.replace(/USDT$/, "")
                  : hoveredTile.item.symbol}
              </div>
              <div className="mt-1 truncate text-[11px] uppercase tracking-wide text-slate-500">
                #{hoveredTile.index + 1} · {hoveredTile.item.name}
              </div>
            </div>
          </div>

          <div className="mt-4 text-2xl font-black leading-none">
            {formatUsd(hoveredTile.item.price)}
          </div>

          <div className="mt-3 rounded-lg border border-white/10 bg-[#0d1020] p-2.5 text-center">
            <div className="text-[11px] text-slate-500">24h</div>
            <div
              className={
                hoveredTile.item.changePct >= 0
                  ? "mt-1 text-base font-bold text-emerald-300"
                  : "mt-1 text-base font-bold text-red-300"
              }
            >
              {hoveredTile.item.changePct >= 0 ? "+" : ""}
              {hoveredTile.item.changePct.toFixed(2)}%
            </div>
          </div>

          <div className="mt-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Market Cap</span>
              <span className="font-bold">
                {formatCompact(hoveredTile.item.marketCap ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Volumen 24h</span>
              <span className="font-bold">{formatCompact(hoveredTile.item.volume)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
