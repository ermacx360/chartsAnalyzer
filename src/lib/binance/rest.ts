import type { Candle, SymbolInfo, Ticker24h, Timeframe } from "./types";

const BASE = "https://api.binance.com/api/v3";

const INTERVAL_MS: Record<Timeframe, number> = {
  "1s": 1000,
  "1m": 60 * 1000,
  "3m": 3 * 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "8h": 8 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
};

function parseKline(k: unknown[]): Candle {
  return {
    time: Math.floor((k[0] as number) / 1000),
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
    isFinal: true,
  };
}

async function fetchKlinePage(
  symbol: string,
  interval: Timeframe,
  limit: number,
  endTime?: number,
) {
  const params = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval,
    limit: String(limit),
  });

  if (endTime !== undefined) {
    params.set("endTime", String(endTime));
  }

  const res = await fetch(`${BASE}/klines?${params.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`klines ${res.status}`);

  return (await res.json()) as unknown[][];
}

export async function fetchKlines(
  symbol: string,
  interval: Timeframe,
  limit = 1000,
  beforeTime?: number,
): Promise<Candle[]> {
  const cappedLimit = Math.max(1, Math.min(30000, limit || 1000));
  const initialEndTime =
    beforeTime !== undefined ? beforeTime * 1000 - 1 : undefined;

  if (cappedLimit <= 1000) {
    const data = await fetchKlinePage(
      symbol,
      interval,
      Math.min(1000, cappedLimit),
      initialEndTime,
    );
    return data.map(parseKline);
  }

  const pages: unknown[][] = [];
  let endTime = initialEndTime;

  while (pages.length < cappedLimit) {
    const remaining = cappedLimit - pages.length;
    const page = await fetchKlinePage(
      symbol,
      interval,
      Math.min(1000, remaining),
      endTime,
    );

    if (page.length === 0) break;

    pages.unshift(...page);

    const firstOpenTime = page[0]?.[0];
    if (typeof firstOpenTime !== "number") break;

    endTime = firstOpenTime - (INTERVAL_MS[interval] ?? 1);

    if (page.length < Math.min(1000, remaining)) break;
  }

  return pages
    .slice(-cappedLimit)
    .map(parseKline)
    .sort((a, b) => a.time - b.time);
}

export async function fetchTicker24h(symbol: string): Promise<Ticker24h> {
  const url = `${BASE}/ticker/24hr?symbol=${symbol.toUpperCase()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`ticker ${res.status}`);
  const t = await res.json();
  return {
    symbol: t.symbol,
    lastPrice: parseFloat(t.lastPrice),
    priceChange: parseFloat(t.priceChange),
    priceChangePercent: parseFloat(t.priceChangePercent),
    highPrice: parseFloat(t.highPrice),
    lowPrice: parseFloat(t.lowPrice),
    volume: parseFloat(t.volume),
    quoteVolume: parseFloat(t.quoteVolume),
  };
}

export async function fetchTickers24h(symbols: string[]): Promise<Ticker24h[]> {
  const arr = JSON.stringify(symbols.map((s) => s.toUpperCase()));
  const url = `${BASE}/ticker/24hr?symbols=${encodeURIComponent(arr)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`tickers ${res.status}`);
  const data = await res.json();
  return data.map((t: Record<string, string>) => ({
    symbol: t.symbol,
    lastPrice: parseFloat(t.lastPrice),
    priceChange: parseFloat(t.priceChange),
    priceChangePercent: parseFloat(t.priceChangePercent),
    highPrice: parseFloat(t.highPrice),
    lowPrice: parseFloat(t.lowPrice),
    volume: parseFloat(t.volume),
    quoteVolume: parseFloat(t.quoteVolume),
  }));
}

let cachedSymbols: SymbolInfo[] | null = null;
export async function fetchExchangeSymbols(): Promise<SymbolInfo[]> {
  if (cachedSymbols) return cachedSymbols;
  const res = await fetch(`${BASE}/exchangeInfo`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`exchangeInfo ${res.status}`);
  const data = await res.json();
  cachedSymbols = data.symbols
    .filter(
      (s: { status: string; quoteAsset: string }) =>
        s.status === "TRADING" && s.quoteAsset === "USDT",
    )
    .map((s: { symbol: string; baseAsset: string; quoteAsset: string; status: string }) => ({
      symbol: s.symbol,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
      status: s.status,
      market: "crypto" as const,
    }));
  return cachedSymbols!;
}
