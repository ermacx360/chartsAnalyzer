"use client";

/* eslint-disable react-hooks/refs, react-hooks/immutability, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- lightweight-charts is an imperative canvas/SVG integration; refs bridge chart APIs, subscriptions, and overlay projection. */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Lock, LockOpen, Trash2, X } from "lucide-react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CrosshairMode,
  LineStyle,
  LineType,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type LineWidth,
  type Logical,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  fetchKlines,
  fetchTicker24h,
  getMarketPollIntervalMs,
  getSymbolDisplay,
  isCapitalMarketSymbol,
  isCryptoSymbol,
  isMainIndexSymbol,
} from "@/lib/market/data";
import { getBinanceWS } from "@/lib/binance/ws";
import {
  ema,
  rsi,
  macd,
  sqzAdxTtm,
  type IndicatorPoint,
} from "@/lib/indicators";
import {
  computePmRangeBreakoutOverlay,
  type PmOverlayLabel,
} from "@/lib/indicators/pm-range-breakout";
import type { Candle, Timeframe } from "@/lib/binance/types";
import {
  DEFAULT_CONFIG,
  INDICATOR_COLORS,
  useChartStore,
  type EmaCrossFillConfig,
  type EmaCrossLineConfig,
  type EmaCrossLineStyle,
  type ChartDrawing,
  type DrawingKind,
  type DrawingPoint,
  type DrawingTool,
  type FibonacciLevelConfig,
  type IndicatorKey,
  type PmRangeBreakoutConfig,
  type RsiSettingsConfig,
  type VolumeProfileConfig,
} from "@/lib/store/chart-store";
import { formatPrice, formatVolume } from "@/lib/format";
import { IndicatorPill } from "./IndicatorPill";
import { MeasureOverlay } from "./MeasureOverlay";

interface MeasurePoint {
  time: number;
  price: number;
}
interface MeasureState {
  phase: "idle" | "placing" | "done";
  a: MeasurePoint | null;
  b: MeasurePoint | null;
}
const INITIAL_MEASURE: MeasureState = { phase: "idle", a: null, b: null };

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1s": 1,
  "1m": 60,
  "3m": 3 * 60,
  "5m": 5 * 60,
  "15m": 15 * 60,
  "30m": 30 * 60,
  "1h": 60 * 60,
  "2h": 2 * 60 * 60,
  "4h": 4 * 60 * 60,
  "6h": 6 * 60 * 60,
  "8h": 8 * 60 * 60,
  "12h": 12 * 60 * 60,
  "1d": 24 * 60 * 60,
  "3d": 3 * 24 * 60 * 60,
  "1w": 7 * 24 * 60 * 60,
  "1M": 30 * 24 * 60 * 60,
};

const HISTORY_LIMIT_BY_TIMEFRAME: Record<Timeframe, number> = {
  "1s": 1000,
  "1m": 1000,
  "3m": 1000,
  "5m": 1000,
  "15m": 1000,
  "30m": 1000,
  "1h": 1000,
  "2h": 1000,
  "4h": 1000,
  "6h": 1000,
  "8h": 1000,
  "12h": 1000,
  "1d": 1000,
  "3d": 1000,
  "1w": 1000,
  "1M": 1000,
};

const OLDER_HISTORY_PAGE_SIZE_BY_TIMEFRAME: Record<Timeframe, number> = {
  "1s": 1000,
  "1m": 1000,
  "3m": 1000,
  "5m": 1000,
  "15m": 1000,
  "30m": 1000,
  "1h": 1000,
  "2h": 1000,
  "4h": 1000,
  "6h": 1000,
  "8h": 1000,
  "12h": 1000,
  "1d": 1000,
  "3d": 1000,
  "1w": 1000,
  "1M": 1000,
};

function durationLabel(aTime: number, bTime: number): string {
  const diff = Math.abs(bTime - aTime);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

function countBarsInRange(candles: Candle[], start: number, end: number) {
  let count = 0;

  for (const candle of candles) {
    if (candle.time >= start && candle.time <= end) count += 1;
  }

  return count;
}

function getPmRangeCandleLimit(config: PmRangeBreakoutConfig, timeframe: Timeframe) {
  if (config.showTradeHistory) return PM_RANGE_MAX_CANDLES;
  return timeframe === "5m"
    ? PM_RANGE_5M_LATEST_TRADE_CANDLES
    : PM_RANGE_LATEST_TRADE_CANDLES;
}

interface Props {
  symbol: string;
  timeframe: Timeframe;
}

const TV_COLORS = {
  bg: "#131722",
  panel: "#1e222d",
  border: "#2a2e39",
  text: "#d1d4dc",
  textMuted: "#787b86",
  green: "#26a69a",
  red: "#ef5350",
  blue: "#2962ff",
  yellow: "#ffb74d",
  purple: "#ab47bc",
  grid: "#1e222d",
};

const RSI_RANGE_FILL_OPACITY = 0.42;
const RSI_LEVEL_LINE_WIDTH = 2;
const RSI_VISIBLE_RANGE = { from: 0, to: 100 };
const SQZ_VISIBLE_RANGE = { from: -120, to: 120 };

function normalizeHexColor(color: string, fallback = TV_COLORS.bg) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function isLightColor(color: string) {
  const normalized = normalizeHexColor(color);
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const luminance =
    0.2126 * r ** 2.2 + 0.7152 * g ** 2.2 + 0.0722 * b ** 2.2;

  return luminance > 0.55;
}

function getChartTheme(backgroundColor: string) {
  const background = normalizeHexColor(backgroundColor);
  const light = isLightColor(background);

  return {
    background,
    text: light ? "#1e222d" : TV_COLORS.text,
    textMuted: light ? "#5f636d" : TV_COLORS.textMuted,
    panel: light ? "#f1f3f8" : TV_COLORS.panel,
    border: light ? "#d7dce5" : TV_COLORS.border,
    grid: light ? "#e8ebf2" : TV_COLORS.grid,
  };
}

function getWatermarkStyle(backgroundColor: string) {
  const background = normalizeHexColor(backgroundColor);
  const light = isLightColor(background);

  if (background === "#000000") {
    return { color: "#ffffff", opacity: 0.13 };
  }

  if (background === "#ffffff") {
    return { color: "#000000", opacity: 0.1 };
  }

  return {
    color: light ? "#000000" : "#ffffff",
    opacity: light ? 0.085 : 0.105,
  };
}

function getSymbolLogo(symbol: string, primary: string) {
  const upper = symbol.toUpperCase();
  const base = upper.endsWith("USDT") ? upper.slice(0, -4) : upper;
  const cryptoLogos: Record<string, { label: string; bg: string; fg: string }> = {
    BTC: { label: "₿", bg: "#f7931a", fg: "#ffffff" },
    ETH: { label: "Ξ", bg: "#627eea", fg: "#ffffff" },
    SOL: { label: "S", bg: "#14f195", fg: "#061014" },
    BNB: { label: "B", bg: "#f3ba2f", fg: "#111111" },
    XRP: { label: "X", bg: "#23292f", fg: "#ffffff" },
    DOGE: { label: "Ð", bg: "#c2a633", fg: "#111111" },
    ADA: { label: "A", bg: "#0033ad", fg: "#ffffff" },
    AVAX: { label: "A", bg: "#e84142", fg: "#ffffff" },
    LINK: { label: "L", bg: "#2a5ada", fg: "#ffffff" },
  };

  if (cryptoLogos[base]) return cryptoLogos[base];
  if (base === "GOLD") return { label: "Au", bg: "#d4af37", fg: "#111111" };
  if (base === "SILVER") return { label: "Ag", bg: "#cfd6df", fg: "#111111" };
  if (base === "OIL") return { label: "Oil", bg: "#202020", fg: "#f5f5f5" };

  const labelSource = primary.replace(/[^a-zA-Z0-9]/g, "") || base;
  return {
    label: labelSource.slice(0, 2).toUpperCase(),
    bg: "#1f6feb",
    fg: "#ffffff",
  };
}

const MARKET_POLL_INTERVAL_MS = 30_000;

const LINE_STYLE_TO_CHART: Record<EmaCrossLineStyle, LineStyle> = {
  solid: LineStyle.Solid,
  dotted: LineStyle.Dotted,
  dashed: LineStyle.Dashed,
  largeDashed: LineStyle.LargeDashed,
  sparseDotted: LineStyle.SparseDotted,
  stepped: LineStyle.Solid,
};

const LINE_TYPE_TO_CHART: Record<EmaCrossLineStyle, LineType> = {
  solid: LineType.Simple,
  dotted: LineType.Simple,
  dashed: LineType.Simple,
  largeDashed: LineType.Simple,
  sparseDotted: LineType.Simple,
  stepped: LineType.WithSteps,
};

function toChartLineWidth(value: number): LineWidth {
  return Math.max(1, Math.min(5, Math.round(value))) as LineWidth;
}

function movingAverageValues(
  values: number[],
  volume: number[],
  length: number,
  type: RsiSettingsConfig["maType"],
) {
  if (type === "None") return Array<number>(values.length).fill(Number.NaN);
  if (type === "EMA") return emaNumberValues(values, length);
  if (type === "SMMA (RMA)") return rmaNumberValues(values, length);
  if (type === "WMA") return wmaNumberValues(values, length);
  if (type === "VWMA") return vwmaNumberValues(values, volume, length);
  return smaNumberValues(values, length);
}

function smaNumberValues(values: number[], length: number) {
  const out = Array<number>(values.length).fill(Number.NaN);
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];
    if (index >= length) sum -= values[index - length];
    if (index >= length - 1) out[index] = sum / length;
  }
  return out;
}

function emaNumberValues(values: number[], length: number) {
  const out = Array<number>(values.length).fill(Number.NaN);
  if (values.length < length) return out;
  const k = 2 / (length + 1);
  let previous = 0;
  for (let index = 0; index < length; index += 1) previous += values[index];
  previous /= length;
  out[length - 1] = previous;
  for (let index = length; index < values.length; index += 1) {
    previous = values[index] * k + previous * (1 - k);
    out[index] = previous;
  }
  return out;
}

function rmaNumberValues(values: number[], length: number) {
  const out = Array<number>(values.length).fill(Number.NaN);
  if (values.length < length) return out;
  let previous = 0;
  for (let index = 0; index < length; index += 1) previous += values[index];
  previous /= length;
  out[length - 1] = previous;
  for (let index = length; index < values.length; index += 1) {
    previous = (previous * (length - 1) + values[index]) / length;
    out[index] = previous;
  }
  return out;
}

function wmaNumberValues(values: number[], length: number) {
  const out = Array<number>(values.length).fill(Number.NaN);
  const divisor = (length * (length + 1)) / 2;
  for (let index = length - 1; index < values.length; index += 1) {
    let sum = 0;
    for (let offset = 0; offset < length; offset += 1) {
      sum += values[index - offset] * (length - offset);
    }
    out[index] = sum / divisor;
  }
  return out;
}

function vwmaNumberValues(values: number[], volume: number[], length: number) {
  const out = Array<number>(values.length).fill(Number.NaN);
  let priceVolumeSum = 0;
  let volumeSum = 0;
  for (let index = 0; index < values.length; index += 1) {
    priceVolumeSum += values[index] * volume[index];
    volumeSum += volume[index];
    if (index >= length) {
      priceVolumeSum -= values[index - length] * volume[index - length];
      volumeSum -= volume[index - length];
    }
    if (index >= length - 1 && volumeSum !== 0) {
      out[index] = priceVolumeSum / volumeSum;
    }
  }
  return out;
}

function stdevNumberValues(values: number[], length: number) {
  const mean = smaNumberValues(values, length);
  return values.map((_, index) => {
    if (!Number.isFinite(mean[index]) || index < length - 1) return Number.NaN;
    let sum = 0;
    for (let offset = index - length + 1; offset <= index; offset += 1) {
      sum += (values[offset] - mean[index]) ** 2;
    }
    return Math.sqrt(sum / length);
  });
}

function buildRsiSmoothing(
  rsiData: IndicatorPoint[],
  candles: Candle[],
  settings: RsiSettingsConfig,
) {
  if (settings.maType === "None") return { ma: [], bbUpper: [], bbLower: [] };

  const values = rsiData.map((point) => point.value);
  const volumeByTime = new Map(candles.map((candle) => [candle.time, candle.volume]));
  const volumes = rsiData.map((point) => volumeByTime.get(point.time) ?? 0);
  const maValues = movingAverageValues(
    values,
    volumes,
    settings.maLength,
    settings.maType,
  );
  const ma = rsiData
    .map((point, index) => ({ time: point.time, value: maValues[index] }))
    .filter((point) => Number.isFinite(point.value));

  if (settings.maType !== "SMA + Bollinger Bands") {
    return { ma, bbUpper: [], bbLower: [] };
  }

  const stdev = stdevNumberValues(values, settings.maLength);
  const bbUpper: IndicatorPoint[] = [];
  const bbLower: IndicatorPoint[] = [];
  rsiData.forEach((point, index) => {
    if (!Number.isFinite(maValues[index]) || !Number.isFinite(stdev[index])) return;
    const offset = stdev[index] * settings.bbMult;
    bbUpper.push({ time: point.time, value: maValues[index] + offset });
    bbLower.push({ time: point.time, value: maValues[index] - offset });
  });

  return { ma, bbUpper, bbLower };
}

function getEmaCrossLines(config?: EmaCrossLineConfig[]): EmaCrossLineConfig[] {
  return DEFAULT_CONFIG.emaCross.map((fallback, index) => ({
    ...fallback,
    ...config?.[index],
  }));
}

function getEmaCrossFill(config?: EmaCrossFillConfig): EmaCrossFillConfig {
  return {
    ...DEFAULT_CONFIG.emaCrossFill,
    ...config,
  };
}

function toUnixSeconds(time: unknown): number | null {
  if (typeof time === "number") return time;

  if (typeof time === "string") {
    const parsed = Date.parse(time);
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
  }

  if (
    time &&
    typeof time === "object" &&
    "year" in time &&
    "month" in time &&
    "day" in time
  ) {
    const d = time as { year: number; month: number; day: number };
    return Math.floor(Date.UTC(d.year, d.month - 1, d.day) / 1000);
  }

  return null;
}

function formatChartTime(time: unknown, timeZone: string) {
  const seconds = toUnixSeconds(time);
  if (seconds === null) return "";

  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(seconds * 1000));
}

function getCandleCloseTimeMs(
  timeframe: Timeframe,
  candleStartTime: number,
  previousCandleStartTime?: number,
) {
  if (
    previousCandleStartTime !== undefined &&
    candleStartTime > previousCandleStartTime
  ) {
    return (candleStartTime + candleStartTime - previousCandleStartTime) * 1000;
  }

  if (timeframe === "1M") {
    const close = new Date(candleStartTime * 1000);
    close.setUTCMonth(close.getUTCMonth() + 1);
    return close.getTime();
  }

  const durationSeconds: Record<Exclude<Timeframe, "1M">, number> = {
    "1s": 1,
    "1m": 60,
    "3m": 3 * 60,
    "5m": 5 * 60,
    "15m": 15 * 60,
    "30m": 30 * 60,
    "1h": 60 * 60,
    "2h": 2 * 60 * 60,
    "4h": 4 * 60 * 60,
    "6h": 6 * 60 * 60,
    "8h": 8 * 60 * 60,
    "12h": 12 * 60 * 60,
    "1d": 24 * 60 * 60,
    "3d": 3 * 24 * 60 * 60,
    "1w": 7 * 24 * 60 * 60,
  };

  return (candleStartTime + durationSeconds[timeframe]) * 1000;
}

function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
}

function getCandleCountdown(
  timeframe: Timeframe,
  candleStartTime: number | undefined,
  previousCandleStartTime: number | undefined,
  now: number,
) {
  if (candleStartTime === undefined) return null;

  return formatCountdown(
    getCandleCloseTimeMs(timeframe, candleStartTime, previousCandleStartTime) -
      now,
  );
}

function getCandleColor(candle: Candle) {
  return candle.close >= candle.open ? TV_COLORS.green : TV_COLORS.red;
}

interface HoverInfo {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  time: number;
  pct: number;
}

function isSameHoverInfo(a: HoverInfo | null, b: HoverInfo | null) {
  if (a === b) return true;
  if (!a || !b) return false;

  return (
    a.o === b.o &&
    a.h === b.h &&
    a.l === b.l &&
    a.c === b.c &&
    a.v === b.v &&
    a.time === b.time &&
    a.pct === b.pct
  );
}

function isSameDrawingPoint(a: DrawingPoint | null, b: DrawingPoint | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.time === b.time && a.price === b.price;
}

interface LastValues {
  ema20?: number;
  ema50?: number;
  ema200?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  sqzAdxTtm?: number;
  sqzAdx?: number;
  volume?: number;
}

interface SwingPatternMarker {
  time: number;
  price: number;
  kind: "high" | "low";
  structure: "HH" | "LH" | "LL" | "HL";
  pattern: string;
  description: string;
}

interface RsiDivergenceMarker {
  time: number;
  value: number;
  previousTime: number;
  previousValue: number;
  kind: "bull" | "bear";
}

interface RsiZoneFill {
  path: string;
  kind: "overbought" | "oversold";
}

interface PaneOffset {
  top: number;
  height: number;
}

interface ChartContextMenu {
  x: number;
  y: number;
}

interface EmaCrossFillRender {
  path: string;
  color: string;
  opacity: number;
  height: number;
}

interface VolumeProfileBinRender {
  y: number;
  height: number;
  buyWidth: number;
  sellWidth: number;
  totalWidth: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  inValueArea?: boolean;
}

interface VolumeProfileRender {
  bins: VolumeProfileBinRender[];
  opacity: number;
  buyColor: string;
  sellColor: string;
  pocColor: string;
  pocY: number;
  pocPrice: number;
  vahY?: number;
  vahPrice?: number;
  valY?: number;
  valPrice?: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  visibleBars: number;
}

interface CandleCacheEntry {
  candles: Candle[];
  updatedAt: number;
}

interface PersistedCandleCacheEntry {
  key: string;
  candles: Array<[number, number, number, number, number, number, 0 | 1]>;
  updatedAt: number;
}

interface DrawingDraft {
  kind: DrawingKind;
  points: DrawingPoint[];
}

interface ScreenPoint extends DrawingPoint {
  x: number;
  y: number;
}

function FixedVolumeProfileNumberField({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-sm border border-tv-border bg-tv-bg px-2 text-xs tabular-nums text-tv-text outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

function FixedVolumeProfileColorField({
  label,
  value,
  fallback,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const safeValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <div className="flex h-8 items-center gap-2 rounded-sm border border-tv-border bg-tv-bg px-2">
        <input
          aria-label={label}
          type="color"
          value={safeValue}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-5 w-6 cursor-pointer rounded border border-tv-border bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="font-mono text-[11px] uppercase text-tv-text-muted">
          {safeValue}
        </span>
      </div>
    </label>
  );
}

const DEFAULT_DRAWING_COLOR = TV_COLORS.blue;
const FIXED_VOLUME_PROFILE_VALUE_AREA_PCT = 0.7;
const FIXED_VOLUME_PROFILE_BUY_COLOR = "#2962ff";
const FIXED_VOLUME_PROFILE_SELL_COLOR = "#ffeb3b";
const FIXED_VOLUME_PROFILE_OUTSIDE_VALUE_COLOR = "#787b86";
const FIXED_VOLUME_PROFILE_ANCHOR_COLOR = "#2962ff";
const FIXED_VOLUME_PROFILE_VAH_COLOR = "#00c853";
const FIXED_VOLUME_PROFILE_VAL_COLOR = "#ffb300";

const DRAWING_POINT_REQUIREMENTS: Record<DrawingKind, number> = {
  trendLine: 2,
  ray: 2,
  infoLine: 2,
  extendedLine: 2,
  trendAngle: 2,
  hline: 1,
  hray: 2,
  vline: 1,
  crossLine: 1,
  parallelChannel: 3,
  regressionTrend: 2,
  flatTopBottom: 2,
  disjointChannel: 3,
  brush: 3,
  highlighter: 3,
  arrowMarker: 2,
  arrow: 2,
  arrowUp: 1,
  arrowDown: 1,
  rectangle: 2,
  rotatedRectangle: 3,
  route: 3,
  circle: 2,
  ellipse: 2,
  polyline: 3,
  triangle: 3,
  arc: 3,
  curve: 3,
  doubleCurve: 4,
  fibRetracement: 2,
  fibExtension: 3,
  fixedVolumeProfile: 2,
  measureRange: 2,
  longPosition: 2,
  shortPosition: 2,
};

const DRAWING_LABELS: Record<DrawingKind, string> = {
  trendLine: "Linea de tendencia",
  ray: "Rayo",
  infoLine: "Linea de informacion",
  extendedLine: "Linea extendida",
  trendAngle: "Angulo de tendencia",
  hline: "Linea horizontal",
  hray: "Rayo horizontal",
  vline: "Linea vertical",
  crossLine: "Linea de cruce",
  parallelChannel: "Canal paralelo",
  regressionTrend: "Tendencia de regresion",
  flatTopBottom: "Plano superior/inferior",
  disjointChannel: "Canal desconectado",
  brush: "Pincel",
  highlighter: "Resaltador",
  arrowMarker: "Marcador de flecha",
  arrow: "Flecha",
  arrowUp: "Marca de flecha hacia arriba",
  arrowDown: "Marca de flecha hacia abajo",
  rectangle: "Rectangulo",
  rotatedRectangle: "Rectangulo rotado",
  route: "Ruta",
  circle: "Circulo",
  ellipse: "Elipse",
  polyline: "Polilinea",
  triangle: "Triangulo",
  arc: "Arco",
  curve: "Curva",
  doubleCurve: "Doble curva",
  fibRetracement: "Retroceso de Fibonacci",
  fibExtension: "Extension de Fibonacci",
  fixedVolumeProfile: "Volume Profile fijo",
  measureRange: "Regla / Medicion",
  longPosition: "Posicion larga",
  shortPosition: "Posicion corta",
};

const DRAWING_TOOL_SET = new Set<DrawingTool>(Object.keys(DRAWING_POINT_REQUIREMENTS) as DrawingTool[]);

const FIB_LEVEL_COLOR = "#c8d400";
const DEFAULT_FIB_RETRACEMENT_LEVELS: FibonacciLevelConfig[] = [
  { value: 0, enabled: true, color: FIB_LEVEL_COLOR },
  { value: 0.236, enabled: false, color: FIB_LEVEL_COLOR },
  { value: 0.382, enabled: true, color: FIB_LEVEL_COLOR },
  { value: 0.5, enabled: true, color: FIB_LEVEL_COLOR },
  { value: 0.618, enabled: true, color: FIB_LEVEL_COLOR },
  { value: 0.65, enabled: true, color: FIB_LEVEL_COLOR },
  { value: 0.786, enabled: true, color: FIB_LEVEL_COLOR },
  { value: 1, enabled: true, color: FIB_LEVEL_COLOR },
];
const FIB_EXTENSION_LEVELS = [0, 0.618, 1, 1.272, 1.618, 2.618];
const PRICE_SCALE_GUTTER_WIDTH = 90;
const PM_RANGE_MAX_CANDLES = 2500;
const PM_RANGE_5M_LATEST_TRADE_CANDLES = 600;
const PM_RANGE_LATEST_TRADE_CANDLES = 900;
const CANDLE_CACHE_MAX_ENTRIES = 24;
const CANDLE_CACHE_SCHEMA_VERSION = 2;
const CANDLE_CACHE_MAX_CANDLES = 120000;
const CANDLE_DB_NAME = "tv-gratis-candle-cache";
const CANDLE_DB_STORE = "candles";
const CANDLE_DB_VERSION = 1;
const CANDLE_DB_MAX_ENTRIES = 20;
const CANDLE_DB_WRITE_INTERVAL_MS = 60_000;
const MEMORY_ONLY_CACHE_TIMEFRAMES = new Set<Timeframe>([
  "1s",
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
]);
const candleHistoryCache = new Map<string, CandleCacheEntry>();
const candleDbWriteTimes = new Map<string, number>();
let candleDbPromise: Promise<IDBDatabase | null> | null = null;

function isDrawingTool(tool: DrawingTool): tool is DrawingKind {
  return DRAWING_TOOL_SET.has(tool);
}

function normalizeColor(color: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_DRAWING_COLOR;
}

function getDrawingBorderColor(drawing: ChartDrawing) {
  return normalizeColor(drawing.borderColor ?? drawing.color);
}

function getDrawingCenterColor(drawing: ChartDrawing) {
  return normalizeColor(drawing.centerColor ?? drawing.borderColor ?? drawing.color);
}

function getDrawingFillOpacity(drawing: ChartDrawing) {
  return Math.max(0, Math.min(100, drawing.fillOpacity ?? 8));
}

function getDrawingBorderOpacity(drawing: ChartDrawing) {
  return Math.max(0, Math.min(100, drawing.borderOpacity ?? 100));
}

function getDrawingStrokeOpacity(drawing: ChartDrawing) {
  return getDrawingBorderOpacity(drawing) / 100;
}

function getDrawingLineLengthPercent(drawing: ChartDrawing) {
  return Math.max(10, Math.min(100, drawing.lineLengthPercent ?? 100));
}

function getFixedVolumeProfileRows(drawing: ChartDrawing) {
  return Math.max(
    12,
    Math.min(
      1000,
      Math.round(drawing.fixedVolumeProfileRows ?? DEFAULT_CONFIG.volumeProfile.rows),
    ),
  );
}

function getFixedVolumeProfileWidthPercent(drawing: ChartDrawing) {
  return Math.max(
    12,
    Math.min(
      60,
      Math.round(drawing.lineLengthPercent ?? DEFAULT_CONFIG.volumeProfile.widthPct),
    ),
  );
}

function getFixedVolumeProfileCandleLimit(drawing: ChartDrawing) {
  return Math.max(
    1,
    Math.min(1000, Math.round(drawing.fixedVolumeProfileCandleLimit ?? 1000)),
  );
}

function getFixedVolumeProfileBuyColor(drawing: ChartDrawing) {
  return normalizeHexColor(
    drawing.fixedVolumeProfileBuyColor ?? FIXED_VOLUME_PROFILE_BUY_COLOR,
    FIXED_VOLUME_PROFILE_BUY_COLOR,
  );
}

function getFixedVolumeProfileSellColor(drawing: ChartDrawing) {
  return normalizeHexColor(
    drawing.fixedVolumeProfileSellColor ?? FIXED_VOLUME_PROFILE_SELL_COLOR,
    FIXED_VOLUME_PROFILE_SELL_COLOR,
  );
}

function getFixedVolumeProfilePocColor(drawing: ChartDrawing) {
  return normalizeHexColor(
    drawing.fixedVolumeProfilePocColor ?? FIXED_VOLUME_PROFILE_SELL_COLOR,
    FIXED_VOLUME_PROFILE_SELL_COLOR,
  );
}

function getValueAreaRange(totals: number[], pocIndex: number) {
  const totalVolume = totals.reduce((sum, volume) => sum + volume, 0);
  if (!Number.isFinite(totalVolume) || totalVolume <= 0) {
    return { indices: new Set<number>([pocIndex]), low: pocIndex, high: pocIndex };
  }

  const targetVolume = totalVolume * FIXED_VOLUME_PROFILE_VALUE_AREA_PCT;
  let accumulated = totals[pocIndex] ?? 0;
  let low = pocIndex;
  let high = pocIndex;

  while (accumulated < targetVolume && (low > 0 || high < totals.length - 1)) {
    const nextLow = low > 0 ? totals[low - 1] : -1;
    const nextHigh = high < totals.length - 1 ? totals[high + 1] : -1;

    if (nextHigh >= nextLow) {
      high += 1;
      accumulated += Math.max(0, totals[high] ?? 0);
    } else {
      low -= 1;
      accumulated += Math.max(0, totals[low] ?? 0);
    }
  }

  const indices = new Set<number>();
  for (let index = low; index <= high; index += 1) indices.add(index);
  return { indices, low, high };
}

function getFibonacciLevels(drawing: ChartDrawing) {
  const customLevels = drawing.fibonacciLevels ?? [];

  return DEFAULT_FIB_RETRACEMENT_LEVELS.map((defaultLevel, index) => {
    const customLevel = customLevels[index];
    const value = Number(customLevel?.value ?? defaultLevel.value);

    return {
      value: Number.isFinite(value) ? value : defaultLevel.value,
      enabled: customLevel?.enabled ?? defaultLevel.enabled,
      color: normalizeColor(customLevel?.color ?? defaultLevel.color),
    };
  });
}

function getDefaultDrawingColor(kind: DrawingKind) {
  if (kind === "arrowUp") return TV_COLORS.green;
  if (kind === "arrowDown") return TV_COLORS.red;
  if (kind === "longPosition") return TV_COLORS.green;
  if (kind === "shortPosition") return TV_COLORS.red;
  if (kind === "measureRange") return TV_COLORS.green;
  if (kind === "fixedVolumeProfile") return FIB_LEVEL_COLOR;
  if (kind === "fibRetracement" || kind === "fibExtension") return FIB_LEVEL_COLOR;
  return DEFAULT_DRAWING_COLOR;
}

function getCandleCacheKey(symbol: string, timeframe: Timeframe) {
  return `${CANDLE_CACHE_SCHEMA_VERSION}:${symbol.toUpperCase()}|${timeframe}`;
}

function isPersistentCacheTimeframe(timeframe: Timeframe) {
  return !MEMORY_ONLY_CACHE_TIMEFRAMES.has(timeframe);
}

function cloneCandles(candles: Candle[]) {
  return candles.map((candle) => ({ ...candle }));
}

function isValidCandle(candle: Candle | undefined): candle is Candle {
  if (!candle) return false;

  const values = [
    candle.time,
    candle.open,
    candle.high,
    candle.low,
    candle.close,
    candle.volume,
  ];

  if (!values.every((value) => Number.isFinite(value))) return false;
  if (candle.time <= 0) return false;
  if (candle.high < Math.max(candle.open, candle.close)) return false;
  if (candle.low > Math.min(candle.open, candle.close)) return false;

  return true;
}

function normalizeCandles(candles: Candle[]) {
  const byTime = new Map<number, Candle>();

  candles.forEach((candle) => {
    if (!isValidCandle(candle)) return;
    byTime.set(candle.time, { ...candle });
  });

  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

function readMemoryCandleCache(symbol: string, timeframe: Timeframe) {
  const key = getCandleCacheKey(symbol, timeframe);
  const entry = candleHistoryCache.get(key);
  if (!entry) return null;

  candleHistoryCache.delete(key);
  candleHistoryCache.set(key, entry);
  return cloneCandles(entry.candles);
}

function openCandleDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (candleDbPromise) return candleDbPromise;

  candleDbPromise = new Promise((resolve) => {
    const request = indexedDB.open(CANDLE_DB_NAME, CANDLE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CANDLE_DB_STORE)) {
        db.createObjectStore(CANDLE_DB_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return candleDbPromise;
}

function compactCandles(candles: Candle[]): PersistedCandleCacheEntry["candles"] {
  return candles.slice(-CANDLE_CACHE_MAX_CANDLES).map((candle) => [
    candle.time,
    candle.open,
    candle.high,
    candle.low,
    candle.close,
    candle.volume,
    candle.isFinal ? 1 : 0,
  ]);
}

function expandCandles(candles: PersistedCandleCacheEntry["candles"]): Candle[] {
  return candles.map(([time, open, high, low, close, volume, isFinal]) => ({
    time,
    open,
    high,
    low,
    close,
    volume,
    isFinal: isFinal === 1,
  }));
}

async function readPersistentCandleCache(symbol: string, timeframe: Timeframe) {
  if (!isPersistentCacheTimeframe(timeframe)) return null;
  const db = await openCandleDb();
  if (!db) return null;
  const key = getCandleCacheKey(symbol, timeframe);

  return new Promise<Candle[] | null>((resolve) => {
    const tx = db.transaction(CANDLE_DB_STORE, "readonly");
    const request = tx.objectStore(CANDLE_DB_STORE).get(key);

    request.onsuccess = () => {
      const entry = request.result as PersistedCandleCacheEntry | undefined;
      resolve(entry ? expandCandles(entry.candles) : null);
    };
    request.onerror = () => resolve(null);
  });
}

async function prunePersistentCandleCache(db: IDBDatabase) {
  const tx = db.transaction(CANDLE_DB_STORE, "readwrite");
  const store = tx.objectStore(CANDLE_DB_STORE);
  const request = store.getAll();

  request.onsuccess = () => {
    const entries = (request.result as PersistedCandleCacheEntry[]).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
    entries.slice(CANDLE_DB_MAX_ENTRIES).forEach((entry) => {
      store.delete(entry.key);
    });
  };
}

async function writePersistentCandleCache(
  symbol: string,
  timeframe: Timeframe,
  candles: Candle[],
) {
  if (!isPersistentCacheTimeframe(timeframe) || candles.length === 0) return;
  const db = await openCandleDb();
  if (!db) return;

  const key = getCandleCacheKey(symbol, timeframe);
  const entry: PersistedCandleCacheEntry = {
    key,
    candles: compactCandles(candles),
    updatedAt: Date.now(),
  };

  await new Promise<void>((resolve) => {
    const tx = db.transaction(CANDLE_DB_STORE, "readwrite");
    tx.objectStore(CANDLE_DB_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  void prunePersistentCandleCache(db);
}

function writeCandleCache(
  symbol: string,
  timeframe: Timeframe,
  candles: Candle[],
  options: { forcePersist?: boolean } = {},
) {
  const key = getCandleCacheKey(symbol, timeframe);
  const now = Date.now();
  candleHistoryCache.set(key, {
    candles: cloneCandles(candles.slice(-CANDLE_CACHE_MAX_CANDLES)),
    updatedAt: now,
  });

  while (candleHistoryCache.size > CANDLE_CACHE_MAX_ENTRIES) {
    const oldestKey = candleHistoryCache.keys().next().value;
    if (!oldestKey) break;
    candleHistoryCache.delete(oldestKey);
  }

  if (!isPersistentCacheTimeframe(timeframe)) return;

  const lastWrite = candleDbWriteTimes.get(key) ?? 0;
  if (options.forcePersist || now - lastWrite >= CANDLE_DB_WRITE_INTERVAL_MS) {
    candleDbWriteTimes.set(key, now);
    void writePersistentCandleCache(symbol, timeframe, candles);
  }
}

function formatRiskRewardRatio(reward: number, risk: number) {
  if (risk <= 0 || !Number.isFinite(reward) || !Number.isFinite(risk)) {
    return "1:0";
  }

  const ratio = reward / risk;
  return `1:${ratio.toFixed(ratio >= 10 ? 1 : 2).replace(/\.?0+$/, "")}`;
}

function isPositionDrawingKind(kind: DrawingKind) {
  return kind === "longPosition" || kind === "shortPosition";
}

function getInitialPositionPoints(kind: DrawingKind, points: DrawingPoint[]) {
  if (!isPositionDrawingKind(kind) || points.length < 2) return points;

  const [entry, targetPoint] = points;
  const distance =
    Math.abs(targetPoint.price - entry.price) ||
    Math.max(Math.abs(entry.price) * 0.01, 1);
  const targetPrice =
    kind === "longPosition"
      ? entry.price + distance
      : entry.price - distance;
  const stopPrice =
    kind === "longPosition"
      ? entry.price - distance
      : entry.price + distance;

  return [
    entry,
    { ...targetPoint, price: targetPrice },
    { ...targetPoint, price: stopPrice },
    { ...targetPoint, price: entry.price },
  ];
}

function isPivotHigh(candles: Candle[], index: number, length: number) {
  const value = candles[index]?.high;
  if (value === undefined) return false;
  for (let i = index - length; i <= index + length; i += 1) {
    if (i === index) continue;
    if (!candles[i] || candles[i].high >= value) return false;
  }
  return true;
}

function isPivotLow(candles: Candle[], index: number, length: number) {
  const value = candles[index]?.low;
  if (value === undefined) return false;
  for (let i = index - length; i <= index + length; i += 1) {
    if (i === index) continue;
    if (!candles[i] || candles[i].low <= value) return false;
  }
  return true;
}

function getCandlePattern(candles: Candle[], index: number, pivot: "high" | "low") {
  const candle = candles[index];
  const previous = candles[index - 1];
  if (!candle) return { title: "None", description: "" };

  const o = candle.open;
  const h = candle.high;
  const l = candle.low;
  const c = candle.close;
  const d = Math.abs(c - o);
  const upper = h - Math.max(c, o);
  const lower = Math.min(o, c) - l;

  if (pivot === "low" && lower > d && upper < d) {
    return {
      title: "Hammer",
      description:
        "Cuerpo corto con mecha inferior larga; sugiere presión compradora al final de una caída.",
    };
  }
  if (pivot === "low" && upper > d && lower < d) {
    return {
      title: "Inverted Hammer",
      description:
        "Mecha superior larga en zona baja; sugiere que los compradores empiezan a tomar control.",
    };
  }
  if (
    pivot === "low" &&
    previous &&
    c > o &&
    previous.close < previous.open &&
    c > previous.open &&
    o < previous.close
  ) {
    return {
      title: "Bullish Engulfing",
      description:
        "Vela alcista envuelve el cuerpo bajista previo; posible cambio de impulso al alza.",
    };
  }
  if (pivot === "high" && lower > d && upper < d) {
    return {
      title: "Hanging Man",
      description:
        "Figura tipo martillo en zona alta; advierte posible pérdida de control alcista.",
    };
  }
  if (pivot === "high" && upper > d && lower < d) {
    return {
      title: "Shooting Star",
      description:
        "Mecha superior larga en zona alta; advierte rechazo de precios superiores.",
    };
  }
  if (
    pivot === "high" &&
    previous &&
    c < o &&
    previous.close > previous.open &&
    c < previous.open &&
    o > previous.close
  ) {
    return {
      title: "Bearish Engulfing",
      description:
        "Vela bajista envuelve el cuerpo alcista previo; posible cambio de impulso a la baja.",
    };
  }

  return { title: "None", description: "" };
}

function getSwingPatternMarkers(candles: Candle[], length: number) {
  const markers: SwingPatternMarker[] = [];
  let previousHigh: number | null = null;
  let previousLow: number | null = null;

  for (let index = length; index < candles.length - length; index += 1) {
    const candle = candles[index];
    if (isPivotHigh(candles, index, length)) {
      const structure = previousHigh === null || candle.high > previousHigh ? "HH" : "LH";
      const pattern = getCandlePattern(candles, index, "high");
      markers.push({
        time: candle.time,
        price: candle.high,
        kind: "high",
        structure,
        pattern: pattern.title,
        description: pattern.description,
      });
      previousHigh = candle.high;
    } else if (isPivotLow(candles, index, length)) {
      const structure = previousLow === null || candle.low < previousLow ? "LL" : "HL";
      const pattern = getCandlePattern(candles, index, "low");
      markers.push({
        time: candle.time,
        price: candle.low,
        kind: "low",
        structure,
        pattern: pattern.title,
        description: pattern.description,
      });
      previousLow = candle.low;
    }
  }

  return markers.slice(-500);
}

function detectRsiDivergences(
  candles: Candle[],
  rsiData: IndicatorPoint[],
): RsiDivergenceMarker[] {
  const lookbackLeft = 5;
  const lookbackRight = 5;
  const rangeLower = 5;
  const rangeUpper = 60;
  const candleByTime = new Map(candles.map((candle) => [candle.time, candle]));
  const markers: RsiDivergenceMarker[] = [];
  let previousLowPivot:
    | { index: number; value: number; price: number }
    | null = null;
  let previousHighPivot:
    | { index: number; value: number; price: number }
    | null = null;

  for (
    let index = lookbackLeft;
    index < rsiData.length - lookbackRight;
    index += 1
  ) {
    const point = rsiData[index];
    const candle = candleByTime.get(point.time);
    if (!candle) continue;

    let pivotLow = true;
    let pivotHigh = true;
    for (
      let offset = index - lookbackLeft;
      offset <= index + lookbackRight;
      offset += 1
    ) {
      if (offset === index) continue;
      if (rsiData[offset].value <= point.value) pivotLow = false;
      if (rsiData[offset].value >= point.value) pivotHigh = false;
    }

    if (pivotLow) {
      if (previousLowPivot) {
        const bars = index - previousLowPivot.index;
        if (
          bars >= rangeLower &&
          bars <= rangeUpper &&
          point.value > previousLowPivot.value &&
          candle.low < previousLowPivot.price
        ) {
          markers.push({
            time: point.time,
            value: point.value,
            previousTime: rsiData[previousLowPivot.index].time,
            previousValue: previousLowPivot.value,
            kind: "bull",
          });
        }
      }
      previousLowPivot = { index, value: point.value, price: candle.low };
    }

    if (pivotHigh) {
      if (previousHighPivot) {
        const bars = index - previousHighPivot.index;
        if (
          bars >= rangeLower &&
          bars <= rangeUpper &&
          point.value < previousHighPivot.value &&
          candle.high > previousHighPivot.price
        ) {
          markers.push({
            time: point.time,
            value: point.value,
            previousTime: rsiData[previousHighPivot.index].time,
            previousValue: previousHighPivot.value,
            kind: "bear",
          });
        }
      }
      previousHighPivot = { index, value: point.value, price: candle.high };
    }
  }

  return markers.slice(-100);
}

export function PriceChart({ symbol, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const emaCrossRefs = useRef<ISeriesApi<"Line">[]>([]);
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi30Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi70Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiMaRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiBbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiBbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const macdPaneIndexRef = useRef<number | null>(null);
  const sqzSqueezeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sqzAdxRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sqzKeyRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sqzCompressionRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sqzWaveARef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sqzWaveBRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sqzWaveCRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sqzPaneIndexRef = useRef<number | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const loadingOlderRef = useRef(false);
  const hasMoreOlderRef = useRef(true);
  const loadOlderRef = useRef<(() => void) | null>(null);
  const priceLinesMapRef = useRef<Map<string, IPriceLine>>(new Map());
  const overlayRenderFrameRef = useRef<number | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<HoverInfo | null>(null);
  const drawingPreviewFrameRef = useRef<number | null>(null);
  const pendingDrawingPreviewPointRef = useRef<DrawingPoint | null>(null);
  const measurePreviewFrameRef = useRef<number | null>(null);
  const measurePreviewPointRef = useRef<MeasurePoint | null>(null);

  const indicators = useChartStore((s) => s.indicators);
  const hidden = useChartStore((s) => s.hidden);
  const config = useChartStore((s) => s.config);
  const tool = useChartStore((s) => s.tool);
  const setTool = useChartStore((s) => s.setTool);
  const priceLines = useChartStore((s) => s.priceLines);
  const drawings = useChartStore((s) => s.drawings);
  const addDrawing = useChartStore((s) => s.addDrawing);
  const updateDrawing = useChartStore((s) => s.updateDrawing);
  const removeDrawing = useChartStore((s) => s.removeDrawing);
  const removeIndicator = useChartStore((s) => s.removeIndicator);
  const toggleHidden = useChartStore((s) => s.toggleHidden);
  const setSettingsTarget = useChartStore((s) => s.setSettingsTarget);
  const pageBackgroundColor = useChartStore((s) => s.pageBackgroundColor);
  const timeZone = useChartStore((s) => s.chartTimeZone);
  const chartTheme = useMemo(
    () => getChartTheme(pageBackgroundColor),
    [pageBackgroundColor],
  );
  const watermarkStyle = useMemo(
    () => getWatermarkStyle(pageBackgroundColor),
    [pageBackgroundColor],
  );

  // Refs to avoid recreating subscribeClick on every tool change
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const addDrawingRef = useRef(addDrawing);
  addDrawingRef.current = addDrawing;
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const configRef = useRef(config);
  configRef.current = config;
  const indicatorsRef = useRef(indicators);
  indicatorsRef.current = indicators;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [lastPrice, setLastPrice] = useState<{ value: number; pct: number } | null>(null);
  const [lastValues, setLastValues] = useState<LastValues>({});
  const [paneOffsets, setPaneOffsets] = useState<PaneOffset[]>([]);
  const [measure, setMeasure] = useState<MeasureState>(INITIAL_MEASURE);
  const [renderTick, setRenderTick] = useState(0);
  const [candleVersion, setCandleVersion] = useState(0);
  const [clockTimestamp, setClockTimestamp] = useState(() => Date.now());
  const [contextMenu, setContextMenu] = useState<ChartContextMenu | null>(null);
  const [drawingDraft, setDrawingDraft] = useState<DrawingDraft | null>(null);
  const [drawingPreviewPoint, setDrawingPreviewPoint] =
    useState<DrawingPoint | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const symbolDisplay = getSymbolDisplay(symbol);
  const symbolLogo = getSymbolLogo(symbol, symbolDisplay.primary);
  const measureRef = useRef(measure);
  measureRef.current = measure;
  const drawingDraftRef = useRef(drawingDraft);
  drawingDraftRef.current = drawingDraft;

  function scheduleOverlayRender() {
    if (overlayRenderFrameRef.current !== null) return;

    overlayRenderFrameRef.current = window.requestAnimationFrame(() => {
      overlayRenderFrameRef.current = null;
      setRenderTick((tick) => tick + 1);
    });
  }

  function scheduleHover(nextHover: HoverInfo | null) {
    pendingHoverRef.current = nextHover;

    if (hoverFrameRef.current !== null) return;

    hoverFrameRef.current = window.requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      const value = pendingHoverRef.current;
      pendingHoverRef.current = null;
      setHover((previous) =>
        isSameHoverInfo(previous, value) ? previous : value,
      );
    });
  }

  function scheduleDrawingPreview(nextPoint: DrawingPoint | null) {
    pendingDrawingPreviewPointRef.current = nextPoint;

    if (drawingPreviewFrameRef.current !== null) return;

    drawingPreviewFrameRef.current = window.requestAnimationFrame(() => {
      drawingPreviewFrameRef.current = null;
      const value = pendingDrawingPreviewPointRef.current;
      pendingDrawingPreviewPointRef.current = null;
      setDrawingPreviewPoint((previous) =>
        isSameDrawingPoint(previous, value) ? previous : value,
      );
    });
  }

  // Safe coordinate conversion helpers for off-screen and future drawing
  function timeToCoordinateSafe(time: number): number | null {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries || candlesRef.current.length === 0) return null;

    const timeScale = chart.timeScale();
    
    // 1. Try native timeToCoordinate first (it works for loaded/visible bars)
    const nativeX = timeScale.timeToCoordinate(time as UTCTimestamp);
    if (nativeX !== null) return nativeX;

    // 2. Extrapolate or interpolate using logical indices
    const firstCandle = candlesRef.current[0];
    const lastCandle = candlesRef.current[candlesRef.current.length - 1];
    
    const step = TIMEFRAME_SECONDS[timeframe] || 60;

    let logicalIndex = 0;
    if (time >= lastCandle.time) {
      const diff = time - lastCandle.time;
      const bars = Math.round(diff / step);
      logicalIndex = (candlesRef.current.length - 1) + bars;
    } else if (time <= firstCandle.time) {
      const diff = firstCandle.time - time;
      const bars = Math.round(diff / step);
      logicalIndex = 0 - bars;
    } else {
      // Binary search for the closest candle time within the loaded dataset
      let low = 0;
      let high = candlesRef.current.length - 1;
      let closestIndex = 0;
      let minDiff = Infinity;
      
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const midTime = candlesRef.current[mid].time;
        const diff = Math.abs(midTime - time);
        
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = mid;
        }
        
        if (midTime === time) {
          break;
        } else if (midTime < time) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      logicalIndex = closestIndex;
    }

    return timeScale.logicalToCoordinate(logicalIndex as Logical);
  }

  function coordinateToTimeSafe(x: number): number | null {
    const chart = chartRef.current;
    if (!chart || candlesRef.current.length === 0) return null;
    
    const timeScale = chart.timeScale();
    const logical = timeScale.coordinateToLogical(x);
    if (logical === null) return null;
    
    const firstCandle = candlesRef.current[0];
    const lastCandle = candlesRef.current[candlesRef.current.length - 1];
    
    const step = TIMEFRAME_SECONDS[timeframe] || 60;
    
    const lastIndex = candlesRef.current.length - 1;
    if (logical >= lastIndex) {
      const barsDiff = Math.round(logical - lastIndex);
      return lastCandle.time + barsDiff * step;
    } else if (logical <= 0) {
      const barsDiff = Math.round(0 - logical);
      return firstCandle.time - barsDiff * step;
    } else {
      // Within loaded range, find the closest candle
      const index = Math.round(logical);
      const candle = candlesRef.current[index];
      if (candle) return candle.time;
      return lastCandle.time;
    }
  }

  // Interactive Drag & Drop handlers for drawing resizing and displacement
  function getDrawingPointFromMouse(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !candleSeriesRef.current) return null;

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const time = coordinateToTimeSafe(localX);
    const price = candleSeriesRef.current.coordinateToPrice(localY);

    if (time === null || price === null || !isFinite(price)) {
      return null;
    }

    return { time, price };
  }

  const handlePointMouseDown = (drawingId: string, pointIndex: number, event: ReactMouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    
    setSelectedDrawingId(drawingId);
    const lockedAtStart = useChartStore
      .getState()
      .drawings.find((item) => item.id === drawingId)?.locked;
    if (lockedAtStart) return;

    let pendingPoint: DrawingPoint | null = null;
    let frameId: number | null = null;

    const flushPointUpdate = () => {
      frameId = null;
      const nextPoint = pendingPoint;
      pendingPoint = null;
      if (!nextPoint) return;

      const drawing = useChartStore.getState().drawings.find(d => d.id === drawingId);
      if (drawing && !drawing.locked) {
        const nextPoints = [...drawing.points];
        nextPoints[pointIndex] = nextPoint;
        updateDrawing(drawingId, { points: nextPoints });
      }
    };
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextPoint = getDrawingPointFromMouse(
        moveEvent.clientX,
        moveEvent.clientY,
      );

      if (nextPoint) {
        pendingPoint = nextPoint;
        if (frameId === null) {
          frameId = window.requestAnimationFrame(flushPointUpdate);
        }
      }
    };
    
    const onMouseUp = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
        flushPointUpdate();
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleParallelChannelEndMouseDown = (
    drawing: ChartDrawing,
    event: ReactMouseEvent,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    setSelectedDrawingId(drawing.id);

    const currentAtStart = useChartStore
      .getState()
      .drawings.find((item) => item.id === drawing.id);
    if (
      drawing.kind !== "parallelChannel" ||
      !currentAtStart ||
      currentAtStart.locked
    ) {
      return;
    }

    const [a, , c] = currentAtStart.points;
    if (!a || !c) return;

    const offsetTime = c.time - a.time;
    const offsetPrice = c.price - a.price;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextParallelEnd = getDrawingPointFromMouse(
        moveEvent.clientX,
        moveEvent.clientY,
      );

      if (!nextParallelEnd) return;

      const currentDrawing = useChartStore
        .getState()
        .drawings.find((item) => item.id === drawing.id);

      if (!currentDrawing || currentDrawing.locked) return;

      const nextPoints = [...currentDrawing.points];
      nextPoints[1] = {
        time: nextParallelEnd.time - offsetTime,
        price: nextParallelEnd.price - offsetPrice,
      };
      updateDrawing(drawing.id, { points: nextPoints });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleParallelChannelMidMouseDown = (
    drawing: ChartDrawing,
    line: "base" | "parallel",
    event: ReactMouseEvent,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    setSelectedDrawingId(drawing.id);

    const currentAtStart = useChartStore
      .getState()
      .drawings.find((item) => item.id === drawing.id);
    if (
      drawing.kind !== "parallelChannel" ||
      !currentAtStart ||
      currentAtStart.locked
    ) {
      return;
    }

    const startPoint = getDrawingPointFromMouse(event.clientX, event.clientY);
    if (!startPoint) return;

    const startPoints = [...currentAtStart.points];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentDrawing = useChartStore
        .getState()
        .drawings.find((item) => item.id === drawing.id);
      if (!currentDrawing || currentDrawing.locked) return;

      const nextPoint = getDrawingPointFromMouse(
        moveEvent.clientX,
        moveEvent.clientY,
      );

      if (!nextPoint) return;

      const deltaTime = nextPoint.time - startPoint.time;
      const deltaPrice = nextPoint.price - startPoint.price;
      const nextPoints = [...startPoints];
      const indices = line === "base" ? [0, 1] : [2];

      indices.forEach((index) => {
        const point = startPoints[index];
        if (!point) return;
        nextPoints[index] = {
          time: point.time + deltaTime,
          price: point.price + deltaPrice,
        };
      });

      updateDrawing(drawing.id, { points: nextPoints });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleRectangleResizeMouseDown = (
    drawing: ChartDrawing,
    handle:
      | "nw"
      | "n"
      | "ne"
      | "e"
      | "se"
      | "s"
      | "sw"
      | "w",
    event: ReactMouseEvent,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    setSelectedDrawingId(drawing.id);

    const currentAtStart = useChartStore
      .getState()
      .drawings.find((item) => item.id === drawing.id);
    if (drawing.kind !== "rectangle" || !currentAtStart || currentAtStart.locked) {
      return;
    }

    const startPoints = [...currentAtStart.points];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentDrawing = useChartStore
        .getState()
        .drawings.find((item) => item.id === drawing.id);
      if (!currentDrawing || currentDrawing.locked) return;

      const point = getDrawingPointFromMouse(moveEvent.clientX, moveEvent.clientY);
      if (!point) return;

      const [a, b] = startPoints;
      if (!a || !b) return;

      const nextA = { ...a };
      const nextB = { ...b };

      if (handle.includes("n")) nextA.price = point.price;
      if (handle.includes("s")) nextB.price = point.price;
      if (handle.includes("w")) nextA.time = point.time;
      if (handle.includes("e")) nextB.time = point.time;

      if (handle === "n" || handle === "s") {
        nextA.time = a.time;
        nextB.time = b.time;
      }

      if (handle === "e" || handle === "w") {
        nextA.price = a.price;
        nextB.price = b.price;
      }

      updateDrawing(drawing.id, { points: [nextA, nextB] });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleDrawingMouseDown = (drawing: ChartDrawing, event: ReactMouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    
    setSelectedDrawingId(drawing.id);
    const currentAtStart = useChartStore
      .getState()
      .drawings.find((item) => item.id === drawing.id);
    if (!currentAtStart || currentAtStart.locked) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !candleSeriesRef.current) return;
    
    const startMouseX = event.clientX;
    const startMouseY = event.clientY;
    const startPoints = [...currentAtStart.points];
    
    const timeScale = chartRef.current?.timeScale();
    if (!timeScale) return;
    
    const startMouseLocalX = startMouseX - rect.left;
    const startMouseLocalY = startMouseY - rect.top;
    
    const startLogical = timeScale.coordinateToLogical(startMouseLocalX);
    const startPrice = candleSeriesRef.current.coordinateToPrice(startMouseLocalY);
    if (startLogical === null || startPrice === null) return;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentDrawing = useChartStore
        .getState()
        .drawings.find((item) => item.id === drawing.id);
      if (!currentDrawing || currentDrawing.locked) return;

      const currentRect = containerRef.current?.getBoundingClientRect();
      const currentTimeScale = chartRef.current?.timeScale();
      if (!currentRect || !currentTimeScale || !candleSeriesRef.current) return;
      
      const localX = moveEvent.clientX - currentRect.left;
      const localY = moveEvent.clientY - currentRect.top;
      
      const currentLogical = currentTimeScale.coordinateToLogical(localX);
      const currentPrice = candleSeriesRef.current.coordinateToPrice(localY);
      if (currentLogical === null || currentPrice === null) return;
      
      const deltaLogical = currentLogical - startLogical;
      const deltaPrice = currentPrice - startPrice;
      
      const step = TIMEFRAME_SECONDS[timeframe] || 60;
      
      const nextPoints = startPoints.map((point) => {
        const nextPrice = point.price + deltaPrice;
        
        const firstCandle = candlesRef.current[0];
        const lastCandle = candlesRef.current[candlesRef.current.length - 1];
        const lastIndex = candlesRef.current.length - 1;
        
        let pointLogical = 0;
        if (point.time >= lastCandle.time) {
          const diff = point.time - lastCandle.time;
          pointLogical = lastIndex + Math.round(diff / step);
        } else if (point.time <= firstCandle.time) {
          const diff = firstCandle.time - point.time;
          pointLogical = 0 - Math.round(diff / step);
        } else {
          let closest = 0;
          let minDiff = Infinity;
          for (let i = 0; i < candlesRef.current.length; i++) {
            const diff = Math.abs(candlesRef.current[i].time - point.time);
            if (diff < minDiff) {
              minDiff = diff;
              closest = i;
            }
          }
          pointLogical = closest;
        }
        
        const nextLogical = Math.round(pointLogical + deltaLogical);
        
        let nextTime = 0;
        if (nextLogical >= lastIndex) {
          nextTime = lastCandle.time + (nextLogical - lastIndex) * step;
        } else if (nextLogical <= 0) {
          nextTime = firstCandle.time - (0 - nextLogical) * step;
        } else {
          nextTime = candlesRef.current[nextLogical]?.time ?? point.time;
        }
        
        return { time: nextTime, price: nextPrice };
      });
      
      updateDrawing(drawing.id, { points: nextPoints });
    };
    
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Helper — compute pane top offsets from chart layout
  function recomputePaneOffsets() {
    if (!chartRef.current) return;
    const panes = chartRef.current.panes();
    let top = 0;
    const offsets: PaneOffset[] = panes.map((p) => {
      const h = p.getHeight();
      const o = { top, height: h };
      top += h;
      return o;
    });
    setPaneOffsets(offsets);
  }

  function refreshChartLayout(afterLayout?: () => void) {
    const refresh = () => {
      const chart = chartRef.current;
      const container = containerRef.current;

      if (!chart || !container) return;

      void container;
      chart.applyOptions({ autoSize: true });
      recomputePaneOffsets();
      scheduleOverlayRender();
      afterLayout?.();
    };

    requestAnimationFrame(refresh);
    requestAnimationFrame(() => requestAnimationFrame(refresh));
  }

  function applyRsiScaleRange() {
    const scale = rsiRef.current?.priceScale();
    if (!scale) return;

    scale.applyOptions({
      autoScale: false,
      scaleMargins: { top: 0.08, bottom: 0.08 },
    });
    scale.setVisibleRange(RSI_VISIBLE_RANGE);
  }

  function applySqzScaleRange() {
    const scale = sqzSqueezeRef.current?.priceScale();
    if (!scale) return;

    scale.applyOptions({
      autoScale: false,
      scaleMargins: { top: 0.08, bottom: 0.12 },
    });
    scale.setVisibleRange(SQZ_VISIBLE_RANGE);
  }

  function removeMacdSeries() {
    const chart = chartRef.current;
    if (!chart) return;

    [macdRef.current, macdSignalRef.current, macdHistRef.current].forEach(
      (series) => {
        if (series) chart.removeSeries(series);
      },
    );
    macdRef.current = null;
    macdSignalRef.current = null;
    macdHistRef.current = null;
    macdPaneIndexRef.current = null;
  }

  function removeSqzSeries() {
    const chart = chartRef.current;
    if (!chart) return;

    [
      sqzSqueezeRef.current,
      sqzAdxRef.current,
      sqzKeyRef.current,
      sqzCompressionRef.current,
      sqzWaveARef.current,
      sqzWaveBRef.current,
      sqzWaveCRef.current,
    ].forEach((series) => {
      if (series) chart.removeSeries(series);
    });
    sqzSqueezeRef.current = null;
    sqzAdxRef.current = null;
    sqzKeyRef.current = null;
    sqzCompressionRef.current = null;
    sqzWaveARef.current = null;
    sqzWaveBRef.current = null;
    sqzWaveCRef.current = null;
    sqzPaneIndexRef.current = null;
  }

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const priceLinesMap = priceLinesMapRef.current;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: chartTheme.background },
        textColor: chartTheme.text,
        fontFamily: "var(--font-tv-sans), Inter, system-ui, sans-serif",
        fontSize: 11,
        panes: { separatorColor: chartTheme.border, separatorHoverColor: chartTheme.border },
      },
      grid: {
        vertLines: { color: chartTheme.grid },
        horzLines: { color: chartTheme.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: chartTheme.textMuted, width: 1, style: 3, labelBackgroundColor: chartTheme.panel },
        horzLine: { color: chartTheme.textMuted, width: 1, style: 3, labelBackgroundColor: chartTheme.panel },
      },
      rightPriceScale: {
        borderColor: chartTheme.border,
        textColor: chartTheme.textMuted,
      },
      timeScale: {
        borderColor: chartTheme.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8,
        tickMarkFormatter: (time: Time) => formatChartTime(time, "UTC"),
      },
      localization: {
        timeFormatter: (time: Time) => formatChartTime(time, "UTC"),
      },
      autoSize: true,
    });

    // PANE 0 — Candles + EMAs
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: TV_COLORS.green,
      downColor: TV_COLORS.red,
      borderUpColor: TV_COLORS.green,
      borderDownColor: TV_COLORS.red,
      wickUpColor: TV_COLORS.green,
      wickDownColor: TV_COLORS.red,
      priceLineColor: TV_COLORS.textMuted,
      priceLineStyle: 2,
    });

    ema20Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema50Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema50,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema200Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema200,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    emaCrossRefs.current = getEmaCrossLines(configRef.current.emaCross).map(
      (line) =>
        chart.addSeries(LineSeries, {
          color: line.color,
          lineStyle: LINE_STYLE_TO_CHART[line.lineStyle],
          lineType: LINE_TYPE_TO_CHART[line.lineStyle],
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          visible: false,
        }),
    );

    chartRef.current = chart;

    // Click handler — add horizontal price line when hline tool is active
    chart.subscribeClick((param) => {
      if (!param.point || !candleSeriesRef.current) return;
      const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
      if (price === null || !isFinite(price)) return;
      const activeTool = toolRef.current;
      const time =
        coordinateToTimeSafe(param.point.x) ??
        toUnixSeconds(param.time) ??
        candlesRef.current.at(-1)?.time ??
        Math.floor(Date.now() / 1000);

      if (isDrawingTool(activeTool)) {
        const currentDraft = drawingDraftRef.current;
        const basePoints =
          currentDraft?.kind === activeTool ? currentDraft.points : [];
        const points = [...basePoints, { time, price }];
        const pointsNeeded = DRAWING_POINT_REQUIREMENTS[activeTool];

        setSelectedDrawingId(null);
        setDrawingPreviewPoint(null);

        if (points.length >= pointsNeeded) {
          const drawingPoints = getInitialPositionPoints(
            activeTool,
            points.slice(0, pointsNeeded),
          );

          addDrawingRef.current({
            symbol: symbolRef.current,
            kind: activeTool,
            points: drawingPoints,
            color: getDefaultDrawingColor(activeTool),
            ...(activeTool === "fibRetracement"
              ? {
                  fibonacciLevels: DEFAULT_FIB_RETRACEMENT_LEVELS,
                  showTrendLine: true,
                }
              : {}),
            locked: false,
          });
          setDrawingDraft(null);
          setTool("cursor");
        } else {
          setDrawingDraft({ kind: activeTool, points });
        }
        return;
      }

      if (activeTool === "cursor") {
        setSelectedDrawingId(null);
      }

      if (activeTool === "measure") {
        const current = measureRef.current;
        if (current.phase === "idle") {
          setMeasure({
            phase: "placing",
            a: { time, price },
            b: { time, price },
          });
        } else if (current.phase === "placing") {
          if (current.a) {
            addDrawingRef.current({
              symbol: symbolRef.current,
              kind: "measureRange",
              points: [current.a, { time, price }],
              color: price >= current.a.price ? TV_COLORS.green : TV_COLORS.red,
              locked: false,
            });
          }
          setMeasure(INITIAL_MEASURE);
          setTool("cursor");
        } else {
          setMeasure({
            phase: "placing",
            a: { time, price },
            b: { time, price },
          });
        }
      }
    });

    // Crosshair handler
    chart.subscribeCrosshairMove((param) => {
      if (
        toolRef.current === "measure" &&
        measureRef.current.phase === "placing" &&
        param.point &&
        candleSeriesRef.current
      ) {
        const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
        const time = toUnixSeconds(param.time) ?? coordinateToTimeSafe(param.point.x);
        if (price !== null && isFinite(price) && time !== null) {
          measurePreviewPointRef.current = { time, price };
          if (measurePreviewFrameRef.current === null) {
            measurePreviewFrameRef.current = window.requestAnimationFrame(() => {
              measurePreviewFrameRef.current = null;
              const point = measurePreviewPointRef.current;
              if (!point) return;
              setMeasure((prev) =>
                prev.phase === "placing" ? { ...prev, b: point } : prev,
              );
            });
          }
        }
      }

      if (!param.time || !candleSeriesRef.current) {
        scheduleHover(null);
        return;
      }
      const data = param.seriesData.get(candleSeriesRef.current);
      const vol = volumeSeriesRef.current
        ? param.seriesData.get(volumeSeriesRef.current)
        : null;
      if (data && "open" in data) {
        const o = data.open as number;
        const c = data.close as number;
        scheduleHover({
          o,
          h: data.high as number,
          l: data.low as number,
          c,
          v: vol && "value" in vol ? (vol.value as number) : 0,
          time: Number(param.time),
          pct: o === 0 ? 0 : ((c - o) / o) * 100,
        });
      }
    });

    // Re-render measure overlay on pan / zoom so pixel coords stay in sync
    const tsRangeHandler = () => scheduleOverlayRender();
    chart.timeScale().subscribeVisibleTimeRangeChange(tsRangeHandler);
    const logicalRangeHandler = (range: { from: number; to: number } | null) => {
      scheduleOverlayRender();
      if (range && range.from < 80) {
        loadOlderRef.current?.();
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(logicalRangeHandler);

    let isPointerPanning = false;
    const handleWheel = () => scheduleOverlayRender();
    const handlePointerDown = () => {
      isPointerPanning = true;
      scheduleOverlayRender();
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (isDrawingTool(toolRef.current) && drawingDraftRef.current) {
        scheduleDrawingPreview(
          getDrawingPointFromMouse(event.clientX, event.clientY),
        );
      }
      if (isPointerPanning) scheduleOverlayRender();
    };
    const handlePointerUp = () => {
      isPointerPanning = false;
      scheduleOverlayRender();
    };

    containerRef.current.addEventListener("wheel", handleWheel, { passive: true });
    containerRef.current.addEventListener("pointerdown", handlePointerDown);
    containerRef.current.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    // ResizeObserver — recompute pane offsets when chart container resizes
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        recomputePaneOffsets();
        scheduleOverlayRender();
      });
    });
    ro.observe(containerRef.current);
    recomputePaneOffsets();

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(tsRangeHandler);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(logicalRangeHandler);
      containerRef.current?.removeEventListener("wheel", handleWheel);
      containerRef.current?.removeEventListener("pointerdown", handlePointerDown);
      containerRef.current?.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      if (overlayRenderFrameRef.current !== null) {
        window.cancelAnimationFrame(overlayRenderFrameRef.current);
        overlayRenderFrameRef.current = null;
      }
      if (hoverFrameRef.current !== null) {
        window.cancelAnimationFrame(hoverFrameRef.current);
        hoverFrameRef.current = null;
      }
      pendingHoverRef.current = null;
      if (drawingPreviewFrameRef.current !== null) {
        window.cancelAnimationFrame(drawingPreviewFrameRef.current);
        drawingPreviewFrameRef.current = null;
      }
      pendingDrawingPreviewPointRef.current = null;
      if (measurePreviewFrameRef.current !== null) {
        window.cancelAnimationFrame(measurePreviewFrameRef.current);
        measurePreviewFrameRef.current = null;
      }
      measurePreviewPointRef.current = null;
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesMap.clear();
      ema20Ref.current = null;
      ema50Ref.current = null;
      ema200Ref.current = null;
      emaCrossRefs.current = [];
      rsiRef.current = null;
      rsi30Ref.current = null;
      rsi50Ref.current = null;
      rsi70Ref.current = null;
      rsiMaRef.current = null;
      rsiBbUpperRef.current = null;
      rsiBbLowerRef.current = null;
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
      macdPaneIndexRef.current = null;
      sqzSqueezeRef.current = null;
      sqzAdxRef.current = null;
      sqzKeyRef.current = null;
      sqzCompressionRef.current = null;
      sqzWaveARef.current = null;
      sqzWaveBRef.current = null;
      sqzWaveCRef.current = null;
      sqzPaneIndexRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: {
        background: { color: chartTheme.background },
        textColor: chartTheme.text,
        panes: {
          separatorColor: chartTheme.border,
          separatorHoverColor: chartTheme.border,
        },
      },
      grid: {
        vertLines: { color: chartTheme.grid },
        horzLines: { color: chartTheme.grid },
      },
      crosshair: {
        vertLine: {
          color: chartTheme.textMuted,
          width: 1,
          style: 3,
          labelBackgroundColor: chartTheme.panel,
        },
        horzLine: {
          color: chartTheme.textMuted,
          width: 1,
          style: 3,
          labelBackgroundColor: chartTheme.panel,
        },
      },
      rightPriceScale: {
        borderColor: chartTheme.border,
        textColor: chartTheme.textMuted,
      },
      timeScale: {
        borderColor: chartTheme.border,
      },
    });
  }, [chartTheme]);

  useEffect(() => {
    if (!chartRef.current) return;

    chartRef.current.applyOptions({
      timeScale: {
        tickMarkFormatter: (time: Time) => formatChartTime(time, timeZone),
      },
      localization: {
        timeFormatter: (time: Time) => formatChartTime(time, timeZone),
      },
    });
  }, [timeZone]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockTimestamp(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    const close = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("click", close);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", close);

    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", close);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!selectedDrawingId) return;

    const stillVisible = drawings.some(
      (drawing) => drawing.id === selectedDrawingId && drawing.symbol === symbol,
    );

    if (stillVisible) return;

    const resetTimer = window.setTimeout(() => setSelectedDrawingId(null), 0);
    return () => window.clearTimeout(resetTimer);
  }, [drawings, selectedDrawingId, symbol]);

  useEffect(() => {
    if (!selectedDrawingId) return;
    const drawingId = selectedDrawingId;

    function handleDeleteDrawing(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") return;

      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isTypingTarget) return;

      event.preventDefault();
      removeDrawing(drawingId);
      setSelectedDrawingId(null);
    }

    window.addEventListener("keydown", handleDeleteDrawing);
    return () => window.removeEventListener("keydown", handleDeleteDrawing);
  }, [removeDrawing, selectedDrawingId]);

  // Listen for Escape key to cancel draft drawings, measurements or active selection
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isTypingTarget) return;

      event.preventDefault();
      
      // Reset tools and draft states
      setDrawingDraft(null);
      setDrawingPreviewPoint(null);
      setMeasure(INITIAL_MEASURE);
      setSelectedDrawingId(null);
      
      // Reset active tool back to cursor
      setTool("cursor");
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [setTool]);

  // Manage volume — overlay at the bottom of the main pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.volume && !volumeSeriesRef.current) {
      const v = chartRef.current.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          color: TV_COLORS.textMuted,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        0,
      );
      v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volumeSeriesRef.current = v;
      const data = candlesRef.current.map((k) => ({
        time: k.time as UTCTimestamp,
        value: k.volume,
        color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
      }));
      v.setData(data);
    } else if (!indicators.volume && volumeSeriesRef.current && chartRef.current) {
      chartRef.current.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
  }, [indicators.volume]);

  // RSI pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.rsi && !rsiRef.current) {
      const paneIndex = 1;
      const r = chartRef.current.addSeries(
        LineSeries,
        {
          color: configRef.current.rsiSettings.rsiColor,
          lineStyle: LINE_STYLE_TO_CHART[configRef.current.rsiSettings.rsiLineStyle],
          lineType: LINE_TYPE_TO_CHART[configRef.current.rsiSettings.rsiLineStyle],
          lineWidth: toChartLineWidth(configRef.current.rsiSettings.rsiLineWidth),
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const r30 = chartRef.current.addSeries(
        LineSeries,
        {
          color: configRef.current.rsiSettings.rangeLineColor,
          lineWidth: RSI_LEVEL_LINE_WIDTH,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const r50 = chartRef.current.addSeries(
        LineSeries,
        {
          color: `${configRef.current.rsiSettings.rangeLineColor}99`,
          lineWidth: RSI_LEVEL_LINE_WIDTH,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const r70 = chartRef.current.addSeries(
        LineSeries,
        {
          color: configRef.current.rsiSettings.rangeLineColor,
          lineWidth: RSI_LEVEL_LINE_WIDTH,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const rMa = chartRef.current.addSeries(
        LineSeries,
        {
          color: configRef.current.rsiSettings.maColor,
          lineStyle: LINE_STYLE_TO_CHART[configRef.current.rsiSettings.maLineStyle],
          lineType: LINE_TYPE_TO_CHART[configRef.current.rsiSettings.maLineStyle],
          lineWidth: toChartLineWidth(configRef.current.rsiSettings.maLineWidth),
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const bbUpper = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.green,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const bbLower = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.green,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      rsiRef.current = r;
      rsi30Ref.current = r30;
      rsi50Ref.current = r50;
      rsi70Ref.current = r70;
      rsiMaRef.current = rMa;
      rsiBbUpperRef.current = bbUpper;
      rsiBbLowerRef.current = bbLower;
      applyRsiScaleRange();
      try {
        chartRef.current.panes()[1]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateRSI();
      refreshChartLayout(() => {
        updateRSI();
        applyRsiScaleRange();
      });
    } else if (!indicators.rsi && rsiRef.current && chartRef.current) {
      chartRef.current.removeSeries(rsiRef.current);
      if (rsi30Ref.current) chartRef.current.removeSeries(rsi30Ref.current);
      if (rsi50Ref.current) chartRef.current.removeSeries(rsi50Ref.current);
      if (rsi70Ref.current) chartRef.current.removeSeries(rsi70Ref.current);
      if (rsiMaRef.current) chartRef.current.removeSeries(rsiMaRef.current);
      if (rsiBbUpperRef.current) chartRef.current.removeSeries(rsiBbUpperRef.current);
      if (rsiBbLowerRef.current) chartRef.current.removeSeries(rsiBbLowerRef.current);
      rsiRef.current = null;
      rsi30Ref.current = null;
      rsi50Ref.current = null;
      rsi70Ref.current = null;
      rsiMaRef.current = null;
      rsiBbUpperRef.current = null;
      rsiBbLowerRef.current = null;
    }
    refreshChartLayout();
  }, [indicators.rsi]);

  // MACD pane
  useEffect(() => {
    if (!chartRef.current) return;
    const paneIndex = indicators.rsi ? 2 : 1;

    if (
      indicators.macd &&
      macdRef.current &&
      macdPaneIndexRef.current !== paneIndex
    ) {
      removeMacdSeries();
    }

    if (indicators.macd && !macdRef.current) {
      const m = chartRef.current.addSeries(
        LineSeries,
        {
          color: INDICATOR_COLORS.macd,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const s = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.yellow,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const h = chartRef.current.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false },
        paneIndex,
      );
      macdRef.current = m;
      macdSignalRef.current = s;
      macdHistRef.current = h;
      macdPaneIndexRef.current = paneIndex;
      try {
        chartRef.current.panes()[paneIndex]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateMACD();
      refreshChartLayout(() => updateMACD());
    } else if (!indicators.macd && macdRef.current && chartRef.current) {
      removeMacdSeries();
    }
    refreshChartLayout();
  }, [indicators.macd, indicators.rsi]);

  // SQZ + ADX + TTM pane
  useEffect(() => {
    if (!chartRef.current) return;
    const paneIndex =
      1 + (indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0);

    if (
      indicators.sqzAdxTtm &&
      sqzSqueezeRef.current &&
      sqzPaneIndexRef.current !== paneIndex
    ) {
      removeSqzSeries();
    }

    if (indicators.sqzAdxTtm && !sqzSqueezeRef.current) {
      sqzWaveCRef.current = chartRef.current.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false },
        paneIndex,
      );
      sqzWaveBRef.current = chartRef.current.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false },
        paneIndex,
      );
      sqzWaveARef.current = chartRef.current.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false },
        paneIndex,
      );
      sqzSqueezeRef.current = chartRef.current.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false },
        paneIndex,
      );
      sqzKeyRef.current = chartRef.current.addSeries(
        LineSeries,
        {
          color: "#ffffff",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      sqzCompressionRef.current = chartRef.current.addSeries(
        LineSeries,
        {
          color: "#ffffff",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      sqzAdxRef.current = chartRef.current.addSeries(
        LineSeries,
        {
          color: "#ffffff",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      sqzPaneIndexRef.current = paneIndex;
      applySqzScaleRange();
      try {
        chartRef.current.panes()[paneIndex]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateSqzAdxTtm();
      refreshChartLayout(() => {
        updateSqzAdxTtm();
        applySqzScaleRange();
      });
    } else if (!indicators.sqzAdxTtm && sqzSqueezeRef.current && chartRef.current) {
      removeSqzSeries();
    }
    refreshChartLayout();
  }, [indicators.sqzAdxTtm, indicators.rsi, indicators.macd]);

  // Visibility — eye toggle (hidden state) + enabled state combined
  useEffect(() => {
    const v = (key: IndicatorKey) => indicators[key] && !hidden[key];
    ema20Ref.current?.applyOptions({ visible: v("ema20") });
    ema50Ref.current?.applyOptions({ visible: v("ema50") });
    ema200Ref.current?.applyOptions({ visible: v("ema200") });
    const emaCrossLines = getEmaCrossLines(configRef.current.emaCross);
    emaCrossRefs.current.forEach((series, index) =>
      series.applyOptions({
        visible: v("emaCross") && (emaCrossLines[index]?.enabled ?? true),
      }),
    );
    if (rsiRef.current) rsiRef.current.applyOptions({ visible: v("rsi") });
    if (rsi30Ref.current) rsi30Ref.current.applyOptions({ visible: v("rsi") });
    if (rsi50Ref.current) rsi50Ref.current.applyOptions({ visible: v("rsi") });
    if (rsi70Ref.current) rsi70Ref.current.applyOptions({ visible: v("rsi") });
    if (rsiMaRef.current) rsiMaRef.current.applyOptions({ visible: v("rsi") });
    if (rsiBbUpperRef.current) rsiBbUpperRef.current.applyOptions({ visible: v("rsi") });
    if (rsiBbLowerRef.current) rsiBbLowerRef.current.applyOptions({ visible: v("rsi") });
    if (macdRef.current) macdRef.current.applyOptions({ visible: v("macd") });
    if (macdSignalRef.current) macdSignalRef.current.applyOptions({ visible: v("macd") });
    if (macdHistRef.current) macdHistRef.current.applyOptions({ visible: v("macd") });
    if (sqzSqueezeRef.current) sqzSqueezeRef.current.applyOptions({ visible: v("sqzAdxTtm") });
    if (sqzAdxRef.current) sqzAdxRef.current.applyOptions({ visible: v("sqzAdxTtm") });
    if (sqzKeyRef.current) sqzKeyRef.current.applyOptions({ visible: v("sqzAdxTtm") });
    if (sqzCompressionRef.current) sqzCompressionRef.current.applyOptions({ visible: v("sqzAdxTtm") });
    if (sqzWaveARef.current) sqzWaveARef.current.applyOptions({ visible: v("sqzAdxTtm") });
    if (sqzWaveBRef.current) sqzWaveBRef.current.applyOptions({ visible: v("sqzAdxTtm") });
    if (sqzWaveCRef.current) sqzWaveCRef.current.applyOptions({ visible: v("sqzAdxTtm") });
    if (volumeSeriesRef.current) volumeSeriesRef.current.applyOptions({ visible: v("volume") });
    refreshChartLayout();
  }, [indicators, hidden]);

  // Recompute indicators when config changes (periods)
  useEffect(() => {
    updateEMAs();
  }, [config.ema20, config.ema50, config.ema200]);

  useEffect(() => {
    updateEmaCross();
  }, [config.emaCross]);

  useEffect(() => {
    updateRSI();
  }, [config.rsi, config.rsiSettings]);

  useEffect(() => {
    updateMACD();
  }, [config.macdFast, config.macdSlow, config.macdSignal]);

  useEffect(() => {
    updateSqzAdxTtm();
  }, [config.sqzAdxTtm]);

  // Sync price lines from store to the candle series
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const map = priceLinesMapRef.current;
    const linesForThisSymbol = priceLines.filter((p) => p.symbol === symbol);
    const activeIds = new Set(linesForThisSymbol.map((p) => p.id));

    for (const [id, apiLine] of map.entries()) {
      if (!activeIds.has(id)) {
        try {
          series.removePriceLine(apiLine);
        } catch {}
        map.delete(id);
      }
    }
    for (const pl of linesForThisSymbol) {
      if (!map.has(pl.id)) {
        const apiLine = series.createPriceLine({
          price: pl.price,
          color: TV_COLORS.blue,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "",
        });
        map.set(pl.id, apiLine);
      }
    }
  }, [priceLines, symbol]);

  // Cursor style when drawing tools are active + reset measure on tool change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor =
        tool === "measure" || isDrawingTool(tool) ? "crosshair" : "";
    }
    const resetTimers: number[] = [];

    if (!isDrawingTool(tool)) {
      resetTimers.push(
        window.setTimeout(() => {
          setDrawingDraft(null);
          setDrawingPreviewPoint(null);
        }, 0),
      );
    } else if (drawingDraft?.kind !== tool) {
      resetTimers.push(
        window.setTimeout(() => {
          setDrawingDraft(null);
          setDrawingPreviewPoint(null);
        }, 0),
      );
    }
    if (tool !== "measure") {
      resetTimers.push(window.setTimeout(() => setMeasure(INITIAL_MEASURE), 0));
    }

    return () => {
      resetTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [tool, drawingDraft?.kind]);

  useEffect(() => {
    setDrawingDraft(null);
    setDrawingPreviewPoint(null);
    setSelectedDrawingId(null);
  }, [symbol]);

  function updateEMAs() {
    const c = candlesRef.current;
    if (c.length === 0) return;
    const cfg = configRef.current;
    let last20: number | undefined;
    let last50: number | undefined;
    let last200: number | undefined;

    if (ema20Ref.current) {
      const data = ema(c, cfg.ema20);
      ema20Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last20 = data.at(-1)?.value;
    }
    if (ema50Ref.current) {
      const data = ema(c, cfg.ema50);
      ema50Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last50 = data.at(-1)?.value;
    }
    if (ema200Ref.current) {
      const data = ema(c, cfg.ema200);
      ema200Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last200 = data.at(-1)?.value;
    }
    const lastVol = c.at(-1)?.volume;
    setLastValues((prev) => ({
      ...prev,
      ema20: last20,
      ema50: last50,
      ema200: last200,
      volume: lastVol,
    }));
  }

  function clearIndicatorSeries() {
    ema20Ref.current?.setData([]);
    ema50Ref.current?.setData([]);
    ema200Ref.current?.setData([]);
    emaCrossRefs.current.forEach((series) => series.setData([]));
    rsiRef.current?.setData([]);
    rsi30Ref.current?.setData([]);
    rsi50Ref.current?.setData([]);
    rsi70Ref.current?.setData([]);
    rsiMaRef.current?.setData([]);
    rsiBbUpperRef.current?.setData([]);
    rsiBbLowerRef.current?.setData([]);
    macdRef.current?.setData([]);
    macdSignalRef.current?.setData([]);
    macdHistRef.current?.setData([]);
    sqzSqueezeRef.current?.setData([]);
    sqzAdxRef.current?.setData([]);
    sqzKeyRef.current?.setData([]);
    sqzCompressionRef.current?.setData([]);
    sqzWaveARef.current?.setData([]);
    sqzWaveBRef.current?.setData([]);
    sqzWaveCRef.current?.setData([]);
    setLastValues({});
    scheduleOverlayRender();
  }

  function updateEmaCross() {
    const c = candlesRef.current;
    if (c.length === 0) return;

    const lines = getEmaCrossLines(configRef.current.emaCross);
    const currentIndicators = indicatorsRef.current;
    const currentHidden = hiddenRef.current;
    emaCrossRefs.current.forEach((series, index) => {
      const line = lines[index];
      const data = line.enabled ? ema(c, line.period) : [];
      series.applyOptions({
        color: line.color,
        lineStyle: LINE_STYLE_TO_CHART[line.lineStyle],
        lineType: LINE_TYPE_TO_CHART[line.lineStyle],
        visible: currentIndicators.emaCross && !currentHidden.emaCross && line.enabled,
      });
      series.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
    });
  }

  function updateRSI() {
    const c = candlesRef.current;
    if (c.length === 0 || !rsiRef.current) return;
    const cfg = configRef.current;
    const rsiData = rsi(c, cfg.rsi);
    const data = rsiData.map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    }));
    rsiRef.current.setData(data);
    if (rsi30Ref.current && data.length > 0) {
      rsi30Ref.current.setData([
        { time: data[0].time, value: 30 },
        { time: data[data.length - 1].time, value: 30 },
      ]);
    }
    if (rsi50Ref.current && data.length > 0) {
      rsi50Ref.current.setData([
        { time: data[0].time, value: 50 },
        { time: data[data.length - 1].time, value: 50 },
      ]);
    }
    if (rsi70Ref.current && data.length > 0) {
      rsi70Ref.current.setData([
        { time: data[0].time, value: 70 },
        { time: data[data.length - 1].time, value: 70 },
      ]);
    }
    const smoothing = buildRsiSmoothing(rsiData, c, cfg.rsiSettings);
    const isBb = cfg.rsiSettings.maType === "SMA + Bollinger Bands";
    rsiRef.current.applyOptions({
      color: cfg.rsiSettings.rsiColor,
      lineStyle: LINE_STYLE_TO_CHART[cfg.rsiSettings.rsiLineStyle],
      lineType: LINE_TYPE_TO_CHART[cfg.rsiSettings.rsiLineStyle],
      lineWidth: toChartLineWidth(cfg.rsiSettings.rsiLineWidth),
    });
    rsi30Ref.current?.applyOptions({
      color: cfg.rsiSettings.rangeLineColor,
      lineWidth: RSI_LEVEL_LINE_WIDTH,
      lineStyle: LineStyle.Dashed,
    });
    rsi50Ref.current?.applyOptions({
      color: `${cfg.rsiSettings.rangeLineColor}99`,
      lineWidth: RSI_LEVEL_LINE_WIDTH,
      lineStyle: LineStyle.Dashed,
    });
    rsi70Ref.current?.applyOptions({
      color: cfg.rsiSettings.rangeLineColor,
      lineWidth: RSI_LEVEL_LINE_WIDTH,
      lineStyle: LineStyle.Dashed,
    });
    rsiMaRef.current?.applyOptions({
      color: cfg.rsiSettings.maColor,
      lineStyle: LINE_STYLE_TO_CHART[cfg.rsiSettings.maLineStyle],
      lineType: LINE_TYPE_TO_CHART[cfg.rsiSettings.maLineStyle],
      lineWidth: toChartLineWidth(cfg.rsiSettings.maLineWidth),
      visible:
        indicators.rsi &&
        !hidden.rsi &&
        cfg.rsiSettings.maType !== "None",
    });
    rsiMaRef.current?.setData(
      smoothing.ma.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
    );
    rsiBbUpperRef.current?.applyOptions({
      visible: indicators.rsi && !hidden.rsi && isBb,
    });
    rsiBbUpperRef.current?.setData(
      smoothing.bbUpper.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.value,
      })),
    );
    rsiBbLowerRef.current?.applyOptions({
      visible: indicators.rsi && !hidden.rsi && isBb,
    });
    rsiBbLowerRef.current?.setData(
      smoothing.bbLower.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.value,
      })),
    );
    applyRsiScaleRange();
    setLastValues((prev) => ({ ...prev, rsi: data.at(-1)?.value }));
    scheduleOverlayRender();
  }

  function updateMACD() {
    const c = candlesRef.current;
    if (c.length === 0 || !macdRef.current) return;
    const cfg = configRef.current;
    const m = macd(c, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
    macdRef.current.setData(
      m.map((p) => ({ time: p.time as UTCTimestamp, value: p.macd })),
    );
    macdSignalRef.current?.setData(
      m.map((p) => ({ time: p.time as UTCTimestamp, value: p.signal })),
    );
    macdHistRef.current?.setData(
      m.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.histogram,
        color: p.histogram >= 0 ? `${TV_COLORS.green}80` : `${TV_COLORS.red}80`,
      })),
    );
    const last = m.at(-1);
    setLastValues((prev) => ({
      ...prev,
      macd: last?.macd,
      macdSignal: last?.signal,
      macdHist: last?.histogram,
    }));
  }

  function updateSqzAdxTtm() {
    const c = candlesRef.current;
    if (c.length === 0 || !sqzSqueezeRef.current) return;
    const cfg = configRef.current.sqzAdxTtm;
    const data = sqzAdxTtm(c, cfg);
    const visible = indicators.sqzAdxTtm && !hidden.sqzAdxTtm;
    const squeezeData = data
      .filter((point) => Number.isFinite(point.squeeze))
      .map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.squeeze ?? 0,
        color: point.squeezeColor,
      }));
    const adxData = data
      .filter((point) => Number.isFinite(point.adx))
      .map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.adx ?? 0,
      }));
    const keyLevelData = data
      .filter((point) => Number.isFinite(point.keyLevel))
      .map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.keyLevel ?? 0,
      }));
    const compressionData = data
      .filter((point) => Number.isFinite(point.compression))
      .map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.compression ?? 0,
        color: point.compressionColor,
      }));
    const waveAData = data
      .filter((point) => Number.isFinite(point.waveA))
      .map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.waveA ?? 0,
        color: "#00808033",
      }));
    const waveBData = data
      .filter((point) => Number.isFinite(point.waveB))
      .map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.waveB ?? 0,
        color: "#ffa5001a",
      }));
    const waveCData = data
      .filter((point) => Number.isFinite(point.waveC))
      .map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.waveC ?? 0,
        color: "#ffff001a",
      }));
    const hasVisibleSqzData =
      (cfg.showSqueeze && squeezeData.length > 0) ||
      (cfg.showAdx && adxData.length > 0) ||
      (cfg.showTtmSqueeze && compressionData.length > 0) ||
      (cfg.showWaves &&
        (waveAData.length > 0 || waveBData.length > 0 || waveCData.length > 0));

    sqzSqueezeRef.current.applyOptions({ visible: visible && cfg.showSqueeze });
    sqzSqueezeRef.current.setData(squeezeData);
    sqzAdxRef.current?.applyOptions({ visible: visible && cfg.showAdx });
    sqzAdxRef.current?.setData(adxData);
    sqzKeyRef.current?.applyOptions({ visible: visible && cfg.showAdx });
    sqzKeyRef.current?.setData(keyLevelData);
    sqzCompressionRef.current?.applyOptions({
      visible: visible && cfg.showTtmSqueeze,
    });
    sqzCompressionRef.current?.setData(compressionData);
    sqzWaveARef.current?.applyOptions({ visible: visible && cfg.showWaves });
    sqzWaveARef.current?.setData(waveAData);
    sqzWaveBRef.current?.applyOptions({ visible: visible && cfg.showWaves });
    sqzWaveBRef.current?.setData(waveBData);
    sqzWaveCRef.current?.applyOptions({ visible: visible && cfg.showWaves });
    sqzWaveCRef.current?.setData(waveCData);

    if (visible && hasVisibleSqzData) {
      applySqzScaleRange();
      requestAnimationFrame(() => {
        sqzSqueezeRef.current?.setData(squeezeData);
        sqzAdxRef.current?.setData(adxData);
        sqzKeyRef.current?.setData(keyLevelData);
        sqzCompressionRef.current?.setData(compressionData);
        sqzWaveARef.current?.setData(waveAData);
        sqzWaveBRef.current?.setData(waveBData);
        sqzWaveCRef.current?.setData(waveCData);
        applySqzScaleRange();
        refreshChartLayout();
      });
    }

    const last = [...data].reverse().find(
      (point) => point.squeeze !== undefined || point.adx !== undefined,
    );
    setLastValues((prev) => ({
      ...prev,
      sqzAdxTtm: last?.squeeze,
      sqzAdx: last?.adx,
    }));
    scheduleOverlayRender();
  }

  function updateCurrentPriceColor(candle: Candle) {
    candleSeriesRef.current?.applyOptions({
      priceLineColor: getCandleColor(candle),
    });
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 40;
    setContextMenu({
      x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - menuHeight - 8)),
    });
  }

  function resetChartView() {
    setContextMenu(null);
    chartRef.current?.timeScale().fitContent();
    candleSeriesRef.current?.priceScale().applyOptions({ autoScale: true });
    volumeSeriesRef.current?.priceScale().applyOptions({ autoScale: true });
    rsiRef.current?.priceScale().applyOptions({ autoScale: true });
    macdRef.current?.priceScale().applyOptions({ autoScale: true });
    sqzSqueezeRef.current?.priceScale().applyOptions({ autoScale: true });
    requestAnimationFrame(() => recomputePaneOffsets());
  }

  function buildEmaCrossFill(): EmaCrossFillRender | null {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const container = containerRef.current;
    const fill = getEmaCrossFill(config.emaCrossFill);

    if (
      !chart ||
      !candleSeries ||
      !container ||
      !indicators.emaCross ||
      hidden.emaCross ||
      !fill.enabled ||
      fill.opacity <= 0 ||
      fill.from === fill.to ||
      candlesRef.current.length === 0
    ) {
      return null;
    }

    const lines = getEmaCrossLines(config.emaCross);
    const fromLine = lines[fill.from];
    const toLine = lines[fill.to];
    if (!fromLine || !toLine || !fromLine.enabled || !toLine.enabled) return null;

    const fromData = ema(candlesRef.current, fromLine.period);
    const toByTime = new Map(
      ema(candlesRef.current, toLine.period).map((point) => [
        point.time,
        point.value,
      ]),
    );
    const timeScale = chart.timeScale();
    const width = container.clientWidth;
    const height = paneOffsets[0]?.height ?? container.clientHeight;
    const fromPoints: string[] = [];
    const toPoints: string[] = [];

    for (const point of fromData) {
      const toValue = toByTime.get(point.time);
      if (toValue === undefined) continue;

      const x = timeScale.timeToCoordinate(point.time as UTCTimestamp);
      const yFrom = candleSeries.priceToCoordinate(point.value);
      const yTo = candleSeries.priceToCoordinate(toValue);
      if (x === null || yFrom === null || yTo === null) continue;
      if (x < -40 || x > width + 40) continue;

      fromPoints.push(`${x.toFixed(2)},${yFrom.toFixed(2)}`);
      toPoints.push(`${x.toFixed(2)},${yTo.toFixed(2)}`);
    }

    if (fromPoints.length < 2 || toPoints.length < 2) return null;

    const color = /^#[0-9a-fA-F]{6}$/.test(fill.color)
      ? fill.color
      : DEFAULT_CONFIG.emaCrossFill.color;

    return {
      path: `M ${fromPoints.join(" L ")} L ${toPoints.reverse().join(" L ")} Z`,
      color,
      opacity: Math.max(0, Math.min(1, fill.opacity / 100)),
      height,
    };
  }

  function normalizeProfileColor(color: string, fallback: string) {
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
  }

  function buildVisibleRangeVolumeProfile(): VolumeProfileRender | null {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const container = containerRef.current;
    const mainPane = paneOffsets[0];
    const profileConfig: VolumeProfileConfig = {
      ...DEFAULT_CONFIG.volumeProfile,
      ...config.volumeProfile,
    };

    if (
      !chart ||
      !candleSeries ||
      !container ||
      !mainPane ||
      !indicators.volumeProfile ||
      hidden.volumeProfile ||
      candlesRef.current.length === 0
    ) {
      return null;
    }

    const logicalRange = chart.timeScale().getVisibleLogicalRange();
    if (!logicalRange) return null;

    const candles = candlesRef.current;
    const from = Math.max(0, Math.floor(Number(logicalRange.from)));
    const to = Math.min(candles.length - 1, Math.ceil(Number(logicalRange.to)));
    if (to < from) return null;

    const visibleCandles = candles.slice(from, to + 1);
    if (visibleCandles.length < 2) return null;

    let lowest = Infinity;
    let highest = -Infinity;
    visibleCandles.forEach((candle) => {
      lowest = Math.min(lowest, candle.low);
      highest = Math.max(highest, candle.high);
    });

    if (!Number.isFinite(lowest) || !Number.isFinite(highest) || highest <= lowest) {
      return null;
    }

    const rowCount = Math.max(12, Math.min(1000, Math.round(profileConfig.rows)));
    const priceStep = (highest - lowest) / rowCount;
    const volumeBins = Array.from({ length: rowCount }, () => ({
      buy: 0,
      sell: 0,
    }));

    visibleCandles.forEach((candle) => {
      const candleLow = Math.max(lowest, candle.low);
      const candleHigh = Math.min(highest, candle.high);
      const startBin = Math.max(
        0,
        Math.min(rowCount - 1, Math.floor((candleLow - lowest) / priceStep)),
      );
      const endBin = Math.max(
        startBin,
        Math.min(rowCount - 1, Math.floor((candleHigh - lowest) / priceStep)),
      );
      const touchedBins = endBin - startBin + 1;
      const volumeShare = candle.volume / touchedBins;
      const target = candle.close >= candle.open ? "buy" : "sell";

      for (let index = startBin; index <= endBin; index += 1) {
        volumeBins[index][target] += Number.isFinite(volumeShare) ? volumeShare : 0;
      }
    });

    const totals = volumeBins.map((bin) => bin.buy + bin.sell);
    const maxVolume = Math.max(...totals);
    if (!Number.isFinite(maxVolume) || maxVolume <= 0) return null;

    const pocIndex = totals.indexOf(maxVolume);
    const profileRight = Math.max(80, container.clientWidth - 78);
    const profileWidth = Math.min(
      340,
      Math.max(90, (container.clientWidth * profileConfig.widthPct) / 100),
    );
    const barGap = 1;

    const bins = volumeBins
      .map((bin, index): VolumeProfileBinRender | null => {
        const priceLow = lowest + index * priceStep;
        const priceHigh = priceLow + priceStep;
        const yHigh = candleSeries.priceToCoordinate(priceHigh);
        const yLow = candleSeries.priceToCoordinate(priceLow);
        if (yHigh === null || yLow === null) return null;

        const y = Math.min(yHigh, yLow);
        const height = Math.max(1, Math.abs(yLow - yHigh) - barGap);
        if (y > mainPane.top + mainPane.height || y + height < mainPane.top) {
          return null;
        }

        const volume = bin.buy + bin.sell;
        const totalWidth = Math.max(1, (volume / maxVolume) * profileWidth);
        const buyWidth = volume > 0 ? (bin.buy / volume) * totalWidth : 0;
        const sellWidth = totalWidth - buyWidth;

        return {
          y,
          height,
          buyWidth,
          sellWidth,
          totalWidth,
          volume,
          buyVolume: bin.buy,
          sellVolume: bin.sell,
        };
      })
      .filter((bin): bin is VolumeProfileBinRender => bin !== null);

    if (bins.length === 0) return null;

    const pocPrice = lowest + (pocIndex + 0.5) * priceStep;
    const pocY = candleSeries.priceToCoordinate(pocPrice);
    if (pocY === null) return null;

    return {
      bins,
      opacity: Math.max(0.1, Math.min(1, profileConfig.opacity / 100)),
      buyColor: normalizeProfileColor(
        profileConfig.buyColor,
        DEFAULT_CONFIG.volumeProfile.buyColor,
      ),
      sellColor: normalizeProfileColor(
        profileConfig.sellColor,
        DEFAULT_CONFIG.volumeProfile.sellColor,
      ),
      pocColor: normalizeProfileColor(
        profileConfig.pocColor,
        DEFAULT_CONFIG.volumeProfile.pocColor,
      ),
      pocY,
      pocPrice,
      left: profileRight - profileWidth,
      right: profileRight,
      top: mainPane.top,
      bottom: mainPane.top + mainPane.height,
      visibleBars: visibleCandles.length,
    };
  }

  function buildFixedRangeVolumeProfile(
    drawing: ChartDrawing,
    points: ScreenPoint[],
  ): VolumeProfileRender | null {
    const candleSeries = candleSeriesRef.current;
    const [a, b] = points;
    const profileConfig: VolumeProfileConfig = {
      ...DEFAULT_CONFIG.volumeProfile,
      ...config.volumeProfile,
    };

    if (!candleSeries || !a || !b || candlesRef.current.length === 0) {
      return null;
    }

    const startTime = Math.min(drawing.points[0].time, drawing.points[1].time);
    const endTime = Math.max(drawing.points[0].time, drawing.points[1].time);
    const timeCandles = candlesRef.current.filter(
      (candle) => candle.time >= startTime && candle.time <= endTime,
    );

    if (timeCandles.length < 1) return null;

    let lowest = Math.min(drawing.points[0].price, drawing.points[1].price);
    let highest = Math.max(drawing.points[0].price, drawing.points[1].price);

    if (!Number.isFinite(lowest) || !Number.isFinite(highest) || highest <= lowest) {
      lowest = Math.min(...timeCandles.map((candle) => candle.low));
      highest = Math.max(...timeCandles.map((candle) => candle.high));
    }

    if (!Number.isFinite(lowest) || !Number.isFinite(highest) || highest <= lowest) {
      return null;
    }

    const limitedTimeCandles = timeCandles.slice(
      -getFixedVolumeProfileCandleLimit(drawing),
    );
    const selectedCandles = limitedTimeCandles.filter(
      (candle) => candle.high >= lowest && candle.low <= highest,
    );

    if (selectedCandles.length < 1) return null;

    const rowCount = getFixedVolumeProfileRows(drawing);
    const priceStep = (highest - lowest) / rowCount;
    const volumeBins = Array.from({ length: rowCount }, () => ({
      buy: 0,
      sell: 0,
    }));

    selectedCandles.forEach((candle) => {
      const candleLow = Math.max(lowest, candle.low);
      const candleHigh = Math.min(highest, candle.high);
      const candleRange = Math.max(0, candle.high - candle.low);
      const clippedRange = Math.max(priceStep, candleHigh - candleLow);
      const buyRatio =
        candleRange > 0
          ? Math.max(0, Math.min(1, (candle.close - candle.low) / candleRange))
          : candle.close >= candle.open
            ? 0.65
            : 0.35;
      const startBin = Math.max(
        0,
        Math.min(rowCount - 1, Math.floor((candleLow - lowest) / priceStep)),
      );
      const endBin = Math.max(
        startBin,
        Math.min(rowCount - 1, Math.floor((candleHigh - lowest) / priceStep)),
      );

      for (let index = startBin; index <= endBin; index += 1) {
        const binLow = lowest + index * priceStep;
        const binHigh = binLow + priceStep;
        const overlap = Math.max(
          0,
          Math.min(candleHigh, binHigh) - Math.max(candleLow, binLow),
        );
        const weight =
          candleHigh > candleLow
            ? overlap / clippedRange
            : index === startBin
              ? 1
              : 0;
        const volumeShare = candle.volume * weight;
        if (!Number.isFinite(volumeShare) || volumeShare <= 0) continue;
        volumeBins[index].buy += volumeShare * buyRatio;
        volumeBins[index].sell += volumeShare * (1 - buyRatio);
      }
    });

    const totals = volumeBins.map((bin) => bin.buy + bin.sell);
    const maxVolume = Math.max(...totals);
    if (!Number.isFinite(maxVolume) || maxVolume <= 0) return null;

    const pocIndex = totals.indexOf(maxVolume);
    const valueArea = getValueAreaRange(totals, pocIndex);
    const selectionLeft = Math.max(0, Math.min(a.x, b.x));
    const selectionRight = Math.min(overlayWidth, Math.max(a.x, b.x));
    const selectionWidth = Math.max(1, selectionRight - selectionLeft);
    const yHigh = candleSeries.priceToCoordinate(highest);
    const yLow = candleSeries.priceToCoordinate(lowest);
    const selectionTop = yHigh === null || yLow === null
      ? Math.min(a.y, b.y)
      : Math.min(yHigh, yLow);
    const selectionBottom = yHigh === null || yLow === null
      ? Math.max(a.y, b.y)
      : Math.max(yHigh, yLow);
    const profileWidth = Math.max(
      24,
      Math.min(
        selectionWidth,
        (selectionWidth * getFixedVolumeProfileWidthPercent(drawing)) / 100,
      ),
    );
    const profileLeft = selectionLeft + 2;
    const profileRight = profileLeft + profileWidth;
    const barGap = rowCount > 220 ? 0 : 1;

    const bins = volumeBins
      .map((bin, index): VolumeProfileBinRender | null => {
        const priceLow = lowest + index * priceStep;
        const priceHigh = priceLow + priceStep;
        const binYHigh = candleSeries.priceToCoordinate(priceHigh);
        const binYLow = candleSeries.priceToCoordinate(priceLow);
        if (binYHigh === null || binYLow === null) return null;

        const y = Math.min(binYHigh, binYLow);
        const height = Math.max(1, Math.abs(binYLow - binYHigh) - barGap);
        if (y > selectionBottom || y + height < selectionTop) return null;

        const volume = bin.buy + bin.sell;
        const totalWidth = Math.max(1, (volume / maxVolume) * profileWidth);
        const buyWidth = volume > 0 ? (bin.buy / volume) * totalWidth : 0;
        const sellWidth = totalWidth - buyWidth;

        return {
          y,
          height,
          buyWidth,
          sellWidth,
          totalWidth,
          volume,
          buyVolume: bin.buy,
          sellVolume: bin.sell,
          inValueArea: valueArea.indices.has(index),
        };
      })
      .filter((bin): bin is VolumeProfileBinRender => bin !== null);

    if (bins.length === 0) return null;

    const pocPrice = lowest + (pocIndex + 0.5) * priceStep;
    const pocY = candleSeries.priceToCoordinate(pocPrice);
    if (pocY === null) return null;
    const vahPrice = lowest + (valueArea.high + 1) * priceStep;
    const valPrice = lowest + valueArea.low * priceStep;
    const vahY = candleSeries.priceToCoordinate(vahPrice);
    const valY = candleSeries.priceToCoordinate(valPrice);

    return {
      bins,
      opacity: Math.max(
        0.1,
        Math.min(1, (drawing.fillOpacity ?? profileConfig.opacity) / 100),
      ),
      buyColor: normalizeProfileColor(
        getFixedVolumeProfileBuyColor(drawing),
        FIXED_VOLUME_PROFILE_BUY_COLOR,
      ),
      sellColor: normalizeProfileColor(
        getFixedVolumeProfileSellColor(drawing),
        FIXED_VOLUME_PROFILE_SELL_COLOR,
      ),
      pocColor: normalizeProfileColor(
        getFixedVolumeProfilePocColor(drawing),
        FIXED_VOLUME_PROFILE_SELL_COLOR,
      ),
      pocY,
      pocPrice,
      vahY: vahY ?? undefined,
      vahPrice,
      valY: valY ?? undefined,
      valPrice,
      left: profileLeft,
      right: profileRight,
      top: selectionTop,
      bottom: selectionBottom,
      visibleBars: selectedCandles.length,
    };
  }

  // Load historical data + subscribe live
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;
    let isLoading = false;
    const isCrypto = isCryptoSymbol(symbol);
    const usesMarketTickerPolling =
      isCapitalMarketSymbol(symbol) || isMainIndexSymbol(symbol);
    const marketPollInterval = getMarketPollIntervalMs(symbol);
    hasMoreOlderRef.current = true;
    loadingOlderRef.current = false;

    function applyCandles(klines: Candle[], fitContent = false) {
      const validKlines = normalizeCandles(klines);
      candlesRef.current = validKlines;
      setCandleVersion((version) => version + 1);
      if (candleSeriesRef.current) {
        candleSeriesRef.current.setData(
          validKlines.map((k) => ({
            time: k.time as UTCTimestamp,
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
          })),
        );
      }
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(
          validKlines.map((k) => ({
            time: k.time as UTCTimestamp,
            value: k.volume,
            color:
              k.close >= k.open
                ? `${TV_COLORS.green}66`
                : `${TV_COLORS.red}66`,
          })),
        );
      }
      if (validKlines.length > 0) {
        updateEMAs();
        updateEmaCross();
        updateRSI();
        updateMACD();
        updateSqzAdxTtm();
      } else {
        clearIndicatorSeries();
      }
      if (fitContent) {
        chartRef.current?.timeScale().fitContent();
        requestAnimationFrame(() => {
          chartRef.current?.timeScale().fitContent();
        });
      }
      requestAnimationFrame(() => recomputePaneOffsets());

      if (validKlines.length > 0) {
        const last = validKlines[validKlines.length - 1];
        const prev = validKlines[validKlines.length - 2] ?? last;
        updateCurrentPriceColor(last);
        setLastPrice({
          value: last.close,
          pct:
            prev.close === 0
              ? 0
              : ((last.close - prev.close) / prev.close) * 100,
        });
      } else {
        setLastPrice(null);
        setLastValues({});
      }

      return validKlines;
    }

    async function load({
      fitContent = false,
      clearOnError = false,
      limit = HISTORY_LIMIT_BY_TIMEFRAME[timeframe],
      forcePersist = true,
      mergeWithExisting = false,
    }: {
      fitContent?: boolean;
      clearOnError?: boolean;
      limit?: number;
      forcePersist?: boolean;
      mergeWithExisting?: boolean;
    } = {}) {
      if (isLoading) return;
      isLoading = true;

      try {
        const klines = await fetchKlines(
          symbol,
          timeframe,
          limit,
        );
        if (cancelled) return;

        if (
          klines.length === 0 &&
          candlesRef.current.length > 0 &&
          !clearOnError
        ) {
          return;
        }

        const nextKlines =
          mergeWithExisting && candlesRef.current.length > 0
            ? normalizeCandles([...candlesRef.current, ...klines])
            : klines;
        const validKlines = applyCandles(nextKlines, fitContent);
        writeCandleCache(symbol, timeframe, validKlines, { forcePersist });

        if (isCrypto) {
          const ws = getBinanceWS();
          unsub = ws.subscribeKline({
            symbol,
            interval: timeframe,
            onCandle: (k) => {
              if (!candleSeriesRef.current) return;
              const arr = candlesRef.current;
              const lastCandle = arr[arr.length - 1];
              if (!isValidCandle(k)) {
                return;
              }
              if (lastCandle && lastCandle.time === k.time) {
                arr[arr.length - 1] = k;
              } else if (!lastCandle || k.time > lastCandle.time) {
                arr.push(k);
                if (arr.length > CANDLE_CACHE_MAX_CANDLES) arr.shift();
              } else {
                return;
              }
              candleSeriesRef.current.update({
                time: k.time as UTCTimestamp,
                open: k.open,
                high: k.high,
                low: k.low,
                close: k.close,
              });
              if (volumeSeriesRef.current) {
                volumeSeriesRef.current.update({
                  time: k.time as UTCTimestamp,
                  value: k.volume,
                  color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
                });
              }
              updateCurrentPriceColor(k);
              setCandleVersion((version) => version + 1);
              updateEMAs();
              updateEmaCross();
              updateRSI();
              updateMACD();
              updateSqzAdxTtm();
              const prev = arr[arr.length - 2] ?? lastCandle;
              setLastPrice({
                value: k.close,
                pct: prev && prev.close !== 0 ? ((k.close - prev.close) / prev.close) * 100 : 0,
              });
              writeCandleCache(symbol, timeframe, arr);
            },
          });
        }
      } catch {
        if (cancelled || (!clearOnError && candlesRef.current.length > 0)) {
          return;
        }
        candlesRef.current = [];
        setCandleVersion((version) => version + 1);
        candleSeriesRef.current?.setData([]);
        volumeSeriesRef.current?.setData([]);
        clearIndicatorSeries();
        setLastPrice(null);
      } finally {
        isLoading = false;
      }
    }

    async function loadLiveTicker() {
      try {
        const ticker = await fetchTicker24h(symbol);
        if (cancelled || ticker.lastPrice <= 0 || !candleSeriesRef.current) {
          return;
        }

        const arr = candlesRef.current;
        const lastCandle = arr[arr.length - 1];
        const step = TIMEFRAME_SECONDS[timeframe] || 60;
        const now = Math.floor(Date.now() / 1000);
        const bucketTime =
          timeframe === "1M"
            ? lastCandle?.time ?? now
            : Math.floor(now / step) * step;
        let nextCandle: Candle;

        if (!lastCandle) {
          nextCandle = {
            time: bucketTime,
            open: ticker.lastPrice,
            high: ticker.lastPrice,
            low: ticker.lastPrice,
            close: ticker.lastPrice,
            volume: 0,
            isFinal: false,
          };
          arr.push(nextCandle);
        } else if (bucketTime > lastCandle.time) {
          nextCandle = {
            time: bucketTime,
            open: lastCandle.close,
            high: Math.max(lastCandle.close, ticker.lastPrice),
            low: Math.min(lastCandle.close, ticker.lastPrice),
            close: ticker.lastPrice,
            volume: 0,
            isFinal: false,
          };
          arr.push(nextCandle);
          if (arr.length > CANDLE_CACHE_MAX_CANDLES) arr.shift();
        } else {
          nextCandle = {
            ...lastCandle,
            high: Math.max(lastCandle.high, ticker.lastPrice),
            low: Math.min(lastCandle.low, ticker.lastPrice),
            close: ticker.lastPrice,
            isFinal: false,
          };
          arr[arr.length - 1] = nextCandle;
        }

        candleSeriesRef.current.update({
          time: nextCandle.time as UTCTimestamp,
          open: nextCandle.open,
          high: nextCandle.high,
          low: nextCandle.low,
          close: nextCandle.close,
        });
        volumeSeriesRef.current?.update({
          time: nextCandle.time as UTCTimestamp,
          value: nextCandle.volume,
          color:
            nextCandle.close >= nextCandle.open
              ? `${TV_COLORS.green}66`
              : `${TV_COLORS.red}66`,
        });
        updateCurrentPriceColor(nextCandle);
        setCandleVersion((version) => version + 1);
        updateEMAs();
        updateEmaCross();
        updateRSI();
        updateMACD();
        updateSqzAdxTtm();
        setLastPrice({
          value: ticker.lastPrice,
          pct: ticker.priceChangePercent,
        });
        writeCandleCache(symbol, timeframe, arr);
      } catch {
        return;
      }
    }

    async function loadOlderHistory() {
      if (
        loadingOlderRef.current ||
        !hasMoreOlderRef.current ||
        candlesRef.current.length === 0
      ) {
        return;
      }

      const firstCandle = candlesRef.current[0];
      loadingOlderRef.current = true;

      try {
        const olderCandles = await fetchKlines(
          symbol,
          timeframe,
          OLDER_HISTORY_PAGE_SIZE_BY_TIMEFRAME[timeframe],
          firstCandle.time,
        );
        if (cancelled || olderCandles.length === 0) {
          hasMoreOlderRef.current = false;
          return;
        }

        const validOlderCandles = normalizeCandles(olderCandles).filter(
          (candle) => candle.time < firstCandle.time,
        );
        if (validOlderCandles.length === 0) {
          hasMoreOlderRef.current = false;
          return;
        }

        const existingTimes = new Set(candlesRef.current.map((candle) => candle.time));
        const uniqueOlderCandles = validOlderCandles.filter(
          (candle) => !existingTimes.has(candle.time),
        );

        if (uniqueOlderCandles.length === 0) {
          hasMoreOlderRef.current = false;
          return;
        }

        const nextCandles = normalizeCandles([
          ...uniqueOlderCandles,
          ...candlesRef.current,
        ]);
        const previousVisibleRange = chartRef.current
          ?.timeScale()
          .getVisibleLogicalRange();
        const validNextCandles = applyCandles(nextCandles, false);
        writeCandleCache(symbol, timeframe, validNextCandles);

        if (previousVisibleRange) {
          const shift = uniqueOlderCandles.length;
          chartRef.current?.timeScale().setVisibleLogicalRange({
            from: previousVisibleRange.from + shift,
            to: previousVisibleRange.to + shift,
          });
        }

        if (
          isCrypto &&
          olderCandles.length < OLDER_HISTORY_PAGE_SIZE_BY_TIMEFRAME[timeframe]
        ) {
          hasMoreOlderRef.current = false;
        }
      } catch {
        return;
      } finally {
        loadingOlderRef.current = false;
      }
    }

    loadOlderRef.current = loadOlderHistory;

    const cachedCandles = readMemoryCandleCache(symbol, timeframe);
    if (cachedCandles && cachedCandles.length > 0) {
      applyCandles(cachedCandles, true);
      void load({
        fitContent: false,
        clearOnError: false,
        mergeWithExisting: true,
      });
    } else if (isPersistentCacheTimeframe(timeframe)) {
      void (async () => {
        const persistentCandles = await readPersistentCandleCache(
          symbol,
          timeframe,
        );
        if (cancelled) return;

        if (persistentCandles && persistentCandles.length > 0) {
          applyCandles(persistentCandles, true);
          writeCandleCache(symbol, timeframe, persistentCandles);
          void load({
            fitContent: false,
            clearOnError: false,
            mergeWithExisting: true,
          });
        } else {
          void load({ fitContent: true, clearOnError: true });
        }
      })();
    } else {
      void load({ fitContent: true, clearOnError: true });
    }
    const pollId = window.setInterval(
      () => {
        if (isCrypto || !isCryptoSymbol(symbol)) {
          void loadLiveTicker();
        } else {
          void load({ mergeWithExisting: true });
        }
      },
      usesMarketTickerPolling ? marketPollInterval : MARKET_POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      loadOlderRef.current = null;
      if (pollId !== null) window.clearInterval(pollId);
      if (unsub) unsub();
    };
  }, [symbol, timeframe]);

  const greenOrRed = (n: number) =>
    n >= 0 ? "text-tv-green" : "text-tv-red";

  // Helpers for pill rendering
  const isShown = (key: IndicatorKey) =>
    indicators[key] && (key === "volume" || true); // always renderable if enabled
  void isShown;

  // Determine which pane each indicator lives in (based on current layout)
  const rsiPaneIdx = 1;
  const macdPaneIdx = indicators.rsi ? 2 : 1;
  const sqzAdxTtmPaneIdx =
    1 + (indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0);
  const rsiPane = paneOffsets[rsiPaneIdx];
  const rsi70Y = rsiRef.current?.priceToCoordinate(70) ?? null;
  const rsi30Y = rsiRef.current?.priceToCoordinate(30) ?? null;
  const emaCrossLines = getEmaCrossLines(config.emaCross);
  const emaCrossFill = buildEmaCrossFill();
  const volumeProfile = useMemo(
    () => buildVisibleRangeVolumeProfile(),
    [
      candleVersion,
      config.volumeProfile,
      hidden.volumeProfile,
      indicators.volumeProfile,
      paneOffsets,
      renderTick,
    ],
  );
  const lastCandle = candlesRef.current.at(-1);
  const previousCandle = candlesRef.current.at(-2);
  const candleCountdown = getCandleCountdown(
    timeframe,
    lastCandle?.time,
    previousCandle?.time,
    clockTimestamp,
  );
  const currentPriceY =
    lastPrice && candleSeriesRef.current
      ? candleSeriesRef.current.priceToCoordinate(lastPrice.value)
      : null;
  const mainPaneTop = paneOffsets[0]?.top ?? 0;
  const mainPaneHeight = paneOffsets[0]?.height;
  const countdownTop =
    candleCountdown && currentPriceY !== null
      ? mainPaneHeight
        ? Math.max(
            mainPaneTop + 4,
            Math.min(currentPriceY + 12, mainPaneTop + mainPaneHeight - 18),
          )
        : currentPriceY + 12
      : null;
  const overlayWidth = containerRef.current?.clientWidth ?? 0;
  const overlayHeight = containerRef.current?.clientHeight ?? 0;
  const mainPaneBottom = mainPaneTop + (mainPaneHeight ?? overlayHeight);
  const drawingsForSymbol = useMemo(
    () => drawings.filter((drawing) => drawing.symbol === symbol),
    [drawings, symbol],
  );
  const selectedDrawing =
    selectedDrawingId === null
      ? null
      : (drawingsForSymbol.find((drawing) => drawing.id === selectedDrawingId) ?? null);
  const selectedFibonacciLevels =
    selectedDrawing?.kind === "fibRetracement"
      ? getFibonacciLevels(selectedDrawing)
      : [];
  const draftDrawing = useMemo<ChartDrawing | null>(() => {
    if (!drawingDraft) return null;

    return {
      id: "draft-drawing",
      symbol,
      kind: drawingDraft.kind,
      points:
        drawingPreviewPoint &&
        drawingDraft.points.length < DRAWING_POINT_REQUIREMENTS[drawingDraft.kind]
          ? [...drawingDraft.points, drawingPreviewPoint]
          : drawingDraft.points,
      color: TV_COLORS.yellow,
      locked: false,
    };
  }, [drawingDraft, drawingPreviewPoint, symbol]);

  const projectedDrawings = useMemo(() => {
    return [...drawingsForSymbol, ...(draftDrawing ? [draftDrawing] : [])]
      .map((drawing) => {
      const chart = chartRef.current;
      const candleSeries = candleSeriesRef.current;
      if (!chart || !candleSeries) return null;
      const points = drawing.points
        .map((point): ScreenPoint | null => {
          const x = timeToCoordinateSafe(point.time);
          const y = candleSeries.priceToCoordinate(point.price);

          if (x === null || y === null) return null;
          return { ...point, x, y };
        })
        .filter((point): point is ScreenPoint => point !== null);

      return points.length > 0 ? { drawing, points } : null;
    })
      .filter(
        (item): item is { drawing: ChartDrawing; points: ScreenPoint[] } =>
          item !== null,
      );
  }, [
    candleVersion,
    draftDrawing,
    drawingsForSymbol,
    paneOffsets,
    renderTick,
    timeframe,
  ]);
  const swingMarkers =
    indicators.swingPatterns && !hidden.swingPatterns
      ? getSwingPatternMarkers(
          candlesRef.current,
          Math.max(2, Math.min(100, config.swingPatterns.length)),
        )
          .map((marker) => {
            const x = timeToCoordinateSafe(marker.time);
            const y = candleSeriesRef.current?.priceToCoordinate(marker.price);
            return x === null || y === null || y === undefined
              ? null
              : { ...marker, x, y: Number(y) };
          })
          .filter(
            (
              marker,
            ): marker is SwingPatternMarker & { x: number; y: number } =>
              marker !== null,
          )
      : [];
  const rsiDivergenceMarkers =
    indicators.rsi &&
    !hidden.rsi &&
    config.rsiSettings.calculateDivergence &&
    rsiRef.current
          ? detectRsiDivergences(
          candlesRef.current,
          rsi(candlesRef.current, config.rsi),
        )
          .map((marker) => {
            const x = timeToCoordinateSafe(marker.time);
            const y = rsiRef.current?.priceToCoordinate(marker.value);
            const previousX = timeToCoordinateSafe(marker.previousTime);
            const previousY = rsiRef.current?.priceToCoordinate(
              marker.previousValue,
            );
            return x === null ||
              y === null ||
              y === undefined ||
              previousX === null ||
              previousY === null ||
              previousY === undefined ||
              !rsiPane
              ? null
              : {
                  ...marker,
                  x,
                  y: rsiPane.top + Number(y),
                  previousX,
                  previousY: rsiPane.top + Number(previousY),
                };
          })
          .filter(
            (
              marker,
            ): marker is RsiDivergenceMarker & {
              x: number;
              y: number;
              previousX: number;
              previousY: number;
            } =>
              marker !== null,
          )
      : [];
  const rsiZoneFills: RsiZoneFill[] = (() => {
    if (!indicators.rsi || hidden.rsi || !rsiRef.current || !rsiPane) return [];

    const overboughtBase = rsiRef.current.priceToCoordinate(70);
    const oversoldBase = rsiRef.current.priceToCoordinate(30);
    if (overboughtBase === null || oversoldBase === null) return [];

    const points = rsi(candlesRef.current, config.rsi)
      .map((point) => {
        const x = timeToCoordinateSafe(point.time);
        const y = rsiRef.current?.priceToCoordinate(point.value);
        return x === null || y === null || y === undefined
          ? null
          : { x, y: rsiPane.top + Number(y), value: point.value };
      })
      .filter(
        (point): point is { x: number; y: number; value: number } =>
          point !== null,
      );

    const build = (
      baseline: number,
      kind: RsiZoneFill["kind"],
      test: (value: number) => boolean,
    ) => {
      const fills: RsiZoneFill[] = [];
      let segment: { x: number; y: number; value: number }[] = [];
      const flush = () => {
        if (segment.length < 2) {
          segment = [];
          return;
        }

        const baseY = rsiPane.top + baseline;
        const first = segment[0];
        const last = segment[segment.length - 1];
        const line = segment
          .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
          .join(" ");
        fills.push({
          path: `M ${first.x.toFixed(2)} ${baseY.toFixed(2)} ${line} L ${last.x.toFixed(2)} ${baseY.toFixed(2)} Z`,
          kind,
        });
        segment = [];
      };

      points.forEach((point) => {
        if (test(point.value)) {
          segment.push(point);
        } else {
          flush();
        }
      });
      flush();

      return fills;
    };

    return [
      ...build(overboughtBase, "overbought", (value) => value >= 70),
      ...build(oversoldBase, "oversold", (value) => value <= 30),
    ];
  })();
  const pmRangeLastConfirmedTime =
    candlesRef.current
      .slice()
      .reverse()
      .find((candle) => candle.isFinal !== false)?.time ?? 0;
  const pmRangeDataKey = [
    candlesRef.current[0]?.time ?? 0,
    pmRangeLastConfirmedTime,
    candlesRef.current.length,
  ].join("|");
  const pmRangeOverlay = useMemo(() => {
    if (!indicators.pmRangeBreakout || hidden.pmRangeBreakout) return null;
    const source = candlesRef.current;
    const limit = getPmRangeCandleLimit(config.pmRangeBreakout, timeframe);
    const candles =
      source.length > limit
        ? source.slice(-limit)
        : source;

    return computePmRangeBreakoutOverlay(
      candles,
      config.pmRangeBreakout,
      TIMEFRAME_SECONDS[timeframe] || 60,
    );
  }, [
    config.pmRangeBreakout,
    hidden.pmRangeBreakout,
    indicators.pmRangeBreakout,
    pmRangeDataKey,
    timeframe,
  ]);

  function projectTimePrice(time: number, price: number) {
    const x = timeToCoordinateSafe(time);
    const y = candleSeriesRef.current?.priceToCoordinate(price);
    return x === null || y === null || y === undefined ? null : { x, y: Number(y) };
  }

  function getPmLabelAnchor(direction: PmOverlayLabel["direction"]) {
    if (direction === "left") return "start";
    if (direction === "up") return "middle";
    return "middle";
  }

  function isPmTradeLabel(text: string) {
    return (
      text.includes("RUPTURA") ||
      text.includes(" LONG") ||
      text.includes(" SHORT") ||
      text.includes("TRADE NULO") ||
      text.includes("ANULADO")
    );
  }

  function renderPmEmaPolyline(
    points: { time: number; value: number }[],
    color: string,
    key: string,
  ) {
    if (points.length < 2) return null;
    const projected = points
      .map((point) => projectTimePrice(point.time, point.value))
      .filter((point): point is { x: number; y: number } => point !== null)
      .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(" ");

    if (!projected) return null;

    return (
      <polyline
        key={key}
        points={projected}
        fill="none"
        stroke={color}
        strokeWidth={1}
        className="pointer-events-none"
      />
    );
  }

  function updateSelectedDrawingColor(color: string) {
    if (!selectedDrawing || selectedDrawing.locked) return;
    const normalizedColor = normalizeColor(color);
    updateDrawing(
      selectedDrawing.id,
      isChannelDrawing(selectedDrawing)
        ? {
            color: normalizedColor,
            borderColor: normalizedColor,
            centerColor: selectedDrawing.centerColor ?? normalizedColor,
          }
        : { color: normalizedColor },
    );
  }

  function updateSelectedDrawingBorderColor(color: string) {
    if (!selectedDrawing || selectedDrawing.locked) return;
    updateDrawing(selectedDrawing.id, { borderColor: normalizeColor(color) });
  }

  function updateSelectedDrawingCenterColor(color: string) {
    if (!selectedDrawing || selectedDrawing.locked) return;
    updateDrawing(selectedDrawing.id, { centerColor: normalizeColor(color) });
  }

  function updateSelectedDrawingFillOpacity(value: string) {
    if (!selectedDrawing || selectedDrawing.locked) return;
    const fillOpacity = Number(value);
    if (!Number.isFinite(fillOpacity)) return;
    updateDrawing(selectedDrawing.id, {
      fillOpacity: Math.max(0, Math.min(100, fillOpacity)),
    });
  }

  function updateSelectedDrawingBorderOpacity(value: string) {
    if (!selectedDrawing || selectedDrawing.locked) return;
    const borderOpacity = Number(value);
    if (!Number.isFinite(borderOpacity)) return;
    updateDrawing(selectedDrawing.id, {
      borderOpacity: Math.max(0, Math.min(100, borderOpacity)),
    });
  }

  function updateSelectedDrawingLineLength(value: string) {
    if (!selectedDrawing || selectedDrawing.locked || !isFibonacciDrawing(selectedDrawing)) {
      return;
    }
    const lineLengthPercent = Number(value);
    if (!Number.isFinite(lineLengthPercent)) return;
    updateDrawing(selectedDrawing.id, {
      lineLengthPercent: Math.max(10, Math.min(100, lineLengthPercent)),
    });
  }

  function updateSelectedFixedVolumeProfileRows(value: string) {
    if (
      !selectedDrawing ||
      selectedDrawing.locked ||
      selectedDrawing.kind !== "fixedVolumeProfile"
    ) {
      return;
    }

    const rows = Number(value);
    if (!Number.isFinite(rows)) return;
    updateDrawing(selectedDrawing.id, {
      fixedVolumeProfileRows: Math.max(12, Math.min(1000, Math.round(rows))),
    });
  }

  function updateSelectedFixedVolumeProfileWidth(value: string) {
    if (
      !selectedDrawing ||
      selectedDrawing.locked ||
      selectedDrawing.kind !== "fixedVolumeProfile"
    ) {
      return;
    }

    const widthPct = Number(value);
    if (!Number.isFinite(widthPct)) return;
    updateDrawing(selectedDrawing.id, {
      lineLengthPercent: Math.max(12, Math.min(60, Math.round(widthPct))),
    });
  }

  function updateSelectedFixedVolumeProfileCandleLimit(value: string) {
    if (
      !selectedDrawing ||
      selectedDrawing.locked ||
      selectedDrawing.kind !== "fixedVolumeProfile"
    ) {
      return;
    }

    const candleLimit = Number(value);
    if (!Number.isFinite(candleLimit)) return;
    updateDrawing(selectedDrawing.id, {
      fixedVolumeProfileCandleLimit: Math.max(
        1,
        Math.min(1000, Math.round(candleLimit)),
      ),
    });
  }

  function updateSelectedFixedVolumeProfileColor(
    field: "buy" | "sell" | "poc",
    color: string,
  ) {
    if (
      !selectedDrawing ||
      selectedDrawing.locked ||
      selectedDrawing.kind !== "fixedVolumeProfile"
    ) {
      return;
    }

    const normalizedColor = normalizeProfileColor(
      color,
      field === "buy"
        ? FIXED_VOLUME_PROFILE_BUY_COLOR
        : field === "sell"
          ? FIXED_VOLUME_PROFILE_SELL_COLOR
          : FIXED_VOLUME_PROFILE_SELL_COLOR,
    );

    updateDrawing(
      selectedDrawing.id,
      field === "buy"
        ? { fixedVolumeProfileBuyColor: normalizedColor }
        : field === "sell"
          ? { fixedVolumeProfileSellColor: normalizedColor }
          : { fixedVolumeProfilePocColor: normalizedColor },
    );
  }

  function updateSelectedFibonacciTrendLine(enabled: boolean) {
    if (!selectedDrawing || selectedDrawing.locked || selectedDrawing.kind !== "fibRetracement") {
      return;
    }

    updateDrawing(selectedDrawing.id, { showTrendLine: enabled });
  }

  function updateSelectedFibonacciLevel(
    index: number,
    patch: Partial<FibonacciLevelConfig>,
  ) {
    if (!selectedDrawing || selectedDrawing.locked || selectedDrawing.kind !== "fibRetracement") {
      return;
    }

    const fibonacciLevels = getFibonacciLevels(selectedDrawing).map((level, levelIndex) =>
      levelIndex === index
        ? {
            ...level,
            ...patch,
            value:
              patch.value !== undefined && Number.isFinite(patch.value)
                ? patch.value
                : level.value,
            color: normalizeColor(patch.color ?? level.color),
          }
        : level,
    );

    updateDrawing(selectedDrawing.id, { fibonacciLevels });
  }

  function updateSelectedDrawingValue(value: string) {
    if (!selectedDrawing || selectedDrawing.locked) return;
    const price = Number(value);
    if (!Number.isFinite(price)) return;

    updateDrawing(selectedDrawing.id, {
      points: selectedDrawing.points.map((point, index) =>
        index === 0 ? { ...point, price } : point,
      ),
    });
  }

  function deleteSelectedDrawing() {
    if (!selectedDrawing) return;
    removeDrawing(selectedDrawing.id);
    setSelectedDrawingId(null);
  }

  function toggleSelectedDrawingLock() {
    if (!selectedDrawing) return;
    updateDrawing(selectedDrawing.id, { locked: !selectedDrawing.locked });
  }

  function selectDrawing(
    drawing: ChartDrawing,
    event: ReactMouseEvent,
  ) {
    if (drawing.id === "draft-drawing") return;
    event.stopPropagation();
    setSelectedDrawingId(drawing.id);
  }

  function isChannelDrawing(drawing: ChartDrawing) {
    return (
      drawing.kind === "parallelChannel" ||
      drawing.kind === "regressionTrend" ||
      drawing.kind === "flatTopBottom" ||
      drawing.kind === "disjointChannel"
    );
  }

  function hasFillOpacityControl(drawing: ChartDrawing) {
    return (
      isChannelDrawing(drawing) ||
      drawing.kind === "fixedVolumeProfile" ||
      drawing.kind === "rectangle" ||
      drawing.kind === "rotatedRectangle" ||
      drawing.kind === "circle" ||
      drawing.kind === "ellipse" ||
      drawing.kind === "triangle"
    );
  }

  function isFibonacciDrawing(drawing: ChartDrawing) {
    return drawing.kind === "fibRetracement" || drawing.kind === "fibExtension";
  }

  function renderLine(
    key: string,
    drawing: ChartDrawing,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: { dashed?: boolean; color?: string; opacity?: number; width?: number } = {},
  ) {
    const isDraft = drawing.id === "draft-drawing";
    const isSelected = drawing.id === selectedDrawingId;
    const color = normalizeColor(options.color ?? drawing.color);

    return (
      <g key={key}>
        {!isDraft && (
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="transparent"
            strokeWidth={12}
            strokeLinecap="round"
            className={`pointer-events-auto ${drawing.locked ? "cursor-pointer" : "cursor-move"}`}
            onMouseDown={(event) => handleDrawingMouseDown(drawing, event)}
          />
        )}
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={isSelected ? TV_COLORS.yellow : color}
          strokeWidth={options.width ?? (isSelected ? 2 : 1.5)}
          strokeDasharray={isDraft || options.dashed ? "5 5" : undefined}
          strokeLinecap="round"
          opacity={
            (drawing.locked ? 0.65 : 1) *
            (options.opacity ?? getDrawingStrokeOpacity(drawing))
          }
          className="pointer-events-none"
        />
      </g>
    );
  }

  function renderMeasureRange(drawing: ChartDrawing, points: ScreenPoint[], key: string) {
    const [a, b] = points;
    if (!a || !b) return null;

    const priceDiff = drawing.points[1]?.price - drawing.points[0]?.price;
    const pctChange =
      drawing.points[0]?.price === 0
        ? 0
        : (priceDiff / drawing.points[0].price) * 100;
    const isUp = priceDiff >= 0;
    const color = isUp ? TV_COLORS.green : TV_COLORS.red;
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const centerX = (a.x + b.x) / 2;
    const centerY = (a.y + b.y) / 2;
    const start = Math.min(drawing.points[0].time, drawing.points[1].time);
    const end = Math.max(drawing.points[0].time, drawing.points[1].time);
    const bars = countBarsInRange(candlesRef.current, start, end);
    const duration = durationLabel(drawing.points[0].time, drawing.points[1].time);
    const sign = priceDiff >= 0 ? "+" : "";
    const pctSign = pctChange >= 0 ? "+" : "";
    const labelWidth = 146;
    const labelX = Math.max(8, centerX - labelWidth / 2);
    const labelY = bottom + 10;
    const markerId = `measure-range-arrow-${drawing.id}`;

    return (
      <g key={key}>
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        </defs>
        <rect
          x={left}
          y={top}
          width={width}
          height={height}
          fill={color}
          fillOpacity={drawing.locked ? 0.1 : 0.16}
          stroke={drawing.id === selectedDrawingId ? TV_COLORS.yellow : color}
          strokeWidth={drawing.id === selectedDrawingId ? 2 : 1}
          className="pointer-events-none"
        />
        <line
          x1={left}
          x2={right}
          y1={centerY}
          y2={centerY}
          stroke={color}
          strokeWidth={1}
          markerEnd={`url(#${markerId})`}
          className="pointer-events-none"
        />
        <line
          x1={centerX}
          x2={centerX}
          y1={top}
          y2={bottom}
          stroke={color}
          strokeWidth={1}
          markerEnd={`url(#${markerId})`}
          className="pointer-events-none"
        />
        <rect
          x={left}
          y={top}
          width={width}
          height={height}
          fill="transparent"
          className={`pointer-events-auto ${drawing.locked ? "cursor-pointer" : "cursor-move"}`}
          onMouseDown={(event) => handleDrawingMouseDown(drawing, event)}
          onClick={(event) => selectDrawing(drawing, event)}
        />
        <foreignObject
          x={labelX}
          y={labelY}
          width={labelWidth}
          height={52}
          className="pointer-events-none"
        >
          <div
            className="rounded px-2 py-1.5 text-center text-[11px] font-semibold leading-tight text-white shadow-md"
            style={{ backgroundColor: color }}
          >
            <div>
              {sign}
              {formatPrice(priceDiff)} ({pctSign}
              {pctChange.toFixed(2)}%)
            </div>
            <div className="mt-1">
              {bars} barras, {duration}
            </div>
          </div>
        </foreignObject>
        {/*
        <text
          x={centerX}
          y={labelY}
          fill="#ffffff"
          fontSize={11}
          fontWeight={600}
          textAnchor="middle"
          paintOrder="stroke"
          stroke={color}
          strokeWidth={4}
          className="pointer-events-none tabular-nums"
        >
          <tspan x={centerX}>
            {sign}
            {formatPrice(priceDiff)} ({pctSign}
            {pctChange.toFixed(2)}%)
          </tspan>
          <tspan x={centerX} dy={13}>
            {inRange.length} barras · {duration} · Vol {formatVolume(volume)}
          </tspan>
        </text>
        */}
        {renderPointHandles(drawing, points)}
      </g>
    );
  }

  function renderPointHandles(drawing: ChartDrawing, points: ScreenPoint[]) {
    const visible = drawing.id === "draft-drawing" || drawing.id === selectedDrawingId;
    if (!visible) return null;
    const isDraft = drawing.id === "draft-drawing";

    return points.map((point, index) => (
      <circle
        key={`${drawing.id}-handle-${index}`}
        cx={point.x}
        cy={point.y}
        r={5}
        fill={TV_COLORS.bg}
        stroke={drawing.id === selectedDrawingId ? TV_COLORS.blue : normalizeColor(drawing.color)}
        strokeWidth={2}
        className={
          isDraft || drawing.locked
            ? "pointer-events-none"
            : "pointer-events-auto cursor-move"
        }
        onMouseDown={
          isDraft || drawing.locked
            ? undefined
            : (event) => handlePointMouseDown(drawing.id, index, event)
        }
      />
    ));
  }

  function renderParallelChannelEndHandle(
    drawing: ChartDrawing,
    point: { x: number; y: number },
  ) {
    if (
      drawing.kind !== "parallelChannel" ||
      drawing.id === "draft-drawing" ||
      drawing.id !== selectedDrawingId ||
      drawing.locked
    ) {
      return null;
    }

    return (
      <circle
        key={`${drawing.id}-handle-derived-end`}
        cx={point.x}
        cy={point.y}
        r={5}
        fill={TV_COLORS.bg}
        stroke={TV_COLORS.blue}
        strokeWidth={2}
        className="pointer-events-auto cursor-ew-resize"
        onMouseDown={(event) => handleParallelChannelEndMouseDown(drawing, event)}
      />
    );
  }

  function renderParallelChannelMidHandle(
    drawing: ChartDrawing,
    point: { x: number; y: number },
    line: "base" | "parallel",
  ) {
    if (
      drawing.kind !== "parallelChannel" ||
      drawing.id === "draft-drawing" ||
      drawing.id !== selectedDrawingId ||
      drawing.locked
    ) {
      return null;
    }

    return (
      <rect
        key={`${drawing.id}-mid-${line}`}
        x={point.x - 5}
        y={point.y - 5}
        width={10}
        height={10}
        rx={2}
        fill={TV_COLORS.bg}
        stroke={TV_COLORS.blue}
        strokeWidth={2}
        className="pointer-events-auto cursor-move"
        onMouseDown={(event) =>
          handleParallelChannelMidMouseDown(drawing, line, event)
        }
      />
    );
  }

  function getExtendedLine(a: ScreenPoint, b: ScreenPoint) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    if (Math.abs(dx) < 0.001) {
      return { x1: a.x, y1: mainPaneTop, x2: a.x, y2: mainPaneBottom };
    }

    const slope = dy / dx;
    return {
      x1: 0,
      y1: a.y + slope * (0 - a.x),
      x2: overlayWidth,
      y2: a.y + slope * (overlayWidth - a.x),
    };
  }

  function renderInfoText(drawing: ChartDrawing, a: ScreenPoint, b: ScreenPoint) {
    if (drawing.kind !== "infoLine" && drawing.kind !== "trendAngle") return null;

    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2 - 8;
    const priceDiff = b.price - a.price;
    const pct = a.price === 0 ? 0 : (priceDiff / a.price) * 100;
    const angle = Math.round((Math.atan2(a.y - b.y, b.x - a.x) * 180) / Math.PI);
    const text =
      drawing.kind === "trendAngle"
        ? `${angle} deg`
        : `${priceDiff >= 0 ? "+" : ""}${formatPrice(priceDiff)} (${pct.toFixed(2)}%)`;

    return (
      <text
        x={midX}
        y={midY}
        fill={normalizeColor(drawing.color)}
        opacity={getDrawingStrokeOpacity(drawing)}
        fontSize={10}
        paintOrder="stroke"
        stroke={TV_COLORS.bg}
        strokeWidth={3}
        textAnchor="middle"
      >
        {text}
      </text>
    );
  }

  function getArrowHead(a: ScreenPoint, b: ScreenPoint, size = 12) {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const left = angle + Math.PI * 0.82;
    const right = angle - Math.PI * 0.82;

    return `${b.x},${b.y} ${b.x + Math.cos(left) * size},${b.y + Math.sin(left) * size} ${b.x + Math.cos(right) * size},${b.y + Math.sin(right) * size}`;
  }

  function renderArrowShape(drawing: ChartDrawing, a: ScreenPoint, b: ScreenPoint) {
    const color = normalizeColor(drawing.color);
    const strokeOpacity = getDrawingStrokeOpacity(drawing);

    return (
      <g key={drawing.id}>
        {drawing.id !== "draft-drawing" && (
          <line
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="transparent"
            strokeWidth={18}
            strokeLinecap="round"
            className={`pointer-events-auto ${drawing.locked ? "cursor-pointer" : "cursor-move"}`}
            onMouseDown={(event) => handleDrawingMouseDown(drawing, event)}
            onClick={(event) => selectDrawing(drawing, event)}
          />
        )}
        {renderLine(`${drawing.id}-line`, drawing, a.x, a.y, b.x, b.y)}
        <polygon
          points={getArrowHead(a, b)}
          fill={color}
          opacity={strokeOpacity}
          className="pointer-events-none"
        />
        {renderPointHandles(drawing, [a, b])}
      </g>
    );
  }

  function renderSingleArrowMark(
    drawing: ChartDrawing,
    point: ScreenPoint,
    direction: "up" | "down",
  ) {
    const color = normalizeColor(drawing.color);
    const strokeOpacity = getDrawingStrokeOpacity(drawing);
    const sign = direction === "up" ? -1 : 1;
    const tipY = point.y + sign * 16;
    const shoulderY = point.y - sign * 2;
    const tailY = point.y - sign * 14;
    const pointsText =
      direction === "up"
        ? `${point.x},${tipY} ${point.x - 10},${shoulderY} ${point.x - 4},${shoulderY} ${point.x - 4},${tailY} ${point.x + 4},${tailY} ${point.x + 4},${shoulderY} ${point.x + 10},${shoulderY}`
        : `${point.x},${tipY} ${point.x - 10},${shoulderY} ${point.x - 4},${shoulderY} ${point.x - 4},${tailY} ${point.x + 4},${tailY} ${point.x + 4},${shoulderY} ${point.x + 10},${shoulderY}`;
    const isDraft = drawing.id === "draft-drawing";
    const isSelected = drawing.id === selectedDrawingId;

    return (
      <g key={drawing.id}>
        {!isDraft && (
          <rect
            x={point.x - 16}
            y={Math.min(tipY, tailY) - 4}
            width={32}
            height={Math.abs(tailY - tipY) + 8}
            fill="transparent"
            className={`pointer-events-auto ${drawing.locked ? "cursor-pointer" : "cursor-move"}`}
            onMouseDown={(event) => handlePointMouseDown(drawing.id, 0, event)}
            onClick={(event) => selectDrawing(drawing, event)}
          />
        )}
        <polygon
          points={pointsText}
          fill={color}
          fillOpacity={strokeOpacity}
          stroke={isSelected ? TV_COLORS.blue : color}
          strokeOpacity={isSelected ? 1 : strokeOpacity}
          strokeWidth={isSelected ? 1.5 : 0}
          className="pointer-events-none"
        />
        {renderPointHandles(drawing, [point])}
      </g>
    );
  }

  function renderFixedVolumeProfileShape(
    drawing: ChartDrawing,
    points: ScreenPoint[],
  ) {
    const [a, b] = points;
    if (!a || !b) return <g key={drawing.id}>{renderPointHandles(drawing, points)}</g>;

    const profile = buildFixedRangeVolumeProfile(drawing, points);
    const isDraft = drawing.id === "draft-drawing";
    const left = Math.max(0, Math.min(a.x, b.x));
    const right = Math.min(overlayWidth, Math.max(a.x, b.x));
    const top = profile?.top ?? Math.min(a.y, b.y);
    const bottom = profile?.bottom ?? Math.max(a.y, b.y);
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const profileOpacity = profile?.opacity ?? 1;

    return (
      <g key={drawing.id}>
        {!isDraft && (
          <rect
            x={left}
            y={top}
            width={width}
            height={height}
            fill="transparent"
            className="pointer-events-auto cursor-pointer"
            onClick={(event) => selectDrawing(drawing, event)}
          />
        )}
        {profile && (
          <>
            <rect
              x={left}
              y={top}
              width={width}
              height={height}
              fill="#001f1b"
              fillOpacity={0.16 * profileOpacity}
              className="pointer-events-none"
            />
            <line
              x1={profile.left}
              y1={top}
              x2={profile.left}
              y2={bottom}
              stroke={FIXED_VOLUME_PROFILE_ANCHOR_COLOR}
              strokeWidth={3}
              strokeOpacity={profileOpacity}
              className="pointer-events-none"
            />
            {profile.bins.map((bin, index) => {
              const x = profile.left;
              if (!bin.inValueArea) {
                return (
                  <rect
                    key={`${drawing.id}-fixed-vp-${index}`}
                    x={x}
                    y={bin.y}
                    width={bin.totalWidth}
                    height={bin.height}
                    fill={FIXED_VOLUME_PROFILE_OUTSIDE_VALUE_COLOR}
                    fillOpacity={0.75 * profileOpacity}
                    className="pointer-events-none"
                  />
                );
              }

              return (
                <g key={`${drawing.id}-fixed-vp-${index}`}>
                  {bin.buyWidth > 0 && (
                    <rect
                      x={x}
                      y={bin.y}
                      width={bin.buyWidth}
                      height={bin.height}
                      fill={profile.buyColor}
                      fillOpacity={profile.opacity}
                      className="pointer-events-none"
                    />
                  )}
                  {bin.sellWidth > 0 && (
                    <rect
                      x={x + bin.buyWidth}
                      y={bin.y}
                      width={bin.sellWidth}
                      height={bin.height}
                      fill={profile.sellColor}
                      fillOpacity={profile.opacity}
                      className="pointer-events-none"
                    />
                  )}
                </g>
              );
            })}
            {profile.vahY !== undefined && (
              <line
                x1={left}
                y1={profile.vahY}
                x2={right}
                y2={profile.vahY}
                stroke={FIXED_VOLUME_PROFILE_VAH_COLOR}
                strokeWidth={1.5}
                strokeOpacity={0.95 * profileOpacity}
                className="pointer-events-none"
              />
            )}
            {profile.valY !== undefined && (
              <line
                x1={left}
                y1={profile.valY}
                x2={right}
                y2={profile.valY}
                stroke={FIXED_VOLUME_PROFILE_VAL_COLOR}
                strokeWidth={1.5}
                strokeOpacity={0.95 * profileOpacity}
                className="pointer-events-none"
              />
            )}
            <line
              x1={left}
              y1={profile.pocY}
              x2={right}
              y2={profile.pocY}
              stroke={profile.pocColor}
              strokeWidth={1.5}
              strokeDasharray="8 7"
              strokeOpacity={0.95 * profileOpacity}
              className="pointer-events-none"
            />
            <text
              x={Math.max(left + 6, Math.min(right - 96, profile.right + 6))}
              y={Math.max(top + 13, Math.min(bottom - 5, profile.pocY - 5))}
              fill={profile.pocColor}
              fillOpacity={profileOpacity}
              fontSize={10}
              fontWeight={700}
              paintOrder="stroke"
              stroke={TV_COLORS.bg}
              strokeWidth={3}
              className="pointer-events-none"
            >
              {`Fixed VP POC ${formatPrice(profile.pocPrice)}`}
            </text>
          </>
        )}
        {renderFixedVolumeProfileAnchors(drawing, [a, b])}
      </g>
    );
  }

  function renderFixedVolumeProfileAnchors(
    drawing: ChartDrawing,
    points: ScreenPoint[],
  ) {
    const visible = drawing.id === "draft-drawing" || drawing.id === selectedDrawingId;
    if (!visible) return null;

    return points.map((point, index) => (
      <circle
        key={`${drawing.id}-fixed-vp-anchor-${index}`}
        cx={point.x}
        cy={point.y}
        r={6}
        fill={TV_COLORS.bg}
        stroke={FIXED_VOLUME_PROFILE_ANCHOR_COLOR}
        strokeWidth={2.5}
        className="pointer-events-none"
      />
    ));
  }

  function renderRectangleShape(drawing: ChartDrawing, points: ScreenPoint[]) {
    const [a, b, c] = points;
    if (!a || !b) return null;
    const color = normalizeColor(drawing.color);
    const strokeOpacity = getDrawingStrokeOpacity(drawing);

    if (drawing.kind === "rotatedRectangle" && c) {
      const offsetX = c.x - a.x;
      const offsetY = c.y - a.y;
      const d = { x: b.x + offsetX, y: b.y + offsetY };

      return (
        <g key={drawing.id}>
          {drawing.id !== "draft-drawing" && (
            <polygon
              points={`${a.x},${a.y} ${b.x},${b.y} ${d.x},${d.y} ${c.x},${c.y}`}
              fill="transparent"
              stroke="transparent"
              strokeWidth={18}
              className={`pointer-events-auto ${drawing.locked ? "cursor-pointer" : "cursor-move"}`}
              onMouseDown={(event) => handleDrawingMouseDown(drawing, event)}
              onClick={(event) => selectDrawing(drawing, event)}
            />
          )}
          <polygon
            points={`${a.x},${a.y} ${b.x},${b.y} ${d.x},${d.y} ${c.x},${c.y}`}
            fill={color}
            fillOpacity={getDrawingFillOpacity(drawing) / 100}
            stroke={color}
            strokeOpacity={strokeOpacity}
            strokeWidth={1.5}
            className="pointer-events-none"
          />
          {renderPointHandles(drawing, points)}
        </g>
      );
    }

    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const width = Math.abs(b.x - a.x);
    const height = Math.abs(b.y - a.y);
    const isSelected = drawing.id === selectedDrawingId;
    const isDraft = drawing.id === "draft-drawing";
    const handlePoints = [
      { key: "nw", x, y, shape: "circle" },
      { key: "n", x: x + width / 2, y, shape: "square" },
      { key: "ne", x: x + width, y, shape: "circle" },
      { key: "e", x: x + width, y: y + height / 2, shape: "square" },
      { key: "se", x: x + width, y: y + height, shape: "circle" },
      { key: "s", x: x + width / 2, y: y + height, shape: "square" },
      { key: "sw", x, y: y + height, shape: "circle" },
      { key: "w", x, y: y + height / 2, shape: "square" },
    ] as const;

    return (
      <g key={drawing.id}>
        {!isDraft && (
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill="transparent"
            className={`pointer-events-auto ${drawing.locked ? "cursor-pointer" : "cursor-move"}`}
            onMouseDown={(event) => handleDrawingMouseDown(drawing, event)}
            onClick={(event) => selectDrawing(drawing, event)}
          />
        )}
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={color}
          fillOpacity={getDrawingFillOpacity(drawing) / 100}
          stroke={isSelected ? TV_COLORS.blue : color}
          strokeOpacity={isSelected ? 1 : strokeOpacity}
          strokeWidth={isSelected ? 0.625 : 0.5}
          className="pointer-events-none"
        />
        {isSelected &&
          !drawing.locked &&
          handlePoints.map((handle) =>
            handle.shape === "circle" ? (
              <circle
                key={`${drawing.id}-rect-${handle.key}`}
                cx={handle.x}
                cy={handle.y}
                r={5}
                fill={TV_COLORS.bg}
                stroke={TV_COLORS.blue}
                strokeWidth={2}
                className="pointer-events-auto cursor-move"
                onMouseDown={(event) =>
                  handleRectangleResizeMouseDown(drawing, handle.key, event)
                }
              />
            ) : (
              <rect
                key={`${drawing.id}-rect-${handle.key}`}
                x={handle.x - 5}
                y={handle.y - 5}
                width={10}
                height={10}
                rx={2}
                fill={TV_COLORS.bg}
                stroke={TV_COLORS.blue}
                strokeWidth={2}
                className="pointer-events-auto cursor-move"
                onMouseDown={(event) =>
                  handleRectangleResizeMouseDown(drawing, handle.key, event)
                }
              />
            ),
          )}
        {isDraft ? renderPointHandles(drawing, points) : null}
      </g>
    );
  }

  function renderEllipseShape(drawing: ChartDrawing, a: ScreenPoint, b: ScreenPoint) {
    const color = normalizeColor(drawing.color);
    const strokeOpacity = getDrawingStrokeOpacity(drawing);
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.abs(b.x - a.x) / 2;
    const ry = drawing.kind === "circle" ? rx : Math.abs(b.y - a.y) / 2;

    return (
      <g key={drawing.id}>
        {drawing.id !== "draft-drawing" && (
          <ellipse
            cx={cx}
            cy={cy}
            rx={Math.max(8, rx)}
            ry={Math.max(8, ry)}
            fill="transparent"
            stroke="transparent"
            strokeWidth={18}
            className={`pointer-events-auto ${drawing.locked ? "cursor-pointer" : "cursor-move"}`}
            onMouseDown={(event) => handleDrawingMouseDown(drawing, event)}
            onClick={(event) => selectDrawing(drawing, event)}
          />
        )}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill={color}
          fillOpacity={getDrawingFillOpacity(drawing) / 100}
          stroke={color}
          strokeOpacity={strokeOpacity}
          strokeWidth={1.5}
          className="pointer-events-none"
        />
        {renderPointHandles(drawing, [a, b])}
      </g>
    );
  }

  function renderOpenPath(drawing: ChartDrawing, points: ScreenPoint[]) {
    const color = normalizeColor(drawing.color);
    const pointText = points.map((point) => `${point.x},${point.y}`).join(" ");
    const strokeWidth =
      drawing.kind === "highlighter" ? 10 : drawing.kind === "brush" ? 3 : 1.5;
    const opacity =
      (drawing.kind === "highlighter" ? 0.32 : 1) *
      getDrawingStrokeOpacity(drawing);
    const routeStart = points.at(-2);
    const routeEnd = points.at(-1);

    return (
      <g key={drawing.id}>
        {drawing.id !== "draft-drawing" && (
          <polyline
            points={pointText}
            fill="none"
            stroke="transparent"
            strokeWidth={18}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`pointer-events-auto ${drawing.locked ? "cursor-pointer" : "cursor-move"}`}
            onMouseDown={(event) => handleDrawingMouseDown(drawing, event)}
            onClick={(event) => selectDrawing(drawing, event)}
          />
        )}
        <polyline
          points={pointText}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeOpacity={opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none"
        />
        {drawing.kind === "route" && routeStart && routeEnd && (
          <polygon
            points={getArrowHead(routeStart, routeEnd)}
            fill={color}
            opacity={opacity}
            className="pointer-events-none"
          />
        )}
        {renderPointHandles(drawing, points)}
      </g>
    );
  }

  function renderCurveShape(drawing: ChartDrawing, points: ScreenPoint[]) {
    const color = normalizeColor(drawing.color);
    const strokeOpacity = getDrawingStrokeOpacity(drawing);
    const [a, b, c, d] = points;
    if (!a || !b || !c) return renderOpenPath(drawing, points);
    const path =
      drawing.kind === "doubleCurve" && d
        ? `M ${a.x} ${a.y} C ${b.x} ${b.y}, ${c.x} ${c.y}, ${d.x} ${d.y}`
        : `M ${a.x} ${a.y} Q ${b.x} ${b.y}, ${c.x} ${c.y}`;

    return (
      <g key={drawing.id}>
        {drawing.id !== "draft-drawing" && (
          <path
            d={path}
            fill="none"
            stroke="transparent"
            strokeWidth={18}
            strokeLinecap="round"
            className={`pointer-events-auto ${drawing.locked ? "cursor-pointer" : "cursor-move"}`}
            onMouseDown={(event) => handleDrawingMouseDown(drawing, event)}
            onClick={(event) => selectDrawing(drawing, event)}
          />
        )}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeOpacity={strokeOpacity}
          strokeWidth={1.5}
          strokeLinecap="round"
          className="pointer-events-none"
        />
        {renderPointHandles(drawing, points)}
      </g>
    );
  }

  function renderFibonacciShape(drawing: ChartDrawing, points: ScreenPoint[]) {
    const [a, b, c] = points;
    if (!a || !b) return null;

    const color = normalizeColor(drawing.color);
    const strokeOpacity = getDrawingStrokeOpacity(drawing);
    const isDraft = drawing.id === "draft-drawing";
    const plotRight = Math.max(0, overlayWidth - PRICE_SCALE_GUTTER_WIDTH);
    const x1 = Math.max(0, Math.min(a.x, b.x, c?.x ?? b.x, plotRight));
    const x2 = x1 + (plotRight - x1) * (getDrawingLineLengthPercent(drawing) / 100);
    const anchorTextX = Math.max(a.x, b.x, c?.x ?? b.x) + 8;
    const textX =
      x2 - x1 >= 124
        ? Math.max(x1 + 8, Math.min(x2 - 108, anchorTextX))
        : x1 + 8;
    const levels =
      drawing.kind === "fibExtension" && c
        ? FIB_EXTENSION_LEVELS.map((level, index) => ({
            level,
            index,
            color,
            y: c.y + (b.y - a.y) * level,
            price: c.price + (b.price - a.price) * level,
          }))
        : getFibonacciLevels(drawing).map((fibLevel, index) => ({
            ...fibLevel,
            index,
          })).filter((level) => level.enabled).map((fibLevel) => {
            const topPoint = a.y <= b.y ? a : b;
            const bottomPoint = a.y <= b.y ? b : a;
            const level = fibLevel.value;

            return {
              level,
              index: fibLevel.index,
              color: fibLevel.color,
              y: topPoint.y + (bottomPoint.y - topPoint.y) * level,
              price: topPoint.price + (bottomPoint.price - topPoint.price) * level,
            };
          });

    const canInteract = !isDraft;

    return (
      <g key={drawing.id}>
        {levels.map(({ level, index, y, price, color: levelColor }) => (
          <g key={`${drawing.id}-fib-${index}-${level}`}>
            {canInteract && (
              <line
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke="transparent"
                strokeWidth={10}
                className={`pointer-events-auto ${drawing.locked ? "cursor-pointer" : "cursor-move"}`}
                onMouseDown={(event) => handleDrawingMouseDown(drawing, event)}
                onClick={(event) => selectDrawing(drawing, event)}
              />
            )}
            <line
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              stroke={levelColor}
              strokeOpacity={strokeOpacity}
              strokeWidth={1}
              className="pointer-events-none"
            />
            <text
              x={textX}
              y={y - 4}
              fill={levelColor}
              opacity={strokeOpacity}
              fontSize={10}
              paintOrder="stroke"
              stroke={TV_COLORS.bg}
              strokeWidth={3}
              className="pointer-events-none"
            >
              {`${(level * 100).toFixed(level % 1 === 0 ? 0 : 1)}% ${formatPrice(price)}`}
            </text>
          </g>
        ))}
        {drawing.kind === "fibExtension" && c ? (
          <polyline
            points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`}
            fill="none"
            stroke={color}
            strokeDasharray="4 4"
            strokeOpacity={Math.min(0.55, strokeOpacity)}
            strokeWidth={1}
            className="pointer-events-none"
          />
        ) : (drawing.showTrendLine ?? true) ? (
          <line
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={color}
            strokeDasharray="4 4"
            strokeOpacity={Math.min(0.55, strokeOpacity)}
            strokeWidth={1}
            className="pointer-events-none"
          />
        ) : null}
        {renderPointHandles(drawing, points)}
      </g>
    );
  }

  function renderPositionShape(
    drawing: ChartDrawing,
    points: ScreenPoint[],
    side: "long" | "short",
  ) {
    const [a, b, c, d] = points;
    if (!a || !b) return <g key={drawing.id}>{renderPointHandles(drawing, points)}</g>;

    const isDraft = drawing.id === "draft-drawing";
    const strokeOpacity = getDrawingStrokeOpacity(drawing);
    const widthPoint = d ?? b;
    const x1 = Math.max(0, Math.min(a.x, widthPoint.x));
    const x2 = Math.min(Math.max(a.x, widthPoint.x), overlayWidth);
    const shapeWidth = Math.max(1, x2 - x1);
    const levelHandleX = Math.max(0, Math.min(widthPoint.x, overlayWidth));
    const rewardDistance =
      Math.abs(b.price - a.price) || Math.max(Math.abs(a.price) * 0.01, 1);
    const riskDistance = c ? Math.abs(c.price - a.price) : rewardDistance;
    const targetPrice =
      side === "long"
        ? a.price + rewardDistance
        : a.price - rewardDistance;
    const stopPrice =
      side === "long"
        ? a.price - riskDistance
        : a.price + riskDistance;
    const targetY = candleSeriesRef.current?.priceToCoordinate(targetPrice);
    const stopY = candleSeriesRef.current?.priceToCoordinate(stopPrice);
    if (targetY === null || targetY === undefined || stopY === null || stopY === undefined) {
      return <g key={drawing.id}>{renderPointHandles(drawing, points)}</g>;
    }

    const rewardTop = Math.min(targetY, a.y);
    const rewardHeight = Math.max(1, Math.abs(a.y - targetY));
    const riskTop = Math.min(a.y, stopY);
    const riskHeight = Math.max(1, Math.abs(stopY - a.y));
    const rewardPct = Math.abs((targetPrice - a.price) / a.price) * 100;
    const riskPct = Math.abs((a.price - stopPrice) / a.price) * 100;
    const reward = Math.abs(targetPrice - a.price);
    const risk = Math.abs(a.price - stopPrice);
    const ratioText = formatRiskRewardRatio(reward, risk);
    const rewardText = `Take Profit ${formatPrice(targetPrice)} (${rewardPct.toFixed(2)}%)`;
    const riskText = `Stop Loss ${formatPrice(stopPrice)} (${riskPct.toFixed(2)}%)`;
    const entryText = `Entrada ${formatPrice(a.price)}  R/B ${ratioText}`;

    return (
      <g key={drawing.id}>
        {!isDraft && (
          <rect
            x={x1}
            y={Math.min(rewardTop, riskTop)}
            width={Math.max(8, shapeWidth)}
            height={Math.max(rewardTop + rewardHeight, riskTop + riskHeight) - Math.min(rewardTop, riskTop)}
            fill="transparent"
            className={`pointer-events-auto ${drawing.locked ? "cursor-pointer" : "cursor-move"}`}
            onMouseDown={(event) => handleDrawingMouseDown(drawing, event)}
            onClick={(event) => selectDrawing(drawing, event)}
          />
        )}
        <rect
          x={x1}
          y={rewardTop}
          width={shapeWidth}
          height={rewardHeight}
          fill={TV_COLORS.green}
          fillOpacity={0.22}
          stroke={TV_COLORS.green}
          strokeOpacity={strokeOpacity}
          strokeWidth={1}
          className="pointer-events-none"
        />
        <rect
          x={x1}
          y={riskTop}
          width={shapeWidth}
          height={riskHeight}
          fill={TV_COLORS.red}
          fillOpacity={0.22}
          stroke={TV_COLORS.red}
          strokeOpacity={strokeOpacity}
          strokeWidth={1}
          className="pointer-events-none"
        />
        <line
          x1={x1}
          y1={a.y}
          x2={x2}
          y2={a.y}
          stroke={TV_COLORS.text}
          strokeOpacity={0.75}
          strokeDasharray="4 3"
          className="pointer-events-none"
        />
        <text
          x={x1 + 8}
          y={rewardTop + 14}
          fill={TV_COLORS.green}
          fontSize={10}
          fontWeight={600}
          paintOrder="stroke"
          stroke={TV_COLORS.bg}
          strokeWidth={3}
          className="pointer-events-none"
        >
          {rewardText}
        </text>
        <text
          x={x1 + 8}
          y={riskTop + riskHeight - 6}
          fill={TV_COLORS.red}
          fontSize={10}
          fontWeight={600}
          paintOrder="stroke"
          stroke={TV_COLORS.bg}
          strokeWidth={3}
          className="pointer-events-none"
        >
          {riskText}
        </text>
        <text
          x={x1 + 8}
          y={a.y - 5}
          fill={TV_COLORS.text}
          fontSize={10}
          paintOrder="stroke"
          stroke={TV_COLORS.bg}
          strokeWidth={3}
          className="pointer-events-none"
        >
          {entryText}
        </text>
        {renderPointHandles(drawing, [
          a,
          { ...b, price: targetPrice, x: levelHandleX, y: Number(targetY) },
          { ...(c ?? b), price: stopPrice, x: levelHandleX, y: Number(stopY) },
          { ...widthPoint, price: a.price, x: levelHandleX, y: a.y },
        ])}
      </g>
    );
  }

  function renderChannel(
    drawing: ChartDrawing,
    points: ScreenPoint[],
    key: string,
  ) {
    const [a, b, c] = points;
    if (!a || !b) return null;
    const isDraft = drawing.id === "draft-drawing";
    const borderColor = getDrawingBorderColor(drawing);
    const centerColor = getDrawingCenterColor(drawing);
    const fillOpacity = getDrawingFillOpacity(drawing) / 100;
    const borderOpacity = getDrawingBorderOpacity(drawing) / 100;

    if (drawing.kind === "regressionTrend") {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      const band = 28;
      const upperA = { x: a.x + nx * band, y: a.y + ny * band };
      const upperB = { x: b.x + nx * band, y: b.y + ny * band };
      const lowerA = { x: a.x - nx * band, y: a.y - ny * band };
      const lowerB = { x: b.x - nx * band, y: b.y - ny * band };

      return (
        <g key={key}>
          <polygon
            points={`${upperA.x},${upperA.y} ${upperB.x},${upperB.y} ${lowerB.x},${lowerB.y} ${lowerA.x},${lowerA.y}`}
            fill={borderColor}
            opacity={fillOpacity}
            className={
              isDraft
                ? "pointer-events-none"
                : `pointer-events-auto ${drawing.locked ? "cursor-pointer" : "cursor-move"}`
            }
            onMouseDown={
              isDraft ? undefined : (event) => handleDrawingMouseDown(drawing, event)
            }
          />
          {renderLine(`${key}-mid`, drawing, a.x, a.y, b.x, b.y, {
            color: centerColor,
          })}
          {renderLine(`${key}-upper`, drawing, upperA.x, upperA.y, upperB.x, upperB.y, {
            dashed: true,
            color: borderColor,
            opacity: borderOpacity,
          })}
          {renderLine(`${key}-lower`, drawing, lowerA.x, lowerA.y, lowerB.x, lowerB.y, {
            dashed: true,
            color: borderColor,
            opacity: borderOpacity,
          })}
          {renderPointHandles(drawing, points)}
        </g>
      );
    }

    if (drawing.kind === "flatTopBottom") {
      return (
        <g key={key}>
          {renderLine(`${key}-top`, drawing, 0, a.y, overlayWidth, a.y)}
          {renderLine(`${key}-bottom`, drawing, 0, b.y, overlayWidth, b.y)}
          {renderPointHandles(drawing, points)}
        </g>
      );
    }

    if (!c) {
      return (
        <g key={key}>
          {renderLine(`${key}-base`, drawing, a.x, a.y, b.x, b.y)}
          {renderPointHandles(drawing, points)}
        </g>
      );
    }

    const offsetX = c.x - a.x;
    const offsetY = c.y - a.y;
    const d = { x: b.x + offsetX, y: b.y + offsetY };
    const midA = { x: a.x + offsetX / 2, y: a.y + offsetY / 2 };
    const midB = { x: b.x + offsetX / 2, y: b.y + offsetY / 2 };
    const baseMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const parallelMid = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 };

    return (
      <g key={key}>
        <polygon
          points={`${a.x},${a.y} ${b.x},${b.y} ${d.x},${d.y} ${c.x},${c.y}`}
          fill={borderColor}
          opacity={fillOpacity}
          className={
            isDraft
              ? "pointer-events-none"
              : `pointer-events-auto ${drawing.locked ? "cursor-pointer" : "cursor-move"}`
          }
          onMouseDown={
            isDraft ? undefined : (event) => handleDrawingMouseDown(drawing, event)
          }
        />
        {renderLine(`${key}-base`, drawing, a.x, a.y, b.x, b.y, {
          color: borderColor,
          opacity: borderOpacity,
        })}
        {drawing.kind === "parallelChannel"
          ? renderLine(
              `${key}-middle`,
              drawing,
              midA.x,
              midA.y,
              midB.x,
              midB.y,
              { dashed: true, color: centerColor, width: 1 },
            )
          : null}
        {renderLine(`${key}-parallel`, drawing, c.x, c.y, d.x, d.y, {
          color: borderColor,
          opacity: borderOpacity,
        })}
        {drawing.kind === "parallelChannel" ||
        drawing.kind === "disjointChannel"
          ? null
          : renderLine(`${key}-left`, drawing, a.x, a.y, c.x, c.y, {
              dashed: true,
              color: borderColor,
              opacity: borderOpacity,
            })}
        {drawing.kind === "parallelChannel" ||
        drawing.kind === "disjointChannel"
          ? null
          : renderLine(`${key}-right`, drawing, b.x, b.y, d.x, d.y, {
              dashed: true,
              color: borderColor,
              opacity: borderOpacity,
            })}
        {renderPointHandles(drawing, points)}
        {renderParallelChannelEndHandle(drawing, d)}
        {renderParallelChannelMidHandle(drawing, baseMid, "base")}
        {renderParallelChannelMidHandle(drawing, parallelMid, "parallel")}
      </g>
    );
  }

  function renderDrawing(drawing: ChartDrawing, points: ScreenPoint[]) {
    const [a, b] = points;
    if (!a) return null;
    const key = drawing.id;

    if (drawing.kind === "brush" || drawing.kind === "highlighter" || drawing.kind === "route" || drawing.kind === "polyline") {
      return renderOpenPath(drawing, points);
    }

    if (drawing.kind === "measureRange") {
      return renderMeasureRange(drawing, points, key);
    }

    if (drawing.kind === "arrow" || drawing.kind === "arrowMarker") {
      if (!b) return <g key={key}>{renderPointHandles(drawing, points)}</g>;
      return renderArrowShape(drawing, a, b);
    }

    if (drawing.kind === "arrowUp") {
      return renderSingleArrowMark(drawing, a, "up");
    }

    if (drawing.kind === "arrowDown") {
      return renderSingleArrowMark(drawing, a, "down");
    }

    if (drawing.kind === "fixedVolumeProfile") {
      return renderFixedVolumeProfileShape(drawing, points);
    }

    if (drawing.kind === "rectangle" || drawing.kind === "rotatedRectangle") {
      return renderRectangleShape(drawing, points);
    }

    if (drawing.kind === "circle" || drawing.kind === "ellipse") {
      if (!b) return <g key={key}>{renderPointHandles(drawing, points)}</g>;
      return renderEllipseShape(drawing, a, b);
    }

    if (drawing.kind === "triangle") {
      const c = points[2];
      if (!b || !c) return renderOpenPath(drawing, points);
      const color = normalizeColor(drawing.color);
      const strokeOpacity = getDrawingStrokeOpacity(drawing);
      return (
        <g key={key}>
          {drawing.id !== "draft-drawing" && (
            <polygon
              points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`}
              fill="transparent"
              stroke="transparent"
              strokeWidth={18}
              className={`pointer-events-auto ${drawing.locked ? "cursor-pointer" : "cursor-move"}`}
              onMouseDown={(event) => handleDrawingMouseDown(drawing, event)}
              onClick={(event) => selectDrawing(drawing, event)}
            />
          )}
          <polygon
            points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`}
            fill={color}
            fillOpacity={getDrawingFillOpacity(drawing) / 100}
            stroke={color}
            strokeOpacity={strokeOpacity}
            strokeWidth={1.5}
            className="pointer-events-none"
          />
          {renderPointHandles(drawing, points)}
        </g>
      );
    }

    if (drawing.kind === "arc" || drawing.kind === "curve" || drawing.kind === "doubleCurve") {
      return renderCurveShape(drawing, points);
    }

    if (drawing.kind === "fibRetracement" || drawing.kind === "fibExtension") {
      return renderFibonacciShape(drawing, points);
    }

    if (drawing.kind === "longPosition" || drawing.kind === "shortPosition") {
      if (!b) return <g key={key}>{renderPointHandles(drawing, points)}</g>;
      return renderPositionShape(
        drawing,
        points,
        drawing.kind === "longPosition" ? "long" : "short",
      );
    }

    if (
      drawing.kind === "parallelChannel" ||
      drawing.kind === "regressionTrend" ||
      drawing.kind === "flatTopBottom" ||
      drawing.kind === "disjointChannel"
    ) {
      return renderChannel(drawing, points, key);
    }

    if (drawing.kind === "hline") {
      return (
        <g key={key}>
          {renderLine(`${key}-hline`, drawing, 0, a.y, overlayWidth, a.y)}
          {renderPointHandles(drawing, points)}
        </g>
      );
    }

    if (drawing.kind === "vline") {
      return (
        <g key={key}>
          {renderLine(`${key}-vline`, drawing, a.x, mainPaneTop, a.x, mainPaneBottom)}
          {renderPointHandles(drawing, points)}
        </g>
      );
    }

    if (drawing.kind === "crossLine") {
      return (
        <g key={key}>
          {renderLine(`${key}-cross-h`, drawing, 0, a.y, overlayWidth, a.y)}
          {renderLine(`${key}-cross-v`, drawing, a.x, mainPaneTop, a.x, mainPaneBottom)}
          {renderPointHandles(drawing, points)}
        </g>
      );
    }

    if (!b) {
      return (
        <g key={key}>
          {renderPointHandles(drawing, points)}
        </g>
      );
    }

    if (drawing.kind === "hray") {
      const x2 = b.x >= a.x ? overlayWidth : 0;
      return (
        <g key={key}>
          {renderLine(`${key}-hray`, drawing, a.x, a.y, x2, a.y)}
          {renderPointHandles(drawing, points)}
        </g>
      );
    }

    if (drawing.kind === "ray") {
      return (
        <g key={key}>
          {renderLine(`${key}-ray`, drawing, a.x, a.y, b.x, b.y)}
          {renderPointHandles(drawing, points)}
        </g>
      );
    }

    if (drawing.kind === "extendedLine") {
      const line = getExtendedLine(a, b);
      return (
        <g key={key}>
          {renderLine(`${key}-extended`, drawing, line.x1, line.y1, line.x2, line.y2)}
          {renderPointHandles(drawing, points)}
        </g>
      );
    }

    return (
      <g key={key}>
        {renderLine(`${key}-line`, drawing, a.x, a.y, b.x, b.y)}
        {renderInfoText(drawing, a, b)}
        {renderPointHandles(drawing, points)}
      </g>
    );
  }

  let measureRender: React.ReactNode = null;
  if (
    measure.a &&
    measure.b &&
    chartRef.current &&
    candleSeriesRef.current
  ) {
    const aX = timeToCoordinateSafe(measure.a.time);
    const bX = timeToCoordinateSafe(measure.b.time);
    const aY = candleSeriesRef.current.priceToCoordinate(measure.a.price);
    const bY = candleSeriesRef.current.priceToCoordinate(measure.b.price);

    if (aX !== null && bX !== null && aY !== null && bY !== null) {
      const priceDiff = measure.b.price - measure.a.price;
      const pctChange =
        measure.a.price === 0 ? 0 : (priceDiff / measure.a.price) * 100;
      const isUp = priceDiff >= 0;
      const start = Math.min(measure.a.time, measure.b.time);
      const end = Math.max(measure.a.time, measure.b.time);
      const bars = countBarsInRange(candlesRef.current, start, end);
      const dur = durationLabel(measure.a.time, measure.b.time);

      measureRender = (
        <MeasureOverlay
          aX={aX}
          aY={aY}
          bX={bX}
          bY={bY}
          priceDiff={priceDiff}
          pctChange={pctChange}
          bars={bars}
          durationText={dur}
          isUp={isUp}
          isPreview={measure.phase === "placing"}
        />
      );
    }
  }
  void renderTick;
  void candleVersion;

  return (
    <div
      className="relative h-full w-full"
      style={{ backgroundColor: chartTheme.background }}
    >
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ backgroundColor: chartTheme.background }}
        onContextMenu={handleContextMenu}
      />
      <div
        className="pointer-events-none absolute left-0 z-[1] flex items-center justify-center overflow-hidden px-8 text-center"
        style={{
          top: mainPaneTop,
          height: mainPaneHeight ?? "100%",
          right: 0,
          color: watermarkStyle.color,
          opacity: watermarkStyle.opacity,
        }}
      >
        <div className="max-w-[82%] break-words text-4xl font-semibold leading-tight sm:text-5xl lg:text-7xl">
          {symbolDisplay.primary}
        </div>
      </div>
      {emaCrossFill && (
        <svg
          className="pointer-events-none absolute left-0 top-0 z-[5] w-full"
          style={{ height: emaCrossFill.height, overflow: "hidden" }}
        >
          <path
            d={emaCrossFill.path}
            fill={emaCrossFill.color}
            fillOpacity={emaCrossFill.opacity}
          />
        </svg>
      )}
      {indicators.rsi &&
        !hidden.rsi &&
        rsiPane &&
        rsi70Y !== null &&
        rsi30Y !== null && (
          <div
            className="pointer-events-none absolute left-0 right-0 z-[4]"
            style={{
              top: rsiPane.top + Math.min(rsi70Y, rsi30Y),
              height: Math.abs(rsi30Y - rsi70Y),
              backgroundColor: config.rsiSettings.rangeFillColor,
              opacity: RSI_RANGE_FILL_OPACITY,
            }}
          />
        )}
      {(projectedDrawings.length > 0 ||
        swingMarkers.length > 0 ||
        rsiZoneFills.length > 0 ||
        rsiDivergenceMarkers.length > 0 ||
        volumeProfile !== null ||
        pmRangeOverlay !== null) &&
        overlayWidth > 0 &&
        overlayHeight > 0 && (
        <svg
          className="pointer-events-none absolute left-0 top-0 z-[15] h-full w-full overflow-hidden"
          width={overlayWidth}
          height={overlayHeight}
        >
          <defs>
            <linearGradient
              id="rsi-overbought-gradient"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0%" stopColor={TV_COLORS.green} stopOpacity="0.68" />
              <stop offset="100%" stopColor={TV_COLORS.green} stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="rsi-oversold-gradient"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0%" stopColor={TV_COLORS.red} stopOpacity="0" />
              <stop offset="100%" stopColor={TV_COLORS.red} stopOpacity="0.68" />
            </linearGradient>
          </defs>
          {volumeProfile && (
            <g className="pointer-events-none">
              {volumeProfile.bins.map((bin, index) => {
                const x = volumeProfile.right - bin.totalWidth;
                return (
                  <g key={`vpvr-bin-${index}`}>
                    {bin.sellWidth > 0 && (
                      <rect
                        x={x}
                        y={bin.y}
                        width={bin.sellWidth}
                        height={bin.height}
                        fill={volumeProfile.sellColor}
                        fillOpacity={volumeProfile.opacity}
                      />
                    )}
                    {bin.buyWidth > 0 && (
                      <rect
                        x={x + bin.sellWidth}
                        y={bin.y}
                        width={bin.buyWidth}
                        height={bin.height}
                        fill={volumeProfile.buyColor}
                        fillOpacity={volumeProfile.opacity}
                      />
                    )}
                  </g>
                );
              })}
              <line
                x1={0}
                y1={volumeProfile.pocY}
                x2={volumeProfile.right}
                y2={volumeProfile.pocY}
                stroke={volumeProfile.pocColor}
                strokeWidth={2}
                strokeDasharray="10 10"
                strokeOpacity={0.95}
              />
              <rect
                x={Math.max(8, volumeProfile.right - 78)}
                y={Math.max(volumeProfile.top + 4, volumeProfile.pocY - 11)}
                width={70}
                height={18}
                rx={2}
                fill={volumeProfile.pocColor}
                fillOpacity={0.96}
              />
              <text
                x={Math.max(13, volumeProfile.right - 73)}
                y={Math.max(volumeProfile.top + 17, volumeProfile.pocY + 4)}
                fill="#111111"
                fontSize={10}
                fontWeight={700}
                className="pointer-events-none"
              >
                {formatPrice(volumeProfile.pocPrice)}
              </text>
            </g>
          )}
          {rsiZoneFills.map((fill, index) => (
            <path
              key={`rsi-zone-${index}`}
              d={fill.path}
              fill={`url(#rsi-${
                fill.kind === "overbought" ? "overbought" : "oversold"
              }-gradient)`}
            />
          ))}
          {pmRangeOverlay?.boxes.map((box, index) => {
            const left = projectTimePrice(box.startTime, box.top);
            const right = projectTimePrice(box.endTime, box.bottom);
            if (!left || !right) return null;
            const isFvgBox = box.kind === "fvgBull" || box.kind === "fvgBear";
            const x = Math.min(left.x, right.x);
            const y = Math.min(left.y, right.y);
            const width = Math.max(1, Math.abs(right.x - left.x));
            const height = Math.max(1, Math.abs(right.y - left.y));
            const midY = y + height / 2;
            return (
              <g key={`pm-box-${index}`}>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={box.fill}
                  fillOpacity={box.opacity}
                  stroke={isFvgBox ? "none" : box.stroke}
                  strokeOpacity={0.55}
                  strokeWidth={1}
                  className="pointer-events-none"
                />
                {isFvgBox && (
                  <line
                    x1={x}
                    y1={midY}
                    x2={x + width}
                    y2={midY}
                    stroke={box.stroke}
                    strokeOpacity={0.8}
                    strokeWidth={1}
                    strokeDasharray="2 3"
                    className="pointer-events-none"
                  />
                )}
                {box.text && width > 48 && height > 30 && !isFvgBox && (
                  <text
                    x={x + 6}
                    y={y + height - Math.min(8, height / 4)}
                    fill={config.pmRangeBreakout.textColor}
                    fontSize={10}
                    paintOrder="stroke"
                    stroke={TV_COLORS.bg}
                    strokeWidth={3}
                    className="pointer-events-none"
                  >
                    {box.text.split("\n").slice(0, 5).map((line, lineIndex) => (
                      <tspan key={`${line}-${lineIndex}`} x={x + 6} dy={lineIndex === 0 ? -48 : 12}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                )}
                {box.text && isFvgBox && width > 42 && height > 12 && (
                  <text
                    x={x + 5}
                    y={y + 11}
                    fill={box.stroke}
                    fontSize={8}
                    fontWeight={700}
                    paintOrder="stroke"
                    stroke={TV_COLORS.bg}
                    strokeWidth={2}
                    className="pointer-events-none"
                  >
                    {box.text}
                  </text>
                )}
              </g>
            );
          })}
          {pmRangeOverlay &&
            renderPmEmaPolyline(
              pmRangeOverlay.ema20,
              config.pmRangeBreakout.ema20Color,
              "pm-ema20",
            )}
          {pmRangeOverlay &&
            renderPmEmaPolyline(
              pmRangeOverlay.ema200,
              config.pmRangeBreakout.ema200Color,
              "pm-ema200",
            )}
          {pmRangeOverlay?.lines.map((line, index) => {
            const start = projectTimePrice(line.startTime, line.price);
            const end = projectTimePrice(line.endTime, line.price);
            if (!start || !end) return null;
            return (
              <line
                key={`pm-line-${index}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={line.color}
                strokeWidth={1}
                strokeDasharray={line.dashed ? "5 5" : undefined}
                className="pointer-events-none"
              />
            );
          })}
          {pmRangeOverlay?.labels.map((label, index) => {
            const point = projectTimePrice(label.time, label.price);
            if (!point) return null;
            const yOffset = label.direction === "down" ? -10 : label.direction === "up" ? 18 : 0;
            const tradeLabel = isPmTradeLabel(label.text);
            const fontSize = tradeLabel ? 8 : 10;
            const lineHeight = tradeLabel ? 9 : 12;
            return (
              <text
                key={`pm-label-${index}`}
                x={point.x + (label.direction === "left" ? 6 : 0)}
                y={point.y + yOffset}
                fill={label.color}
                fontSize={fontSize}
                fontWeight={600}
                textAnchor={getPmLabelAnchor(label.direction)}
                paintOrder="stroke"
                stroke={TV_COLORS.bg}
                strokeWidth={tradeLabel ? 2 : 3}
                className="pointer-events-none"
              >
                {label.text.split("\n").map((line, lineIndex) => (
                  <tspan
                    key={`${line}-${lineIndex}`}
                    x={point.x + (label.direction === "left" ? 6 : 0)}
                    dy={lineIndex === 0 ? 0 : lineHeight}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            );
          })}
          {projectedDrawings.map(({ drawing, points }) =>
            renderDrawing(drawing, points),
          )}
          {swingMarkers.map((marker) => {
            const color =
              marker.kind === "high"
                ? config.swingPatterns.swingHighColor
                : config.swingPatterns.swingLowColor;
            const labelY = marker.kind === "high" ? marker.y - 10 : marker.y + 18;
            const anchor = marker.kind === "high" ? "end" : "start";
            const text = `${marker.structure}\n${marker.pattern}`;

            return (
              <g
                key={`swing-${marker.time}-${marker.kind}`}
                className="pointer-events-none"
              >
                <title>{marker.description}</title>
                <text
                  x={marker.x}
                  y={labelY}
                  fill={normalizeColor(color)}
                  fontSize={10}
                  fontWeight={600}
                  textAnchor={anchor}
                  paintOrder="stroke"
                  stroke={TV_COLORS.bg}
                  strokeWidth={3}
                >
                  {text.split("\n").map((line, index) => (
                    <tspan
                      key={line}
                      x={marker.x}
                      dy={index === 0 ? 0 : 12}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
          {rsiDivergenceMarkers.map((marker, index) => {
            const isBull = marker.kind === "bull";
            const color = isBull ? TV_COLORS.green : TV_COLORS.red;
            const label = isBull ? "Bull" : "Bear";
            const labelY = marker.y + (isBull ? 14 : -14);

            return (
              <g key={`rsi-div-${index}`}>
                <line
                  x1={marker.previousX}
                  x2={marker.x}
                  y1={marker.previousY}
                  y2={marker.y}
                  stroke={color}
                  strokeWidth={2}
                />
                <circle cx={marker.previousX} cy={marker.previousY} r={2.5} fill={color} />
                <circle cx={marker.x} cy={marker.y} r={2.5} fill={color} />
                <rect
                  x={marker.x - 16}
                  y={labelY - 8}
                  width={32}
                  height={16}
                  rx={2}
                  fill={color}
                />
                <text
                  x={marker.x}
                  y={labelY + 3.5}
                  textAnchor="middle"
                  className="fill-white text-[9px] font-semibold"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {measureRender}

      {selectedDrawing && selectedDrawing.kind !== "fixedVolumeProfile" && (
        <div
          onClick={(event) => event.stopPropagation()}
          className="absolute right-14 top-12 z-40 flex items-center gap-1 rounded-sm border border-tv-border bg-tv-panel p-1.5 shadow-xl"
        >
          {!isChannelDrawing(selectedDrawing) && selectedDrawing.kind !== "fibRetracement" && (
            <input
              aria-label="Color del dibujo"
              title="Color"
              type="color"
              value={normalizeColor(selectedDrawing.color)}
              disabled={selectedDrawing.locked}
              onChange={(event) => updateSelectedDrawingColor(event.target.value)}
              className="h-7 w-7 cursor-pointer rounded border border-tv-border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            />
          )}
          {selectedDrawing.kind !== "vline" &&
            !isFibonacciDrawing(selectedDrawing) && (
            <input
              aria-label="Valor del dibujo"
              title={DRAWING_LABELS[selectedDrawing.kind]}
              type="number"
              value={selectedDrawing.points[0]?.price ?? ""}
              disabled={selectedDrawing.locked}
              onChange={(event) => updateSelectedDrawingValue(event.target.value)}
              className="h-7 w-28 rounded-sm border border-tv-border bg-tv-bg px-2 text-xs tabular-nums text-tv-text outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          )}
          {isChannelDrawing(selectedDrawing) && (
            <>
              <input
                aria-label="Color del borde"
                title="Borde"
                type="color"
                value={getDrawingBorderColor(selectedDrawing)}
                disabled={selectedDrawing.locked}
                onChange={(event) =>
                  updateSelectedDrawingBorderColor(event.target.value)
                }
                className="h-7 w-7 cursor-pointer rounded border border-tv-border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <input
                aria-label="Color central"
                title="Centro"
                type="color"
                value={getDrawingCenterColor(selectedDrawing)}
                disabled={selectedDrawing.locked}
                onChange={(event) =>
                  updateSelectedDrawingCenterColor(event.target.value)
                }
                className="h-7 w-7 cursor-pointer rounded border border-tv-border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <input
                aria-label="Transparencia del borde"
                title="Borde opacidad"
                type="range"
                min="0"
                max="100"
                value={getDrawingBorderOpacity(selectedDrawing)}
                disabled={selectedDrawing.locked}
                onChange={(event) =>
                  updateSelectedDrawingBorderOpacity(event.target.value)
                }
                className="h-7 w-20 accent-tv-blue disabled:cursor-not-allowed disabled:opacity-50"
              />
            </>
          )}
          {!isChannelDrawing(selectedDrawing) && (
            <input
              aria-label="Transparencia del trazo"
              title="Opacidad"
              type="range"
              min="0"
              max="100"
              value={getDrawingBorderOpacity(selectedDrawing)}
              disabled={selectedDrawing.locked}
              onChange={(event) =>
                updateSelectedDrawingBorderOpacity(event.target.value)
              }
              className="h-7 w-20 accent-tv-blue disabled:cursor-not-allowed disabled:opacity-50"
            />
          )}
          {hasFillOpacityControl(selectedDrawing) && (
            <input
              aria-label="Transparencia del relleno"
              title="Relleno"
              type="range"
              min="0"
              max="100"
              value={getDrawingFillOpacity(selectedDrawing)}
              disabled={selectedDrawing.locked}
              onChange={(event) =>
                updateSelectedDrawingFillOpacity(event.target.value)
              }
              className="h-7 w-20 accent-tv-blue disabled:cursor-not-allowed disabled:opacity-50"
            />
          )}
          {selectedDrawing.kind === "fibExtension" && (
            <input
              aria-label="Largo de lineas Fibonacci"
              title="Largo"
              type="range"
              min="10"
              max="100"
              value={getDrawingLineLengthPercent(selectedDrawing)}
              disabled={selectedDrawing.locked}
              onChange={(event) =>
                updateSelectedDrawingLineLength(event.target.value)
              }
              className="h-7 w-20 accent-tv-blue disabled:cursor-not-allowed disabled:opacity-50"
            />
          )}
          <button
            type="button"
            aria-label={selectedDrawing.locked ? "Desbloquear dibujo" : "Bloquear dibujo"}
            title={selectedDrawing.locked ? "Desbloquear dibujo" : "Bloquear dibujo"}
            onClick={toggleSelectedDrawingLock}
            className={`flex h-7 w-7 items-center justify-center rounded-sm ${
              selectedDrawing.locked
                ? "bg-tv-panel-hover text-tv-blue"
                : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
            }`}
          >
            {selectedDrawing.locked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              <LockOpen className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            aria-label="Borrar dibujo"
            title="Borrar"
            onClick={deleteSelectedDrawing}
            className="flex h-7 w-7 items-center justify-center rounded-sm text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-red"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Cerrar panel"
            title="Cerrar"
            onClick={() => setSelectedDrawingId(null)}
            className="flex h-7 w-7 items-center justify-center rounded-sm text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {selectedDrawing?.kind === "fixedVolumeProfile" && (
        <div
          onClick={(event) => event.stopPropagation()}
          className="absolute right-14 top-12 z-40 w-[300px] rounded-sm border border-tv-border bg-tv-panel p-3 text-xs text-tv-text shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold">Fixed Volume Profile</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={selectedDrawing.locked ? "Desbloquear dibujo" : "Bloquear dibujo"}
                title={selectedDrawing.locked ? "Desbloquear dibujo" : "Bloquear dibujo"}
                onClick={toggleSelectedDrawingLock}
                className={`flex h-7 w-7 items-center justify-center rounded-sm ${
                  selectedDrawing.locked
                    ? "bg-tv-panel-hover text-tv-blue"
                    : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
                }`}
              >
                {selectedDrawing.locked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <LockOpen className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                aria-label="Borrar dibujo"
                title="Borrar"
                onClick={deleteSelectedDrawing}
                className="flex h-7 w-7 items-center justify-center rounded-sm text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-red"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Cerrar panel"
                title="Cerrar"
                onClick={() => setSelectedDrawingId(null)}
                className="flex h-7 w-7 items-center justify-center rounded-sm text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FixedVolumeProfileNumberField
              label="Filas"
              value={getFixedVolumeProfileRows(selectedDrawing)}
              min={12}
              max={1000}
              disabled={selectedDrawing.locked}
              onChange={updateSelectedFixedVolumeProfileRows}
            />
            <FixedVolumeProfileNumberField
              label="Ancho %"
              value={getFixedVolumeProfileWidthPercent(selectedDrawing)}
              min={12}
              max={60}
              disabled={selectedDrawing.locked}
              onChange={updateSelectedFixedVolumeProfileWidth}
            />
            <FixedVolumeProfileNumberField
              label="Opacidad"
              value={selectedDrawing.fillOpacity ?? config.volumeProfile.opacity}
              min={10}
              max={100}
              disabled={selectedDrawing.locked}
              onChange={(value) => updateSelectedDrawingFillOpacity(value)}
            />
            <FixedVolumeProfileColorField
              label="Compras"
              value={getFixedVolumeProfileBuyColor(selectedDrawing)}
              fallback={FIXED_VOLUME_PROFILE_BUY_COLOR}
              disabled={selectedDrawing.locked}
              onChange={(color) =>
                updateSelectedFixedVolumeProfileColor("buy", color)
              }
            />
            <FixedVolumeProfileColorField
              label="Ventas"
              value={getFixedVolumeProfileSellColor(selectedDrawing)}
              fallback={FIXED_VOLUME_PROFILE_SELL_COLOR}
              disabled={selectedDrawing.locked}
              onChange={(color) =>
                updateSelectedFixedVolumeProfileColor("sell", color)
              }
            />
            <FixedVolumeProfileColorField
              label="POC"
              value={getFixedVolumeProfilePocColor(selectedDrawing)}
              fallback={FIXED_VOLUME_PROFILE_SELL_COLOR}
              disabled={selectedDrawing.locked}
              onChange={(color) =>
                updateSelectedFixedVolumeProfileColor("poc", color)
              }
            />
            <FixedVolumeProfileNumberField
              label="Velas"
              value={getFixedVolumeProfileCandleLimit(selectedDrawing)}
              min={1}
              max={1000}
              disabled={selectedDrawing.locked}
              onChange={updateSelectedFixedVolumeProfileCandleLimit}
            />
          </div>
        </div>
      )}

      {selectedDrawing?.kind === "fibRetracement" && (
        <div
          onClick={(event) => event.stopPropagation()}
          className="absolute right-14 top-24 z-40 w-[370px] rounded-sm border border-tv-border bg-[#1f1f1f] p-3 text-xs text-tv-text shadow-xl"
        >
          <div className="grid grid-cols-[156px_1fr] gap-x-3 gap-y-4">
            <label className="flex h-8 items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={selectedDrawing.showTrendLine ?? true}
                disabled={selectedDrawing.locked}
                onChange={(event) =>
                  updateSelectedFibonacciTrendLine(event.target.checked)
                }
                className="h-4 w-4 accent-tv-blue disabled:opacity-50"
              />
              Linea de tendencia
            </label>
            <div className="flex items-center gap-2">
              <input
                aria-label="Color de linea de tendencia"
                type="color"
                value={normalizeColor(selectedDrawing.color)}
                disabled={selectedDrawing.locked}
                onChange={(event) => updateSelectedDrawingColor(event.target.value)}
                className="h-8 w-[74px] cursor-pointer rounded border border-tv-border bg-tv-bg p-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div
                className="h-px w-8"
                style={{ backgroundColor: normalizeColor(selectedDrawing.color) }}
              />
            </div>

            <div className="flex h-8 items-center text-tv-text">Linea de niveles</div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-[74px] items-center justify-center rounded border border-tv-border bg-tv-bg">
                <span className="h-px w-12 bg-tv-text" />
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded border border-tv-border bg-tv-bg">
                <span className="h-px w-5 bg-tv-text" />
              </div>
            </div>

            <div className="flex h-8 items-center text-tv-text">Ampliar</div>
            <select
              aria-label="Ampliar lineas Fibonacci"
              value={getDrawingLineLengthPercent(selectedDrawing)}
              disabled={selectedDrawing.locked}
              onChange={(event) => updateSelectedDrawingLineLength(event.target.value)}
              className="h-8 rounded border border-tv-border bg-tv-bg px-2 text-xs text-tv-text outline-none disabled:opacity-50"
            >
              <option value={100}>Ampliar las lineas a la derecha</option>
              <option value={75}>75% hacia la derecha</option>
              <option value={50}>50% hacia la derecha</option>
              <option value={25}>25% hacia la derecha</option>
            </select>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-10 gap-y-2">
            {selectedFibonacciLevels.map((level, index) => (
              <div
                key={`fib-setting-${index}`}
                className="grid grid-cols-[20px_1fr_34px] items-center gap-2"
              >
                <input
                  aria-label={`Mostrar nivel Fibonacci ${index + 1}`}
                  type="checkbox"
                  checked={level.enabled}
                  disabled={selectedDrawing.locked}
                  onChange={(event) =>
                    updateSelectedFibonacciLevel(index, {
                      enabled: event.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-tv-blue disabled:opacity-50"
                />
                <input
                  aria-label={`Valor Fibonacci ${index + 1}`}
                  type="number"
                  step="0.001"
                  value={level.value}
                  disabled={selectedDrawing.locked || !level.enabled}
                  onChange={(event) =>
                    updateSelectedFibonacciLevel(index, {
                      value: Number(event.target.value),
                    })
                  }
                  className="h-8 min-w-0 rounded border border-tv-border bg-tv-bg px-2 text-xs tabular-nums text-tv-text outline-none disabled:opacity-50"
                />
                <input
                  aria-label={`Color Fibonacci ${index + 1}`}
                  type="color"
                  value={level.color}
                  disabled={selectedDrawing.locked || !level.enabled}
                  onChange={(event) =>
                    updateSelectedFibonacciLevel(index, {
                      color: event.target.value,
                    })
                  }
                  className="h-8 w-8 cursor-pointer rounded border border-tv-border bg-tv-bg p-1 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
          className="absolute z-40 w-44 rounded border border-tv-border bg-tv-panel py-1 shadow-xl"
        >
          <button
            type="button"
            onClick={resetChartView}
            className="flex w-full items-center px-3 py-1.5 text-left text-xs text-tv-text hover:bg-tv-panel-hover"
          >
            Resetear gráfico
          </button>
        </div>
      )}

      {countdownTop !== null && candleCountdown && (
        <div
          style={{ top: countdownTop, right: 0 }}
          className="pointer-events-none absolute z-20 h-4 min-w-[54px] rounded-l-sm border border-r-0 border-tv-border bg-tv-panel px-1 text-center text-[9px] font-semibold leading-4 tabular-nums text-tv-text shadow-md"
        >
          {candleCountdown}
        </div>
      )}

      {/* Top-left of main pane: symbol info + OHLC + Volume pill + EMA pills */}
      <div
        style={{ top: (paneOffsets[0]?.top ?? 0) + 12, left: 12 }}
        className="pointer-events-none absolute z-10 flex flex-col gap-1 text-xs tabular-nums"
      >
        {/* Row 1: symbol info + OHLC stats inline on hover (fixed height, never wraps) */}
        <div className="flex h-5 flex-nowrap items-center gap-x-3 overflow-hidden whitespace-nowrap">
          <div className="flex shrink-0 items-center gap-2 text-[13px] font-semibold">
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold leading-none shadow-sm ring-1 ring-tv-border"
              style={{
                backgroundColor: symbolLogo.bg,
                color: symbolLogo.fg,
              }}
            >
              {symbolLogo.label}
            </span>
            <span className="text-tv-text">{symbolDisplay.primary}</span>
            <span className="text-tv-text-muted">·</span>
            <span className="uppercase text-tv-text-muted">{timeframe}</span>
            <span className="text-tv-text-muted">·</span>
            <span className="text-tv-text-muted">{symbolDisplay.source}</span>
          </div>
          {hover && (
            <div className="flex items-center gap-x-3 text-[11px]">
              <span className="text-tv-text-muted">
                O <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.o)}</span>
              </span>
              <span className="text-tv-text-muted">
                H <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.h)}</span>
              </span>
              <span className="text-tv-text-muted">
                L <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.l)}</span>
              </span>
              <span className="text-tv-text-muted">
                C <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.c)}</span>
              </span>
              <span className={greenOrRed(hover.pct)}>
                {hover.pct >= 0 ? "+" : ""}
                {hover.pct.toFixed(2)}%
              </span>
              <span className="text-tv-text-muted">
                Vol <span className="text-tv-text">{formatVolume(hover.v)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Row 2: big live price (always present — reserves space even while loading) */}
        <div className="flex h-7 items-center gap-2">
          {lastPrice ? (
            <>
              <span className={`text-lg font-semibold tabular-nums ${greenOrRed(lastPrice.pct)}`}>
                {formatPrice(lastPrice.value)}
              </span>
              <span className={`text-xs ${greenOrRed(lastPrice.pct)}`}>
                {lastPrice.pct >= 0 ? "+" : ""}
                {lastPrice.pct.toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-xs text-tv-text-muted">Cargando…</span>
          )}
        </div>

        {/* Indicator pills for the main pane (fixed position below price) */}
        <div className="mt-1 flex flex-col items-start gap-1">
          {indicators.ema20 && (
            <IndicatorPill
              name={`EMA ${config.ema20}`}
              value={lastValues.ema20 !== undefined ? formatPrice(lastValues.ema20) : undefined}
              color={INDICATOR_COLORS.ema20}
              hidden={hidden.ema20}
              onToggleHide={() => toggleHidden("ema20")}
              onSettings={() => setSettingsTarget("ema20")}
              onRemove={() => removeIndicator("ema20")}
            />
          )}
          {indicators.ema50 && (
            <IndicatorPill
              name={`EMA ${config.ema50}`}
              value={lastValues.ema50 !== undefined ? formatPrice(lastValues.ema50) : undefined}
              color={INDICATOR_COLORS.ema50}
              hidden={hidden.ema50}
              onToggleHide={() => toggleHidden("ema50")}
              onSettings={() => setSettingsTarget("ema50")}
              onRemove={() => removeIndicator("ema50")}
            />
          )}
          {indicators.ema200 && (
            <IndicatorPill
              name={`EMA ${config.ema200}`}
              value={lastValues.ema200 !== undefined ? formatPrice(lastValues.ema200) : undefined}
              color={INDICATOR_COLORS.ema200}
              hidden={hidden.ema200}
              onToggleHide={() => toggleHidden("ema200")}
              onSettings={() => setSettingsTarget("ema200")}
              onRemove={() => removeIndicator("ema200")}
            />
          )}
          {indicators.emaCross && (
            <IndicatorPill
              name={`EMA Cross ${emaCrossLines
                .filter((line) => line.enabled)
                .map((line) => line.period)
                .join("/") || "off"}`}
              color={emaCrossLines[0]?.color ?? INDICATOR_COLORS.emaCross}
              hidden={hidden.emaCross}
              onToggleHide={() => toggleHidden("emaCross")}
              onSettings={() => setSettingsTarget("emaCross")}
              onRemove={() => removeIndicator("emaCross")}
            />
          )}
          {indicators.volume && (
            <IndicatorPill
              name="Vol"
              value={lastValues.volume !== undefined ? formatVolume(lastValues.volume) : undefined}
              color={INDICATOR_COLORS.volume}
              hidden={hidden.volume}
              onToggleHide={() => toggleHidden("volume")}
              onSettings={() => setSettingsTarget("volume")}
              onRemove={() => removeIndicator("volume")}
            />
          )}
          {indicators.volumeProfile && (
            <IndicatorPill
              name="VPVR"
              value={volumeProfile ? `POC ${formatPrice(volumeProfile.pocPrice)}` : undefined}
              color={INDICATOR_COLORS.volumeProfile}
              hidden={hidden.volumeProfile}
              onToggleHide={() => toggleHidden("volumeProfile")}
              onSettings={() => setSettingsTarget("volumeProfile")}
              onRemove={() => removeIndicator("volumeProfile")}
            />
          )}
          {indicators.swingPatterns && (
            <IndicatorPill
              name={`Swing H/L ${config.swingPatterns.length}`}
              color={INDICATOR_COLORS.swingPatterns}
              hidden={hidden.swingPatterns}
              onToggleHide={() => toggleHidden("swingPatterns")}
              onSettings={() => setSettingsTarget("swingPatterns")}
              onRemove={() => removeIndicator("swingPatterns")}
            />
          )}
          {indicators.pmRangeBreakout && (
            <IndicatorPill
              name="PM Range Breakout PRO"
              color={INDICATOR_COLORS.pmRangeBreakout}
              hidden={hidden.pmRangeBreakout}
              onToggleHide={() => toggleHidden("pmRangeBreakout")}
              onSettings={() => setSettingsTarget("pmRangeBreakout")}
              onRemove={() => removeIndicator("pmRangeBreakout")}
            />
          )}
        </div>
      </div>

      {/* RSI pane label */}
      {indicators.rsi && paneOffsets[rsiPaneIdx] && (
        <div
          style={{ top: paneOffsets[rsiPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name={`RSI ${config.rsi}`}
            value={lastValues.rsi !== undefined ? lastValues.rsi.toFixed(2) : undefined}
            color={INDICATOR_COLORS.rsi}
            hidden={hidden.rsi}
            onToggleHide={() => toggleHidden("rsi")}
            onSettings={() => setSettingsTarget("rsi")}
            onRemove={() => removeIndicator("rsi")}
          />
        </div>
      )}

      {/* MACD pane label */}
      {indicators.macd && paneOffsets[macdPaneIdx] && (
        <div
          style={{ top: paneOffsets[macdPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name={`MACD ${config.macdFast}, ${config.macdSlow}, ${config.macdSignal}`}
            value={
              lastValues.macd !== undefined
                ? `${lastValues.macd.toFixed(2)} / ${(lastValues.macdSignal ?? 0).toFixed(2)}`
                : undefined
            }
            color={INDICATOR_COLORS.macd}
            hidden={hidden.macd}
            onToggleHide={() => toggleHidden("macd")}
            onSettings={() => setSettingsTarget("macd")}
            onRemove={() => removeIndicator("macd")}
          />
        </div>
      )}

      {/* SQZ + ADX + TTM pane label */}
      {indicators.sqzAdxTtm && paneOffsets[sqzAdxTtmPaneIdx] && (
        <div
          style={{ top: paneOffsets[sqzAdxTtmPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name="SQZ + ADX + TTM"
            value={
              lastValues.sqzAdxTtm !== undefined
                ? `${lastValues.sqzAdxTtm.toFixed(2)}${
                    lastValues.sqzAdx !== undefined
                      ? ` / ${lastValues.sqzAdx.toFixed(2)}`
                      : ""
                  }`
                : undefined
            }
            color={INDICATOR_COLORS.sqzAdxTtm}
            hidden={hidden.sqzAdxTtm}
            onToggleHide={() => toggleHidden("sqzAdxTtm")}
            onSettings={() => setSettingsTarget("sqzAdxTtm")}
            onRemove={() => removeIndicator("sqzAdxTtm")}
          />
        </div>
      )}
    </div>
  );
}
