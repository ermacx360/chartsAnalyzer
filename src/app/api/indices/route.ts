import { getIndexInstrument } from "@/lib/market/indices";
import { getStockInstrument } from "@/lib/market/stocks";
import { getCommodityInstrument } from "@/lib/market/commodities";
import type { Candle, Ticker24h, Timeframe } from "@/lib/binance/types";

export const dynamic = "force-dynamic";

const BINGX_BASE = "https://open-api.bingx.com";
const CAPITAL_LIVE_BASE = "https://api-capital.backend-capital.com/api/v1";
const CAPITAL_DEMO_BASE = "https://demo-api-capital.backend-capital.com/api/v1";
const FINNHUB_BASE = "https://finnhub.io/api/v1";
const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

interface FinnhubCandleResponse {
  c?: number[];
  h?: number[];
  l?: number[];
  o?: number[];
  s?: string;
  t?: number[];
  v?: number[];
}

interface FinnhubQuoteResponse {
  c?: number;
  d?: number;
  dp?: number;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
  t?: number;
}

interface BingxKline {
  open?: string;
  close?: string;
  high?: string;
  low?: string;
  volume?: string;
  time?: number;
}

interface BingxKlinesResponse {
  code?: number;
  msg?: string;
  data?: BingxKline[];
}

interface BingxTicker {
  symbol?: string;
  priceChange?: string;
  priceChangePercent?: string;
  lastPrice?: string;
  highPrice?: string;
  lowPrice?: string;
  volume?: string;
  quoteVolume?: string;
  openTime?: number;
  closeTime?: number;
}

interface BingxTickerResponse {
  code?: number;
  msg?: string;
  data?: BingxTicker;
}

interface CapitalSession {
  cst: string;
  securityToken: string;
  expiresAt: number;
}

interface CapitalMarket {
  epic?: string;
  bid?: number;
  ofr?: number;
  offer?: number;
  netChange?: number;
  percentageChange?: number;
  high?: number;
  low?: number;
  updateTime?: string;
  updateTimeUTC?: string;
}

interface CapitalMarketsResponse {
  markets?: CapitalMarket[];
}

interface CapitalPricePoint {
  snapshotTimeUTC?: string;
  openPrice?: { bid?: number; ask?: number };
  highPrice?: { bid?: number; ask?: number };
  lowPrice?: { bid?: number; ask?: number };
  closePrice?: { bid?: number; ask?: number };
  lastTradedVolume?: number;
}

interface CapitalPricesResponse {
  prices?: CapitalPricePoint[];
}

interface YahooQuote {
  open?: Array<number | null>;
  high?: Array<number | null>;
  low?: Array<number | null>;
  close?: Array<number | null>;
  volume?: Array<number | null>;
}

interface YahooChartResult {
  timestamp?: number[];
  meta?: {
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    regularMarketVolume?: number;
  };
  indicators?: {
    quote?: YahooQuote[];
  };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
    error?: { description?: string };
  };
}

interface TimeframeQuery {
  resolution: string;
  lookbackSeconds: number;
  yahooInterval: string;
  yahooRange: string;
  aggregateSeconds?: number;
}

interface CapitalTimeframeQuery {
  resolution: string;
  max: number;
  aggregateSeconds?: number;
}

let capitalSession: CapitalSession | null = null;
let capitalSessionPromise: Promise<CapitalSession | null> | null = null;

function getTimeframeQuery(timeframe: Timeframe): TimeframeQuery {
  switch (timeframe) {
    case "1s":
    case "1m":
      return {
        resolution: "1",
        lookbackSeconds: 90 * 24 * 60 * 60,
        yahooInterval: "1m",
        yahooRange: "7d",
      };
    case "3m":
      return {
        resolution: "1",
        lookbackSeconds: 90 * 24 * 60 * 60,
        yahooInterval: "1m",
        yahooRange: "7d",
        aggregateSeconds: 3 * 60,
      };
    case "5m":
      return {
        resolution: "5",
        lookbackSeconds: 90 * 24 * 60 * 60,
        yahooInterval: "5m",
        yahooRange: "60d",
      };
    case "15m":
      return {
        resolution: "15",
        lookbackSeconds: 90 * 24 * 60 * 60,
        yahooInterval: "15m",
        yahooRange: "60d",
      };
    case "30m":
      return {
        resolution: "30",
        lookbackSeconds: 90 * 24 * 60 * 60,
        yahooInterval: "30m",
        yahooRange: "60d",
      };
    case "1h":
      return {
        resolution: "60",
        lookbackSeconds: 730 * 24 * 60 * 60,
        yahooInterval: "60m",
        yahooRange: "730d",
      };
    case "2h":
      return {
        resolution: "60",
        lookbackSeconds: 730 * 24 * 60 * 60,
        yahooInterval: "60m",
        yahooRange: "730d",
        aggregateSeconds: 2 * 60 * 60,
      };
    case "4h":
      return {
        resolution: "60",
        lookbackSeconds: 730 * 24 * 60 * 60,
        yahooInterval: "60m",
        yahooRange: "730d",
        aggregateSeconds: 4 * 60 * 60,
      };
    case "6h":
      return {
        resolution: "60",
        lookbackSeconds: 730 * 24 * 60 * 60,
        yahooInterval: "60m",
        yahooRange: "730d",
        aggregateSeconds: 6 * 60 * 60,
      };
    case "8h":
      return {
        resolution: "60",
        lookbackSeconds: 730 * 24 * 60 * 60,
        yahooInterval: "60m",
        yahooRange: "730d",
        aggregateSeconds: 8 * 60 * 60,
      };
    case "12h":
      return {
        resolution: "60",
        lookbackSeconds: 730 * 24 * 60 * 60,
        yahooInterval: "60m",
        yahooRange: "730d",
        aggregateSeconds: 12 * 60 * 60,
      };
    case "1d":
      return {
        resolution: "D",
        lookbackSeconds: 50 * 365 * 24 * 60 * 60,
        yahooInterval: "1d",
        yahooRange: "max",
      };
    case "3d":
      return {
        resolution: "D",
        lookbackSeconds: 50 * 365 * 24 * 60 * 60,
        yahooInterval: "1d",
        yahooRange: "max",
        aggregateSeconds: 3 * 24 * 60 * 60,
      };
    case "1w":
      return {
        resolution: "W",
        lookbackSeconds: 50 * 365 * 24 * 60 * 60,
        yahooInterval: "1wk",
        yahooRange: "max",
      };
    case "1M":
      return {
        resolution: "M",
        lookbackSeconds: 50 * 365 * 24 * 60 * 60,
        yahooInterval: "1mo",
        yahooRange: "max",
      };
  }
}

function getBingxInterval(timeframe: Timeframe) {
  return timeframe === "1s" ? "1m" : timeframe;
}

function isLongHistoryTimeframe(timeframe: Timeframe) {
  return (
    timeframe === "1h" ||
    timeframe === "2h" ||
    timeframe === "4h" ||
    timeframe === "6h" ||
    timeframe === "8h" ||
    timeframe === "12h" ||
    timeframe === "1d" ||
    timeframe === "3d" ||
    timeframe === "1w" ||
    timeframe === "1M"
  );
}

function canUseDailyHistoryFallback(timeframe: Timeframe) {
  return (
    timeframe === "4h" ||
    timeframe === "6h" ||
    timeframe === "8h" ||
    timeframe === "12h" ||
    timeframe === "1d" ||
    timeframe === "3d" ||
    timeframe === "1w" ||
    timeframe === "1M"
  );
}

function getCandleLimit(limit: number, max = 10000) {
  return Math.max(1, Math.min(max, limit || 5000));
}

function getTimeframeSeconds(timeframe: Timeframe) {
  switch (timeframe) {
    case "1s":
      return 1;
    case "1m":
      return 60;
    case "3m":
      return 3 * 60;
    case "5m":
      return 5 * 60;
    case "15m":
      return 15 * 60;
    case "30m":
      return 30 * 60;
    case "1h":
      return 60 * 60;
    case "2h":
      return 2 * 60 * 60;
    case "4h":
      return 4 * 60 * 60;
    case "6h":
      return 6 * 60 * 60;
    case "8h":
      return 8 * 60 * 60;
    case "12h":
      return 12 * 60 * 60;
    case "1d":
      return 24 * 60 * 60;
    case "3d":
      return 3 * 24 * 60 * 60;
    case "1w":
      return 7 * 24 * 60 * 60;
    case "1M":
      return 30 * 24 * 60 * 60;
  }
}

function getPagedLookbackSeconds(
  timeframe: Timeframe,
  limit: number,
  maxLookbackSeconds: number,
) {
  const pageLimit = getCandleLimit(limit, 5000);
  const multiplier = timeframe === "1d" || timeframe === "3d" ? 3 : 2;
  const lookbackSeconds = getTimeframeSeconds(timeframe) * pageLimit * multiplier;

  return Math.min(maxLookbackSeconds, Math.max(lookbackSeconds, 24 * 60 * 60));
}

function getCapitalPagedLookbackSeconds(timeframe: Timeframe, limit: number) {
  const pageLimit = getCandleLimit(limit, 1000);
  const lookbackSeconds = getTimeframeSeconds(timeframe) * pageLimit * 2;

  return Math.max(lookbackSeconds, 24 * 60 * 60);
}

function getCapitalTimeframeQuery(
  timeframe: Timeframe,
  limit: number,
): CapitalTimeframeQuery | null {
  const max = Math.max(1, Math.min(1000, limit || 1000));

  switch (timeframe) {
    case "1s":
    case "1m":
      return { resolution: "MINUTE", max };
    case "3m":
      return { resolution: "MINUTE", max, aggregateSeconds: 3 * 60 };
    case "5m":
      return { resolution: "MINUTE_5", max };
    case "15m":
      return { resolution: "MINUTE_15", max };
    case "30m":
      return { resolution: "MINUTE_30", max };
    case "1h":
      return { resolution: "HOUR", max };
    case "2h":
      return { resolution: "HOUR", max, aggregateSeconds: 2 * 60 * 60 };
    case "4h":
      return { resolution: "HOUR_4", max };
    case "6h":
      return { resolution: "HOUR", max, aggregateSeconds: 6 * 60 * 60 };
    case "8h":
      return { resolution: "HOUR_4", max, aggregateSeconds: 8 * 60 * 60 };
    case "12h":
      return { resolution: "HOUR_4", max, aggregateSeconds: 12 * 60 * 60 };
    case "1d":
      return { resolution: "DAY", max };
    case "3d":
      return { resolution: "DAY", max, aggregateSeconds: 3 * 24 * 60 * 60 };
    case "1w":
      return { resolution: "WEEK", max };
    case "1M":
      return null;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getFinnhubToken() {
  return process.env.FINNHUB_API_KEY?.trim() ?? "";
}

function getCapitalBaseUrl() {
  if (process.env.CAPITAL_API_BASE_URL?.trim()) {
    return process.env.CAPITAL_API_BASE_URL.trim().replace(/\/$/, "");
  }

  return process.env.CAPITAL_DEMO === "true"
    ? CAPITAL_DEMO_BASE
    : CAPITAL_LIVE_BASE;
}

function getCapitalCredentials() {
  const apiKey = process.env.CAPITAL_API_KEY?.trim() ?? "";
  const identifier = process.env.CAPITAL_IDENTIFIER?.trim() ?? "";
  const password = process.env.CAPITAL_API_PASSWORD?.trim() ?? "";

  if (!apiKey || !identifier || !password) {
    return null;
  }

  return { apiKey, identifier, password };
}

function missingTokenResponse() {
  return Response.json(
    {
      error:
        "Falta FINNHUB_API_KEY. Agregala en .env.local y reinicia el servidor.",
    },
    { status: 503 },
  );
}

async function getCapitalSession() {
  const credentials = getCapitalCredentials();

  if (!credentials) {
    return null;
  }

  if (capitalSession && capitalSession.expiresAt > Date.now()) {
    return capitalSession;
  }

  if (capitalSessionPromise) {
    return capitalSessionPromise;
  }

  capitalSessionPromise = createCapitalSession(credentials);

  try {
    return await capitalSessionPromise;
  } finally {
    capitalSessionPromise = null;
  }
}

async function createCapitalSession(credentials: {
  apiKey: string;
  identifier: string;
  password: string;
}) {
  const res = await fetch(`${getCapitalBaseUrl()}/session`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-CAP-API-KEY": credentials.apiKey,
    },
    body: JSON.stringify({
      identifier: credentials.identifier,
      password: credentials.password,
      encryptedPassword: false,
    }),
  });

  if (!res.ok) {
    capitalSession = null;
    return null;
  }

  const cst = res.headers.get("CST") ?? "";
  const securityToken = res.headers.get("X-SECURITY-TOKEN") ?? "";

  if (!cst || !securityToken) {
    capitalSession = null;
    return null;
  }

  capitalSession = {
    cst,
    securityToken,
    expiresAt: Date.now() + 9 * 60 * 1000,
  };

  return capitalSession;
}

async function fetchCapital<T>(
  path: string,
  params: Record<string, string | number> = {},
  retry = true,
) {
  const session = await getCapitalSession();

  if (!session) {
    return null;
  }

  const url = new URL(`${getCapitalBaseUrl()}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      CST: session.cst,
      "X-SECURITY-TOKEN": session.securityToken,
    },
  });

  if ((res.status === 401 || res.status === 403) && retry) {
    capitalSession = null;
    return fetchCapital<T>(path, params, false);
  }

  if (!res.ok) {
    return null;
  }

  return (await res.json()) as T;
}

function parseCandles(data: FinnhubCandleResponse): Candle[] {
  if (data.s === "no_data") {
    return [];
  }

  const timestamps = data.t ?? [];

  return timestamps.reduce<Candle[]>((candles, time, index) => {
    const open = data.o?.[index];
    const high = data.h?.[index];
    const low = data.l?.[index];
    const close = data.c?.[index];

    if (
      !isFiniteNumber(time) ||
      !isFiniteNumber(open) ||
      !isFiniteNumber(high) ||
      !isFiniteNumber(low) ||
      !isFiniteNumber(close)
    ) {
      return candles;
    }

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume: data.v?.[index] ?? 0,
      isFinal: true,
    });

    return candles;
  }, []);
}

function aggregateCandles(candles: Candle[], bucketSeconds?: number) {
  if (!bucketSeconds) {
    return candles;
  }

  const buckets = new Map<number, Candle>();

  candles.forEach((candle) => {
    const bucketTime = Math.floor(candle.time / bucketSeconds) * bucketSeconds;
    const existing = buckets.get(bucketTime);

    if (!existing) {
      buckets.set(bucketTime, { ...candle, time: bucketTime });
      return;
    }

    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume += candle.volume;
  });

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

async function fetchFinnhub<T>(
  path: string,
  params: Record<string, string | number>,
) {
  const token = getFinnhubToken();

  if (!token) {
    return missingTokenResponse();
  }

  const url = new URL(`${FINNHUB_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  url.searchParams.set("token", token);

  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    return Response.json(
      { error: `Finnhub no pudo cargar datos (${res.status})` },
      { status: res.status },
    );
  }

  return (await res.json()) as T;
}

async function fetchBingx<T>(path: string, params: Record<string, string | number>) {
  const url = new URL(`${BINGX_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    return null;
  }

  return (await res.json()) as T;
}

function parseBingxCandles(data: BingxKlinesResponse): Candle[] {
  if (data.code !== 0 || !Array.isArray(data.data)) {
    return [];
  }

  return data.data
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

async function fetchBingxCandles(
  symbol: string,
  timeframe: Timeframe,
  limit: number,
  beforeTime?: number,
) {
  const cappedLimit = Math.max(1, Math.min(30000, limit || 1000));
  const pageLimit = 1440;
  const pages: Candle[] = [];
  let endTime = beforeTime !== undefined ? beforeTime * 1000 - 1 : undefined;

  while (pages.length < cappedLimit) {
    const currentLimit = Math.min(pageLimit, cappedLimit - pages.length);
    const params: Record<string, string | number> = {
      symbol,
      interval: getBingxInterval(timeframe),
      limit: currentLimit,
    };

    if (endTime !== undefined) {
      params.endTime = endTime;
    }

    const data = await fetchBingx<BingxKlinesResponse>(
      "/openApi/swap/v3/quote/klines",
      params,
    );
    const candles = data ? parseBingxCandles(data) : [];

    if (candles.length === 0) break;

    pages.unshift(...candles);
    endTime = candles[0].time * 1000 - 1;

    if (candles.length < currentLimit) break;
  }

  return pages.slice(-cappedLimit).sort((a, b) => a.time - b.time);
}

async function fetchBingxTicker(
  displaySymbol: string,
  bingxSymbol: string,
): Promise<Ticker24h | null> {
  const response = await fetchBingx<BingxTickerResponse>(
    "/openApi/swap/v2/quote/ticker",
    { symbol: bingxSymbol },
  );
  const ticker = response?.data;

  if (response?.code !== 0 || !ticker) {
    return null;
  }

  const lastPrice = parseNumber(ticker.lastPrice);
  const priceChange = parseNumber(ticker.priceChange);
  const priceChangePercent = parseNumber(ticker.priceChangePercent);

  if (lastPrice === null || priceChange === null || priceChangePercent === null) {
    return null;
  }

  return {
    symbol: displaySymbol,
    lastPrice,
    priceChange,
    priceChangePercent,
    highPrice: parseNumber(ticker.highPrice) ?? lastPrice,
    lowPrice: parseNumber(ticker.lowPrice) ?? lastPrice,
    volume: parseNumber(ticker.volume) ?? 0,
    quoteVolume: parseNumber(ticker.quoteVolume) ?? 0,
    market: "index",
  };
}

function midpoint(bid: unknown, ask: unknown) {
  const parsedBid = parseNumber(bid);
  const parsedAsk = parseNumber(ask);

  if (parsedBid !== null && parsedAsk !== null) {
    return (parsedBid + parsedAsk) / 2;
  }

  return parsedBid ?? parsedAsk;
}

function parseCapitalTime(value: string | undefined) {
  if (!value) return null;
  const normalized = value.endsWith("Z") ? value : `${value}Z`;
  const parsed = Date.parse(normalized);

  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}

function formatCapitalTime(timestamp: number) {
  return new Date(timestamp * 1000).toISOString().replace(/\.\d{3}Z$/, "");
}

function getCapitalMarketPrice(market: CapitalMarket) {
  return midpoint(market.bid, market.ofr ?? market.offer);
}

async function fetchCapitalTicker(
  displaySymbol: string,
  epic: string,
  searchTerm = epic,
  marketKind: Ticker24h["market"] = "index",
): Promise<Ticker24h | null> {
  const response = await fetchCapital<CapitalMarketsResponse>("/markets", {
    searchTerm,
  });
  const market = response?.markets?.find((item) => item.epic === epic);

  if (!market) {
    return null;
  }

  const lastPrice = getCapitalMarketPrice(market);

  if (lastPrice === null) {
    return null;
  }

  const priceChange = parseNumber(market.netChange) ?? 0;

  return {
    symbol: displaySymbol,
    lastPrice,
    priceChange,
    priceChangePercent: parseNumber(market.percentageChange) ?? 0,
    highPrice: parseNumber(market.high) ?? lastPrice,
    lowPrice: parseNumber(market.low) ?? lastPrice,
    volume: 0,
    quoteVolume: 0,
    market: marketKind,
  };
}

function parseCapitalCandles(data: CapitalPricesResponse): Candle[] {
  return (data.prices ?? [])
    .reduce<Candle[]>((candles, item) => {
      const time = parseCapitalTime(item.snapshotTimeUTC);
      const open = midpoint(item.openPrice?.bid, item.openPrice?.ask);
      const high = midpoint(item.highPrice?.bid, item.highPrice?.ask);
      const low = midpoint(item.lowPrice?.bid, item.lowPrice?.ask);
      const close = midpoint(item.closePrice?.bid, item.closePrice?.ask);

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
        time,
        open,
        high,
        low,
        close,
        volume: parseNumber(item.lastTradedVolume) ?? 0,
        isFinal: true,
      });

      return candles;
    }, [])
    .sort((a, b) => a.time - b.time);
}

async function fetchCapitalCandles(
  epic: string,
  timeframe: Timeframe,
  limit: number,
  beforeTime?: number,
) {
  const totalLimit = Math.max(1, Math.min(10000, limit || 1000));
  const query = getCapitalTimeframeQuery(timeframe, Math.min(1000, totalLimit));

  if (!query) {
    return [];
  }

  const pages: Candle[] = [];
  let cursor = beforeTime;

  while (pages.length < totalLimit) {
    const remaining = totalLimit - pages.length;
    const pageMax = Math.min(1000, remaining);
    const params: Record<string, string | number> = {
      resolution: query.resolution,
      max: pageMax,
    };

    if (cursor !== undefined) {
      const to = cursor - 1;
      const from = Math.max(
        0,
        to - getCapitalPagedLookbackSeconds(timeframe, pageMax),
      );
      params.from = formatCapitalTime(from);
      params.to = formatCapitalTime(to);
    }

    const response = await fetchCapital<CapitalPricesResponse>(
      `/prices/${encodeURIComponent(epic)}`,
      params,
    );

    if (!response) {
      break;
    }

    const candles = aggregateCandles(
      parseCapitalCandles(response),
      query.aggregateSeconds,
    ).filter((candle) => cursor === undefined || candle.time < cursor);

    if (candles.length === 0) {
      break;
    }

    pages.unshift(...candles);
    cursor = candles[0].time;

    if (candles.length < pageMax) {
      break;
    }
  }

  return aggregateCandles(pages, query.aggregateSeconds).slice(-totalLimit);
}

function buildTicker(
  symbol: string,
  quote: FinnhubQuoteResponse,
  market: Ticker24h["market"],
): Ticker24h {
  const lastPrice = quote.c ?? 0;
  const previousClose = quote.pc ?? lastPrice;
  const priceChange = quote.d ?? lastPrice - previousClose;

  return {
    symbol,
    lastPrice,
    priceChange,
    priceChangePercent:
      quote.dp ?? (previousClose === 0 ? 0 : (priceChange / previousClose) * 100),
    highPrice: quote.h ?? lastPrice,
    lowPrice: quote.l ?? lastPrice,
    volume: 0,
    quoteVolume: 0,
    market,
  };
}

function hasUsableFinnhubQuote(quote: FinnhubQuoteResponse) {
  return isFiniteNumber(quote.c) && quote.c > 0;
}

async function fetchYahooChart(
  yahooSymbol: string,
  query: Pick<TimeframeQuery, "yahooInterval" | "yahooRange">,
  period?: { from: number; to: number },
) {
  const url = new URL(`${YAHOO_CHART_BASE}/${encodeURIComponent(yahooSymbol)}`);
  url.searchParams.set("interval", query.yahooInterval);
  if (period) {
    url.searchParams.set("period1", String(period.from));
    url.searchParams.set("period2", String(period.to));
  } else if (query.yahooRange === "max") {
    url.searchParams.set("period1", "0");
    url.searchParams.set("period2", String(Math.floor(Date.now() / 1000)));
  } else {
    url.searchParams.set("range", query.yahooRange);
  }
  url.searchParams.set("includePrePost", "false");

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!res.ok) {
    return Response.json(
      { error: `Yahoo no pudo cargar datos (${res.status})` },
      { status: res.status },
    );
  }

  const data = (await res.json()) as YahooChartResponse;
  const result = data.chart?.result?.[0];

  if (!result || data.chart?.error) {
    return Response.json(
      { error: data.chart?.error?.description ?? "Sin datos del indice" },
      { status: 502 },
    );
  }

  return result;
}

function getYahooChartSymbols(futuresSymbol: string | undefined, yahooSymbol: string) {
  return Array.from(
    new Set([futuresSymbol, yahooSymbol].filter((symbol): symbol is string => !!symbol)),
  );
}

async function fetchFirstYahooChart(
  symbols: string[],
  query: Pick<TimeframeQuery, "yahooInterval" | "yahooRange">,
  period?: { from: number; to: number },
) {
  let lastError: Response | null = null;

  for (const symbol of symbols) {
    const result = await fetchYahooChart(symbol, query, period);

    if (!(result instanceof Response)) {
      return result;
    }

    lastError = result;
  }

  return (
    lastError ??
    Response.json({ error: "Sin simbolos Yahoo disponibles" }, { status: 404 })
  );
}

function parseYahooCandles(result: YahooChartResult): Candle[] {
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];

  if (!quote) {
    return [];
  }

  return timestamps.reduce<Candle[]>((candles, time, index) => {
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];

    if (
      !isFiniteNumber(time) ||
      !isFiniteNumber(open) ||
      !isFiniteNumber(high) ||
      !isFiniteNumber(low) ||
      !isFiniteNumber(close)
    ) {
      return candles;
    }

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume: quote.volume?.[index] ?? 0,
      isFinal: true,
    });

    return candles;
  }, []);
}

function buildYahooTicker(
  symbol: string,
  result: YahooChartResult,
  market: Ticker24h["market"],
): Ticker24h {
  const candles = parseYahooCandles(result);
  const last = candles[candles.length - 1];
  const previous = candles[candles.length - 2] ?? last;
  const lastPrice = result.meta?.regularMarketPrice ?? last?.close ?? 0;
  const previousClose = result.meta?.chartPreviousClose ?? previous?.close ?? lastPrice;
  const priceChange = lastPrice - previousClose;

  return {
    symbol,
    lastPrice,
    priceChange,
    priceChangePercent:
      previousClose === 0 ? 0 : (priceChange / previousClose) * 100,
    highPrice: result.meta?.regularMarketDayHigh ?? last?.high ?? lastPrice,
    lowPrice: result.meta?.regularMarketDayLow ?? last?.low ?? lastPrice,
    volume: result.meta?.regularMarketVolume ?? last?.volume ?? 0,
    quoteVolume: 0,
    market,
  };
}

async function fetchYahooDailyHistoryFallback(
  symbols: string[],
  beforeTime: number | undefined,
  limit: number,
) {
  const to = beforeTime !== undefined ? beforeTime - 1 : Math.floor(Date.now() / 1000);
  const result = await fetchFirstYahooChart(
    symbols,
    {
      yahooInterval: "1d",
      yahooRange: "max",
    },
    {
      from: 0,
      to,
    },
  );

  if (result instanceof Response) {
    return [];
  }

  return parseYahooCandles(result)
    .filter((candle) => beforeTime === undefined || candle.time < beforeTime)
    .slice(-getCandleLimit(limit));
}

function buildTickerFromCandles(
  symbol: string,
  candles: Candle[],
  market: Ticker24h["market"],
): Ticker24h | null {
  const last = candles[candles.length - 1];

  if (!last) {
    return null;
  }

  const previous = candles[candles.length - 2] ?? last;
  const priceChange = last.close - previous.close;

  return {
    symbol,
    lastPrice: last.close,
    priceChange,
    priceChangePercent:
      previous.close === 0 ? 0 : (priceChange / previous.close) * 100,
    highPrice: last.high,
    lowPrice: last.low,
    volume: last.volume,
    quoteVolume: 0,
    market,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.toUpperCase() ?? "";
  const kind = url.searchParams.get("kind") ?? "candles";
  const marketHint = url.searchParams.get("market");
  const timeframe = (url.searchParams.get("interval") ?? "1d") as Timeframe;
  const limit = Number(url.searchParams.get("limit") ?? "1000");
  const beforeTimeParam = url.searchParams.get("beforeTime");
  const parsedBeforeTime =
    beforeTimeParam === null ? undefined : Number(beforeTimeParam);
  const beforeTime =
    parsedBeforeTime !== undefined &&
    Number.isFinite(parsedBeforeTime) &&
    parsedBeforeTime > 0
      ? parsedBeforeTime
      : undefined;
  const index = getIndexInstrument(symbol);
  const stock =
    getStockInstrument(symbol) ??
    (marketHint === "stock"
      ? {
          symbol,
          yahooSymbol: symbol.replace(".", "-"),
          finnhubSymbol: symbol,
          name: symbol,
          region: "Estados Unidos",
        }
      : null);
  const commodity = getCommodityInstrument(symbol);
  const instrument = index ?? stock ?? commodity;
  const market = stock ? "stock" : commodity ? "commodity" : "index";
  const capitalEpic = index?.capitalEpic ?? commodity?.capitalEpic;
  const capitalSearchTerm =
    index?.capitalEpic ?? commodity?.capitalSearchTerm ?? commodity?.capitalEpic;

  if (!instrument) {
    return Response.json({ error: "Instrumento no soportado" }, { status: 404 });
  }

  if (kind === "ticker") {
    if (capitalEpic) {
      const ticker = await fetchCapitalTicker(
        symbol,
        capitalEpic,
        capitalSearchTerm,
        market,
      );

      if (ticker) {
        return Response.json({ ticker, provider: "capital" });
      }

      const candles = await fetchCapitalCandles(capitalEpic, "1m", 2);
      const candleTicker = buildTickerFromCandles(symbol, candles, market);

      if (candleTicker) {
        return Response.json({ ticker: candleTicker, provider: "capital" });
      }
    }

    if (index?.bingxSymbol) {
      const ticker = await fetchBingxTicker(symbol, index.bingxSymbol);

      if (ticker) {
        return Response.json({ ticker, provider: "bingx" });
      }
    }

    const chartSymbols = getYahooChartSymbols(
      index?.futuresSymbol,
      instrument.yahooSymbol,
    );
    const quote = await fetchFinnhub<FinnhubQuoteResponse>("/quote", {
      symbol: instrument.finnhubSymbol,
    });

    if (!(quote instanceof Response) && hasUsableFinnhubQuote(quote)) {
      return Response.json({
        ticker: buildTicker(symbol, quote, market),
        provider: "finnhub",
      });
    }

    const yahooResult = await fetchFirstYahooChart(chartSymbols, {
      yahooInterval: "1d",
      yahooRange: "5d",
    });

    if (yahooResult instanceof Response) {
      return yahooResult;
    }

    return Response.json({
      ticker: buildYahooTicker(symbol, yahooResult, market),
      provider: "yahoo-fallback",
    });
  }

  const timeframeQuery = getTimeframeQuery(timeframe);
  const chartSymbols = getYahooChartSymbols(
    index?.futuresSymbol,
    instrument.yahooSymbol,
  );
  const useLongHistoryProvider = isLongHistoryTimeframe(timeframe);

  if (
    index?.bingxSymbol &&
    !capitalEpic &&
    (!useLongHistoryProvider || beforeTime !== undefined)
  ) {
    const bingxCandles = await fetchBingxCandles(
      index.bingxSymbol,
      timeframe,
      limit,
      beforeTime,
    );

    if (bingxCandles.length > 0) {
      return Response.json({ candles: bingxCandles, provider: "bingx" });
    }
  }

  if (capitalEpic) {
    const capitalCandles = await fetchCapitalCandles(
      capitalEpic,
      timeframe,
      limit,
      beforeTime,
    );

    if (capitalCandles.length > 0) {
      return Response.json({ candles: capitalCandles, provider: "capital" });
    }
  }

  const to = beforeTime !== undefined ? beforeTime - 1 : Math.floor(Date.now() / 1000);
  const lookbackSeconds =
    beforeTime !== undefined
      ? getPagedLookbackSeconds(timeframe, limit, timeframeQuery.lookbackSeconds)
      : timeframeQuery.lookbackSeconds;
  const from = Math.max(0, to - lookbackSeconds);
  const result = await fetchFinnhub<FinnhubCandleResponse>("/stock/candle", {
    symbol: instrument.finnhubSymbol,
    resolution: timeframeQuery.resolution,
    from,
    to,
  });

  if (!(result instanceof Response)) {
    const finnhubCandles = aggregateCandles(
      parseCandles(result),
      timeframeQuery.aggregateSeconds,
    ).slice(-getCandleLimit(limit));

    if (finnhubCandles.length > 0) {
      return Response.json({ candles: finnhubCandles, provider: "finnhub" });
    }
  }

  const yahooPeriod =
    beforeTime !== undefined
      ? {
          from,
          to,
        }
      : undefined;
  const yahooResult = await fetchFirstYahooChart(
    chartSymbols,
    timeframeQuery,
    yahooPeriod,
  );

  const yahooCandles =
    yahooResult instanceof Response
      ? []
      : aggregateCandles(
          parseYahooCandles(yahooResult),
          timeframeQuery.aggregateSeconds,
        ).slice(-getCandleLimit(limit));

  if (yahooCandles.length > 0) {
    return Response.json({ candles: yahooCandles, provider: "yahoo-fallback" });
  }

  if (canUseDailyHistoryFallback(timeframe)) {
    const dailyHistoryCandles = await fetchYahooDailyHistoryFallback(
      chartSymbols,
      beforeTime,
      limit,
    );

    if (dailyHistoryCandles.length > 0) {
      return Response.json({
        candles: dailyHistoryCandles,
        provider: "yahoo-daily-history-fallback",
      });
    }
  }

  return Response.json({ candles: [], provider: "empty" });
}
