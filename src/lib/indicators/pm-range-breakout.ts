import type { Candle } from "@/lib/binance/types";
import type { PmRangeBreakoutConfig } from "@/lib/store/chart-store";
import { ema, rsi } from "@/lib/indicators";

export type PmOverlayBoxKind =
  | "daily"
  | "session"
  | "premarket"
  | "pm"
  | "fvgBull"
  | "fvgBear"
  | "tradeProfit"
  | "tradeRisk";

export interface PmOverlayBox {
  kind: PmOverlayBoxKind;
  startTime: number;
  endTime: number;
  top: number;
  bottom: number;
  fill: string;
  stroke: string;
  opacity: number;
  text?: string;
}

export interface PmOverlayLabel {
  time: number;
  price: number;
  text: string;
  color: string;
  textColor: string;
  direction?: "up" | "down" | "left";
}

export interface PmOverlayLine {
  startTime: number;
  endTime: number;
  price: number;
  color: string;
  dashed?: boolean;
  text?: string;
}

export interface PmRangeOverlay {
  boxes: PmOverlayBox[];
  labels: PmOverlayLabel[];
  lines: PmOverlayLine[];
  ema20: { time: number; value: number }[];
  ema200: { time: number; value: number }[];
}

interface SessionDef {
  id: "ny" | "ldn" | "tk";
  name: string;
  session: string;
  preName: string;
  preSession: string;
  active: boolean;
  tradeActive: boolean;
  preActive: boolean;
  sessionColor: string;
  preColor: string;
}

interface SessionState {
  inSession: boolean;
  startIndex: number;
  hi: number | null;
  lo: number | null;
  open: number | null;
}

interface TradeState {
  longSent: boolean;
  shortSent: boolean;
  nullSent: boolean;
  firstBreakDir: -1 | 0 | 1;
}

interface FvgZone {
  kind: "fvgBull" | "fvgBear";
  startTime: number;
  endTime: number;
  top: number;
  bottom: number;
  closed: boolean;
}

const SESSION_COLORS = {
  ny: { session: "#2962ff", pre: "#2962ff" },
  ldn: { session: "#ffffff", pre: "#ffffff" },
  tk: { session: "#ffffff", pre: "#ffffff" },
};

const zonedMinuteCache = new Map<string, number>();
const dayIdCache = new Map<string, string>();
const minuteFormatters = new Map<string, Intl.DateTimeFormat>();
const dayFormatters = new Map<string, Intl.DateTimeFormat>();
const sessionMinutesCache = new Map<string, number>();

export function computePmRangeBreakoutOverlay(
  candles: Candle[],
  config: PmRangeBreakoutConfig,
  stepSeconds: number,
): PmRangeOverlay {
  if (!config.enabled || candles.length === 0) {
    return { boxes: [], labels: [], lines: [], ema20: [], ema200: [] };
  }

  const boxes: PmOverlayBox[] = [];
  const labels: PmOverlayLabel[] = [];
  const lines: PmOverlayLine[] = [];
  const needsRsiDivergence = config.useRsiDivFilter || config.showRsiDivInTrade;
  const needsEmaContext = needsRsiDivergence && config.useEmaContextDiv;
  const ema20 = config.showEMA || needsEmaContext ? ema(candles, 20) : [];
  const ema200 = config.showEMA || needsEmaContext ? ema(candles, 200) : [];
  const ema20ByTime = new Map(ema20.map((point) => [point.time, point.value]));
  const ema200ByTime = new Map(ema200.map((point) => [point.time, point.value]));
  const rsiValues = needsRsiDivergence ? rsi(candles, config.rsiLen) : [];
  const rsiByTime = new Map(rsiValues.map((point) => [point.time, point.value]));

  const sessions: SessionDef[] = [
    {
      id: "ny",
      name: "NEW YORK",
      session: config.nySession,
      preName: "PRE NY",
      preSession: config.nyPreSession,
      active: config.nyActive,
      tradeActive: config.nyTradeActive,
      preActive: config.nyPreActive,
      sessionColor: SESSION_COLORS.ny.session,
      preColor: SESSION_COLORS.ny.pre,
    },
    {
      id: "ldn",
      name: "LONDON",
      session: config.ldnSession,
      preName: "PRE LDN",
      preSession: config.ldnPreSession,
      active: config.ldnActive,
      tradeActive: config.ldnTradeActive,
      preActive: config.ldnPreActive,
      sessionColor: SESSION_COLORS.ldn.session,
      preColor: SESSION_COLORS.ldn.pre,
    },
    {
      id: "tk",
      name: "TOKYO",
      session: config.tkSession,
      preName: "PRE TOKYO",
      preSession: config.tkPreSession,
      active: config.tkActive,
      tradeActive: config.tkTradeActive,
      preActive: config.tkPreActive,
      sessionColor: SESSION_COLORS.tk.session,
      preColor: SESSION_COLORS.tk.pre,
    },
  ];

  const sessionStates = new Map<string, SessionState>();
  const preStates = new Map<string, SessionState>();
  const tradeStates = new Map<string, TradeState>();
  sessions.forEach((session) => {
    sessionStates.set(session.id, createSessionState());
    preStates.set(session.id, createSessionState());
    tradeStates.set(session.id, {
      longSent: false,
      shortSent: false,
      nullSent: false,
      firstBreakDir: 0,
    });
  });

  let dayState = createSessionState();
  let lastDayId = "";
  let nyRefLdnHi: number | null = null;
  let nyRefLdnLo: number | null = null;
  let nySweepHigh = false;
  let nySweepLow = false;

  let pmState = createSessionState();
  let pmTrade: TradeState = {
    longSent: false,
    shortSent: false,
    nullSent: false,
    firstBreakDir: 0,
  };
  let lastPmDayId = "";

  const div = createDivergenceState();
  let prevHHLLHigh: number | null = null;
  let prevHHLLLow: number | null = null;
  let bosLastHigh: { price: number; index: number } | null = null;
  let bosLastLow: { price: number; index: number } | null = null;
  let bosBullStruct: boolean | null = null;
  const fvgZones: FvgZone[] = [];

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const prev = candles[index - 1];
    const dayId = getDayId(candle.time, config.timeZone);
    const isNewDay = dayId !== lastDayId;
    const isNewPmDay = dayId !== lastPmDayId;

    if (isNewDay) {
      if (config.showDailyBox && dayState.hi !== null && dayState.lo !== null) {
        pushSessionBox(boxes, candles, dayState, index - 1, "DAILY", config, "daily", "#787b86", 0.08);
      }
      dayState = createSessionState();
      lastDayId = dayId;
    }

    if (config.showDailyBox) updateSessionState(dayState, index, candle);
    if (config.showFvg) {
      updateFvgZones(fvgZones, candles, index, config, stepSeconds);
    }

    if (isNewPmDay) {
      pmState = createSessionState();
      pmTrade = { longSent: false, shortSent: false, nullSent: false, firstBreakDir: 0 };
      resetDivergence(div);
      lastPmDayId = dayId;
    }

    if (needsRsiDivergence) {
      updateDivergence(candles, index, config, rsiByTime, ema20ByTime, ema200ByTime, div);
    }

    const inTimeWindow = isInsideTimeFilter(candle.time, config);
    const inPM =
      (config.showPMBox || config.nyTradeActive) &&
      inSession(candle.time, config.nyPreSession, config.timeZone);
    handlePmRange(candles, index, inPM, pmState, pmTrade, boxes, labels, config, stepSeconds, inTimeWindow, div);

    sessions.forEach((session) => {
      const sessionState = sessionStates.get(session.id)!;
      const preState = preStates.get(session.id)!;
      const tradeState = tradeStates.get(session.id)!;
      const inMain = inSession(candle.time, session.session, config.timeZone);
      const inPre = inSession(candle.time, session.preSession, config.timeZone);
      const wasMain = prev ? inSession(prev.time, session.session, config.timeZone) : false;
      const wasPre = prev ? inSession(prev.time, session.preSession, config.timeZone) : false;

      if (session.active) handleVisualSession(candles, index, inMain, wasMain, sessionState, boxes, session.name, config, "session", session.sessionColor, 0.1);
      if (session.preActive) handleVisualSession(candles, index, inPre, wasPre, preState, boxes, session.preName, config, "premarket", session.preColor, 0.08);
      if (inPre && !wasPre) {
        tradeState.longSent = false;
        tradeState.shortSent = false;
        tradeState.nullSent = false;
        tradeState.firstBreakDir = 0;
      }

      if (session.id === "ny" && inMain && !wasMain) {
        const ldn = sessionStates.get("ldn")!;
        nyRefLdnHi = ldn.hi;
        nyRefLdnLo = ldn.lo;
        nySweepHigh = false;
        nySweepLow = false;
      }

      if (session.tradeActive) {
        handleSessionTrade(
          candles,
          index,
          session,
          inMain && !inPre,
          preState,
          tradeState,
          boxes,
          labels,
          config,
          stepSeconds,
          div,
        );
      }
    });

    if (config.showSweeps) {
      const nyIn = inSession(candle.time, config.nySession, config.timeZone);
      if (nyIn && nyRefLdnHi !== null && !nySweepHigh && candle.high > nyRefLdnHi && candle.close < nyRefLdnHi) {
        nySweepHigh = true;
        labels.push({ time: candle.time, price: nyRefLdnHi, text: "VALID SWEEP\nLDN HIGH", color: config.shortColor, textColor: config.textColor, direction: "down" });
      }
      if (nyIn && nyRefLdnLo !== null && !nySweepLow && candle.low < nyRefLdnLo && candle.close > nyRefLdnLo) {
        nySweepLow = true;
        labels.push({ time: candle.time, price: nyRefLdnLo, text: "VALID SWEEP\nLDN LOW", color: config.longColor, textColor: config.textColor, direction: "up" });
      }
    }

    if (config.hhllEnabled) {
      const ph = pivotHigh(candles, index, config.hhllLen);
      const pl = pivotLow(candles, index, config.hhllLen);
      if (ph !== null) {
        const pivot = candles[index - config.hhllLen];
        const text = prevHHLLHigh === null || ph > prevHHLLHigh ? "HH" : "LH";
        labels.push({ time: pivot.time, price: ph, text, color: config.shortColor, textColor: config.textColor, direction: "down" });
        prevHHLLHigh = ph;
      }
      if (pl !== null) {
        const pivot = candles[index - config.hhllLen];
        const text = prevHHLLLow === null || pl > prevHHLLLow ? "HL" : "LL";
        labels.push({ time: pivot.time, price: pl, text, color: config.longColor, textColor: config.textColor, direction: "up" });
        prevHHLLLow = pl;
      }
    }

    if (config.bosEnabled) {
      const ph = pivotHigh(candles, index, config.bosLen);
      const pl = pivotLow(candles, index, config.bosLen);
      if (ph !== null) bosLastHigh = { price: ph, index: index - config.bosLen };
      if (pl !== null) bosLastLow = { price: pl, index: index - config.bosLen };
      if (prev && bosLastHigh && candle.close > bosLastHigh.price && prev.close <= bosLastHigh.price) {
        const choch = bosBullStruct === false;
        const color = choch ? config.divColor : "#2962ff";
        lines.push({ startTime: candles[bosLastHigh.index].time, endTime: candle.time, price: bosLastHigh.price, color, dashed: true, text: choch ? "CHoCH ▲" : "BOS ▲" });
        labels.push({ time: candle.time, price: bosLastHigh.price, text: choch ? "CHoCH ▲" : "BOS ▲", color, textColor: config.textColor, direction: "left" });
        bosBullStruct = true;
        bosLastHigh = null;
      }
      if (prev && bosLastLow && candle.close < bosLastLow.price && prev.close >= bosLastLow.price) {
        const choch = bosBullStruct === true;
        const color = choch ? config.divColor : "#2962ff";
        lines.push({ startTime: candles[bosLastLow.index].time, endTime: candle.time, price: bosLastLow.price, color, dashed: true, text: choch ? "CHoCH ▼" : "BOS ▼" });
        labels.push({ time: candle.time, price: bosLastLow.price, text: choch ? "CHoCH ▼" : "BOS ▼", color, textColor: config.textColor, direction: "left" });
        bosBullStruct = false;
        bosLastLow = null;
      }
    }
  }

  if (config.showDailyBox && dayState.hi !== null && dayState.lo !== null) {
    pushSessionBox(boxes, candles, dayState, candles.length - 1, "DAILY", config, "daily", "#787b86", 0.08);
  }
  sessions.forEach((session) => {
    const state = sessionStates.get(session.id)!;
    const pre = preStates.get(session.id)!;
    if (session.active && state.inSession && state.hi !== null && state.lo !== null) {
      pushSessionBox(
        boxes,
        candles,
        state,
        candles.length - 1,
        session.name,
        config,
        "session",
        session.sessionColor,
        0.1,
      );
    }
    if (session.preActive && pre.inSession && pre.hi !== null && pre.lo !== null) {
      pushSessionBox(
        boxes,
        candles,
        pre,
        candles.length - 1,
        session.preName,
        config,
        "premarket",
        session.preColor,
        0.08,
      );
    }
  });
  if (config.showFvg) {
    pushFvgBoxes(boxes, fvgZones, candles[candles.length - 1].time, stepSeconds, config);
  }

  const visibleOverlay = config.showTradeHistory
    ? { boxes, labels }
    : filterLatestTradeOverlay(boxes, labels);

  return {
    boxes: visibleOverlay.boxes.slice(-500),
    labels: visibleOverlay.labels.slice(-500),
    lines: lines.slice(-500),
    ema20: config.showEMA ? ema20 : [],
    ema200: config.showEMA ? ema200 : [],
  };
}

function filterLatestTradeOverlay(boxes: PmOverlayBox[], labels: PmOverlayLabel[]) {
  const tradeBoxes = boxes.filter(isTradeBox);
  const tradeSignalLabels = labels.filter(isTradeSignalLabel);
  const lastBoxStart = Math.max(...tradeBoxes.map((box) => box.startTime), -Infinity);
  const lastLabelTime = Math.max(...tradeSignalLabels.map((label) => label.time), -Infinity);
  const latestTradeTime = Math.max(lastBoxStart, lastLabelTime);

  if (!Number.isFinite(latestTradeTime)) {
    return { boxes, labels };
  }

  const latestTradeEndTimes = new Set(
    tradeBoxes
      .filter((box) => box.startTime === latestTradeTime)
      .map((box) => box.endTime),
  );

  return {
    boxes: boxes.filter((box) => !isTradeBox(box) || box.startTime === latestTradeTime),
    labels: labels.filter((label) => {
      if (!isTradeLabel(label)) return true;
      return label.time === latestTradeTime || latestTradeEndTimes.has(label.time);
    }),
  };
}

function isTradeBox(box: PmOverlayBox) {
  return box.kind === "tradeProfit" || box.kind === "tradeRisk";
}

function isTradeLabel(label: PmOverlayLabel) {
  return (
    label.text.includes("RUPTURA") ||
    label.text.includes(" LONG") ||
    label.text.includes(" SHORT") ||
    label.text.includes("TRADE NULO") ||
    label.text.includes("ANULADO")
  );
}

function isTradeSignalLabel(label: PmOverlayLabel) {
  return (
    label.text.includes("RUPTURA") ||
    label.text.includes("TRADE NULO") ||
    label.text.includes("ANULADO")
  );
}

function createSessionState(): SessionState {
  return { inSession: false, startIndex: 0, hi: null, lo: null, open: null };
}

function updateFvgZones(
  zones: FvgZone[],
  candles: Candle[],
  index: number,
  config: PmRangeBreakoutConfig,
  stepSeconds: number,
) {
  const candle = candles[index];

  for (const zone of zones) {
    if (zone.closed || candle.time <= zone.startTime) continue;
    const midpoint = (zone.top + zone.bottom) / 2;
    const closed =
      zone.kind === "fvgBull"
        ? config.fvgCloseMode === "close"
          ? candle.close <= zone.bottom
          : candle.low <= midpoint
        : config.fvgCloseMode === "close"
          ? candle.close >= zone.top
          : candle.high >= midpoint;

    if (closed) {
      zone.closed = true;
      zone.endTime = candle.time;
    } else {
      zone.endTime = candle.time + stepSeconds * 8;
    }
  }

  if (index < 2) return;
  const left = candles[index - 2];

  if (left.high < candle.low) {
    zones.push({
      kind: "fvgBull",
      startTime: candle.time,
      endTime: candle.time + stepSeconds * 8,
      top: candle.low,
      bottom: left.high,
      closed: false,
    });
  }

  if (left.low > candle.high) {
    zones.push({
      kind: "fvgBear",
      startTime: candle.time,
      endTime: candle.time + stepSeconds * 8,
      top: left.low,
      bottom: candle.high,
      closed: false,
    });
  }

  if (zones.length > 120) {
    zones.splice(0, zones.length - 120);
  }
}

function pushFvgBoxes(
  boxes: PmOverlayBox[],
  zones: FvgZone[],
  lastTime: number,
  stepSeconds: number,
  config: PmRangeBreakoutConfig,
) {
  const maxActive = Math.max(1, Math.min(20, config.maxActiveFvg || 5));
  const visibleZones = config.hideMitigatedFvg
    ? zones.filter((zone) => !zone.closed).slice(-maxActive)
    : zones.slice(-maxActive);

  visibleZones.forEach((zone) => {
    boxes.push({
      kind: zone.kind,
      startTime: zone.startTime,
      endTime: zone.closed ? zone.endTime : Math.max(zone.endTime, lastTime + stepSeconds * 8),
      top: zone.top,
      bottom: zone.bottom,
      fill: zone.kind === "fvgBull" ? "#22ab94" : "#f23645",
      stroke: zone.kind === "fvgBull" ? "#22ab94" : "#f23645",
      opacity: zone.closed ? 0.06 : 0.13,
      text: zone.kind === "fvgBull" ? "FVG +" : "FVG -",
    });
  });
}

function updateSessionState(state: SessionState, index: number, candle: Candle) {
  if (!state.inSession) {
    state.inSession = true;
    state.startIndex = index;
    state.hi = candle.high;
    state.lo = candle.low;
    state.open = candle.open;
    return;
  }
  state.hi = Math.max(state.hi ?? candle.high, candle.high);
  state.lo = Math.min(state.lo ?? candle.low, candle.low);
}

function handleVisualSession(candles: Candle[], index: number, inside: boolean, wasInside: boolean, state: SessionState, boxes: PmOverlayBox[], name: string, config: PmRangeBreakoutConfig, kind: PmOverlayBoxKind, color: string, opacity: number) {
  if (inside) updateSessionState(state, index, candles[index]);
  if (!inside && wasInside && state.hi !== null && state.lo !== null) {
    pushSessionBox(boxes, candles, state, index - 1, name, config, kind, color, opacity);
    state.inSession = false;
  }
}

function pushSessionBox(boxes: PmOverlayBox[], candles: Candle[], state: SessionState, endIndex: number, name: string, config: PmRangeBreakoutConfig, kind: PmOverlayBoxKind, color: string, opacity: number) {
  if (state.hi === null || state.lo === null || state.open === null) return;
  const rangePct = state.lo !== 0 ? ((state.hi - state.lo) / state.lo) * 100 : 0;
  const last = candles[Math.max(0, endIndex)];
  const direction = last.close >= state.open ? "Bullish" : "Bearish";
  const expansion = rangePct >= config.expansionPct ? "EXPANSION" : "Normal";
  boxes.push({
    kind,
    startTime: candles[state.startIndex].time,
    endTime: candles[Math.max(state.startIndex, endIndex)].time,
    top: state.hi,
    bottom: state.lo,
    fill: color,
    stroke: color,
    opacity,
    text: `${name}\nH: ${formatValue(state.hi)}\nL: ${formatValue(state.lo)}\nR: ${rangePct.toFixed(2)}%\n${direction} | ${expansion}`,
  });
}

function handlePmRange(candles: Candle[], index: number, inPM: boolean, state: SessionState, trade: TradeState, boxes: PmOverlayBox[], labels: PmOverlayLabel[], config: PmRangeBreakoutConfig, stepSeconds: number, inTrading: boolean, div: ReturnType<typeof createDivergenceState>) {
  const candle = candles[index];
  const prev = candles[index - 1];
  const wasPM = prev ? inSession(prev.time, config.nyPreSession, config.timeZone) : false;
  if (inPM) updateSessionState(state, index, candle);
  if (!inPM && wasPM && state.hi !== null && state.lo !== null) {
    if (config.showPMBox) {
      const rangePct = state.lo !== 0 ? ((state.hi - state.lo) / state.lo) * 100 : 0;
      boxes.push({ kind: "pm", startTime: candles[state.startIndex].time, endTime: prev!.time, top: state.hi, bottom: state.lo, fill: config.pmColor, stroke: config.pmColor, opacity: 0.15, text: config.showPMPct ? `PM\nRango: ${rangePct.toFixed(2)}%` : "PM" });
      labels.push({ time: candle.time, price: state.hi, text: `PM High: ${formatValue(state.hi)}\nRango: ${rangePct.toFixed(2)}%`, color: config.longColor, textColor: config.textColor, direction: "left" });
      labels.push({ time: candle.time, price: state.lo, text: `PM Low: ${formatValue(state.lo)}`, color: config.shortColor, textColor: config.textColor, direction: "left" });
    }
    state.inSession = false;
  }
  if (state.hi === null || state.lo === null || inPM || !prev || !inTrading) return;
  handleBreakout(candles, index, "NY", state.hi, state.lo, trade, boxes, labels, config, stepSeconds, div);
}

function handleSessionTrade(candles: Candle[], index: number, session: SessionDef, tradeWindow: boolean, preState: SessionState, tradeState: TradeState, boxes: PmOverlayBox[], labels: PmOverlayLabel[], config: PmRangeBreakoutConfig, stepSeconds: number, div: ReturnType<typeof createDivergenceState>) {
  if (!tradeWindow || preState.hi === null || preState.lo === null) return;
  handleBreakout(candles, index, session.name, preState.hi, preState.lo, tradeState, boxes, labels, config, stepSeconds, div);
}

function handleBreakout(candles: Candle[], index: number, name: string, hi: number, lo: number, trade: TradeState, boxes: PmOverlayBox[], labels: PmOverlayLabel[], config: PmRangeBreakoutConfig, stepSeconds: number, div: ReturnType<typeof createDivergenceState>) {
  const candle = candles[index];
  const prev = candles[index - 1];
  if (!prev) return;
  const confirmedClose = index < candles.length - 1;
  if (!confirmedClose) return;
  const rawLong = candle.close > hi && prev.close <= hi;
  const rawShort = candle.close < lo && prev.close >= lo;
  const blockLong = config.useRsiDivFilter && div.activeBear;
  const blockShort = config.useRsiDivFilter && div.activeBull;
  const nullTrade = config.showNull && ((rawLong && trade.firstBreakDir === -1) || (rawShort && trade.firstBreakDir === 1)) && !trade.nullSent;
  const longBreak = config.allowLong && rawLong && trade.firstBreakDir === 0 && !trade.longSent && !nullTrade && !blockLong;
  const shortBreak = config.allowShort && rawShort && trade.firstBreakDir === 0 && !trade.shortSent && !nullTrade && !blockShort;
  const endTime = candle.time + stepSeconds * 30;
  if (longBreak) {
    const risk = hi - lo;
    const tp = hi + risk * config.rr;
    boxes.push({ kind: "tradeProfit", startTime: candle.time, endTime, top: tp, bottom: hi, fill: config.longColor, stroke: config.longColor, opacity: 0.16 });
    boxes.push({ kind: "tradeRisk", startTime: candle.time, endTime, top: hi, bottom: lo, fill: config.shortColor, stroke: config.shortColor, opacity: 0.16 });
    const rsiWarning = config.showRsiDivInTrade && div.activeBear;
    labels.push({ time: candle.time, price: candle.high, text: `RUPTURA ALCISTA ${name}\n${formatValue(hi)}`, color: config.longColor, textColor: config.textColor, direction: "down" });
    labels.push({ time: endTime, price: hi, text: `${name} LONG\nEntrada: ${formatValue(hi)}\nSL: ${formatValue(lo)}\nTP: ${formatValue(tp)}\nRR: ${config.rr}${rsiWarning ? "\nRSI DIV BAJISTA CONFIRMADA" : ""}`, color: rsiWarning ? config.divColor : config.longColor, textColor: config.textColor, direction: "left" });
    trade.longSent = true;
    trade.firstBreakDir = 1;
    div.activeBull = false;
    div.activeBear = false;
  } else if (shortBreak) {
    const risk = hi - lo;
    const tp = lo - risk * config.rr;
    boxes.push({ kind: "tradeProfit", startTime: candle.time, endTime, top: lo, bottom: tp, fill: config.longColor, stroke: config.longColor, opacity: 0.16 });
    boxes.push({ kind: "tradeRisk", startTime: candle.time, endTime, top: hi, bottom: lo, fill: config.shortColor, stroke: config.shortColor, opacity: 0.16 });
    const rsiWarning = config.showRsiDivInTrade && div.activeBull;
    labels.push({ time: candle.time, price: candle.low, text: `RUPTURA BAJISTA ${name}\n${formatValue(lo)}`, color: config.shortColor, textColor: config.textColor, direction: "up" });
    labels.push({ time: endTime, price: lo, text: `${name} SHORT\nEntrada: ${formatValue(lo)}\nSL: ${formatValue(hi)}\nTP: ${formatValue(tp)}\nRR: ${config.rr}${rsiWarning ? "\nRSI DIV ALCISTA CONFIRMADA" : ""}`, color: rsiWarning ? config.divColor : config.shortColor, textColor: config.textColor, direction: "left" });
    trade.shortSent = true;
    trade.firstBreakDir = -1;
    div.activeBull = false;
    div.activeBear = false;
  } else if (nullTrade) {
    labels.push({ time: candle.time, price: candle.close, text: `${name} TRADE NULO\nFalsa ruptura`, color: config.nullColor, textColor: config.textColor, direction: "left" });
    trade.nullSent = true;
  } else if (rawLong && blockLong && !trade.longSent) {
    labels.push({ time: candle.time, price: candle.high, text: `${name} LONG ANULADO\nRSI DIV BAJISTA CONFIRMADA`, color: config.divColor, textColor: config.textColor, direction: "down" });
    trade.longSent = true;
    div.activeBear = false;
  } else if (rawShort && blockShort && !trade.shortSent) {
    labels.push({ time: candle.time, price: candle.low, text: `${name} SHORT ANULADO\nRSI DIV ALCISTA CONFIRMADA`, color: config.divColor, textColor: config.textColor, direction: "up" });
    trade.shortSent = true;
    div.activeBull = false;
  }
}

function createDivergenceState() {
  return { lastPriceHigh: null as number | null, prevPriceHigh: null as number | null, lastRsiHigh: null as number | null, prevRsiHigh: null as number | null, lastPriceLow: null as number | null, prevPriceLow: null as number | null, lastRsiLow: null as number | null, prevRsiLow: null as number | null, activeBull: false, activeBear: false, lastBullBar: null as number | null, lastBearBar: null as number | null };
}

function resetDivergence(state: ReturnType<typeof createDivergenceState>) {
  state.activeBull = false;
  state.activeBear = false;
  state.lastBullBar = null;
  state.lastBearBar = null;
}

function updateDivergence(candles: Candle[], index: number, config: PmRangeBreakoutConfig, rsiByTime: Map<number, number>, ema20ByTime: Map<number, number>, ema200ByTime: Map<number, number>, state: ReturnType<typeof createDivergenceState>) {
  const ph = pivotHigh(candles, index, config.pivotLen);
  const pl = pivotLow(candles, index, config.pivotLen);
  const pivot = candles[index - config.pivotLen];
  if (!pivot) return;
  const rsiValue = rsiByTime.get(pivot.time);
  const ema20Value = ema20ByTime.get(pivot.time);
  const ema200Value = ema200ByTime.get(pivot.time);
  const bullTrend = ema20Value !== undefined && ema200Value !== undefined && ema20Value > ema200Value;
  const bearTrend = ema20Value !== undefined && ema200Value !== undefined && ema20Value < ema200Value;
  if (ph !== null && rsiValue !== undefined) {
    state.prevPriceHigh = state.lastPriceHigh;
    state.prevRsiHigh = state.lastRsiHigh;
    state.lastPriceHigh = ph;
    state.lastRsiHigh = rsiValue;
    const raw = state.prevPriceHigh !== null && state.prevRsiHigh !== null && state.lastPriceHigh > state.prevPriceHigh && state.lastRsiHigh < state.prevRsiHigh;
    const extreme = !config.requireRsiExtreme || (state.prevRsiHigh ?? 0) >= config.rsiOB || state.lastRsiHigh >= config.rsiOB;
    const diff = state.prevRsiHigh !== null && state.prevRsiHigh - state.lastRsiHigh >= config.minRsiDiff;
    const emaOk = !config.useEmaContextDiv || !bullTrend;
    if (raw && extreme && diff && emaOk) {
      state.activeBear = true;
      state.activeBull = false;
      state.lastBearBar = index;
    }
  }
  if (pl !== null && rsiValue !== undefined) {
    state.prevPriceLow = state.lastPriceLow;
    state.prevRsiLow = state.lastRsiLow;
    state.lastPriceLow = pl;
    state.lastRsiLow = rsiValue;
    const raw = state.prevPriceLow !== null && state.prevRsiLow !== null && state.lastPriceLow < state.prevPriceLow && state.lastRsiLow > state.prevRsiLow;
    const extreme = !config.requireRsiExtreme || (state.prevRsiLow ?? 100) <= config.rsiOS || state.lastRsiLow <= config.rsiOS;
    const diff = state.prevRsiLow !== null && state.lastRsiLow - state.prevRsiLow >= config.minRsiDiff;
    const emaOk = !config.useEmaContextDiv || !bearTrend;
    if (raw && extreme && diff && emaOk) {
      state.activeBull = true;
      state.activeBear = false;
      state.lastBullBar = index;
    }
  }
  if (state.activeBear && state.lastBearBar !== null && index - state.lastBearBar > config.divValidBars) state.activeBear = false;
  if (state.activeBull && state.lastBullBar !== null && index - state.lastBullBar > config.divValidBars) state.activeBull = false;
}

function pivotHigh(candles: Candle[], index: number, length: number) {
  const pivotIndex = index - length;
  if (pivotIndex < length) return null;
  const value = candles[pivotIndex].high;
  for (let i = pivotIndex - length; i <= pivotIndex + length; i += 1) {
    if (i === pivotIndex) continue;
    if (!candles[i] || candles[i].high >= value) return null;
  }
  return value;
}

function pivotLow(candles: Candle[], index: number, length: number) {
  const pivotIndex = index - length;
  if (pivotIndex < length) return null;
  const value = candles[pivotIndex].low;
  for (let i = pivotIndex - length; i <= pivotIndex + length; i += 1) {
    if (i === pivotIndex) continue;
    if (!candles[i] || candles[i].low <= value) return null;
  }
  return value;
}

function isInsideTimeFilter(time: number, config: PmRangeBreakoutConfig) {
  if (!config.useTimeFilter) return true;
  const minutes = getZonedMinutes(time, config.timeZone);
  const start = config.startHour * 60 + config.startMinute;
  const end = config.endHour * 60 + config.endMinute;
  return start <= end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end;
}

function inSession(time: number, session: string, timeZone: string) {
  const [startRaw, endRaw] = session.split("-");
  const start = parseSessionMinutes(startRaw);
  const end = parseSessionMinutes(endRaw);
  const minutes = getZonedMinutes(time, timeZone);
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

function parseSessionMinutes(value: string) {
  const cached = sessionMinutesCache.get(value);
  if (cached !== undefined) return cached;
  const minutes = Number(value.slice(0, 2)) * 60 + Number(value.slice(2, 4));
  sessionMinutesCache.set(value, minutes);
  return minutes;
}

function getZonedMinutes(time: number, timeZone: string) {
  const key = `${timeZone}|${time}`;
  const cached = zonedMinuteCache.get(key);
  if (cached !== undefined) return cached;
  let formatter = minuteFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    minuteFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(new Date(time * 1000));
  const minutes =
    Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 +
    Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  zonedMinuteCache.set(key, minutes);
  return minutes;
}

function getDayId(time: number, timeZone: string) {
  const key = `${timeZone}|${time}`;
  const cached = dayIdCache.get(key);
  if (cached !== undefined) return cached;
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(new Date(time * 1000));
  const dayId = `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
  dayIdCache.set(key, dayId);
  return dayId;
}

function formatValue(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
