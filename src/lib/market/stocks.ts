import type { SymbolInfo } from "@/lib/binance/types";

export interface StockInstrument {
  symbol: string;
  yahooSymbol: string;
  finnhubSymbol: string;
  name: string;
  region: string;
}

export const STOCK_INSTRUMENTS: StockInstrument[] = [
  { symbol: "NVDA", yahooSymbol: "NVDA", finnhubSymbol: "NVDA", name: "NVIDIA", region: "Estados Unidos" },
  { symbol: "GOOGL", yahooSymbol: "GOOGL", finnhubSymbol: "GOOGL", name: "Alphabet", region: "Estados Unidos" },
  { symbol: "AAPL", yahooSymbol: "AAPL", finnhubSymbol: "AAPL", name: "Apple", region: "Estados Unidos" },
  { symbol: "MSFT", yahooSymbol: "MSFT", finnhubSymbol: "MSFT", name: "Microsoft", region: "Estados Unidos" },
  { symbol: "AMZN", yahooSymbol: "AMZN", finnhubSymbol: "AMZN", name: "Amazon", region: "Estados Unidos" },
  { symbol: "TSM", yahooSymbol: "TSM", finnhubSymbol: "TSM", name: "Taiwan Semiconductor Manufacturing Company", region: "Taiwan" },
  { symbol: "AVGO", yahooSymbol: "AVGO", finnhubSymbol: "AVGO", name: "Broadcom", region: "Estados Unidos" },
  { symbol: "META", yahooSymbol: "META", finnhubSymbol: "META", name: "Meta Platforms", region: "Estados Unidos" },
  { symbol: "TSLA", yahooSymbol: "TSLA", finnhubSymbol: "TSLA", name: "Tesla", region: "Estados Unidos" },
  { symbol: "BRK.B", yahooSymbol: "BRK-B", finnhubSymbol: "BRK.B", name: "Berkshire Hathaway", region: "Estados Unidos" },
  { symbol: "LLY", yahooSymbol: "LLY", finnhubSymbol: "LLY", name: "Eli Lilly and Company", region: "Estados Unidos" },
  { symbol: "JPM", yahooSymbol: "JPM", finnhubSymbol: "JPM", name: "JPMorgan Chase", region: "Estados Unidos" },
  { symbol: "V", yahooSymbol: "V", finnhubSymbol: "V", name: "Visa", region: "Estados Unidos" },
  { symbol: "TCEHY", yahooSymbol: "TCEHY", finnhubSymbol: "TCEHY", name: "Tencent", region: "China" },
  { symbol: "WMT", yahooSymbol: "WMT", finnhubSymbol: "WMT", name: "Walmart", region: "Estados Unidos" },
  { symbol: "ORCL", yahooSymbol: "ORCL", finnhubSymbol: "ORCL", name: "Oracle", region: "Estados Unidos" },
  { symbol: "XOM", yahooSymbol: "XOM", finnhubSymbol: "XOM", name: "ExxonMobil", region: "Estados Unidos" },
  { symbol: "MA", yahooSymbol: "MA", finnhubSymbol: "MA", name: "Mastercard", region: "Estados Unidos" },
  { symbol: "ASML", yahooSymbol: "ASML", finnhubSymbol: "ASML", name: "ASML", region: "Paises Bajos" },
  { symbol: "005930.KS", yahooSymbol: "005930.KS", finnhubSymbol: "005930.KS", name: "Samsung Electronics", region: "Corea del Sur" },
  { symbol: "COST", yahooSymbol: "COST", finnhubSymbol: "COST", name: "Costco", region: "Estados Unidos" },
  { symbol: "NFLX", yahooSymbol: "NFLX", finnhubSymbol: "NFLX", name: "Netflix", region: "Estados Unidos" },
  { symbol: "JNJ", yahooSymbol: "JNJ", finnhubSymbol: "JNJ", name: "Johnson & Johnson", region: "Estados Unidos" },
  { symbol: "UNH", yahooSymbol: "UNH", finnhubSymbol: "UNH", name: "UnitedHealth Group", region: "Estados Unidos" },
  { symbol: "PG", yahooSymbol: "PG", finnhubSymbol: "PG", name: "Procter & Gamble", region: "Estados Unidos" },
  { symbol: "CVX", yahooSymbol: "CVX", finnhubSymbol: "CVX", name: "Chevron", region: "Estados Unidos" },
  { symbol: "ABBV", yahooSymbol: "ABBV", finnhubSymbol: "ABBV", name: "AbbVie", region: "Estados Unidos" },
  { symbol: "HD", yahooSymbol: "HD", finnhubSymbol: "HD", name: "Home Depot", region: "Estados Unidos" },
  { symbol: "BAC", yahooSymbol: "BAC", finnhubSymbol: "BAC", name: "Bank of America", region: "Estados Unidos" },
  { symbol: "BABA", yahooSymbol: "BABA", finnhubSymbol: "BABA", name: "Alibaba Group", region: "China" },
  { symbol: "KO", yahooSymbol: "KO", finnhubSymbol: "KO", name: "Coca-Cola", region: "Estados Unidos" },
  { symbol: "PEP", yahooSymbol: "PEP", finnhubSymbol: "PEP", name: "PepsiCo", region: "Estados Unidos" },
  { symbol: "NVO", yahooSymbol: "NVO", finnhubSymbol: "NVO", name: "Novo Nordisk", region: "Dinamarca" },
  { symbol: "CRM", yahooSymbol: "CRM", finnhubSymbol: "CRM", name: "Salesforce", region: "Estados Unidos" },
  { symbol: "ADBE", yahooSymbol: "ADBE", finnhubSymbol: "ADBE", name: "Adobe", region: "Estados Unidos" },
  { symbol: "CSCO", yahooSymbol: "CSCO", finnhubSymbol: "CSCO", name: "Cisco", region: "Estados Unidos" },
  { symbol: "AMD", yahooSymbol: "AMD", finnhubSymbol: "AMD", name: "AMD", region: "Estados Unidos" },
  { symbol: "INTC", yahooSymbol: "INTC", finnhubSymbol: "INTC", name: "Intel", region: "Estados Unidos" },
  { symbol: "MS", yahooSymbol: "MS", finnhubSymbol: "MS", name: "Morgan Stanley", region: "Estados Unidos" },
  { symbol: "MCD", yahooSymbol: "MCD", finnhubSymbol: "MCD", name: "McDonald's", region: "Estados Unidos" },
  { symbol: "RMS.PA", yahooSymbol: "RMS.PA", finnhubSymbol: "RMS.PA", name: "Hermes", region: "Francia" },
  { symbol: "MC.PA", yahooSymbol: "MC.PA", finnhubSymbol: "MC.PA", name: "LVMH", region: "Francia" },
  { symbol: "TM", yahooSymbol: "TM", finnhubSymbol: "TM", name: "Toyota", region: "Japon" },
  { symbol: "2222.SR", yahooSymbol: "2222.SR", finnhubSymbol: "2222.SR", name: "Saudi Aramco", region: "Arabia Saudita" },
  { symbol: "IBM", yahooSymbol: "IBM", finnhubSymbol: "IBM", name: "IBM", region: "Estados Unidos" },
  { symbol: "GE", yahooSymbol: "GE", finnhubSymbol: "GE", name: "GE Aerospace", region: "Estados Unidos" },
  { symbol: "HSBC", yahooSymbol: "HSBC", finnhubSymbol: "HSBC", name: "HSBC", region: "Reino Unido" },
  { symbol: "ACN", yahooSymbol: "ACN", finnhubSymbol: "ACN", name: "Accenture", region: "Irlanda" },
  { symbol: "PLTR", yahooSymbol: "PLTR", finnhubSymbol: "PLTR", name: "Palantir Technologies", region: "Estados Unidos" },
  { symbol: "QCOM", yahooSymbol: "QCOM", finnhubSymbol: "QCOM", name: "Qualcomm", region: "Estados Unidos" },
];

export const TOP_100_STOCK_INSTRUMENTS: StockInstrument[] = [
  { symbol: "NVDA", yahooSymbol: "NVDA", finnhubSymbol: "NVDA", name: "NVIDIA", region: "Estados Unidos" },
  { symbol: "MSFT", yahooSymbol: "MSFT", finnhubSymbol: "MSFT", name: "Microsoft", region: "Estados Unidos" },
  { symbol: "AAPL", yahooSymbol: "AAPL", finnhubSymbol: "AAPL", name: "Apple", region: "Estados Unidos" },
  { symbol: "GOOGL", yahooSymbol: "GOOGL", finnhubSymbol: "GOOGL", name: "Alphabet", region: "Estados Unidos" },
  { symbol: "AMZN", yahooSymbol: "AMZN", finnhubSymbol: "AMZN", name: "Amazon", region: "Estados Unidos" },
  { symbol: "META", yahooSymbol: "META", finnhubSymbol: "META", name: "Meta Platforms", region: "Estados Unidos" },
  { symbol: "AVGO", yahooSymbol: "AVGO", finnhubSymbol: "AVGO", name: "Broadcom", region: "Estados Unidos" },
  { symbol: "TSM", yahooSymbol: "TSM", finnhubSymbol: "TSM", name: "TSMC", region: "Taiwan" },
  { symbol: "TSLA", yahooSymbol: "TSLA", finnhubSymbol: "TSLA", name: "Tesla", region: "Estados Unidos" },
  { symbol: "BRK.B", yahooSymbol: "BRK-B", finnhubSymbol: "BRK.B", name: "Berkshire Hathaway", region: "Estados Unidos" },
  { symbol: "LLY", yahooSymbol: "LLY", finnhubSymbol: "LLY", name: "Eli Lilly", region: "Estados Unidos" },
  { symbol: "V", yahooSymbol: "V", finnhubSymbol: "V", name: "Visa", region: "Estados Unidos" },
  { symbol: "JPM", yahooSymbol: "JPM", finnhubSymbol: "JPM", name: "JPMorgan Chase", region: "Estados Unidos" },
  { symbol: "TCEHY", yahooSymbol: "TCEHY", finnhubSymbol: "TCEHY", name: "Tencent", region: "China" },
  { symbol: "WMT", yahooSymbol: "WMT", finnhubSymbol: "WMT", name: "Walmart", region: "Estados Unidos" },
  { symbol: "ORCL", yahooSymbol: "ORCL", finnhubSymbol: "ORCL", name: "Oracle", region: "Estados Unidos" },
  { symbol: "MA", yahooSymbol: "MA", finnhubSymbol: "MA", name: "Mastercard", region: "Estados Unidos" },
  { symbol: "XOM", yahooSymbol: "XOM", finnhubSymbol: "XOM", name: "ExxonMobil", region: "Estados Unidos" },
  { symbol: "ASML", yahooSymbol: "ASML", finnhubSymbol: "ASML", name: "ASML", region: "Paises Bajos" },
  { symbol: "005930.KS", yahooSymbol: "005930.KS", finnhubSymbol: "005930.KS", name: "Samsung Electronics", region: "Corea del Sur" },
  { symbol: "COST", yahooSymbol: "COST", finnhubSymbol: "COST", name: "Costco", region: "Estados Unidos" },
  { symbol: "NFLX", yahooSymbol: "NFLX", finnhubSymbol: "NFLX", name: "Netflix", region: "Estados Unidos" },
  { symbol: "JNJ", yahooSymbol: "JNJ", finnhubSymbol: "JNJ", name: "Johnson & Johnson", region: "Estados Unidos" },
  { symbol: "UNH", yahooSymbol: "UNH", finnhubSymbol: "UNH", name: "UnitedHealth Group", region: "Estados Unidos" },
  { symbol: "PG", yahooSymbol: "PG", finnhubSymbol: "PG", name: "Procter & Gamble", region: "Estados Unidos" },
  { symbol: "CVX", yahooSymbol: "CVX", finnhubSymbol: "CVX", name: "Chevron", region: "Estados Unidos" },
  { symbol: "ABBV", yahooSymbol: "ABBV", finnhubSymbol: "ABBV", name: "AbbVie", region: "Estados Unidos" },
  { symbol: "HD", yahooSymbol: "HD", finnhubSymbol: "HD", name: "Home Depot", region: "Estados Unidos" },
  { symbol: "BAC", yahooSymbol: "BAC", finnhubSymbol: "BAC", name: "Bank of America", region: "Estados Unidos" },
  { symbol: "BABA", yahooSymbol: "BABA", finnhubSymbol: "BABA", name: "Alibaba Group", region: "China" },
  { symbol: "KO", yahooSymbol: "KO", finnhubSymbol: "KO", name: "Coca-Cola", region: "Estados Unidos" },
  { symbol: "PEP", yahooSymbol: "PEP", finnhubSymbol: "PEP", name: "PepsiCo", region: "Estados Unidos" },
  { symbol: "NVO", yahooSymbol: "NVO", finnhubSymbol: "NVO", name: "Novo Nordisk", region: "Dinamarca" },
  { symbol: "CRM", yahooSymbol: "CRM", finnhubSymbol: "CRM", name: "Salesforce", region: "Estados Unidos" },
  { symbol: "ADBE", yahooSymbol: "ADBE", finnhubSymbol: "ADBE", name: "Adobe", region: "Estados Unidos" },
  { symbol: "CSCO", yahooSymbol: "CSCO", finnhubSymbol: "CSCO", name: "Cisco", region: "Estados Unidos" },
  { symbol: "AMD", yahooSymbol: "AMD", finnhubSymbol: "AMD", name: "AMD", region: "Estados Unidos" },
  { symbol: "INTC", yahooSymbol: "INTC", finnhubSymbol: "INTC", name: "Intel", region: "Estados Unidos" },
  { symbol: "MS", yahooSymbol: "MS", finnhubSymbol: "MS", name: "Morgan Stanley", region: "Estados Unidos" },
  { symbol: "MCD", yahooSymbol: "MCD", finnhubSymbol: "MCD", name: "McDonald's", region: "Estados Unidos" },
  { symbol: "RMS.PA", yahooSymbol: "RMS.PA", finnhubSymbol: "RMS.PA", name: "Hermes", region: "Francia" },
  { symbol: "MC.PA", yahooSymbol: "MC.PA", finnhubSymbol: "MC.PA", name: "LVMH", region: "Francia" },
  { symbol: "TM", yahooSymbol: "TM", finnhubSymbol: "TM", name: "Toyota", region: "Japon" },
  { symbol: "2222.SR", yahooSymbol: "2222.SR", finnhubSymbol: "2222.SR", name: "Saudi Aramco", region: "Arabia Saudita" },
  { symbol: "IBM", yahooSymbol: "IBM", finnhubSymbol: "IBM", name: "IBM", region: "Estados Unidos" },
  { symbol: "GE", yahooSymbol: "GE", finnhubSymbol: "GE", name: "GE Aerospace", region: "Estados Unidos" },
  { symbol: "HSBC", yahooSymbol: "HSBC", finnhubSymbol: "HSBC", name: "HSBC", region: "Reino Unido" },
  { symbol: "ACN", yahooSymbol: "ACN", finnhubSymbol: "ACN", name: "Accenture", region: "Irlanda" },
  { symbol: "PLTR", yahooSymbol: "PLTR", finnhubSymbol: "PLTR", name: "Palantir Technologies", region: "Estados Unidos" },
  { symbol: "QCOM", yahooSymbol: "QCOM", finnhubSymbol: "QCOM", name: "Qualcomm", region: "Estados Unidos" },
  { symbol: "SAP", yahooSymbol: "SAP", finnhubSymbol: "SAP", name: "SAP", region: "Alemania" },
  { symbol: "AXP", yahooSymbol: "AXP", finnhubSymbol: "AXP", name: "American Express", region: "Estados Unidos" },
  { symbol: "NSRGY", yahooSymbol: "NSRGY", finnhubSymbol: "NSRGY", name: "Nestle", region: "Suiza" },
  { symbol: "RHHBY", yahooSymbol: "RHHBY", finnhubSymbol: "RHHBY", name: "Roche", region: "Suiza" },
  { symbol: "MRK", yahooSymbol: "MRK", finnhubSymbol: "MRK", name: "Merck & Co.", region: "Estados Unidos" },
  { symbol: "NOW", yahooSymbol: "NOW", finnhubSymbol: "NOW", name: "ServiceNow", region: "Estados Unidos" },
  { symbol: "TMO", yahooSymbol: "TMO", finnhubSymbol: "TMO", name: "Thermo Fisher Scientific", region: "Estados Unidos" },
  { symbol: "INTU", yahooSymbol: "INTU", finnhubSymbol: "INTU", name: "Intuit", region: "Estados Unidos" },
  { symbol: "GS", yahooSymbol: "GS", finnhubSymbol: "GS", name: "Goldman Sachs", region: "Estados Unidos" },
  { symbol: "SHEL", yahooSymbol: "SHEL", finnhubSymbol: "SHEL", name: "Shell", region: "Reino Unido" },
  { symbol: "6201.T", yahooSymbol: "6201.T", finnhubSymbol: "6201.T", name: "Toyota Industries", region: "Japon" },
  { symbol: "OR.PA", yahooSymbol: "OR.PA", finnhubSymbol: "OR.PA", name: "L'Oreal", region: "Francia" },
  { symbol: "SIEGY", yahooSymbol: "SIEGY", finnhubSymbol: "SIEGY", name: "Siemens", region: "Alemania" },
  { symbol: "DHR", yahooSymbol: "DHR", finnhubSymbol: "DHR", name: "Danaher", region: "Estados Unidos" },
  { symbol: "PFE", yahooSymbol: "PFE", finnhubSymbol: "PFE", name: "Pfizer", region: "Estados Unidos" },
  { symbol: "UBER", yahooSymbol: "UBER", finnhubSymbol: "UBER", name: "Uber", region: "Estados Unidos" },
  { symbol: "BLK", yahooSymbol: "BLK", finnhubSymbol: "BLK", name: "BlackRock", region: "Estados Unidos" },
  { symbol: "300750.SZ", yahooSymbol: "300750.SZ", finnhubSymbol: "300750.SZ", name: "CATL", region: "China" },
  { symbol: "BHP", yahooSymbol: "BHP", finnhubSymbol: "BHP", name: "BHP", region: "Australia" },
  { symbol: "CMCSA", yahooSymbol: "CMCSA", finnhubSymbol: "CMCSA", name: "Comcast", region: "Estados Unidos" },
  { symbol: "AMGN", yahooSymbol: "AMGN", finnhubSymbol: "AMGN", name: "Amgen", region: "Estados Unidos" },
  { symbol: "BKNG", yahooSymbol: "BKNG", finnhubSymbol: "BKNG", name: "Booking Holdings", region: "Estados Unidos" },
  { symbol: "SONY", yahooSymbol: "SONY", finnhubSymbol: "SONY", name: "Sony", region: "Japon" },
  { symbol: "DTEGY", yahooSymbol: "DTEGY", finnhubSymbol: "DTEGY", name: "Deutsche Telekom", region: "Alemania" },
  { symbol: "SPGI", yahooSymbol: "SPGI", finnhubSymbol: "SPGI", name: "S&P Global", region: "Estados Unidos" },
  { symbol: "CAT", yahooSymbol: "CAT", finnhubSymbol: "CAT", name: "Caterpillar", region: "Estados Unidos" },
  { symbol: "AIR.PA", yahooSymbol: "AIR.PA", finnhubSymbol: "AIR.PA", name: "Airbus", region: "Francia" },
  { symbol: "RTX", yahooSymbol: "RTX", finnhubSymbol: "RTX", name: "RTX", region: "Estados Unidos" },
  { symbol: "BA", yahooSymbol: "BA", finnhubSymbol: "BA", name: "Boeing", region: "Estados Unidos" },
  { symbol: "NKE", yahooSymbol: "NKE", finnhubSymbol: "NKE", name: "Nike", region: "Estados Unidos" },
  { symbol: "SBUX", yahooSymbol: "SBUX", finnhubSymbol: "SBUX", name: "Starbucks", region: "Estados Unidos" },
  { symbol: "PYPL", yahooSymbol: "PYPL", finnhubSymbol: "PYPL", name: "PayPal", region: "Estados Unidos" },
  { symbol: "SHOP", yahooSymbol: "SHOP", finnhubSymbol: "SHOP", name: "Shopify", region: "Canada" },
  { symbol: "ARM", yahooSymbol: "ARM", finnhubSymbol: "ARM", name: "Arm Holdings", region: "Reino Unido" },
  { symbol: "MU", yahooSymbol: "MU", finnhubSymbol: "MU", name: "Micron Technology", region: "Estados Unidos" },
  { symbol: "RIO", yahooSymbol: "RIO", finnhubSymbol: "RIO", name: "Rio Tinto", region: "Reino Unido" },
  { symbol: "HON", yahooSymbol: "HON", finnhubSymbol: "HON", name: "Honeywell", region: "Estados Unidos" },
  { symbol: "UNP", yahooSymbol: "UNP", finnhubSymbol: "UNP", name: "Union Pacific", region: "Estados Unidos" },
  { symbol: "SCHW", yahooSymbol: "SCHW", finnhubSymbol: "SCHW", name: "Charles Schwab", region: "Estados Unidos" },
  { symbol: "C", yahooSymbol: "C", finnhubSymbol: "C", name: "Citigroup", region: "Estados Unidos" },
  { symbol: "MAR", yahooSymbol: "MAR", finnhubSymbol: "MAR", name: "Marriott International", region: "Estados Unidos" },
  { symbol: "BUD", yahooSymbol: "BUD", finnhubSymbol: "BUD", name: "Anheuser-Busch InBev", region: "Belgica" },
  { symbol: "MDT", yahooSymbol: "MDT", finnhubSymbol: "MDT", name: "Medtronic", region: "Irlanda" },
  { symbol: "LMT", yahooSymbol: "LMT", finnhubSymbol: "LMT", name: "Lockheed Martin", region: "Estados Unidos" },
  { symbol: "PANW", yahooSymbol: "PANW", finnhubSymbol: "PANW", name: "Palo Alto Networks", region: "Estados Unidos" },
  { symbol: "CRWD", yahooSymbol: "CRWD", finnhubSymbol: "CRWD", name: "CrowdStrike", region: "Estados Unidos" },
  { symbol: "ABNB", yahooSymbol: "ABNB", finnhubSymbol: "ABNB", name: "Airbnb", region: "Estados Unidos" },
  { symbol: "RACE", yahooSymbol: "RACE", finnhubSymbol: "RACE", name: "Ferrari", region: "Italia" },
  { symbol: "NEE", yahooSymbol: "NEE", finnhubSymbol: "NEE", name: "NextEra Energy", region: "Estados Unidos" },
  { symbol: "MURGY", yahooSymbol: "MURGY", finnhubSymbol: "MURGY", name: "Munich Re", region: "Alemania" },
];

const ALL_STOCK_INSTRUMENTS = Array.from(
  new Map(
    [...TOP_100_STOCK_INSTRUMENTS, ...STOCK_INSTRUMENTS].map((stock) => [
      stock.symbol,
      stock,
    ]),
  ).values(),
);

export const TOP_STOCK_SYMBOLS = STOCK_INSTRUMENTS.map((stock) => stock.symbol);

export const STOCK_SYMBOLS: SymbolInfo[] = ALL_STOCK_INSTRUMENTS.map((stock) => ({
  symbol: stock.symbol,
  baseAsset: stock.symbol,
  quoteAsset: "USD",
  status: "TRADING",
  market: "stock",
  name: stock.name,
  region: stock.region,
}));

const STOCK_BY_SYMBOL = new Map(
  ALL_STOCK_INSTRUMENTS.map((stock) => [stock.symbol, stock]),
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
