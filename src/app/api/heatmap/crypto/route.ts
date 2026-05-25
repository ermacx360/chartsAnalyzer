import { NextResponse } from "next/server";
import type { Ticker24h } from "@/lib/binance/types";

const BINANCE_BASE = "https://api.binance.com/api/v3";
const BINGX_BASE = "https://open-api.bingx.com";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const COINPAPRIKA_BASE = "https://api.coinpaprika.com/v1";
const EXCLUDED_BASE_ASSETS = new Set([
  "BUSD",
  "DAI",
  "FDUSD",
  "TUSD",
  "USDE",
  "USD1",
  "USDP",
  "USDS",
  "WBTC",
  "WETH",
]);
const BASE_ASSET_ALIASES = new Map([["TONCOIN", "TON"]]);
const MARKET_CAP_FALLBACK_RANK = [
  "BTC",
  "ETH",
  "BNB",
  "XRP",
  "SOL",
  "TRX",
  "DOGE",
  "ADA",
  "HYPE",
  "BCH",
  "LINK",
  "XLM",
  "SUI",
  "AVAX",
  "LEO",
  "TON",
  "TONCOIN",
  "SHIB",
  "LTC",
  "HBAR",
  "DOT",
  "XMR",
  "UNI",
  "APT",
  "NEAR",
  "ETC",
  "ICP",
  "PI",
  "KAS",
  "CRO",
  "OKB",
  "MNT",
  "AAVE",
  "ATOM",
  "RENDER",
  "VET",
  "FIL",
  "WLD",
  "ALGO",
  "ARB",
  "OP",
  "INJ",
  "QNT",
  "SEI",
  "JUP",
  "FET",
  "TIA",
  "PENDLE",
  "BONK",
  "WIF",
];
const MARKET_CAP_FALLBACK_SCORE = new Map(
  MARKET_CAP_FALLBACK_RANK.map((asset, index) => [
    asset,
    MARKET_CAP_FALLBACK_RANK.length - index,
  ]),
);

type CryptoSortMode = "marketCap" | "volume";

interface CryptoTicker extends Ticker24h {
  marketCap?: number;
  logoUrl?: string;
}

interface BinanceTicker {
  symbol?: string;
  lastPrice?: string;
  priceChange?: string;
  priceChangePercent?: string;
  highPrice?: string;
  lowPrice?: string;
  volume?: string;
  quoteVolume?: string;
}

interface BingxResponse<T> {
  code?: number;
  data?: T;
}

interface BingxTicker {
  symbol?: string;
  lastPrice?: string | number;
  priceChange?: string | number;
  priceChangePercent?: string | number;
  highPrice?: string | number;
  lowPrice?: string | number;
  volume?: string | number;
  quoteVolume?: string | number;
}

interface CoinGeckoMarket {
  symbol?: string;
  current_price?: number | null;
  market_cap?: number | null;
  market_cap_rank?: number | null;
  price_change_percentage_24h?: number | null;
  total_volume?: number | null;
  image?: string | null;
}

interface CoinPaprikaTicker {
  symbol?: string;
  rank?: number | null;
  quotes?: {
    USD?: {
      price?: number | null;
      market_cap?: number | null;
      percent_change_24h?: number | null;
      volume_24h?: number | null;
    };
  };
}

interface MarketData {
  marketCap: number;
  volume: number;
  logoUrl?: string;
  price?: number;
  changePct?: number;
  rank?: number;
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toAppSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/-/g, "");
}

function getBaseAsset(symbol: string) {
  return symbol.replace(/USDT$/, "");
}

function normalizeMarketSymbol(symbol: string) {
  const upperSymbol = symbol.toUpperCase();
  if (!upperSymbol.endsWith("USDT")) return upperSymbol;

  const baseAsset = getBaseAsset(upperSymbol);
  const normalizedBaseAsset = BASE_ASSET_ALIASES.get(baseAsset) ?? baseAsset;

  return `${normalizedBaseAsset}USDT`;
}

function isUsdtSymbol(symbol: string) {
  const baseAsset = getBaseAsset(symbol);

  return (
    symbol.endsWith("USDT") &&
    symbol.length > 4 &&
    /^[A-Z0-9]+USDT$/.test(symbol) &&
    !EXCLUDED_BASE_ASSETS.has(baseAsset) &&
    !symbol.includes("USDUSDT") &&
    !symbol.startsWith("NCC") &&
    !symbol.startsWith("NCS") &&
    !symbol.startsWith("VSTOCK")
  );
}

function parseBinanceTicker(ticker: BinanceTicker): CryptoTicker | null {
  const symbol = normalizeMarketSymbol(ticker.symbol ?? "");
  const lastPrice = parseNumber(ticker.lastPrice);

  if (!isUsdtSymbol(symbol) || lastPrice === null || lastPrice <= 0) return null;

  return {
    symbol,
    lastPrice,
    priceChange: parseNumber(ticker.priceChange) ?? 0,
    priceChangePercent: parseNumber(ticker.priceChangePercent) ?? 0,
    highPrice: parseNumber(ticker.highPrice) ?? lastPrice,
    lowPrice: parseNumber(ticker.lowPrice) ?? lastPrice,
    volume: parseNumber(ticker.volume) ?? 0,
    quoteVolume: parseNumber(ticker.quoteVolume) ?? 0,
    market: "crypto",
  };
}

function parseBingxTicker(ticker: BingxTicker): CryptoTicker | null {
  const symbol = normalizeMarketSymbol(toAppSymbol(ticker.symbol ?? ""));
  const lastPrice = parseNumber(ticker.lastPrice);

  if (!isUsdtSymbol(symbol) || lastPrice === null || lastPrice <= 0) return null;

  return {
    symbol,
    lastPrice,
    priceChange: parseNumber(ticker.priceChange) ?? 0,
    priceChangePercent: parseNumber(ticker.priceChangePercent) ?? 0,
    highPrice: parseNumber(ticker.highPrice) ?? lastPrice,
    lowPrice: parseNumber(ticker.lowPrice) ?? lastPrice,
    volume: parseNumber(ticker.volume) ?? 0,
    quoteVolume: parseNumber(ticker.quoteVolume) ?? 0,
    market: "crypto",
  };
}

async function fetchBinanceTickers() {
  const response = await fetch(`${BINANCE_BASE}/ticker/24hr`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) throw new Error(`binance ${response.status}`);

  const data = (await response.json()) as BinanceTicker[];
  return data
    .map(parseBinanceTicker)
    .filter((ticker): ticker is CryptoTicker => ticker !== null);
}

async function fetchBingxTickers() {
  const response = await fetch(`${BINGX_BASE}/openApi/swap/v2/quote/ticker`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) throw new Error(`bingx ${response.status}`);

  const payload = (await response.json()) as BingxResponse<BingxTicker[] | BingxTicker>;
  const data = Array.isArray(payload.data)
    ? payload.data
    : payload.data
      ? [payload.data]
      : [];

  return data
    .map(parseBingxTicker)
    .filter((ticker): ticker is CryptoTicker => ticker !== null);
}

async function fetchCoinGeckoMarkets() {
  const markets = new Map<string, MarketData>();

  for (let page = 1; page <= 2; page += 1) {
    const params = new URLSearchParams({
      vs_currency: "usd",
      order: "market_cap_desc",
      per_page: "250",
      page: String(page),
      sparkline: "false",
    });
    const response = await fetch(`${COINGECKO_BASE}/coins/markets?${params}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) throw new Error(`coingecko ${response.status}`);

    const data = (await response.json()) as CoinGeckoMarket[];
    data.forEach((coin) => {
      const symbol = coin.symbol?.toUpperCase();
      const marketCap = parseNumber(coin.market_cap) ?? 0;
      const volume = parseNumber(coin.total_volume) ?? 0;
      const price = parseNumber(coin.current_price) ?? undefined;
      const changePct = parseNumber(coin.price_change_percentage_24h) ?? undefined;
      const rank = parseNumber(coin.market_cap_rank) ?? undefined;

      if (!symbol || marketCap <= 0) return;

      const current = markets.get(symbol);
      if (!current || marketCap > current.marketCap) {
        markets.set(symbol, {
          marketCap,
          volume,
          logoUrl: coin.image ?? undefined,
          price,
          changePct,
          rank,
        });
      }
    });
  }

  return markets;
}

async function fetchCoinPaprikaMarkets() {
  const response = await fetch(`${COINPAPRIKA_BASE}/tickers`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) throw new Error(`coinpaprika ${response.status}`);

  const data = (await response.json()) as CoinPaprikaTicker[];
  const markets = new Map<string, MarketData>();

  data.forEach((coin) => {
    const symbol = coin.symbol?.toUpperCase();
    const marketCap = parseNumber(coin.quotes?.USD?.market_cap) ?? 0;
    const volume = parseNumber(coin.quotes?.USD?.volume_24h) ?? 0;
    const price = parseNumber(coin.quotes?.USD?.price) ?? undefined;
    const changePct = parseNumber(coin.quotes?.USD?.percent_change_24h) ?? undefined;
    const rank = parseNumber(coin.rank) ?? undefined;

    if (!symbol || marketCap <= 0) return;

    const current = markets.get(symbol);
    if (!current || marketCap > current.marketCap) {
      markets.set(symbol, { marketCap, volume, price, changePct, rank });
    }
  });

  return markets;
}

function mergeMarketMaps(
  primary: Map<string, MarketData>,
  fallback: Map<string, MarketData>,
) {
  const merged = new Map(fallback);

  primary.forEach((market, symbol) => {
    const current = merged.get(symbol);
    merged.set(symbol, {
      marketCap: market.marketCap || current?.marketCap || 0,
      volume: market.volume || current?.volume || 0,
      logoUrl: market.logoUrl ?? current?.logoUrl,
      price: market.price ?? current?.price,
      changePct: market.changePct ?? current?.changePct,
      rank: market.rank ?? current?.rank,
    });
  });

  return merged;
}

function mergeTickers(primary: CryptoTicker[], fallback: CryptoTicker[]) {
  const tickers = new Map<string, CryptoTicker>();

  fallback.forEach((ticker) => tickers.set(ticker.symbol, ticker));
  primary.forEach((ticker) => tickers.set(ticker.symbol, ticker));

  return Array.from(tickers.values()).filter(
    (ticker) =>
      Number.isFinite(ticker.priceChangePercent) &&
      Math.abs(ticker.priceChangePercent) <= 1000 &&
      Number.isFinite(ticker.lastPrice) &&
      ticker.lastPrice > 0,
  );
}

function enrichWithMarketData(
  tickers: CryptoTicker[],
  markets: Map<string, MarketData>,
) {
  return tickers.map((ticker) => {
    const baseAsset = getBaseAsset(ticker.symbol);
    const market = markets.get(baseAsset);

    return {
      ...ticker,
      marketCap: market?.marketCap,
      logoUrl: market?.logoUrl,
      quoteVolume: ticker.quoteVolume || market?.volume || ticker.quoteVolume,
    };
  });
}

function marketToTicker(symbol: string, market: MarketData): CryptoTicker | null {
  if (!/^[A-Z0-9]+$/.test(symbol)) return null;

  const appSymbol = normalizeMarketSymbol(`${symbol}USDT`);
  const baseAsset = getBaseAsset(appSymbol);
  const lastPrice = market.price ?? 0;

  if (EXCLUDED_BASE_ASSETS.has(baseAsset) || lastPrice <= 0) return null;

  return {
    symbol: appSymbol,
    lastPrice,
    priceChange: 0,
    priceChangePercent: market.changePct ?? 0,
    highPrice: lastPrice,
    lowPrice: lastPrice,
    volume: market.volume,
    quoteVolume: market.volume,
    marketCap: market.marketCap,
    logoUrl: market.logoUrl,
    market: "crypto",
  };
}

function getRankValue(ticker: CryptoTicker, sort: CryptoSortMode) {
  const volumeValue = ticker.quoteVolume || ticker.volume * ticker.lastPrice || 0;

  if (sort === "marketCap") {
    const fallbackRank = MARKET_CAP_FALLBACK_SCORE.get(getBaseAsset(ticker.symbol));
    return ticker.marketCap ?? (fallbackRank ? fallbackRank * 1_000_000_000 : 0);
  }

  return volumeValue;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sort: CryptoSortMode =
    url.searchParams.get("sort") === "volume" ? "volume" : "marketCap";
  const [binanceResult, bingxResult] = await Promise.allSettled([
    fetchBinanceTickers(),
    fetchBingxTickers(),
  ]);
  const binanceTickers =
    binanceResult.status === "fulfilled" ? binanceResult.value : [];
  const bingxTickers = bingxResult.status === "fulfilled" ? bingxResult.value : [];
  const [coinGeckoResult, coinPaprikaResult] = await Promise.allSettled([
    fetchCoinGeckoMarkets(),
    fetchCoinPaprikaMarkets(),
  ]);
  const coinGeckoMarkets =
    coinGeckoResult.status === "fulfilled"
      ? coinGeckoResult.value
      : new Map<string, MarketData>();
  const coinPaprikaMarkets =
    coinPaprikaResult.status === "fulfilled"
      ? coinPaprikaResult.value
      : new Map<string, MarketData>();
  const markets = mergeMarketMaps(coinGeckoMarkets, coinPaprikaMarkets);
  const rankingMarkets = coinGeckoMarkets.size >= 50 ? coinGeckoMarkets : markets;
  const exchangeTickers = enrichWithMarketData(
    mergeTickers(binanceTickers, bingxTickers),
    markets,
  );
  const exchangeTickersBySymbol = new Map(
    exchangeTickers.map((ticker) => [ticker.symbol, ticker]),
  );
  const marketTickers = Array.from(rankingMarkets.entries())
    .map(([symbol, market]) => marketToTicker(symbol, market))
    .filter((ticker): ticker is CryptoTicker => ticker !== null);
  const tickers =
    sort === "marketCap"
      ? marketTickers.map((ticker) => ({
          ...ticker,
          ...(exchangeTickersBySymbol.get(ticker.symbol) ?? {}),
          marketCap: ticker.marketCap,
          logoUrl: ticker.logoUrl,
          quoteVolume:
            exchangeTickersBySymbol.get(ticker.symbol)?.quoteVolume ||
            ticker.quoteVolume,
        }))
      : exchangeTickers;
  const rankedUniverse = [...tickers]
    .filter((ticker) => getRankValue(ticker, sort) > 0)
    .sort((a, b) => getRankValue(b, sort) - getRankValue(a, sort))
    .slice(0, 180);

  const winners = [...rankedUniverse]
    .filter((ticker) => ticker.priceChangePercent >= 0)
    .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
    .slice(0, 30);
  const losers = [...rankedUniverse]
    .filter((ticker) => ticker.priceChangePercent < 0)
    .sort((a, b) => a.priceChangePercent - b.priceChangePercent)
    .slice(0, 30);

  return NextResponse.json({
    all: rankedUniverse.slice(0, 50),
    winners,
    losers,
    sort,
    source: {
      binance: binanceTickers.length,
      bingx: bingxTickers.length,
      coinGecko: coinGeckoMarkets.size,
      coinPaprika: coinPaprikaMarkets.size,
      marketData: markets.size,
    },
  }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
