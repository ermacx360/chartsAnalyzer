import type { Candle } from "@/lib/binance/types";

export interface SqzAdxTtmConfig {
  showSqueeze: boolean;
  bbLength: number;
  bbMult: number;
  kcLength: number;
  kcMult: number;
  linearMomentum: number;
  showAdx: boolean;
  adxLength: number;
  keyLevel: number;
  showWaves: boolean;
  waveALength: number;
  waveBLength: number;
  waveCLength: number;
  showTtmSqueeze: boolean;
}

export interface SqzAdxTtmPoint {
  time: number;
  squeeze?: number;
  squeezeColor?: string;
  adx?: number;
  keyLevel?: number;
  compression?: number;
  compressionColor?: string;
  waveA?: number;
  waveB?: number;
  waveC?: number;
}

const OSCILLATOR_SCALE = 100;
const ADX_OSCILLATOR_SCALE = 55;

export function sqzAdxTtm(
  candles: Candle[],
  config: SqzAdxTtmConfig,
): SqzAdxTtmPoint[] {
  if (candles.length === 0) return [];

  const close = candles.map((candle) => candle.close);
  const tr = trueRange(candles);
  const bbBasis = smaValues(close, config.bbLength);
  const bbDev = stdevValues(close, config.bbLength).map((value) =>
    finite(value) ? value * config.bbMult : Number.NaN,
  );
  const kcBasis = smaValues(close, config.kcLength);
  const devKc = smaValues(tr, config.bbLength);
  const squeeze = linregMomentum(candles, config.linearMomentum);
  const adxValues = adx(candles, 14, config.adxLength);
  const waveA = ttmWave(candles, config.waveALength, config.waveALength);
  const waveB = ttmWave(candles, config.waveBLength, config.waveALength);
  const waveC = ttmWave(candles, config.waveCLength, config.waveCLength);
  const squeezeScale = rollingAbsMax(squeeze, config.linearMomentum * 3);
  const waveAScale = rollingAbsMax(waveA, config.waveALength);
  const waveBScale = rollingAbsMax(waveB, config.waveBLength);
  const waveCScale = rollingAbsMax(waveC, config.waveCLength);
  const out: SqzAdxTtmPoint[] = [];

  for (let index = 0; index < candles.length; index += 1) {
    const upperBb = bbBasis[index] + bbDev[index];
    const lowerBb = bbBasis[index] - bbDev[index];
    const kc = kcBasis[index];
    const kcRange = devKc[index];
    const previousSqueeze = index > 0 ? squeeze[index - 1] : Number.NaN;
    const point: SqzAdxTtmPoint = { time: candles[index].time };

    if (config.showSqueeze && finite(squeeze[index])) {
      const normalizedSqueeze = normalizeOscillatorValue(
        squeeze[index],
        squeezeScale[index],
      );

      if (finite(normalizedSqueeze)) {
        point.squeeze = normalizedSqueeze;
        point.squeezeColor =
          squeeze[index] > 0
            ? squeeze[index] > previousSqueeze
              ? "#2ef527"
              : "#10780d"
            : squeeze[index] < previousSqueeze
              ? "#d90606"
              : "#620000";
      }
    }

    if (config.showAdx && finite(adxValues[index])) {
      const normalizedAdx =
        ((adxValues[index] - config.keyLevel) / Math.max(config.keyLevel, 1)) *
        ADX_OSCILLATOR_SCALE;

      if (finite(normalizedAdx)) {
        point.adx = normalizedAdx;
        point.keyLevel = 0;
      }
    }

    if (
      config.showTtmSqueeze &&
      finite(lowerBb) &&
      finite(upperBb) &&
      finite(kc) &&
      finite(kcRange)
    ) {
      const highCompression =
        lowerBb >= kc - kcRange * 1 || upperBb <= kc + kcRange * 1;
      const midCompression =
        lowerBb >= kc - kcRange * 1.5 || upperBb <= kc + kcRange * 1.5;
      point.compression = 0;
      point.compressionColor =
        highCompression || midCompression ? "#8800ff" : "#ffffff";
    }

    if (config.showWaves) {
      const normalizedWaveA = normalizeOscillatorValue(
        waveA[index],
        waveAScale[index],
      );
      const normalizedWaveB = normalizeOscillatorValue(
        waveB[index],
        waveBScale[index],
      );
      const normalizedWaveC = normalizeOscillatorValue(
        waveC[index],
        waveCScale[index],
      );

      if (finite(normalizedWaveA)) {
        point.waveA = normalizedWaveA;
      }
      if (finite(normalizedWaveB)) {
        point.waveB = normalizedWaveB;
      }
      if (finite(normalizedWaveC)) {
        point.waveC = normalizedWaveC;
      }
    }

    out.push(point);
  }

  return out;
}

function normalizeOscillatorValue(value: number, scale: number) {
  if (!finite(value) || !finite(scale) || scale <= 0) return Number.NaN;
  return Math.max(
    -OSCILLATOR_SCALE,
    Math.min(OSCILLATOR_SCALE, (value / scale) * OSCILLATOR_SCALE),
  );
}

function rollingAbsMax(values: number[], length: number) {
  return values.map((_, index) => {
    const start = Math.max(0, index - length + 1);
    let max = 0;

    for (let offset = start; offset <= index; offset += 1) {
      if (finite(values[offset])) {
        max = Math.max(max, Math.abs(values[offset]));
      }
    }

    return max;
  });
}

function linregMomentum(candles: Candle[], length: number) {
  const highestHigh = highestValues(candles.map((candle) => candle.high), length);
  const lowestLow = lowestValues(candles.map((candle) => candle.low), length);
  const close = candles.map((candle) => candle.close);
  const closeSma = smaValues(close, length);
  const source = candles.map((candle, index) => {
    const rangeMid = avg(highestHigh[index], lowestLow[index]);
    const basis = avg(rangeMid, closeSma[index]);
    return finite(basis) ? candle.close - basis : Number.NaN;
  });

  return linregValues(source, length);
}

function ttmWave(candles: Candle[], slowLength: number, signalLength: number) {
  const fast = emaValues(candles.map((candle) => candle.close), 8);
  const slow = emaValues(candles.map((candle) => candle.close), slowLength);
  const macd = fast.map((value, index) =>
    finite(value) && finite(slow[index]) ? value - slow[index] : Number.NaN,
  );
  const signal = emaValues(macd, signalLength);

  return macd.map((value, index) =>
    finite(value) && finite(signal[index]) ? value - signal[index] : Number.NaN,
  );
}

function adx(candles: Candle[], diLength: number, adxLength: number) {
  const tr = trueRange(candles);
  const up = candles.map((candle, index) =>
    index === 0 ? 0 : candle.high - candles[index - 1].high,
  );
  const down = candles.map((candle, index) =>
    index === 0 ? 0 : candles[index - 1].low - candle.low,
  );
  const trRma = rmaValues(tr, diLength);
  const plusDm = up.map((value, index) =>
    value > down[index] && value > 0 ? value : 0,
  );
  const minusDm = down.map((value, index) =>
    value > up[index] && value > 0 ? value : 0,
  );
  const plusRma = rmaValues(plusDm, diLength);
  const minusRma = rmaValues(minusDm, diLength);
  const dx = candles.map((_, index) => {
    if (!finite(trRma[index]) || trRma[index] === 0) return Number.NaN;
    const plus = (100 * plusRma[index]) / trRma[index];
    const minus = (100 * minusRma[index]) / trRma[index];
    const sum = plus + minus;
    return 100 * (Math.abs(plus - minus) / (sum === 0 ? 1 : sum));
  });

  return rmaValues(dx, adxLength);
}

function trueRange(candles: Candle[]) {
  return candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });
}

function smaValues(values: number[], length: number) {
  const out = Array<number>(values.length).fill(Number.NaN);
  let sum = 0;
  let validCount = 0;

  for (let index = 0; index < values.length; index += 1) {
    if (finite(values[index])) {
      sum += values[index];
      validCount += 1;
    }
    if (index >= length && finite(values[index - length])) {
      sum -= values[index - length];
      validCount -= 1;
    }
    if (index >= length - 1 && validCount === length) {
      out[index] = sum / length;
    }
  }

  return out;
}

function emaValues(values: number[], length: number) {
  const out = Array<number>(values.length).fill(Number.NaN);
  const k = 2 / (length + 1);
  let sum = 0;
  let count = 0;
  let previous = Number.NaN;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!finite(value)) continue;
    if (!finite(previous)) {
      sum += value;
      count += 1;
      if (count === length) {
        previous = sum / length;
        out[index] = previous;
      }
      continue;
    }
    previous = value * k + previous * (1 - k);
    out[index] = previous;
  }

  return out;
}

function rmaValues(values: number[], length: number) {
  const out = Array<number>(values.length).fill(Number.NaN);
  let sum = 0;
  let count = 0;
  let previous = Number.NaN;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!finite(value)) continue;
    if (!finite(previous)) {
      sum += value;
      count += 1;
      if (count === length) {
        previous = sum / length;
        out[index] = previous;
      }
      continue;
    }
    previous = (previous * (length - 1) + value) / length;
    out[index] = previous;
  }

  return out;
}

function stdevValues(values: number[], length: number) {
  const mean = smaValues(values, length);
  return values.map((_, index) => {
    if (!finite(mean[index]) || index < length - 1) return Number.NaN;
    let sum = 0;
    for (let offset = index - length + 1; offset <= index; offset += 1) {
      sum += (values[offset] - mean[index]) ** 2;
    }
    return Math.sqrt(sum / length);
  });
}

function highestValues(values: number[], length: number) {
  return values.map((_, index) => {
    if (index < length - 1) return Number.NaN;
    let high = -Infinity;
    for (let offset = index - length + 1; offset <= index; offset += 1) {
      high = Math.max(high, values[offset]);
    }
    return high;
  });
}

function lowestValues(values: number[], length: number) {
  return values.map((_, index) => {
    if (index < length - 1) return Number.NaN;
    let low = Infinity;
    for (let offset = index - length + 1; offset <= index; offset += 1) {
      low = Math.min(low, values[offset]);
    }
    return low;
  });
}

function linregValues(values: number[], length: number) {
  const out = Array<number>(values.length).fill(Number.NaN);
  const xMean = (length - 1) / 2;
  let xVariance = 0;

  for (let index = 0; index < length; index += 1) {
    xVariance += (index - xMean) ** 2;
  }

  for (let index = length - 1; index < values.length; index += 1) {
    let ySum = 0;
    let validCount = 0;
    for (let offset = index - length + 1; offset <= index; offset += 1) {
      if (!finite(values[offset])) break;
      ySum += values[offset];
      validCount += 1;
    }
    if (validCount !== length) continue;

    const yMean = ySum / length;
    let covariance = 0;
    for (let x = 0; x < length; x += 1) {
      covariance +=
        (x - xMean) * (values[index - length + 1 + x] - yMean);
    }
    const slope = covariance / xVariance;
    const intercept = yMean - slope * xMean;
    out[index] = intercept + slope * (length - 1);
  }

  return out;
}

function avg(a: number, b: number) {
  return finite(a) && finite(b) ? (a + b) / 2 : Number.NaN;
}

function finite(value: number) {
  return Number.isFinite(value);
}
