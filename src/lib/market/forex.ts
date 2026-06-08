import type { SymbolInfo } from "@/lib/binance/types";

export interface ForexInstrument {
  symbol: string;
  displaySymbol: string;
  yahooSymbol: string;
  finnhubSymbol: string;
  capitalEpic: string;
  simplefxSymbol: string;
  name: string;
  region: string;
}

export const FOREX_INSTRUMENTS: ForexInstrument[] = [
  {
    symbol: "EURUSD",
    displaySymbol: "EUR/USD",
    yahooSymbol: "EURUSD=X",
    finnhubSymbol: "OANDA:EUR_USD",
    capitalEpic: "EURUSD",
    simplefxSymbol: "EURUSD",
    name: "EUR/USD",
    region: "Forex",
  },
  {
    symbol: "USDJPY",
    displaySymbol: "USD/JPY",
    yahooSymbol: "USDJPY=X",
    finnhubSymbol: "OANDA:USD_JPY",
    capitalEpic: "USDJPY",
    simplefxSymbol: "USDJPY",
    name: "USD/JPY",
    region: "Forex",
  },
  {
    symbol: "GBPUSD",
    displaySymbol: "GBP/USD",
    yahooSymbol: "GBPUSD=X",
    finnhubSymbol: "OANDA:GBP_USD",
    capitalEpic: "GBPUSD",
    simplefxSymbol: "GBPUSD",
    name: "GBP/USD",
    region: "Forex",
  },
  {
    symbol: "USDCAD",
    displaySymbol: "USD/CAD",
    yahooSymbol: "USDCAD=X",
    finnhubSymbol: "OANDA:USD_CAD",
    capitalEpic: "USDCAD",
    simplefxSymbol: "USDCAD",
    name: "USD/CAD",
    region: "Forex",
  },
  {
    symbol: "AUDUSD",
    displaySymbol: "AUD/USD",
    yahooSymbol: "AUDUSD=X",
    finnhubSymbol: "OANDA:AUD_USD",
    capitalEpic: "AUDUSD",
    simplefxSymbol: "AUDUSD",
    name: "AUD/USD",
    region: "Forex",
  },
];

export const FOREX_SYMBOLS: SymbolInfo[] = FOREX_INSTRUMENTS.map((pair) => ({
  symbol: pair.symbol,
  baseAsset: pair.displaySymbol.slice(0, 3),
  quoteAsset: pair.displaySymbol.slice(4),
  status: "TRADING",
  market: "forex",
  name: pair.name,
  region: pair.region,
}));

const FOREX_BY_SYMBOL = new Map(
  FOREX_INSTRUMENTS.map((pair) => [pair.symbol, pair]),
);

function normalizeForexSymbol(symbol: string) {
  return symbol.toUpperCase().replace("/", "");
}

export function getForexInstrument(symbol: string) {
  return FOREX_BY_SYMBOL.get(normalizeForexSymbol(symbol)) ?? null;
}

export function isForexSymbol(symbol: string) {
  return FOREX_BY_SYMBOL.has(normalizeForexSymbol(symbol));
}

export function isCapitalForexSymbol(symbol: string) {
  return !!getForexInstrument(symbol)?.capitalEpic;
}
