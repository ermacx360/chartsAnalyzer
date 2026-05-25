"use client";

import { useEffect, useState } from "react";
import {
  CHART_TIMEZONE_OPTIONS,
  useChartStore,
} from "@/lib/store/chart-store";
import {
  fetchTicker24h,
  getSymbolDisplay,
  isCryptoSymbol,
} from "@/lib/market/data";
import type { Ticker24h } from "@/lib/binance/types";
import { formatPrice, formatPct, formatVolume } from "@/lib/format";
import { cn } from "@/lib/utils";

const CRYPTO_REFRESH_MS = 5_000;
const MARKET_REFRESH_MS = 30_000;

function formatClockTime(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

export function BottomPanel() {
  const symbol = useChartStore((s) => s.symbol);
  const timeZone = useChartStore((s) => s.chartTimeZone);
  const setChartTimeZone = useChartStore((s) => s.setChartTimeZone);
  const [clockTimestamp, setClockTimestamp] = useState(() => Date.now());
  const [tickerState, setTickerState] = useState<{
    symbol: string;
    ticker: Ticker24h;
  } | null>(null);
  const t = tickerState?.symbol === symbol ? tickerState.ticker : null;
  const isCrypto = isCryptoSymbol(symbol);
  const refreshMs = isCrypto ? CRYPTO_REFRESH_MS : MARKET_REFRESH_MS;

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchTicker24h(symbol)
        .then((x) => {
          if (!cancelled) setTickerState({ symbol, ticker: x });
        })
        .catch(() => {
          return;
        });
    };
    load();
    const id = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshMs, symbol]);

  const upClass = (n: number) => (n >= 0 ? "text-tv-green" : "text-tv-red");
  const symbolDisplay = getSymbolDisplay(symbol);
  const sourceText = isCrypto
    ? "Binance · Live"
    : `${symbolDisplay.source} · Delay`;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockTimestamp(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="flex h-9 items-center gap-0 border-t border-tv-border bg-tv-panel px-3 text-xs">
      <Stat label="Símbolo" value={symbolDisplay.compact} />
      <Stat
        label="24h Cambio"
        value={t ? formatPct(t.priceChangePercent) : "—"}
        valueClass={t ? upClass(t.priceChangePercent) : ""}
      />
      <Stat
        label="24h Alto"
        value={t ? formatPrice(t.highPrice) : "—"}
        valueClass="text-tv-green"
      />
      <Stat
        label="24h Bajo"
        value={t ? formatPrice(t.lowPrice) : "—"}
        valueClass="text-tv-red"
      />
      <Stat
        label="24h Vol (base)"
        value={t ? formatVolume(t.volume) : "—"}
      />
      <Stat
        label="24h Vol (USDT)"
        value={t ? formatVolume(t.quoteVolume) : "—"}
      />
      <div className="ml-auto mr-28 flex h-6 items-center gap-1 rounded-sm border border-tv-border bg-tv-bg px-2 shadow-sm">
        <span className="min-w-[52px] text-right text-[10px] font-medium tabular-nums leading-none text-tv-text">
          {formatClockTime(clockTimestamp, timeZone)}
        </span>
        <select
          aria-label="Zona horaria"
          title="Zona horaria"
          value={timeZone}
          onChange={(event) => setChartTimeZone(event.target.value)}
          className="h-5 bg-transparent text-[10px] font-semibold leading-none text-tv-text outline-none"
        >
          {CHART_TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz.value} value={tz.value} className="bg-tv-panel text-tv-text">
              {tz.label}
            </option>
          ))}
        </select>
      </div>
      <div className="-ml-24 flex items-center gap-2 text-[10px] text-tv-text-dim">
        <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-tv-green" />
        <span>{sourceText}</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 border-r border-tv-border px-3">
      <span className="text-tv-text-dim">{label}</span>
      <span className={cn("font-medium tabular-nums", valueClass ?? "text-tv-text")}>
        {value}
      </span>
    </div>
  );
}
