import { useEffect, useRef } from "react";
import type { ISeriesApi, IPriceLine } from "lightweight-charts";

const BINANCE_REST_BASE = "https://fapi.binance.com";
const BINANCE_STREAM_BASE = "wss://fstream.binance.com/stream";

function bucketPrice(price: number, bucket: number, side: "ask" | "bid") {
  return side === "ask"
    ? Math.ceil(price / bucket) * bucket
    : Math.floor(price / bucket) * bucket;
}

function getNiceBucketSize(raw: number) {
  if (raw <= 0) return 1e-8;
  const exponent = Math.floor(Math.log10(raw));
  const fraction = raw / Math.pow(10, exponent);
  let niceFraction;
  if (fraction < 1.5) niceFraction = 1;
  else if (fraction < 3.5) niceFraction = 2;
  else if (fraction < 7.5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * Math.pow(10, exponent);
}

export function useOrderbookBlocks(
  symbol: string,
  seriesRef: React.MutableRefObject<ISeriesApi<"Candlestick"> | null>,
  config: {
    enabled: boolean;
    bucketPct: number;
    topBlocks: number;
    minVolumeUsdt: number;
    buyColor: string;
    sellColor: string;
    opacity: number;
  }
) {
  const priceLinesRef = useRef<IPriceLine[]>([]);

  useEffect(() => {
    const isBinanceSymbol = symbol && symbol.toUpperCase().endsWith("USDT");

    if (!config.enabled || !isBinanceSymbol) {
      priceLinesRef.current.forEach((line) => {
        try {
          seriesRef.current?.removePriceLine(line);
        } catch (e) {}
      });
      priceLinesRef.current = [];
      return;
    }

    let closed = false;
    let snapshotReady = false;
    let lastUpdateId = 0;
    let currentBucket = 0;
    const bidBook = new Map<number, number>();
    const askBook = new Map<number, number>();

    const applyUpdates = (book: Map<number, number>, updates: [string, string][]) => {
      updates.forEach(([p, q]) => {
        const price = Number(p);
        const quantity = Number(q);
        if (price <= 0) return;
        if (quantity <= 0) {
          book.delete(price);
        } else {
          book.set(price, quantity);
        }
      });
    };

    const drawBlocks = () => {
      const series = seriesRef.current;
      if (closed || !series || !currentBucket) return;

      const bucket = currentBucket;

      const groupLevels = (book: Map<number, number>, side: "ask" | "bid") => {
        const grouped = new Map<number, number>();

        for (const [price, quantity] of book.entries()) {
          const bPrice = bucketPrice(price, bucket, side);
          grouped.set(bPrice, (grouped.get(bPrice) || 0) + quantity);
        }

        const blocks = Array.from(grouped.entries()).map(([price, quantity]) => ({
          price,
          totalUsdt: price * quantity,
        }));

        const validBlocks = blocks.filter((b) => b.totalUsdt >= config.minVolumeUsdt);

        return validBlocks
          .sort((a, b) => b.totalUsdt - a.totalUsdt)
          .slice(0, config.topBlocks);
      };

      const topBids = groupLevels(bidBook, "bid");
      const topAsks = groupLevels(askBook, "ask");

      priceLinesRef.current.forEach((line) => {
        try {
          series.removePriceLine(line);
        } catch (e) {}
      });
      priceLinesRef.current = [];

      const formatUsdt = (val: number) => {
        if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
        if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
        return `$${val.toFixed(0)}`;
      };

      const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
      };

      const allBlocks = [...topBids, ...topAsks];
      const maxVolume = allBlocks.length > 0 ? Math.max(...allBlocks.map(b => b.totalUsdt)) : 1;

      // Draw bids
      topBids.forEach((block) => {
        try {
          const intensity = Math.max(0.1, block.totalUsdt / maxVolume);
          const width = Math.max(1, Math.min(4, Math.ceil(intensity * 4)));
          const baseAlpha = Math.min(1, Math.max(0.2, intensity + 0.2));
          const alpha = baseAlpha * config.opacity;
          const color = hexToRgba(config.buyColor, alpha);

          const line = series.createPriceLine({
            price: block.price,
            color: color,
            lineWidth: width as any,
            lineStyle: 0, // Solid
            axisLabelVisible: true,
            title: formatUsdt(block.totalUsdt),
          });
          priceLinesRef.current.push(line);
        } catch (e) {}
      });

      // Draw asks
      topAsks.forEach((block) => {
        try {
          const intensity = Math.max(0.1, block.totalUsdt / maxVolume);
          const width = Math.max(1, Math.min(4, Math.ceil(intensity * 4)));
          const baseAlpha = Math.min(1, Math.max(0.2, intensity + 0.2));
          const alpha = baseAlpha * config.opacity;
          const color = hexToRgba(config.sellColor, alpha);

          const line = series.createPriceLine({
            price: block.price,
            color: color,
            lineWidth: width as any,
            lineStyle: 0, // Solid
            axisLabelVisible: true,
            title: formatUsdt(block.totalUsdt),
          });
          priceLinesRef.current.push(line);
        } catch (e) {}
      });
    };

    let drawTimeout: number | null = null;
    const scheduleDraw = () => {
      if (!drawTimeout) {
        drawTimeout = window.setTimeout(() => {
          drawBlocks();
          drawTimeout = null;
        }, 1500); // Throttled updates to avoid UI lag
      }
    };

    const fetchUrl = `${BINANCE_REST_BASE}/fapi/v1/depth?symbol=${symbol.toUpperCase()}&limit=1000`;
    fetch(fetchUrl)
      .then((res) => res.json())
      .then((snapshot) => {
        if (closed) return;
        applyUpdates(bidBook, snapshot.bids || []);
        applyUpdates(askBook, snapshot.asks || []);

        const bestBid = bidBook.size > 0 ? Math.max(...bidBook.keys()) : 0;
        const bestAsk = askBook.size > 0 ? Math.min(...askBook.keys()) : 0;
        const midPrice = bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : bestBid || bestAsk;
        const rawBucket = midPrice > 0 ? Math.max(1e-8, (midPrice * config.bucketPct) / 100) : 1;
        currentBucket = getNiceBucketSize(rawBucket);

        lastUpdateId = snapshot.lastUpdateId || 0;
        snapshotReady = true;
        drawBlocks();
      })
      .catch(() => {});

    const streamSymbol = symbol.toLowerCase();
    const ws = new WebSocket(
      `${BINANCE_STREAM_BASE}?streams=${streamSymbol}@depth@100ms`,
    );

    ws.onmessage = (event) => {
      if (closed || !snapshotReady) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.data && msg.data.u > lastUpdateId) {
          applyUpdates(bidBook, msg.data.b || []);
          applyUpdates(askBook, msg.data.a || []);
          lastUpdateId = msg.data.u;
          scheduleDraw();
        }
      } catch (e) {}
    };

    return () => {
      closed = true;
      ws.close();
      if (drawTimeout) window.clearTimeout(drawTimeout);
      priceLinesRef.current.forEach((line) => {
        try {
          seriesRef.current?.removePriceLine(line);
        } catch (e) {}
      });
      priceLinesRef.current = [];
    };
  }, [
    config.enabled,
    config.bucketPct,
    config.topBlocks,
    config.minVolumeUsdt,
    config.buyColor,
    config.sellColor,
    config.opacity,
    symbol,
    seriesRef,
  ]);
}
