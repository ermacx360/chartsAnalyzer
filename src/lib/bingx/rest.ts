import type { Candle, SymbolInfo, Ticker24h, Timeframe } from "@/lib/binance/types";

const BASE = "https://open-api.bingx.com";

interface BingxResponse<T> {
  code?: number;
  msg?: string;
  data?: T;
}

interface BingxKline {
  open?: string | number;
  close?: string | number;
  high?: string | number;
  low?: string | number;
  volume?: string | number;
  time?: string | number;
}

interface BingxTicker {
  symbol?: string;
  priceChange?: string | number;
  priceChangePercent?: string | number;
  lastPrice?: string | number;
  highPrice?: string | number;
  lowPrice?: string | number;
  volume?: string | number;
  quoteVolume?: string | number;
}

interface BingxContract {
  symbol?: string;
  asset?: string;
  currency?: string;
  status?: string | number;
}

function toBingxSymbol(symbol: string) {
  const upper = symbol.toUpperCase();
  if (upper.includes("-")) return upper;
  if (upper.endsWith("USDT") && upper.length > 4) {
    return `${upper.slice(0, -4)}-USDT`;
  }
  return upper;
}

function toAppSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/-/g, "");
}

function getBingxInterval(timeframe: Timeframe) {
  return timeframe === "1s" ? "1m" : timeframe;
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function fetchBingx<T>(
  path: string,
  params: Record<string, string | number> = {},
) {
  const url = new URL(
    typeof window === "undefined" ? `${BASE}${path}` : "/api/bingx",
    typeof window === "undefined" ? undefined : window.location.origin,
  );

  if (typeof window !== "undefined") {
    url.searchParams.set("path", path);
  }

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`bingx ${res.status}`);

  const data = (await res.json()) as BingxResponse<T>;
  if (data.code !== 0) throw new Error(`bingx ${data.code ?? "error"} ${data.msg ?? ""}`);

  return data.data;
}

function parseKlines(data: BingxKline[] | undefined): Candle[] {
  if (!Array.isArray(data)) return [];

  return data
    .reduce<Candle[]>((candles, item) => {
      const time = parseNumber(item.time);
      const open = parseNumber(item.open);
      const high = parseNumber(item.high);
      const low = parseNumber(item.low);
      const close = parseNumber(item.close);

      if (
        time === null ||
        open === null ||
        high === null ||
        low === null ||
        close === null
      ) {
        return candles;
      }

      candles.push({
        time: Math.floor(time / 1000),
        open,
        high,
        low,
        close,
        volume: parseNumber(item.volume) ?? 0,
        isFinal: true,
      });

      return candles;
    }, [])
    .sort((a, b) => a.time - b.time);
}

export async function fetchKlines(
  symbol: string,
  interval: Timeframe,
  limit = 1000,
  beforeTime?: number,
): Promise<Candle[]> {
  const cappedLimit = Math.max(1, Math.min(30000, limit || 1000));
  const pageLimit = 1440;
  const pages: Candle[] = [];
  let endTime = beforeTime !== undefined ? beforeTime * 1000 - 1 : undefined;

  while (pages.length < cappedLimit) {
    const currentLimit = Math.min(pageLimit, cappedLimit - pages.length);
    const params: Record<string, string | number> = {
      symbol: toBingxSymbol(symbol),
      interval: getBingxInterval(interval),
      limit: currentLimit,
    };

    if (endTime !== undefined) {
      params.endTime = endTime;
    }

    const data = await fetchBingx<BingxKline[]>(
      "/openApi/swap/v3/quote/klines",
      params,
    );
    const candles = parseKlines(data);

    if (candles.length === 0) break;

    pages.unshift(...candles);
    endTime = candles[0].time * 1000 - 1;

    if (candles.length < currentLimit) break;
  }

  return pages.slice(-cappedLimit).sort((a, b) => a.time - b.time);
}

function parseTicker(displaySymbol: string, ticker: BingxTicker | undefined): Ticker24h {
  const lastPrice = parseNumber(ticker?.lastPrice);
  if (lastPrice === null) throw new Error("bingx ticker missing price");

  return {
    symbol: displaySymbol,
    lastPrice,
    priceChange: parseNumber(ticker?.priceChange) ?? 0,
    priceChangePercent: parseNumber(ticker?.priceChangePercent) ?? 0,
    highPrice: parseNumber(ticker?.highPrice) ?? lastPrice,
    lowPrice: parseNumber(ticker?.lowPrice) ?? lastPrice,
    volume: parseNumber(ticker?.volume) ?? 0,
    quoteVolume: parseNumber(ticker?.quoteVolume) ?? 0,
    market: "crypto",
  };
}

export async function fetchTicker24h(symbol: string): Promise<Ticker24h> {
  const bingxSymbol = toBingxSymbol(symbol);
  const ticker = await fetchBingx<BingxTicker>(
    "/openApi/swap/v2/quote/ticker",
    { symbol: bingxSymbol },
  );

  return parseTicker(toAppSymbol(bingxSymbol), ticker);
}

export async function fetchTickers24h(symbols: string[]): Promise<Ticker24h[]> {
  const results = await Promise.all(
    symbols.map((symbol) => fetchTicker24h(symbol).catch(() => null)),
  );

  return results.filter((ticker): ticker is Ticker24h => ticker !== null);
}

let cachedSymbols: SymbolInfo[] | null = null;
export async function fetchExchangeSymbols(): Promise<SymbolInfo[]> {
  if (cachedSymbols) return cachedSymbols;

  const data = await fetchBingx<BingxContract[]>(
    "/openApi/swap/v2/quote/contracts",
  );

  cachedSymbols = (data ?? [])
    .filter((contract) => {
      const symbol = contract.symbol?.toUpperCase() ?? "";
      const quote = contract.currency?.toUpperCase() ?? "";
      return symbol.endsWith("-USDT") || quote === "USDT";
    })
    .map((contract) => {
      const symbol = contract.symbol?.toUpperCase() ?? "";
      const appSymbol = toAppSymbol(symbol);
      const baseAsset =
        contract.asset?.toUpperCase() ??
        appSymbol.replace(/USDT$/, "") ??
        appSymbol;

      return {
        symbol: appSymbol,
        baseAsset,
        quoteAsset: "USDT",
        status: String(contract.status ?? "TRADING"),
        market: "crypto" as const,
        name: `${baseAsset}/USDT`,
      };
    });

  return cachedSymbols;
}
