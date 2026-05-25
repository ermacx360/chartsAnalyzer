import type { SymbolInfo } from "@/lib/binance/types";

export interface CommodityInstrument {
  symbol: string;
  yahooSymbol: string;
  finnhubSymbol: string;
  capitalEpic: string;
  capitalSearchTerm?: string;
  name: string;
  region: string;
}

export const COMMODITY_INSTRUMENTS: CommodityInstrument[] = [
  {
    symbol: "GOLD",
    yahooSymbol: "GC=F",
    finnhubSymbol: "OANDA:XAU_USD",
    capitalEpic: "GOLD",
    name: "Gold",
    region: "Commodities",
  },
  {
    symbol: "SILVER",
    yahooSymbol: "SI=F",
    finnhubSymbol: "OANDA:XAG_USD",
    capitalEpic: "SILVER",
    name: "Silver",
    region: "Commodities",
  },
  {
    symbol: "OIL",
    yahooSymbol: "CL=F",
    finnhubSymbol: "OANDA:WTICO_USD",
    capitalEpic: "OIL_CRUDE",
    capitalSearchTerm: "Oil",
    name: "Crude Oil Spot",
    region: "Commodities",
  },
];

export const COMMODITY_SYMBOLS: SymbolInfo[] = COMMODITY_INSTRUMENTS.map(
  (commodity) => ({
    symbol: commodity.symbol,
    baseAsset: commodity.symbol,
    quoteAsset: "CFD",
    status: "TRADING",
    market: "commodity",
    name: commodity.name,
    region: commodity.region,
  }),
);

const COMMODITY_BY_SYMBOL = new Map(
  COMMODITY_INSTRUMENTS.map((commodity) => [commodity.symbol, commodity]),
);

export function getCommodityInstrument(symbol: string) {
  return COMMODITY_BY_SYMBOL.get(symbol.toUpperCase()) ?? null;
}

export function isCommoditySymbol(symbol: string) {
  return COMMODITY_BY_SYMBOL.has(symbol.toUpperCase());
}

export function isCapitalCommoditySymbol(symbol: string) {
  return !!getCommodityInstrument(symbol)?.capitalEpic;
}
