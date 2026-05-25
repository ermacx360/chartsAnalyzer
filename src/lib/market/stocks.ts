import type { SymbolInfo } from "@/lib/binance/types";

export interface StockInstrument {
  symbol: string;
  yahooSymbol: string;
  finnhubSymbol: string;
  name: string;
  region: string;
}

export const STOCK_INSTRUMENTS: StockInstrument[] = [
  { symbol: "NVDA", yahooSymbol: "NVDA", finnhubSymbol: "NVDA", name: "NVIDIA Corporation", region: "Estados Unidos" },
  { symbol: "GOOGL", yahooSymbol: "GOOGL", finnhubSymbol: "GOOGL", name: "Alphabet Inc.", region: "Estados Unidos" },
  { symbol: "AAPL", yahooSymbol: "AAPL", finnhubSymbol: "AAPL", name: "Apple Inc.", region: "Estados Unidos" },
  { symbol: "MSFT", yahooSymbol: "MSFT", finnhubSymbol: "MSFT", name: "Microsoft Corporation", region: "Estados Unidos" },
  { symbol: "AMZN", yahooSymbol: "AMZN", finnhubSymbol: "AMZN", name: "Amazon.com, Inc.", region: "Estados Unidos" },
  { symbol: "AVGO", yahooSymbol: "AVGO", finnhubSymbol: "AVGO", name: "Broadcom Inc.", region: "Estados Unidos" },
  { symbol: "TSM", yahooSymbol: "TSM", finnhubSymbol: "TSM", name: "Taiwan Semiconductor Manufacturing Company Limited", region: "Taiwan" },
  { symbol: "META", yahooSymbol: "META", finnhubSymbol: "META", name: "Meta Platforms, Inc.", region: "Estados Unidos" },
  { symbol: "TSLA", yahooSymbol: "TSLA", finnhubSymbol: "TSLA", name: "Tesla, Inc.", region: "Estados Unidos" },
  { symbol: "WMT", yahooSymbol: "WMT", finnhubSymbol: "WMT", name: "Walmart Inc.", region: "Estados Unidos" },
  { symbol: "BRK.B", yahooSymbol: "BRK-B", finnhubSymbol: "BRK.B", name: "Berkshire Hathaway Inc.", region: "Estados Unidos" },
  { symbol: "LLY", yahooSymbol: "LLY", finnhubSymbol: "LLY", name: "Eli Lilly and Company", region: "Estados Unidos" },
  { symbol: "JPM", yahooSymbol: "JPM", finnhubSymbol: "JPM", name: "JPMorgan Chase & Co.", region: "Estados Unidos" },
  { symbol: "MU", yahooSymbol: "MU", finnhubSymbol: "MU", name: "Micron Technology, Inc.", region: "Estados Unidos" },
  { symbol: "AMD", yahooSymbol: "AMD", finnhubSymbol: "AMD", name: "Advanced Micro Devices, Inc.", region: "Estados Unidos" },
  { symbol: "XOM", yahooSymbol: "XOM", finnhubSymbol: "XOM", name: "Exxon Mobil Corporation", region: "Estados Unidos" },
  { symbol: "V", yahooSymbol: "V", finnhubSymbol: "V", name: "Visa Inc.", region: "Estados Unidos" },
  { symbol: "ASML", yahooSymbol: "ASML", finnhubSymbol: "ASML", name: "ASML Holding N.V.", region: "Paises Bajos" },
  { symbol: "INTC", yahooSymbol: "INTC", finnhubSymbol: "INTC", name: "Intel Corporation", region: "Estados Unidos" },
  { symbol: "JNJ", yahooSymbol: "JNJ", finnhubSymbol: "JNJ", name: "Johnson & Johnson", region: "Estados Unidos" },
  { symbol: "ORCL", yahooSymbol: "ORCL", finnhubSymbol: "ORCL", name: "Oracle Corporation", region: "Estados Unidos" },
  { symbol: "COST", yahooSymbol: "COST", finnhubSymbol: "COST", name: "Costco Wholesale Corporation", region: "Estados Unidos" },
  { symbol: "CSCO", yahooSymbol: "CSCO", finnhubSymbol: "CSCO", name: "Cisco Systems, Inc.", region: "Estados Unidos" },
  { symbol: "MA", yahooSymbol: "MA", finnhubSymbol: "MA", name: "Mastercard Incorporated", region: "Estados Unidos" },
  { symbol: "CAT", yahooSymbol: "CAT", finnhubSymbol: "CAT", name: "Caterpillar Inc.", region: "Estados Unidos" },
  { symbol: "CVX", yahooSymbol: "CVX", finnhubSymbol: "CVX", name: "Chevron Corporation", region: "Estados Unidos" },
  { symbol: "ABBV", yahooSymbol: "ABBV", finnhubSymbol: "ABBV", name: "AbbVie Inc.", region: "Estados Unidos" },
  { symbol: "NFLX", yahooSymbol: "NFLX", finnhubSymbol: "NFLX", name: "Netflix, Inc.", region: "Estados Unidos" },
  { symbol: "BAC", yahooSymbol: "BAC", finnhubSymbol: "BAC", name: "Bank of America Corporation", region: "Estados Unidos" },
  { symbol: "UNH", yahooSymbol: "UNH", finnhubSymbol: "UNH", name: "UnitedHealth Group Incorporated", region: "Estados Unidos" },
  { symbol: "KO", yahooSymbol: "KO", finnhubSymbol: "KO", name: "The Coca-Cola Company", region: "Estados Unidos" },
  { symbol: "LRCX", yahooSymbol: "LRCX", finnhubSymbol: "LRCX", name: "Lam Research Corporation", region: "Estados Unidos" },
  { symbol: "PG", yahooSymbol: "PG", finnhubSymbol: "PG", name: "The Procter & Gamble Company", region: "Estados Unidos" },
  { symbol: "PLTR", yahooSymbol: "PLTR", finnhubSymbol: "PLTR", name: "Palantir Technologies Inc.", region: "Estados Unidos" },
  { symbol: "AMAT", yahooSymbol: "AMAT", finnhubSymbol: "AMAT", name: "Applied Materials, Inc.", region: "Estados Unidos" },
  { symbol: "BABA", yahooSymbol: "BABA", finnhubSymbol: "BABA", name: "Alibaba Group Holding Limited", region: "China" },
  { symbol: "HSBC", yahooSymbol: "HSBC", finnhubSymbol: "HSBC", name: "HSBC Holdings plc", region: "Reino Unido" },
  { symbol: "HD", yahooSymbol: "HD", finnhubSymbol: "HD", name: "The Home Depot, Inc.", region: "Estados Unidos" },
  { symbol: "MS", yahooSymbol: "MS", finnhubSymbol: "MS", name: "Morgan Stanley", region: "Estados Unidos" },
  { symbol: "PM", yahooSymbol: "PM", finnhubSymbol: "PM", name: "Philip Morris International Inc.", region: "Estados Unidos" },
  { symbol: "GE", yahooSymbol: "GE", finnhubSymbol: "GE", name: "GE Aerospace", region: "Estados Unidos" },
  { symbol: "AZN", yahooSymbol: "AZN", finnhubSymbol: "AZN", name: "AstraZeneca PLC", region: "Reino Unido" },
  { symbol: "NVS", yahooSymbol: "NVS", finnhubSymbol: "NVS", name: "Novartis AG", region: "Suiza" },
  { symbol: "GS", yahooSymbol: "GS", finnhubSymbol: "GS", name: "The Goldman Sachs Group, Inc.", region: "Estados Unidos" },
  { symbol: "MRK", yahooSymbol: "MRK", finnhubSymbol: "MRK", name: "Merck & Co., Inc.", region: "Estados Unidos" },
  { symbol: "TXN", yahooSymbol: "TXN", finnhubSymbol: "TXN", name: "Texas Instruments Incorporated", region: "Estados Unidos" },
  { symbol: "GEV", yahooSymbol: "GEV", finnhubSymbol: "GEV", name: "GE Vernova Inc.", region: "Estados Unidos" },
  { symbol: "RY", yahooSymbol: "RY", finnhubSymbol: "RY", name: "Royal Bank of Canada", region: "Canada" },
  { symbol: "SHEL", yahooSymbol: "SHEL", finnhubSymbol: "SHEL", name: "Shell plc", region: "Reino Unido" },
  { symbol: "TM", yahooSymbol: "TM", finnhubSymbol: "TM", name: "Toyota Motor Corporation", region: "Japon" },
];

export const TOP_STOCK_SYMBOLS = STOCK_INSTRUMENTS.map((stock) => stock.symbol);

export const STOCK_SYMBOLS: SymbolInfo[] = STOCK_INSTRUMENTS.map((stock) => ({
  symbol: stock.symbol,
  baseAsset: stock.symbol,
  quoteAsset: "USD",
  status: "TRADING",
  market: "stock",
  name: stock.name,
  region: stock.region,
}));

const STOCK_BY_SYMBOL = new Map(
  STOCK_INSTRUMENTS.map((stock) => [stock.symbol, stock]),
);
const DYNAMIC_STOCK_BY_SYMBOL = new Map<string, StockInstrument>();

function normalizeYahooSymbol(symbol: string) {
  return symbol.replace(".", "-");
}

export function registerStockInstrument(info: SymbolInfo) {
  const symbol = info.symbol.toUpperCase();
  const stock: StockInstrument = {
    symbol,
    yahooSymbol: normalizeYahooSymbol(symbol),
    finnhubSymbol: symbol,
    name: info.name ?? symbol,
    region: info.region ?? "Estados Unidos",
  };

  DYNAMIC_STOCK_BY_SYMBOL.set(symbol, stock);
  return stock;
}

export function registerStockInstruments(symbols: SymbolInfo[]) {
  symbols.forEach((symbol) => {
    if (symbol.market === "stock") {
      registerStockInstrument(symbol);
    }
  });
}

export function getStockInstrument(symbol: string) {
  const upperSymbol = symbol.toUpperCase();
  return (
    STOCK_BY_SYMBOL.get(upperSymbol) ??
    DYNAMIC_STOCK_BY_SYMBOL.get(upperSymbol) ??
    null
  );
}

export function isDynamicStockSymbol(symbol: string) {
  return DYNAMIC_STOCK_BY_SYMBOL.has(symbol.toUpperCase());
}

export function isStockSymbol(symbol: string) {
  const upperSymbol = symbol.toUpperCase();
  return STOCK_BY_SYMBOL.has(upperSymbol) || DYNAMIC_STOCK_BY_SYMBOL.has(upperSymbol);
}
