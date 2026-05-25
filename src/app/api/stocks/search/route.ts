import type { SymbolInfo } from "@/lib/binance/types";

export const dynamic = "force-dynamic";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

interface FinnhubStockSymbol {
  currency?: string;
  description?: string;
  displaySymbol?: string;
  figi?: string;
  mic?: string;
  symbol?: string;
  type?: string;
}

let cachedSymbols: SymbolInfo[] | null = null;
let cachedAt = 0;

function getFinnhubToken() {
  return process.env.FINNHUB_API_KEY ?? "";
}

function normalizeStockSymbol(item: FinnhubStockSymbol): SymbolInfo | null {
  const symbol = (item.displaySymbol ?? item.symbol ?? "").trim().toUpperCase();
  const rawSymbol = (item.symbol ?? symbol).trim().toUpperCase();
  const name = item.description?.trim();
  const type = item.type?.toUpperCase() ?? "";

  if (!symbol || !rawSymbol || !name) return null;
  if (type && !["COMMON STOCK", "ADR", "REIT", "ETF"].includes(type)) return null;
  if (symbol.includes("/") || symbol.includes(" ")) return null;

  return {
    symbol,
    baseAsset: symbol,
    quoteAsset: item.currency ?? "USD",
    status: "TRADING",
    market: "stock",
    name,
    region: "Estados Unidos",
  };
}

async function loadFinnhubSymbols() {
  const now = Date.now();
  if (cachedSymbols && now - cachedAt < CACHE_TTL_MS) {
    return cachedSymbols;
  }

  const token = getFinnhubToken();
  if (!token) {
    return [];
  }

  const url = new URL(`${FINNHUB_BASE}/stock/symbol`);
  url.searchParams.set("exchange", "US");
  url.searchParams.set("token", token);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return cachedSymbols ?? [];
  }

  const data = (await res.json()) as FinnhubStockSymbol[];
  const seen = new Set<string>();
  cachedSymbols = data
    .map(normalizeStockSymbol)
    .filter((item): item is SymbolInfo => {
      if (!item || seen.has(item.symbol)) return false;
      seen.add(item.symbol);
      return true;
    })
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  cachedAt = now;

  return cachedSymbols;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().toUpperCase();

  if (query.length < 2) {
    return Response.json({ symbols: [] });
  }

  const symbols = await loadFinnhubSymbols();
  const results = symbols
    .filter(
      (symbol) =>
        symbol.symbol.includes(query) ||
        symbol.name?.toUpperCase().includes(query),
    )
    .slice(0, 60);

  return Response.json({ symbols: results, cachedAt });
}
