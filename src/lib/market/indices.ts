import type { SymbolInfo } from "@/lib/binance/types";

export interface IndexInstrument {
  symbol: string;
  yahooSymbol: string;
  futuresSymbol?: string;
  futuresSource?: string;
  capitalEpic?: string;
  simplefxSymbol?: string;
  finnhubSymbol: string;
  name: string;
  region: string;
}

export const INDEX_INSTRUMENTS: IndexInstrument[] = [
  {
    symbol: "SPX",
    yahooSymbol: "^GSPC",
    futuresSymbol: "ES=F",
    futuresSource: "SimpleFX",
    capitalEpic: "US500",
    simplefxSymbol: "US500",
    finnhubSymbol: "^GSPC",
    name: "S&P 500 Futures",
    region: "Estados Unidos",
  },
  {
    symbol: "NDX",
    yahooSymbol: "^NDX",
    futuresSymbol: "NQ=F",
    futuresSource: "SimpleFX",
    capitalEpic: "US100",
    simplefxSymbol: "US100",
    finnhubSymbol: "^NDX",
    name: "Nasdaq 100 Futures",
    region: "Estados Unidos",
  },
  {
    symbol: "IXIC",
    yahooSymbol: "^IXIC",
    finnhubSymbol: "^IXIC",
    name: "Nasdaq Composite",
    region: "Estados Unidos",
  },
  {
    symbol: "DJI",
    yahooSymbol: "^DJI",
    futuresSymbol: "YM=F",
    futuresSource: "SimpleFX",
    capitalEpic: "US30",
    simplefxSymbol: "US30",
    finnhubSymbol: "^DJI",
    name: "Dow Jones Futures",
    region: "Estados Unidos",
  },
  {
    symbol: "RUT",
    yahooSymbol: "^RUT",
    futuresSymbol: "RTY=F",
    futuresSource: "SimpleFX",
    capitalEpic: "RTY",
    simplefxSymbol: "US2000",
    finnhubSymbol: "^RUT",
    name: "Russell 2000 Futures",
    region: "Estados Unidos",
  },
  {
    symbol: "N225",
    yahooSymbol: "^N225",
    futuresSymbol: "NKD=F",
    futuresSource: "SimpleFX",
    simplefxSymbol: "JP225",
    finnhubSymbol: "^N225",
    name: "Nikkei 225 Futures",
    region: "Japon",
  },
  {
    symbol: "GDAXI",
    yahooSymbol: "^GDAXI",
    finnhubSymbol: "^GDAXI",
    name: "DAX",
    region: "Alemania",
  },
  {
    symbol: "FTSE",
    yahooSymbol: "^FTSE",
    futuresSymbol: "Z=F",
    futuresSource: "ICE Futures",
    finnhubSymbol: "^FTSE",
    name: "FTSE 100 Futures",
    region: "Reino Unido",
  },
  {
    symbol: "FCHI",
    yahooSymbol: "^FCHI",
    futuresSymbol: "FCE=F",
    futuresSource: "Euronext Futures",
    finnhubSymbol: "^FCHI",
    name: "CAC 40 Futures",
    region: "Francia",
  },
  {
    symbol: "STOXX50E",
    yahooSymbol: "^STOXX50E",
    finnhubSymbol: "^STOXX50E",
    name: "Euro Stoxx 50",
    region: "Europa",
  },
  {
    symbol: "IBEX",
    yahooSymbol: "^IBEX",
    finnhubSymbol: "^IBEX",
    name: "IBEX 35",
    region: "Espana",
  },
  {
    symbol: "HSI",
    yahooSymbol: "^HSI",
    futuresSource: "SimpleFX",
    simplefxSymbol: "HK50",
    finnhubSymbol: "^HSI",
    name: "Hang Seng",
    region: "Hong Kong",
  },
  {
    symbol: "AXJO",
    yahooSymbol: "^AXJO",
    futuresSymbol: "AP=F",
    futuresSource: "ASX Futures",
    finnhubSymbol: "^AXJO",
    name: "ASX 200 Futures",
    region: "Australia",
  },
  {
    symbol: "MERV",
    yahooSymbol: "^MERV",
    finnhubSymbol: "^MERV",
    name: "Merval",
    region: "Argentina",
  },
  {
    symbol: "MXX",
    yahooSymbol: "^MXX",
    finnhubSymbol: "^MXX",
    name: "IPC Mexico",
    region: "Mexico",
  },
  {
    symbol: "BVSP",
    yahooSymbol: "^BVSP",
    finnhubSymbol: "^BVSP",
    name: "Bovespa",
    region: "Brasil",
  },
  {
    symbol: "VIX",
    yahooSymbol: "^VIX",
    futuresSymbol: "VX=F",
    futuresSource: "CFE Futures",
    finnhubSymbol: "^VIX",
    name: "VIX Futures",
    region: "Volatilidad",
  },
];

export const INDEX_SYMBOLS: SymbolInfo[] = INDEX_INSTRUMENTS.map((index) => ({
  symbol: index.symbol,
  baseAsset: index.symbol,
  quoteAsset: "INDEX",
  status: "TRADING",
  market: "index",
  name: index.name,
  region: index.region,
}));

export const MAIN_INDEX_SYMBOLS = ["SPX", "NDX", "DJI", "RUT", "N225", "HSI"] as const;

const INDEX_BY_SYMBOL = new Map(
  INDEX_INSTRUMENTS.map((index) => [index.symbol, index]),
);

export function getIndexInstrument(symbol: string) {
  return INDEX_BY_SYMBOL.get(symbol.toUpperCase()) ?? null;
}

export function isIndexSymbol(symbol: string) {
  return INDEX_BY_SYMBOL.has(symbol.toUpperCase());
}

export function isCapitalIndexSymbol(symbol: string) {
  return !!getIndexInstrument(symbol)?.capitalEpic;
}

export function isMainIndexSymbol(symbol: string) {
  return MAIN_INDEX_SYMBOLS.includes(
    symbol.toUpperCase() as (typeof MAIN_INDEX_SYMBOLS)[number],
  );
}
