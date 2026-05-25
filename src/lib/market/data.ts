import {
  fetchExchangeSymbols as fetchCryptoSymbols,
  fetchKlines as fetchCryptoKlines,
  fetchTicker24h as fetchCryptoTicker24h,
  fetchTickers24h as fetchCryptoTickers24h,
} from "@/lib/binance/rest";
import {
  fetchExchangeSymbols as fetchBingxCryptoSymbols,
  fetchKlines as fetchBingxCryptoKlines,
  fetchTicker24h as fetchBingxCryptoTicker24h,
  fetchTickers24h as fetchBingxCryptoTickers24h,
} from "@/lib/bingx/rest";
import type { Candle, SymbolInfo, Ticker24h, Timeframe } from "@/lib/binance/types";
import {
  COMMODITY_SYMBOLS,
  getCommodityInstrument,
  isCapitalCommoditySymbol,
  isCommoditySymbol,
} from "./commodities";
import {
  getIndexInstrument,
  INDEX_SYMBOLS,
  isCapitalIndexSymbol,
  isIndexSymbol,
  isMainIndexSymbol,
} from "./indices";
import {
  getStockInstrument,
  isStockSymbol,
  registerStockInstruments,
  STOCK_SYMBOLS,
} from "./stocks";

export function isCryptoSymbol(symbol: string) {
  return !isIndexSymbol(symbol) && !isStockSymbol(symbol) && !isCommoditySymbol(symbol);
}

export function isCapitalMarketSymbol(symbol: string) {
  return isCapitalIndexSymbol(symbol) || isCapitalCommoditySymbol(symbol);
}

export function getCapitalPollIntervalMs(symbol: string) {
  return getMarketPollIntervalMs(symbol);
}

export function getMarketPollIntervalMs(symbol: string) {
  const upper = symbol.toUpperCase();

  if (isMainIndexSymbol(upper)) {
    return 1_000;
  }

  if (isCapitalMarketSymbol(upper)) {
    return 5_000;
  }

  return 30_000;
}

export { isCapitalIndexSymbol, isCommoditySymbol, isMainIndexSymbol };

export function getSymbolDisplay(symbol: string) {
  const index = getIndexInstrument(symbol);
  if (index) {
    return {
      primary: index.name,
      secondary: "Indice",
      compact: index.symbol,
      source: index.capitalEpic
        ? "Capital.com"
        : index.bingxSymbol
        ? "BingX Futures"
        : index.futuresSource ?? (index.futuresSymbol ? "Futures" : "Indice"),
    };
  }

  const commodity = getCommodityInstrument(symbol);
  if (commodity) {
    return {
      primary: commodity.name,
      secondary: "Commodity",
      compact: commodity.symbol,
      source: "Capital.com",
    };
  }

  const stock = getStockInstrument(symbol);
  if (stock) {
    return {
      primary: stock.name,
      secondary: "Accion",
      compact: stock.symbol,
      source: "Finnhub",
    };
  }

  return {
    primary: symbol.replace("USDT", ""),
    secondary: symbol.endsWith("USDT") ? "USDT" : "Cripto",
    compact: symbol,
    source: "Binance / BingX",
  };
}

async function fetchCryptoKlinesWithFallback(
  symbol: string,
  interval: Timeframe,
  limit: number,
  beforeTime?: number,
) {
  try {
    const binanceCandles = await fetchCryptoKlines(symbol, interval, limit, beforeTime);
    if (binanceCandles.length > 0) return binanceCandles;
  } catch {
    // try BingX below
  }

  return fetchBingxCryptoKlines(symbol, interval, limit, beforeTime);
}

async function fetchCryptoTicker24hWithFallback(symbol: string) {
  try {
    return await fetchCryptoTicker24h(symbol);
  } catch {
    return fetchBingxCryptoTicker24h(symbol);
  }
}

async function fetchCryptoTickers24hWithFallback(symbols: string[]) {
  const uniqueSymbols = Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase())));
  const results = new Map<string, Ticker24h>();

  try {
    const binanceTickers = await fetchCryptoTickers24h(uniqueSymbols);
    binanceTickers.forEach((ticker) => results.set(ticker.symbol.toUpperCase(), ticker));
  } catch {
    await Promise.all(
      uniqueSymbols.map(async (symbol) => {
        try {
          const ticker = await fetchCryptoTicker24h(symbol);
          results.set(ticker.symbol.toUpperCase(), ticker);
        } catch {
          // try BingX below
        }
      }),
    );
  }

  const missingSymbols = uniqueSymbols.filter((symbol) => !results.has(symbol));
  if (missingSymbols.length > 0) {
    const bingxTickers = await fetchBingxCryptoTickers24h(missingSymbols).catch(() => []);
    bingxTickers.forEach((ticker) => results.set(ticker.symbol.toUpperCase(), ticker));
  }

  return uniqueSymbols
    .map((symbol) => results.get(symbol))
    .filter((ticker): ticker is Ticker24h => ticker !== undefined);
}

function getMarketApiUrl(
  symbol: string,
  kind: "candles" | "ticker",
  interval?: Timeframe,
  limit?: number,
  beforeTime?: number,
) {
  const params = new URLSearchParams({
    symbol,
    kind,
  });

  if (isStockSymbol(symbol)) {
    params.set("market", "stock");
  } else if (isCommoditySymbol(symbol)) {
    params.set("market", "commodity");
  } else if (isIndexSymbol(symbol)) {
    params.set("market", "index");
  }

  if (interval) {
    params.set("interval", interval);
  }

  if (limit) {
    params.set("limit", String(limit));
  }

  if (beforeTime !== undefined) {
    params.set("beforeTime", String(beforeTime));
  }

  return `/api/indices?${params.toString()}`;
}

export async function fetchStockSearchSymbols(query: string): Promise<SymbolInfo[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`, {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = (await res.json()) as { symbols?: SymbolInfo[] };
  const symbols = data.symbols ?? [];
  registerStockInstruments(symbols);
  return symbols;
}

export async function fetchKlines(
  symbol: string,
  interval: Timeframe,
  limit = 1000,
  beforeTime?: number,
): Promise<Candle[]> {
  if (isIndexSymbol(symbol) || isStockSymbol(symbol) || isCommoditySymbol(symbol)) {
    const res = await fetch(
      getMarketApiUrl(symbol, "candles", interval, limit, beforeTime),
      {
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as { candles: Candle[] };
    return data.candles;
  }

  return fetchCryptoKlinesWithFallback(symbol, interval, limit, beforeTime);
}

export async function fetchTicker24h(symbol: string): Promise<Ticker24h> {
  if (isIndexSymbol(symbol) || isStockSymbol(symbol) || isCommoditySymbol(symbol)) {
    const market = isStockSymbol(symbol)
      ? "stock"
      : isCommoditySymbol(symbol)
        ? "commodity"
        : "index";
    const res = await fetch(getMarketApiUrl(symbol, "ticker"), {
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        symbol,
        lastPrice: 0,
        priceChange: 0,
        priceChangePercent: 0,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        quoteVolume: 0,
        market,
      };
    }

    const data = (await res.json()) as { ticker: Ticker24h };
    return data.ticker;
  }

  return fetchCryptoTicker24hWithFallback(symbol);
}

export async function fetchTickers24h(symbols: string[]): Promise<Ticker24h[]> {
  const cryptoSymbols = symbols.filter(isCryptoSymbol);
  const indexSymbols = symbols.filter(isIndexSymbol);
  const stockSymbols = symbols.filter(isStockSymbol);
  const commoditySymbols = symbols.filter(isCommoditySymbol);
  const [cryptoTickers, indexTickers, stockTickers, commodityTickers] =
    await Promise.all([
    cryptoSymbols.length > 0 ? fetchCryptoTickers24hWithFallback(cryptoSymbols) : [],
    Promise.all(
      indexSymbols.map((symbol) =>
        fetchTicker24h(symbol).catch(() => null),
      ),
    ),
    Promise.all(
      stockSymbols.map((symbol) =>
        fetchTicker24h(symbol).catch(() => null),
      ),
    ),
    Promise.all(
      commoditySymbols.map((symbol) =>
        fetchTicker24h(symbol).catch(() => null),
      ),
    ),
    ]);

  return [
    ...cryptoTickers,
    ...indexTickers.filter((ticker): ticker is Ticker24h => ticker !== null),
    ...stockTickers.filter((ticker): ticker is Ticker24h => ticker !== null),
    ...commodityTickers.filter((ticker): ticker is Ticker24h => ticker !== null),
  ];
}

export async function fetchExchangeSymbols(): Promise<SymbolInfo[]> {
  const [binanceSymbols, bingxSymbols] = await Promise.all([
    fetchCryptoSymbols().catch(() => []),
    fetchBingxCryptoSymbols().catch(() => []),
  ]);
  const cryptoSymbolMap = new Map<string, SymbolInfo>();

  bingxSymbols.forEach((symbol) => cryptoSymbolMap.set(symbol.symbol, symbol));
  binanceSymbols.forEach((symbol) => cryptoSymbolMap.set(symbol.symbol, symbol));

  return [
    ...INDEX_SYMBOLS,
    ...COMMODITY_SYMBOLS,
    ...STOCK_SYMBOLS,
    ...Array.from(cryptoSymbolMap.values()).sort((a, b) =>
      a.symbol.localeCompare(b.symbol),
    ),
  ];
}
