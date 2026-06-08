"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, MoreHorizontal } from "lucide-react";
import { useChartStore } from "@/lib/store/chart-store";
import { isCryptoSymbol } from "@/lib/market/data";
import { cn } from "@/lib/utils";

interface BookLevel {
  price: number;
  quantity: number;
}

interface RenderLevel extends BookLevel {
  quote: number;
  total: number;
}

interface LiveTrade {
  id: number;
  price: number;
  quantity: number;
  quote: number;
  time: number;
  side: "buy" | "sell";
}

interface TradeForceBucket {
  time: number;
  buyQuote: number;
  sellQuote: number;
  buyTrades: number;
  sellTrades: number;
}

interface TradeForceRow {
  label: string;
  score: number;
  delta: number;
  buyQuote: number;
  sellQuote: number;
  trades: number;
  side: "buy" | "sell" | "neutral";
}

interface DepthSnapshot {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

interface DepthUpdateMessage {
  stream: string;
  data: {
    U: number;
    u: number;
    b: [string, string][];
    a: [string, string][];
  };
}

interface AggTradeMessage {
  stream: string;
  data: {
    a: number;
    p: string;
    q: string;
    T: number;
    m: boolean;
  };
}

type BinanceStreamMessage = DepthUpdateMessage | AggTradeMessage;
type BookBucket = 0.01 | 0.02 | 0.04 | 0.1 | 0.2 | 1 | 5 | 10 | 50 | 100 | 500 | 1000;
type BookSide = "ask" | "bid";
type BookViewMode = "asks" | "both" | "bids";
type LowerPanelTab = "trades" | "indicator";

const FORCE_HISTORY_MS = 31 * 24 * 60 * 60 * 1000;
const FORCE_WINDOWS = [
  { label: "30s", ms: 30 * 1000 },
  { label: "5m", ms: 5 * 60 * 1000 },
  { label: "15m", ms: 15 * 60 * 1000 },
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "4h", ms: 4 * 60 * 60 * 1000 },
  { label: "1d", ms: 24 * 60 * 60 * 1000 },
  { label: "1w", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "1M", ms: 30 * 24 * 60 * 60 * 1000 },
] as const;

const BINANCE_REST_BASE = "https://data-api.binance.vision";
const BINANCE_STREAM_BASE = "wss://stream.binance.com:9443/stream";
const BOOK_ROWS = 8;
const BOOK_FULL_ROWS = BOOK_ROWS * 2 + 1;
const MAX_TRADES = 18;
const BOOK_BUCKETS: BookBucket[] = [0.01, 0.02, 0.04, 0.1, 0.2, 1, 5, 10, 50, 100, 500, 1000];
const BOOK_VIEW_MODES: { mode: BookViewMode; label: string }[] = [
  { mode: "asks", label: "Solo ventas" },
  { mode: "both", label: "Compras y ventas" },
  { mode: "bids", label: "Solo compras" },
];

function parseLevels(levels: [string, string][]) {
  return levels
    .map(([price, quantity]) => ({
      price: Number(price),
      quantity: Number(quantity),
    }))
    .filter((level) => level.price > 0 && level.quantity > 0);
}

function levelsToMap(levels: [string, string][]) {
  return new Map(
    parseLevels(levels).map((level) => [level.price, level.quantity] as const),
  );
}

function applyLevelUpdates(book: Map<number, number>, levels: [string, string][]) {
  levels.forEach(([rawPrice, rawQuantity]) => {
    const price = Number(rawPrice);
    const quantity = Number(rawQuantity);

    if (price <= 0 || Number.isNaN(price)) return;

    if (quantity <= 0 || Number.isNaN(quantity)) {
      book.delete(price);
      return;
    }

    book.set(price, quantity);
  });
}

function sortedLevels(book: Map<number, number>, side: BookSide) {
  return Array.from(book.entries())
    .map(([price, quantity]) => ({ price, quantity }))
    .filter((level) => level.price > 0 && level.quantity > 0)
    .sort((a, b) => (side === "ask" ? a.price - b.price : b.price - a.price));
}

function withTotals(levels: BookLevel[]) {
  let total = 0;
  return levels.map((level) => {
    const quote = level.price * level.quantity;
    total += quote;
    return { ...level, quote, total };
  });
}

function bucketPrice(price: number, bucket: BookBucket, side: BookSide) {
  return side === "ask"
    ? Math.ceil(price / bucket) * bucket
    : Math.floor(price / bucket) * bucket;
}

function groupLevels(
  levels: BookLevel[],
  bucket: BookBucket,
  side: BookSide,
  rowCount: number,
  anchorPrice?: number,
) {
  const grouped = new Map<number, BookLevel>();

  levels.forEach((level) => {
    const price = bucketPrice(level.price, bucket, side);
    const existing = grouped.get(price);
    grouped.set(price, {
      price,
      quantity: (existing?.quantity ?? 0) + level.quantity,
    });
  });

  if (!anchorPrice) {
    return Array.from(grouped.values())
      .sort((a, b) => (side === "ask" ? a.price - b.price : b.price - a.price))
      .slice(0, rowCount);
  }

  const firstBucket = bucketPrice(anchorPrice, bucket, side);
  return Array.from({ length: rowCount }, (_, index) => {
    const price =
      side === "ask" ? firstBucket + index * bucket : firstBucket - index * bucket;
    return grouped.get(price) ?? { price, quantity: 0 };
  });
}

function formatPrice(value: number) {
  if (value >= 1000) {
    return value.toLocaleString("es-AR", { maximumFractionDigits: 1 });
  }
  if (value >= 1) {
    return value.toLocaleString("es-AR", { maximumFractionDigits: 4 });
  }
  return value.toLocaleString("es-AR", { maximumFractionDigits: 8 });
}

function formatCompact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  if (abs >= 1) return value.toFixed(1);
  return value.toFixed(4);
}

function formatSignedCompact(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "+";
  return `${sign}${formatCompact(Math.abs(value))}`;
}

function parseForceBuckets(
  buckets: Array<[number, number, number, number, number]>,
) {
  const minTime = Date.now() - FORCE_HISTORY_MS;

  return buckets.reduce<Record<number, TradeForceBucket>>((acc, item) => {
    const [time, buyQuote, sellQuote, buyTrades, sellTrades] = item;
    if (!Number.isFinite(time) || time < minTime) return acc;
    acc[time] = { time, buyQuote, sellQuote, buyTrades, sellTrades };
    return acc;
  }, {});
}

function parseForceRows(rows: unknown): TradeForceRow[] | null {
  if (!Array.isArray(rows)) return null;

  const parsed = rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Partial<TradeForceRow>;
      const score = Number(item.score);
      const delta = Number(item.delta);
      const buyQuote = Number(item.buyQuote);
      const sellQuote = Number(item.sellQuote);
      const trades = Number(item.trades);
      const side =
        item.side === "buy" || item.side === "sell" || item.side === "neutral"
          ? item.side
          : "neutral";

      if (
        typeof item.label !== "string" ||
        !Number.isFinite(score) ||
        !Number.isFinite(delta) ||
        !Number.isFinite(buyQuote) ||
        !Number.isFinite(sellQuote) ||
        !Number.isFinite(trades)
      ) {
        return null;
      }

      return {
        label: item.label,
        score,
        delta,
        buyQuote,
        sellQuote,
        trades,
        side,
      };
    })
    .filter((row): row is TradeForceRow => row !== null);

  return parsed.length > 0 ? parsed : null;
}

async function fetchForceBuckets(symbol: string) {
  const response = await fetch(`/api/orderflow?symbol=${encodeURIComponent(symbol)}`, {
    cache: "no-store",
  });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    buckets?: Array<[number, number, number, number, number]>;
    rows?: unknown;
  };

  return {
    buckets: Array.isArray(data.buckets) ? parseForceBuckets(data.buckets) : null,
    rows: parseForceRows(data.rows),
  };
}

function getOrderflowWsUrl(symbol: string) {
  const base = process.env.NEXT_PUBLIC_ORDERFLOW_WS_URL;
  const key = process.env.NEXT_PUBLIC_ORDERFLOW_API_KEY;
  if (!base) return null;

  const url = new URL(base);
  url.searchParams.set("symbol", symbol);
  if (key) url.searchParams.set("key", key);

  return url.toString();
}

function buildForceRows(
  buckets: Record<number, TradeForceBucket>,
  bookBuyPct: number,
) {
  const now = Date.now();
  const bucketValues = Object.values(buckets).sort((a, b) => a.time - b.time);
  const bookScore = (bookBuyPct - 50) * 2;

  return FORCE_WINDOWS.map<TradeForceRow>((windowConfig) => {
    const start = now - windowConfig.ms;
    const totals = bucketValues.reduce(
      (acc, bucket) => {
        if (bucket.time < start) return acc;
        acc.buyQuote += bucket.buyQuote;
        acc.sellQuote += bucket.sellQuote;
        acc.trades += bucket.buyTrades + bucket.sellTrades;
        return acc;
      },
      { buyQuote: 0, sellQuote: 0, trades: 0 },
    );

    const totalQuote = totals.buyQuote + totals.sellQuote;
    const tradeScore =
      totalQuote > 0 ? ((totals.buyQuote - totals.sellQuote) / totalQuote) * 100 : 0;
    const score = tradeScore * 0.7 + bookScore * 0.3;
    const side =
      score >= 8 ? "buy" : score <= -8 ? "sell" : "neutral";

    return {
      label: windowConfig.label,
      score,
      delta: totals.buyQuote - totals.sellQuote,
      buyQuote: totals.buyQuote,
      sellQuote: totals.sellQuote,
      trades: totals.trades,
      side,
    };
  });
}

function getForceSideLabel(side: TradeForceRow["side"]) {
  if (side === "buy") return "BUY";
  if (side === "sell") return "SELL";
  return "NEUTRO";
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function isDepthMessage(message: BinanceStreamMessage): message is DepthUpdateMessage {
  return message.stream.endsWith("@depth@100ms");
}

function isAggTradeMessage(message: BinanceStreamMessage): message is AggTradeMessage {
  return message.stream.endsWith("@aggTrade");
}

function BookViewIcon({ mode }: { mode: BookViewMode }) {
  return (
    <span className="grid h-3.5 w-3.5 grid-cols-2 gap-px">
      <span
        className={cn(
          "rounded-[1px]",
          mode !== "bids" ? "bg-tv-red" : "bg-tv-red/25",
        )}
      />
      <span
        className={cn(
          "rounded-[1px]",
          mode !== "asks" ? "bg-tv-green" : "bg-tv-green/25",
        )}
      />
      <span
        className={cn(
          "rounded-[1px]",
          mode === "asks" ? "bg-tv-red" : "bg-tv-red/25",
        )}
      />
      <span
        className={cn(
          "rounded-[1px]",
          mode === "bids" ? "bg-tv-green" : "bg-tv-green/25",
        )}
      />
    </span>
  );
}

function LevelRow({
  level,
  side,
  maxTotal,
}: {
  level: RenderLevel;
  side: "ask" | "bid";
  maxTotal: number;
}) {
  const width = maxTotal > 0 ? Math.min(100, (level.total / maxTotal) * 100) : 0;
  const colorClass = side === "ask" ? "text-tv-red" : "text-tv-green";
  const barClass = side === "ask" ? "bg-tv-red/15" : "bg-tv-green/15";

  return (
    <div className="relative grid h-[19px] grid-cols-[1fr_1fr_1fr] items-center overflow-hidden px-1 text-[11px] leading-none">
      <div
        className={cn("absolute right-0 top-0 h-full", barClass)}
        style={{ width: `${width}%` }}
      />
      <span className={cn("relative z-10 tabular-nums", colorClass)}>
        {formatPrice(level.price)}
      </span>
      <span className="relative z-10 text-right font-semibold tabular-nums text-tv-text">
        {formatCompact(level.quote)}
      </span>
      <span className="relative z-10 text-right font-semibold tabular-nums text-tv-text">
        {formatCompact(level.total)}
      </span>
    </div>
  );
}

export function OrderbookPanel() {
  const symbol = useChartStore((s) => s.symbol);
  const binanceSymbol = symbol.toUpperCase();
  const supported = isCryptoSymbol(binanceSymbol) && binanceSymbol.endsWith("USDT");

  if (!supported) {
    return (
      <div className="flex h-full flex-col bg-tv-panel text-xs text-tv-text-muted">
        <div className="flex h-10 items-center justify-between border-b border-tv-border px-3">
          <span className="font-semibold text-tv-text">Libro de Ordenes</span>
          <MoreHorizontal className="h-4 w-4" />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center leading-relaxed">
          Orderbook disponible para pares cripto de Binance.
        </div>
      </div>
    );
  }

  return <LiveCryptoOrderbook key={binanceSymbol} symbol={binanceSymbol} />;
}

function LiveCryptoOrderbook({ symbol }: { symbol: string }) {
  const [bids, setBids] = useState<BookLevel[]>([]);
  const [asks, setAsks] = useState<BookLevel[]>([]);
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastSide, setLastSide] = useState<"buy" | "sell" | null>(null);
  const [bucket, setBucket] = useState<BookBucket>(100);
  const [viewMode, setViewMode] = useState<BookViewMode>("both");
  const [lowerTab, setLowerTab] = useState<LowerPanelTab>("trades");
  const [forceBuckets, setForceBuckets] = useState<Record<number, TradeForceBucket>>({});
  const [remoteForceRows, setRemoteForceRows] = useState<TradeForceRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const applyPayload = (payload: {
      buckets?: Array<[number, number, number, number, number]>;
      rows?: unknown;
    }) => {
      if (cancelled) return;
      if (Array.isArray(payload.buckets)) {
        setForceBuckets(parseForceBuckets(payload.buckets));
      }
      setRemoteForceRows(parseForceRows(payload.rows));
    };

    const syncRemoteBuckets = () => {
      void fetchForceBuckets(symbol).then((buckets) => {
        if (!cancelled && buckets?.buckets) {
          setForceBuckets(buckets.buckets);
          setRemoteForceRows(buckets.rows);
        }
      });
    };

    void fetchForceBuckets(symbol).then((buckets) => {
      if (!cancelled && buckets?.buckets) {
        setForceBuckets(buckets.buckets);
        setRemoteForceRows(buckets.rows);
      }
    });

    const connectWs = () => {
      const wsUrl = getOrderflowWsUrl(symbol);
      if (!wsUrl || cancelled) return;

      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          applyPayload(JSON.parse(event.data) as {
            buckets?: Array<[number, number, number, number, number]>;
            rows?: unknown;
          });
        } catch {
          // Ignore malformed websocket payloads.
        }
      };
      ws.onclose = () => {
        if (!cancelled) {
          reconnectTimer = window.setTimeout(connectWs, 1500);
        }
      };
      ws.onerror = () => {
        ws?.close();
      };
    };

    connectWs();
    const syncInterval = window.setInterval(syncRemoteBuckets, 10_000);

    return () => {
      cancelled = true;
      ws?.close();
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      window.clearInterval(syncInterval);
    };
  }, [symbol]);

  useEffect(() => {
    const streamSymbol = symbol.toLowerCase();
    const url = `${BINANCE_STREAM_BASE}?streams=${streamSymbol}@depth@100ms/${streamSymbol}@aggTrade`;
    let closed = false;
    let snapshotReady = false;
    let lastUpdateId = 0;
    let bidBook = new Map<number, number>();
    let askBook = new Map<number, number>();
    const ws = new WebSocket(url);

    fetch(`${BINANCE_REST_BASE}/api/v3/depth?symbol=${symbol}&limit=1000`)
      .then((response) => response.json() as Promise<DepthSnapshot>)
      .then((snapshot) => {
        if (closed) return;
        bidBook = levelsToMap(snapshot.bids);
        askBook = levelsToMap(snapshot.asks);
        lastUpdateId = snapshot.lastUpdateId;
        snapshotReady = true;
        setBids(sortedLevels(bidBook, "bid"));
        setAsks(sortedLevels(askBook, "ask"));
      })
      .catch(() => {
        if (!closed) {
          snapshotReady = false;
        }
      });

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => {
      setConnected(false);
      ws.close();
    };
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as BinanceStreamMessage;

        if (isDepthMessage(message)) {
          if (!snapshotReady || message.data.u <= lastUpdateId) return;

          applyLevelUpdates(bidBook, message.data.b);
          applyLevelUpdates(askBook, message.data.a);
          lastUpdateId = message.data.u;
          setBids(sortedLevels(bidBook, "bid"));
          setAsks(sortedLevels(askBook, "ask"));
          return;
        }

        if (isAggTradeMessage(message)) {
          const price = Number(message.data.p);
          const quantity = Number(message.data.q);
          if (price <= 0 || quantity <= 0) return;

          const side: LiveTrade["side"] = message.data.m ? "sell" : "buy";
          const quote = price * quantity;
          setLastSide(side);
          setTrades((current) => [
            {
              id: message.data.a,
              price,
              quantity,
              quote,
              time: message.data.T,
              side,
            },
            ...current,
          ].slice(0, MAX_TRADES));
        }
      } catch {
        // Ignore malformed stream payloads.
      }
    };

    return () => {
      closed = true;
      ws.close();
    };
  }, [bucket, symbol]);

  const bestAsk = asks[0]?.price;
  const bestBid = bids[0]?.price;
  const rowCount = viewMode === "both" ? BOOK_ROWS : BOOK_FULL_ROWS;
  const groupedAsks = useMemo(
    () => groupLevels(asks, bucket, "ask", rowCount, bestAsk),
    [asks, bestAsk, bucket, rowCount],
  );
  const groupedBids = useMemo(
    () => groupLevels(bids, bucket, "bid", rowCount, bestBid),
    [bids, bestBid, bucket, rowCount],
  );
  const askRows = useMemo(() => withTotals(groupedAsks).reverse(), [groupedAsks]);
  const bidRows = useMemo(() => withTotals(groupedBids), [groupedBids]);
  const maxTotal = Math.max(
    ...askRows.map((row) => row.total),
    ...bidRows.map((row) => row.total),
    1,
  );
  const midPrice = trades[0]?.price ?? (bestAsk && bestBid ? (bestAsk + bestBid) / 2 : null);
  const spread =
    bestAsk && bestBid
      ? {
          value: bestAsk - bestBid,
          pct: ((bestAsk - bestBid) / bestAsk) * 100,
        }
      : null;
  const bidTotal = bidRows.at(-1)?.total ?? 0;
  const askTotal = askRows[0]?.total ?? 0;
  const totalLiquidity = bidTotal + askTotal;
  const bidPct = totalLiquidity > 0 ? (bidTotal / totalLiquidity) * 100 : 50;
  const forceRows = useMemo(
    () => remoteForceRows ?? buildForceRows(forceBuckets, bidPct),
    [bidPct, forceBuckets, remoteForceRows],
  );
  const shortForce = forceRows[0];
  const forceSummary =
    shortForce.side === "buy"
      ? "Compra rapida dominante."
      : shortForce.side === "sell"
        ? "Venta rapida dominante."
        : "Presion mixta sin confirmacion clara.";
  const dominantWindow =
    forceRows.find((row) => row.side !== "neutral" && row.trades > 0) ?? shortForce;

  return (
    <div className="flex h-full min-h-0 flex-col bg-tv-panel text-xs text-tv-text">
      <section className="min-h-0 border-b border-tv-border">
        <div className="flex h-10 items-center justify-between border-b border-tv-border px-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Libro de Ordenes</span>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                connected ? "bg-tv-green" : "bg-tv-red",
              )}
            />
          </div>
          <MoreHorizontal className="h-4 w-4 text-tv-text-muted" />
        </div>

        <div className="flex h-8 items-center justify-between px-2 text-[11px] text-tv-text-muted">
          <div className="flex gap-1">
            {BOOK_VIEW_MODES.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded",
                  viewMode === mode
                    ? "bg-tv-bg"
                    : "hover:bg-tv-bg/70",
                )}
              >
                <BookViewIcon mode={mode} />
              </button>
            ))}
          </div>
          <select
            aria-label="Bucket del orderbook"
            className="h-6 rounded border border-tv-border bg-tv-bg px-1 text-[11px] font-semibold text-tv-text outline-none hover:border-tv-border-light"
            value={bucket}
            onChange={(event) => setBucket(Number(event.target.value) as BookBucket)}
          >
            {BOOK_BUCKETS.map((value) => (
              <option key={value} value={value} className="bg-tv-panel text-tv-text">
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[1fr_1fr_1fr] px-1 pb-1 text-[10px] text-tv-text-muted">
          <span>Precio (USDT)</span>
          <span className="text-right">Cantidad (USDT)</span>
          <span className="text-right">Total (USDT)</span>
        </div>

        {viewMode !== "bids" && (
        <div className="px-0.5">
          {askRows.map((level) => (
            <LevelRow
              key={`ask-${level.price}`}
              level={level}
              side="ask"
              maxTotal={maxTotal}
            />
          ))}
        </div>
        )}

        {viewMode === "both" && (
        <div className="flex h-10 items-center gap-2 px-1">
          <span
            className={cn(
              "text-xl font-semibold tabular-nums",
              lastSide === "sell" ? "text-tv-red" : "text-tv-green",
            )}
          >
            {midPrice ? formatPrice(midPrice) : "--"}
            {lastSide === "sell" ? " ↓" : " ↑"}
          </span>
          {spread && (
            <span className="text-[11px] tabular-nums text-tv-text-muted">
              {formatPrice(spread.value)} ({spread.pct.toFixed(3)}%)
            </span>
          )}
        </div>
        )}

        {viewMode !== "asks" && (
        <div className="px-0.5">
          {bidRows.map((level) => (
            <LevelRow
              key={`bid-${level.price}`}
              level={level}
              side="bid"
              maxTotal={maxTotal}
            />
          ))}
        </div>
        )}

        {viewMode === "both" ? (
          <div className="flex h-6 items-center gap-1 px-2 text-[11px] font-semibold tabular-nums">
            <span className="text-tv-green">B {bidPct.toFixed(2)}%</span>
            <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-tv-border">
              <div className="bg-tv-green" style={{ width: `${bidPct}%` }} />
              <div className="flex-1 bg-tv-red" />
            </div>
            <span className="text-tv-red">{(100 - bidPct).toFixed(2)}% S</span>
          </div>
        ) : (
          <div className="flex h-6 items-center gap-1 px-2 text-[11px] font-semibold tabular-nums">
            <span className={viewMode === "bids" ? "text-tv-green" : "text-tv-red"}>
              {viewMode === "bids" ? "Compras" : "Ventas"}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-tv-border">
              <div
                className={cn(
                  "h-full",
                  viewMode === "bids" ? "bg-tv-green" : "bg-tv-red",
                )}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        )}
      </section>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-9 items-center justify-between border-b border-tv-border px-2">
          <div className="flex h-full items-center gap-4">
            <button
              type="button"
              onClick={() => setLowerTab("trades")}
              className={cn(
                "relative h-full font-semibold transition-colors",
                lowerTab === "trades"
                  ? "text-tv-text"
                  : "text-tv-text-muted hover:text-tv-text",
              )}
            >
              Trades
              {lowerTab === "trades" && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-tv-blue" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setLowerTab("indicator")}
              className={cn(
                "relative h-full whitespace-nowrap font-semibold transition-colors",
                lowerTab === "indicator"
                  ? "text-tv-text"
                  : "text-tv-text-muted hover:text-tv-text",
              )}
            >
              Fuerza de compra ventas
              {lowerTab === "indicator" && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-tv-blue" />
              )}
            </button>
          </div>
          <MoreHorizontal className="h-4 w-4 text-tv-text-muted" />
        </div>

        {lowerTab === "trades" ? (
          <>
            <div className="grid grid-cols-[1fr_1fr_1fr] px-1 py-2 text-[10px] text-tv-text-muted">
              <span>Precio (USDT)</span>
              <span className="text-right">Monto (USDT)</span>
              <span className="text-right">Tiempo</span>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden px-1">
              {trades.map((trade) => (
                <div
                  key={trade.id}
                  className="grid h-[19px] grid-cols-[1fr_1fr_1fr] items-center text-[11px] leading-none"
                >
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      trade.side === "buy" ? "text-tv-green" : "text-tv-red",
                    )}
                  >
                    {formatPrice(trade.price)}
                  </span>
                  <span className="text-right font-semibold tabular-nums text-tv-text">
                    {formatCompact(trade.quote)}
                  </span>
                  <span className="text-right font-semibold tabular-nums text-tv-text">
                    {formatTime(trade.time)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2 px-1.5 py-2">
            <div className="rounded-sm border border-tv-blue/70 bg-tv-bg/55">
              <div className="-mt-2 ml-3 inline-flex items-center gap-1 bg-tv-bg px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#38dce5]">
                <Activity className="h-3 w-3" />
                Presion por ventanas
              </div>
              <div className="grid grid-cols-[36px_74px_52px_52px_52px_1fr] border-b border-tv-text-muted/60 px-1.5 pb-1 pt-1 font-mono text-[10px] font-semibold text-tv-text">
                <span>Vent</span>
                <span className="text-right">Score</span>
                <span className="text-right">Delta</span>
                <span className="text-right">Compra</span>
                <span className="text-right">Venta</span>
                <span className="text-right">Trades</span>
              </div>
              <div className="px-1.5 py-1 font-mono text-[10px] leading-4">
                {forceRows.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[36px_74px_52px_52px_52px_1fr] items-center"
                  >
                    <span className="font-semibold text-tv-text">{row.label}</span>
                    <span
                      className={cn(
                        "whitespace-nowrap text-right font-semibold",
                        row.side === "buy"
                          ? "text-tv-green"
                          : row.side === "sell"
                            ? "text-tv-red"
                            : "text-yellow-400",
                      )}
                    >
                      {row.score >= 0 ? "+" : ""}
                      {row.score.toFixed(1)} {getForceSideLabel(row.side)}
                    </span>
                    <span
                      className={cn(
                        "whitespace-nowrap text-right font-semibold tabular-nums",
                        row.delta > 0
                          ? "text-tv-green"
                          : row.delta < 0
                            ? "text-tv-red"
                            : "text-yellow-400",
                      )}
                    >
                      {formatSignedCompact(row.delta)}
                    </span>
                    <span className="whitespace-nowrap text-right font-semibold tabular-nums text-tv-green">
                      {formatCompact(row.buyQuote)}
                    </span>
                    <span className="whitespace-nowrap text-right font-semibold tabular-nums text-tv-red">
                      {formatCompact(row.sellQuote)}
                    </span>
                    <span className="whitespace-nowrap text-right font-semibold tabular-nums text-tv-text">
                      {row.trades.toLocaleString("es-AR")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-tv-border px-1.5 py-1 font-mono text-[10px] text-tv-text-muted">
                Score = <span className="text-tv-green">70% trades</span> +{" "}
                <span className="text-tv-blue">30% book</span>
              </div>
            </div>

            <div className="rounded-sm border border-tv-blue/70 bg-tv-bg/55">
              <div className="-mt-2 ml-3 inline-block bg-tv-bg px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#38dce5]">
                Lectura
              </div>
              <div className="space-y-1 px-2 pb-2 pt-1 font-mono text-[10px] font-semibold leading-4 text-yellow-400">
                <p>
                  {dominantWindow.side === "neutral"
                    ? "MIXTO / NEUTRAL"
                    : dominantWindow.side === "buy"
                      ? "COMPRADOR"
                      : "VENDEDOR"}
                </p>
                <p>- {forceSummary}</p>
                <p>
                  - Ventana dominante: {dominantWindow.label} con delta{" "}
                  {formatSignedCompact(dominantWindow.delta)}.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
