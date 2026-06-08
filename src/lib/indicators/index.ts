import type { Candle } from "@/lib/binance/types";
export { sqzAdxTtm, type SqzAdxTtmPoint } from "./sqz-adx-ttm";

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface MACDPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

/**
 * Simple Moving Average
 */
export function sma(candles: Candle[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length < period) return out;
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period });
  }
  return out;
}

/**
 * Exponential Moving Average — seeded with SMA of first `period` candles.
 */
export function ema(candles: Candle[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length < period) return out;
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += candles[i].close;
  prev /= period;
  out.push({ time: candles[period - 1].time, value: prev });
  for (let i = period; i < candles.length; i++) {
    prev = candles[i].close * k + prev * (1 - k);
    out.push({ time: candles[i].time, value: prev });
  }
  return out;
}

/**
 * RSI (Wilder) — period typically 14.
 */
export function rsi(candles: Candle[], period = 14): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  gain /= period;
  loss /= period;
  let value = loss === 0 ? 100 : gain === 0 ? 0 : 100 - 100 / (1 + gain / loss);
  out.push({ time: candles[period].time, value });
  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    value = loss === 0 ? 100 : gain === 0 ? 0 : 100 - 100 / (1 + gain / loss);
    out.push({ time: candles[i].time, value });
  }
  return out;
}

/**
 * MACD — fast EMA, slow EMA, signal EMA of the MACD line.
 * Defaults: 12 / 26 / 9.
 */
export function macd(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signal = 9,
): MACDPoint[] {
  if (candles.length < slow + signal) return [];
  const emaFast = ema(candles, fast);
  const emaSlow = ema(candles, slow);
  // align: emaSlow starts later
  const slowStartTime = emaSlow[0].time;
  const fastByTime = new Map(emaFast.map((p) => [p.time, p.value]));
  const macdLine: IndicatorPoint[] = [];
  for (const p of emaSlow) {
    const f = fastByTime.get(p.time);
    if (f !== undefined) macdLine.push({ time: p.time, value: f - p.value });
  }
  // signal = EMA of MACD line. Build synthetic candles for ema()
  const synth: Candle[] = macdLine.map((p) => ({
    time: p.time,
    open: p.value,
    high: p.value,
    low: p.value,
    close: p.value,
    volume: 0,
  }));
  const sig = ema(synth, signal);
  const sigByTime = new Map(sig.map((p) => [p.time, p.value]));
  const out: MACDPoint[] = [];
  for (const p of macdLine) {
    const s = sigByTime.get(p.time);
    if (s === undefined) continue;
    out.push({ time: p.time, macd: p.value, signal: s, histogram: p.value - s });
  }
  void slowStartTime;
  return out;
}

export interface VwapBandsOptions {
  anchor: "Session" | "Week" | "Month" | "Year";
  calcMode: "Standard Deviation" | "Percentage";
  showBand1: boolean;
  bandMult1: number;
  showBand2: boolean;
  bandMult2: number;
  showBand3: boolean;
  bandMult3: number;
}

export interface VwapBandsPoint {
  time: number;
  vwap: number;
  upper1?: number;
  lower1?: number;
  upper2?: number;
  lower2?: number;
  upper3?: number;
  lower3?: number;
}

/**
 * Volume Weighted Average Price (VWAP) with Bands
 * Matches TradingView's VWAP algorithm with Standard Deviation or Percentage bands.
 */
export function vwapBands(candles: Candle[], config: VwapBandsOptions): VwapBandsPoint[] {
  const out: VwapBandsPoint[] = [];
  if (candles.length === 0) return out;

  let sumPv = 0;
  let sumV = 0;
  let sumP2v = 0;
  let currentPeriod = -1;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    
    const date = new Date(c.time * 1000);
    let period = -1;
    if (config.anchor === "Session") {
      period = Math.floor(c.time / 86400);
    } else if (config.anchor === "Week") {
      // Offset by 345600 seconds to align weeks with Monday instead of Thursday
      period = Math.floor((c.time - 345600) / 604800);
    } else if (config.anchor === "Month") {
      period = date.getUTCFullYear() * 12 + date.getUTCMonth();
    } else if (config.anchor === "Year") {
      period = date.getUTCFullYear();
    }

    if (period !== currentPeriod) {
      sumPv = 0;
      sumV = 0;
      sumP2v = 0;
      currentPeriod = period;
    }

    const typicalPrice = (c.high + c.low + c.close) / 3;
    sumPv += typicalPrice * c.volume;
    sumV += c.volume;
    sumP2v += typicalPrice * typicalPrice * c.volume;

    if (sumV === 0) {
      out.push({ time: c.time, vwap: typicalPrice });
      continue;
    }

    const currentVwap = sumPv / sumV;
    const point: VwapBandsPoint = { time: c.time, vwap: currentVwap };

    let bandBasis = 0;
    if (config.calcMode === "Percentage") {
      bandBasis = currentVwap * 0.01;
    } else {
      const variance = (sumP2v / sumV) - (currentVwap * currentVwap);
      const stdev = Math.sqrt(Math.max(0, variance));
      bandBasis = stdev;
    }

    if (config.showBand1) {
      point.upper1 = currentVwap + bandBasis * config.bandMult1;
      point.lower1 = currentVwap - bandBasis * config.bandMult1;
    }
    if (config.showBand2) {
      point.upper2 = currentVwap + bandBasis * config.bandMult2;
      point.lower2 = currentVwap - bandBasis * config.bandMult2;
    }
    if (config.showBand3) {
      point.upper3 = currentVwap + bandBasis * config.bandMult3;
      point.lower3 = currentVwap - bandBasis * config.bandMult3;
    }

    out.push(point);
  }

  return out;
}
