"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MarketKind, Timeframe } from "@/lib/binance/types";
import type { SqzAdxTtmConfig } from "@/lib/indicators/sqz-adx-ttm";
import { COMMODITY_INSTRUMENTS } from "@/lib/market/commodities";
import { TOP_STOCK_SYMBOLS } from "@/lib/market/stocks";

export type IndicatorKey =
  | "ema20"
  | "ema50"
  | "ema200"
  | "emaCross"
  | "rsi"
  | "macd"
  | "volume"
  | "volumeProfile"
  | "swingPatterns"
  | "pmRangeBreakout"
  | "sqzAdxTtm";

export type DrawingTool =
  | "cursor"
  | "measure"
  | "eraser"
  | "trendLine"
  | "ray"
  | "infoLine"
  | "extendedLine"
  | "trendAngle"
  | "hline"
  | "hray"
  | "vline"
  | "crossLine"
  | "parallelChannel"
  | "regressionTrend"
  | "flatTopBottom"
  | "disjointChannel"
  | "brush"
  | "highlighter"
  | "arrowMarker"
  | "arrow"
  | "arrowUp"
  | "arrowDown"
  | "rectangle"
  | "rotatedRectangle"
  | "route"
  | "circle"
  | "ellipse"
  | "polyline"
  | "triangle"
  | "arc"
  | "curve"
  | "doubleCurve"
  | "fibRetracement"
  | "fibExtension"
  | "fixedVolumeProfile"
  | "measureRange"
  | "longPosition"
  | "shortPosition";
export type DrawingKind = Exclude<DrawingTool, "cursor" | "measure" | "eraser">;
export type EmaCrossLineStyle =
  | "solid"
  | "dotted"
  | "dashed"
  | "largeDashed"
  | "sparseDotted"
  | "stepped";

export interface EmaCrossLineConfig {
  enabled: boolean;
  period: number;
  color: string;
  lineStyle: EmaCrossLineStyle;
}

export interface EmaCrossFillConfig {
  enabled: boolean;
  from: number;
  to: number;
  color: string;
  opacity: number;
}

export interface SwingPatternsConfig {
  length: number;
  swingHighColor: string;
  swingLowColor: string;
}

export interface PmRangeBreakoutConfig {
  enabled: boolean;
  timeZone: string;
  useTimeFilter: boolean;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  showPMBox: boolean;
  showPMPct: boolean;
  showTradeHistory: boolean;
  showNull: boolean;
  allowLong: boolean;
  allowShort: boolean;
  rr: number;
  showEMA: boolean;
  showDailyBox: boolean;
  showSweeps: boolean;
  showFvg: boolean;
  fvgCloseMode: "close" | "avg";
  hideMitigatedFvg: boolean;
  maxActiveFvg: number;
  expansionPct: number;
  showRsiDivInTrade: boolean;
  useRsiDivFilter: boolean;
  rsiLen: number;
  pivotLen: number;
  divValidBars: number;
  requireRsiExtreme: boolean;
  rsiOB: number;
  rsiOS: number;
  minRsiDiff: number;
  useEmaContextDiv: boolean;
  hhllEnabled: boolean;
  hhllLen: number;
  bosEnabled: boolean;
  bosLen: number;
  nyActive: boolean;
  nySession: string;
  nyTradeActive: boolean;
  nyPreActive: boolean;
  nyPreSession: string;
  ldnActive: boolean;
  ldnSession: string;
  ldnTradeActive: boolean;
  ldnPreActive: boolean;
  ldnPreSession: string;
  tkActive: boolean;
  tkSession: string;
  tkTradeActive: boolean;
  tkPreActive: boolean;
  tkPreSession: string;
  pmColor: string;
  longColor: string;
  shortColor: string;
  nullColor: string;
  divColor: string;
  textColor: string;
  ema20Color: string;
  ema200Color: string;
}

export type RsiMaType =
  | "None"
  | "SMA"
  | "SMA + Bollinger Bands"
  | "EMA"
  | "SMMA (RMA)"
  | "WMA"
  | "VWMA";

export interface RsiSettingsConfig {
  maType: RsiMaType;
  maLength: number;
  bbMult: number;
  calculateDivergence: boolean;
  rsiColor: string;
  maColor: string;
  rangeFillColor: string;
  rangeLineColor: string;
  rsiLineStyle: EmaCrossLineStyle;
  maLineStyle: EmaCrossLineStyle;
  rsiLineWidth: number;
  maLineWidth: number;
}

export interface VolumeProfileConfig {
  rows: number;
  widthPct: number;
  opacity: number;
  buyColor: string;
  sellColor: string;
  pocColor: string;
}

export interface PriceLine {
  id: string;
  symbol: string;
  price: number;
}

export const DEFAULT_PAGE_BACKGROUND_COLOR = "#131722";
export const DEFAULT_PAGE_PANEL_COLOR = "#1e222d";
export const DEFAULT_CHART_TIMEZONE = "America/Argentina/Buenos_Aires";
export const CHART_TIMEZONE_OPTIONS = [
  { label: "UTC", value: "UTC" },
  { label: "BA", value: DEFAULT_CHART_TIMEZONE },
  { label: "SCL", value: "America/Santiago" },
  { label: "NY", value: "America/New_York" },
  { label: "LON", value: "Europe/London" },
  { label: "TYO", value: "Asia/Tokyo" },
] as const;

export interface DrawingPoint {
  time: number;
  price: number;
}

export interface FibonacciLevelConfig {
  value: number;
  enabled: boolean;
  color: string;
}

export interface ChartDrawing {
  id: string;
  symbol: string;
  kind: DrawingKind;
  points: DrawingPoint[];
  color: string;
  borderColor?: string;
  centerColor?: string;
  fillOpacity?: number;
  borderOpacity?: number;
  lineLengthPercent?: number;
  fixedVolumeProfileRows?: number;
  fixedVolumeProfileCandleLimit?: number;
  fixedVolumeProfileBuyColor?: string;
  fixedVolumeProfileSellColor?: string;
  fixedVolumeProfilePocColor?: string;
  showTrendLine?: boolean;
  fibonacciLevels?: FibonacciLevelConfig[];
  locked: boolean;
}

export interface WatchlistFolder {
  id: string;
  name: string;
}

export type WatchlistAssignments = Record<string, string>;

export interface IndicatorConfig {
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  rsiSettings: RsiSettingsConfig;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  volumeProfile: VolumeProfileConfig;
  emaCross: EmaCrossLineConfig[];
  emaCrossFill: EmaCrossFillConfig;
  swingPatterns: SwingPatternsConfig;
  pmRangeBreakout: PmRangeBreakoutConfig;
  sqzAdxTtm: SqzAdxTtmConfig;
}

export const DEFAULT_CONFIG: IndicatorConfig = {
  ema20: 20,
  ema50: 50,
  ema200: 200,
  rsi: 14,
  rsiSettings: {
    maType: "SMA",
    maLength: 14,
    bbMult: 2,
    calculateDivergence: false,
    rsiColor: "#7E57C2",
    maColor: "#fbc02d",
    rangeFillColor: "#1f2547",
    rangeLineColor: "#9a95b8",
    rsiLineStyle: "solid",
    maLineStyle: "solid",
    rsiLineWidth: 2,
    maLineWidth: 1,
  },
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  volumeProfile: {
    rows: 72,
    widthPct: 34,
    opacity: 58,
    buyColor: "#16823a",
    sellColor: "#8f2636",
    pocColor: "#ffe600",
  },
  emaCross: [
    { enabled: false, period: 7, color: "#ffaa00", lineStyle: "solid" },
    { enabled: true, period: 20, color: "#04ff00", lineStyle: "solid" },
    { enabled: true, period: 55, color: "#fbff00", lineStyle: "solid" },
    { enabled: true, period: 80, color: "#1e00ff", lineStyle: "solid" },
    { enabled: true, period: 200, color: "#ffffff", lineStyle: "solid" },
    { enabled: true, period: 400, color: "#ff0000", lineStyle: "solid" },
  ],
  emaCrossFill: {
    enabled: true,
    from: 2,
    to: 3,
    color: "#e4ff1a",
    opacity: 18,
  },
  swingPatterns: {
    length: 21,
    swingHighColor: "#f23645",
    swingLowColor: "#22ab94",
  },
  pmRangeBreakout: {
    enabled: true,
    timeZone: "America/Argentina/Buenos_Aires",
    useTimeFilter: false,
    startHour: 9,
    startMinute: 30,
    endHour: 14,
    endMinute: 0,
    showPMBox: false,
    showPMPct: false,
    showTradeHistory: false,
    showNull: false,
    allowLong: false,
    allowShort: false,
    rr: 1,
    showEMA: false,
    showDailyBox: false,
    showSweeps: false,
    showFvg: false,
    fvgCloseMode: "avg",
    hideMitigatedFvg: false,
    maxActiveFvg: 5,
    expansionPct: 0.35,
    showRsiDivInTrade: false,
    useRsiDivFilter: false,
    rsiLen: 14,
    pivotLen: 7,
    divValidBars: 25,
    requireRsiExtreme: false,
    rsiOB: 70,
    rsiOS: 30,
    minRsiDiff: 3,
    useEmaContextDiv: false,
    hhllEnabled: false,
    hhllLen: 5,
    bosEnabled: true,
    bosLen: 10,
    nyActive: false,
    nySession: "1100-1700",
    nyTradeActive: false,
    nyPreActive: false,
    nyPreSession: "0930-1100",
    ldnActive: false,
    ldnSession: "0400-1230",
    ldnTradeActive: false,
    ldnPreActive: false,
    ldnPreSession: "0300-0400",
    tkActive: false,
    tkSession: "2100-0300",
    tkTradeActive: false,
    tkPreActive: false,
    tkPreSession: "2000-2100",
    pmColor: "#2962ff",
    longColor: "#22ab94",
    shortColor: "#f23645",
    nullColor: "#787b86",
    divColor: "#ff9800",
    textColor: "#ffffff",
    ema20Color: "#26ff00",
    ema200Color: "#ffffff",
  },
  sqzAdxTtm: {
    showSqueeze: true,
    bbLength: 20,
    bbMult: 2,
    kcLength: 20,
    kcMult: 1.5,
    linearMomentum: 20,
    showAdx: true,
    adxLength: 14,
    keyLevel: 23,
    showWaves: false,
    waveALength: 55,
    waveBLength: 144,
    waveCLength: 233,
    showTtmSqueeze: false,
  },
};

const LEGACY_EMA_CROSS_DEFAULTS: EmaCrossLineConfig[][] = [
  [
    { enabled: true, period: 9, color: "#22ab94", lineStyle: "solid" },
    { enabled: true, period: 21, color: "#f23645", lineStyle: "solid" },
    { enabled: true, period: 50, color: "#2962ff", lineStyle: "dashed" },
    { enabled: true, period: 200, color: "#ffb74d", lineStyle: "largeDashed" },
  ],
  [
    { enabled: true, period: 9, color: "#22ab94", lineStyle: "solid" },
    { enabled: true, period: 21, color: "#f23645", lineStyle: "solid" },
    { enabled: true, period: 55, color: "#2962ff", lineStyle: "dashed" },
    { enabled: true, period: 800, color: "#ffb74d", lineStyle: "largeDashed" },
    { enabled: true, period: 100, color: "#ab47bc", lineStyle: "solid" },
    { enabled: true, period: 200, color: "#ffffff", lineStyle: "dashed" },
  ],
  [
    { enabled: false, period: 7, color: "#ffaa00", lineStyle: "solid" },
    { enabled: true, period: 20, color: "#04ff00", lineStyle: "solid" },
    { enabled: true, period: 55, color: "#fbff00", lineStyle: "solid" },
    { enabled: true, period: 80, color: "#1e00ff", lineStyle: "solid" },
    { enabled: true, period: 200, color: "#ffffff", lineStyle: "solid" },
    { enabled: true, period: 400, color: "#ff0000", lineStyle: "dashed" },
  ],
];

const LEGACY_EMA_CROSS_FILL_DEFAULT: EmaCrossFillConfig = {
  enabled: false,
  from: 2,
  to: 3,
  color: "#2962ff",
  opacity: 18,
};

const LEGACY_EMA_CROSS_FILL_DEFAULTS: EmaCrossFillConfig[] = [
  LEGACY_EMA_CROSS_FILL_DEFAULT,
  {
    enabled: true,
    from: 2,
    to: 3,
    color: "#2962ff",
    opacity: 18,
  },
];

export const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  ema20: "#ffb74d",
  ema50: "#2962ff",
  ema200: "#ab47bc",
  emaCross: "#22ab94",
  rsi: "#7E57C2",
  macd: "#2962ff",
  volume: "#787b86",
  volumeProfile: "#ffe600",
  swingPatterns: "#22ab94",
  pmRangeBreakout: "#2962ff",
  sqzAdxTtm: "#2ef527",
};

export const DEFAULT_WATCHLIST = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "MATICUSDT",
  "SPX",
  "NDX",
  "DJI",
  "RUT",
  "N225",
  "HSI",
  "GOLD",
  "SILVER",
  "OIL",
];

const TOP_COMMODITY_SYMBOLS = COMMODITY_INSTRUMENTS.map(
  (commodity) => commodity.symbol,
);

const DEFAULT_WATCHLIST_FOLDER_RULES = [
  {
    id: "majors",
    name: "Criptos",
    assets: [
      "AAVE",
      "ADA",
      "ALGO",
      "APT",
      "ATOM",
      "AVAX",
      "AXS",
      "BNB",
      "BONK",
      "BTC",
      "CAKE",
      "CHZ",
      "COMP",
      "CRV",
      "DOGE",
      "DOT",
      "DYDX",
      "ENJ",
      "ETH",
      "FET",
      "FIL",
      "FLOKI",
      "GALA",
      "ICP",
      "IMX",
      "INJ",
      "LDO",
      "LINK",
      "MANA",
      "MATIC",
      "MKR",
      "NEAR",
      "OCEAN",
      "PEPE",
      "RNDR",
      "RUNE",
      "SAND",
      "SEI",
      "SHIB",
      "SNX",
      "SOL",
      "SUI",
      "SUSHI",
      "TAO",
      "TON",
      "TRX",
      "UNI",
      "WIF",
      "WLD",
      "XLM",
      "XRP",
    ],
  },
  {
    id: "stocks",
    name: "Acciones",
    assets: TOP_STOCK_SYMBOLS,
  },
  {
    id: "commodities",
    name: "Commodities",
    assets: TOP_COMMODITY_SYMBOLS,
  },
  {
    id: "indices",
    name: "Índices",
    assets: [
      "SPX",
      "NDX",
      "IXIC",
      "DJI",
      "RUT",
      "N225",
      "GDAXI",
      "FTSE",
      "FCHI",
      "STOXX50E",
      "IBEX",
      "HSI",
      "AXJO",
      "MERV",
      "MXX",
      "BVSP",
      "VIX",
    ],
  },
] as const;

const QUOTE_ASSETS = [
  "USDT",
  "FDUSD",
  "USDC",
  "TUSD",
  "BUSD",
  "BTC",
  "ETH",
  "BNB",
  "TRY",
  "EUR",
] as const;

export const DEFAULT_WATCHLIST_FOLDERS: WatchlistFolder[] =
  [
    { id: "majors", name: "Criptos" },
    { id: "indices", name: "Índices" },
    { id: "stocks", name: "Acciones" },
    { id: "commodities", name: "Commodities" },
  ];

export const DEFAULT_WATCHLIST_FOLDER_IDS = DEFAULT_WATCHLIST_FOLDERS.map(
  (folder) => folder.id,
);

const WATCHLIST_FALLBACK_FOLDER_ID = "majors";
const WATCHLIST_INDICES_FOLDER_ID = "indices";
const WATCHLIST_STOCKS_FOLDER_ID = "stocks";
const WATCHLIST_COMMODITIES_FOLDER_ID = "commodities";
const WATCHLIST_FOLDER_VERSION = 3;

function isSameEmaCrossConfig(
  config: EmaCrossLineConfig[] | undefined,
  defaults: EmaCrossLineConfig[],
) {
  if (!config || config.length !== defaults.length) {
    return false;
  }

  return config.every((line, index) => {
    const defaultLine = defaults[index];

    return (
      line.enabled === defaultLine.enabled &&
      line.period === defaultLine.period &&
      line.color === defaultLine.color &&
      line.lineStyle === defaultLine.lineStyle
    );
  });
}

function isLegacyEmaCrossDefault(emaCross?: EmaCrossLineConfig[]) {
  return LEGACY_EMA_CROSS_DEFAULTS.some((defaults) =>
    isSameEmaCrossConfig(emaCross, defaults),
  );
}

function isLegacyEmaCrossFillDefault(fill?: EmaCrossFillConfig) {
  return (
    !fill ||
    LEGACY_EMA_CROSS_FILL_DEFAULTS.some(
      (legacyFill) =>
        fill.enabled === legacyFill.enabled &&
        fill.from === legacyFill.from &&
        fill.to === legacyFill.to &&
        fill.color === legacyFill.color &&
        fill.opacity === legacyFill.opacity,
    )
  );
}

function isLegacyPmRangeBreakoutDefault(config?: Partial<PmRangeBreakoutConfig>) {
  if (!config) return false;

  return (
    config.useTimeFilter === true &&
    config.showPMBox === true &&
    config.showPMPct === true &&
    config.showTradeHistory === true &&
    config.showNull === true &&
    config.allowLong === true &&
    config.allowShort === true &&
    config.showEMA === true &&
    config.showDailyBox === true &&
    config.showSweeps === true &&
    config.showFvg === true &&
    config.hideMitigatedFvg === true &&
    config.showRsiDivInTrade === true &&
    config.requireRsiExtreme === true &&
    config.useEmaContextDiv === true &&
    config.hhllEnabled === false &&
    config.bosEnabled === true &&
    config.nyActive === true &&
    config.nyTradeActive === true &&
    config.nyPreActive === true &&
    config.ldnActive === true &&
    config.ldnTradeActive === true &&
    config.ldnPreActive === true &&
    config.tkActive === false &&
    config.tkTradeActive === false &&
    config.tkPreActive === false
  );
}

function getBaseAsset(symbol: string) {
  const upperSymbol = symbol.toUpperCase();
  const quoteAsset = QUOTE_ASSETS.find(
    (quote) => upperSymbol.endsWith(quote) && upperSymbol.length > quote.length,
  );

  return quoteAsset ? upperSymbol.slice(0, -quoteAsset.length) : upperSymbol;
}

function createWatchlistFolderId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `folder-${crypto.randomUUID()}`;
  }

  return `folder-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeFolderName(name: string) {
  return name.trim().slice(0, 32);
}

function normalizeWatchlistFolders(folders?: WatchlistFolder[]) {
  const sourceFolders = Array.isArray(folders) ? folders : DEFAULT_WATCHLIST_FOLDERS;
  const seenFolderIds = new Set<string>();
  const normalizedFolders = sourceFolders
    .map((folder) => ({
      id: typeof folder.id === "string" ? folder.id : "",
      name: typeof folder.name === "string" ? normalizeFolderName(folder.name) : "",
    }))
    .filter((folder) => {
      if (!folder.id || !folder.name || seenFolderIds.has(folder.id)) {
        return false;
      }

      seenFolderIds.add(folder.id);
      return true;
    });

  return normalizedFolders.length > 0
    ? normalizedFolders
    : DEFAULT_WATCHLIST_FOLDERS;
}

function getFolderIdByMarket(market: MarketKind, validFolderIds: Set<string>) {
  const marketFolderId =
    market === "stock"
      ? WATCHLIST_STOCKS_FOLDER_ID
      : market === "commodity"
        ? WATCHLIST_COMMODITIES_FOLDER_ID
        : market === "index"
          ? WATCHLIST_INDICES_FOLDER_ID
          : WATCHLIST_FALLBACK_FOLDER_ID;

  return validFolderIds.has(marketFolderId) ? marketFolderId : null;
}

function getDefaultWatchlistFolderId(
  symbol: string,
  validFolderIds: Set<string>,
  marketHint?: MarketKind,
) {
  if (marketHint) {
    const marketFolderId = getFolderIdByMarket(marketHint, validFolderIds);

    if (marketFolderId) {
      return marketFolderId;
    }
  }

  const baseAsset = getBaseAsset(symbol);
  const defaultFolder = DEFAULT_WATCHLIST_FOLDER_RULES.find((folder) =>
    (folder.assets as readonly string[]).includes(baseAsset),
  );

  if (defaultFolder && validFolderIds.has(defaultFolder.id)) {
    return defaultFolder.id;
  }

  if (validFolderIds.has(WATCHLIST_FALLBACK_FOLDER_ID)) {
    return WATCHLIST_FALLBACK_FOLDER_ID;
  }

  return Array.from(validFolderIds)[0] ?? WATCHLIST_FALLBACK_FOLDER_ID;
}

function buildWatchlistAssignments(
  watchlist: string[],
  folders: WatchlistFolder[],
  assignments?: WatchlistAssignments,
) {
  const validFolderIds = new Set(folders.map((folder) => folder.id));
  const nextAssignments: WatchlistAssignments = {};

  watchlist.forEach((symbol) => {
    const persistedFolderId = assignments?.[symbol];
    nextAssignments[symbol] =
      persistedFolderId && validFolderIds.has(persistedFolderId)
        ? persistedFolderId
        : getDefaultWatchlistFolderId(symbol, validFolderIds);
  });

  return nextAssignments;
}

interface ChartState {
  symbol: string;
  timeframe: Timeframe;
  /** Indicator is added to the chart (appears in pill + renders unless hidden) */
  indicators: Record<IndicatorKey, boolean>;
  /** Indicator is hidden (eye icon off) — kept in pill list, just not rendered */
  hidden: Record<IndicatorKey, boolean>;
  /** Periods and parameters for each indicator */
  config: IndicatorConfig;
  watchlist: string[];
  watchlistFolders: WatchlistFolder[];
  watchlistAssignments: WatchlistAssignments;
  watchlistFolderVersion: number;
  pageBackgroundColor: string;
  pagePanelColor: string;
  chartTimeZone: string;

  // Chart UI state
  tool: DrawingTool;
  priceLines: PriceLine[];
  drawings: ChartDrawing[];
  symbolDialogOpen: boolean;
  /** Which indicator's settings dialog is open (null = closed) */
  settingsTarget: IndicatorKey | null;

  // Actions
  setSymbol: (s: string) => void;
  setTimeframe: (t: Timeframe) => void;
  toggleIndicator: (key: IndicatorKey) => void;
  removeIndicator: (key: IndicatorKey) => void;
  toggleHidden: (key: IndicatorKey) => void;
  setConfig: (patch: Partial<IndicatorConfig>) => void;
  setPageBackgroundColor: (color: string) => void;
  setPagePanelColor: (color: string) => void;
  setChartTimeZone: (timeZone: string) => void;
  addToWatchlist: (s: string, folderId?: string, marketHint?: MarketKind) => void;
  removeFromWatchlist: (s: string) => void;
  createWatchlistFolder: (name: string) => void;
  renameWatchlistFolder: (id: string, name: string) => void;
  removeWatchlistFolder: (id: string) => void;
  moveWatchlistSymbol: (symbol: string, folderId: string) => void;
  setTool: (t: DrawingTool) => void;
  addPriceLine: (price: number, symbol: string) => void;
  clearPriceLines: (symbol?: string) => void;
  addDrawing: (drawing: Omit<ChartDrawing, "id">) => void;
  updateDrawing: (
    id: string,
    patch: Partial<Omit<ChartDrawing, "id" | "symbol" | "kind">>,
  ) => void;
  removeDrawing: (id: string) => void;
  clearDrawings: (symbol?: string) => void;
  setSymbolDialogOpen: (v: boolean) => void;
  setSettingsTarget: (k: IndicatorKey | null) => void;
}

export const useChartStore = create<ChartState>()(
  persist(
    (set) => ({
      symbol: "BTCUSDT",
      timeframe: "15m" as Timeframe,
      indicators: {
        ema20: false,
        ema50: false,
        ema200: false,
        emaCross: false,
        rsi: true,
        macd: false,
        volume: true,
        volumeProfile: false,
        swingPatterns: false,
        pmRangeBreakout: false,
        sqzAdxTtm: false,
      },
      hidden: {
        ema20: false,
        ema50: false,
        ema200: false,
        emaCross: false,
        rsi: false,
        macd: false,
        volume: false,
        volumeProfile: false,
        swingPatterns: false,
        pmRangeBreakout: false,
        sqzAdxTtm: false,
      },
      config: { ...DEFAULT_CONFIG },
      watchlist: DEFAULT_WATCHLIST,
      watchlistFolders: DEFAULT_WATCHLIST_FOLDERS,
      watchlistAssignments: buildWatchlistAssignments(
        DEFAULT_WATCHLIST,
        DEFAULT_WATCHLIST_FOLDERS,
      ),
      watchlistFolderVersion: WATCHLIST_FOLDER_VERSION,
      pageBackgroundColor: DEFAULT_PAGE_BACKGROUND_COLOR,
      pagePanelColor: DEFAULT_PAGE_PANEL_COLOR,
      chartTimeZone: DEFAULT_CHART_TIMEZONE,
      tool: "cursor",
      priceLines: [],
      drawings: [],
      symbolDialogOpen: false,
      settingsTarget: null,

      setSymbol: (symbol) => set({ symbol }),
      setTimeframe: (timeframe) => set({ timeframe }),
      toggleIndicator: (key) =>
        set((s) => ({
          indicators: { ...s.indicators, [key]: !s.indicators[key] },
          // When re-adding, ensure not hidden
          hidden: !s.indicators[key]
            ? { ...s.hidden, [key]: false }
            : s.hidden,
        })),
      removeIndicator: (key) =>
        set((s) => ({
          indicators: { ...s.indicators, [key]: false },
          hidden: { ...s.hidden, [key]: false },
        })),
      toggleHidden: (key) =>
        set((s) => ({ hidden: { ...s.hidden, [key]: !s.hidden[key] } })),
      setConfig: (patch) =>
        set((s) => ({ config: { ...s.config, ...patch } })),
      setPageBackgroundColor: (pageBackgroundColor) =>
        set({ pageBackgroundColor }),
      setPagePanelColor: (pagePanelColor) => set({ pagePanelColor }),
      setChartTimeZone: (chartTimeZone) => set({ chartTimeZone }),
      addToWatchlist: (s, folderId, marketHint) =>
        set((state) => {
          const symbol = s.toUpperCase();
          const folders = normalizeWatchlistFolders(state.watchlistFolders);
          const validFolderIds = new Set(folders.map((folder) => folder.id));
          const targetFolderId =
            folderId && validFolderIds.has(folderId)
              ? folderId
              : getDefaultWatchlistFolderId(symbol, validFolderIds, marketHint);
          const watchlist = state.watchlist.includes(symbol)
            ? state.watchlist
            : [...state.watchlist, symbol];

          return {
            watchlist,
            watchlistAssignments: {
              ...buildWatchlistAssignments(
                state.watchlist,
                folders,
                state.watchlistAssignments,
              ),
              [symbol]: targetFolderId,
            },
          };
        }),
      removeFromWatchlist: (s) =>
        set((state) => {
          const watchlistAssignments = { ...state.watchlistAssignments };
          delete watchlistAssignments[s];

          return {
            watchlist: state.watchlist.filter((x) => x !== s),
            watchlistAssignments,
          };
        }),
      createWatchlistFolder: (name) =>
        set((state) => {
          const folderName = normalizeFolderName(name);

          if (!folderName) {
            return state;
          }

          return {
            watchlistFolders: [
              ...state.watchlistFolders,
              { id: createWatchlistFolderId(), name: folderName },
            ],
          };
        }),
      renameWatchlistFolder: (id, name) =>
        set((state) => {
          const folderName = normalizeFolderName(name);

          if (!folderName) {
            return state;
          }

          return {
            watchlistFolders: state.watchlistFolders.map((folder) =>
              folder.id === id ? { ...folder, name: folderName } : folder,
            ),
          };
        }),
      removeWatchlistFolder: (id) =>
        set((state) => {
          const watchlistFolders = normalizeWatchlistFolders(
            state.watchlistFolders,
          );
          const folderExists = watchlistFolders.some((folder) => folder.id === id);

          if (!folderExists || watchlistFolders.length <= 1) {
            return state;
          }

          const nextFolders = watchlistFolders.filter((folder) => folder.id !== id);
          const validFolderIds = new Set(nextFolders.map((folder) => folder.id));
          const fallbackFolderId =
            id === WATCHLIST_FALLBACK_FOLDER_ID
              ? nextFolders[0]?.id
              : validFolderIds.has(WATCHLIST_FALLBACK_FOLDER_ID)
                ? WATCHLIST_FALLBACK_FOLDER_ID
                : nextFolders[0]?.id;

          if (!fallbackFolderId) {
            return state;
          }

          const watchlistAssignments = Object.fromEntries(
            Object.entries(state.watchlistAssignments).map(
              ([symbol, folderId]) => [
                symbol,
                folderId === id ? fallbackFolderId : folderId,
              ],
            ),
          );

          return {
            watchlistFolders: nextFolders,
            watchlistAssignments,
          };
        }),
      moveWatchlistSymbol: (symbol, folderId) =>
        set((state) => {
          const validFolderIds = new Set(
            state.watchlistFolders.map((folder) => folder.id),
          );

          if (!validFolderIds.has(folderId) || !state.watchlist.includes(symbol)) {
            return state;
          }

          return {
            watchlistAssignments: {
              ...state.watchlistAssignments,
              [symbol]: folderId,
            },
          };
        }),
      setTool: (tool) => set({ tool }),
      addPriceLine: (price, symbol) =>
        set((state) => ({
          priceLines: [
            ...state.priceLines,
            {
              id:
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random()}`,
              symbol,
              price,
            },
          ],
        })),
      clearPriceLines: (symbol) =>
        set((state) => ({
          priceLines: symbol
            ? state.priceLines.filter((p) => p.symbol !== symbol)
            : [],
        })),
      addDrawing: (drawing) =>
        set((state) => ({
          drawings: [
            ...state.drawings,
            {
              ...drawing,
              id:
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? `drawing-${crypto.randomUUID()}`
                  : `drawing-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            },
          ],
        })),
      updateDrawing: (id, patch) =>
        set((state) => ({
          drawings: state.drawings.map((drawing) =>
            drawing.id === id
              ? {
                  ...drawing,
                  ...(
                    drawing.locked &&
                    "points" in patch &&
                    patch.locked !== false
                      ? { ...patch, points: drawing.points }
                      : patch
                  ),
                }
              : drawing,
          ),
        })),
      removeDrawing: (id) =>
        set((state) => ({
          drawings: state.drawings.filter((drawing) => drawing.id !== id),
        })),
      clearDrawings: (symbol) =>
        set((state) => ({
          drawings: symbol
            ? state.drawings.filter((drawing) => drawing.symbol !== symbol)
            : [],
        })),
      setSymbolDialogOpen: (symbolDialogOpen) => set({ symbolDialogOpen }),
      setSettingsTarget: (settingsTarget) => set({ settingsTarget }),
    }),
    {
      name: "tv-gratis-chart-state",
      partialize: (s) => ({
        symbol: s.symbol,
        timeframe: s.timeframe,
        indicators: s.indicators,
        hidden: s.hidden,
        config: s.config,
        watchlist: s.watchlist,
        watchlistFolders: s.watchlistFolders,
        watchlistAssignments: s.watchlistAssignments,
        watchlistFolderVersion: s.watchlistFolderVersion,
        pageBackgroundColor: s.pageBackgroundColor,
        pagePanelColor: s.pagePanelColor,
        chartTimeZone: s.chartTimeZone,
        drawings: s.drawings,
      }),
      merge: (persisted, current) => {
        const state = (persisted ?? {}) as Partial<
          Pick<
            ChartState,
            | "symbol"
            | "timeframe"
            | "indicators"
            | "hidden"
            | "config"
            | "watchlist"
            | "watchlistFolders"
            | "watchlistAssignments"
            | "watchlistFolderVersion"
            | "pageBackgroundColor"
            | "pagePanelColor"
            | "chartTimeZone"
            | "drawings"
          >
        >;
        const persistedEmaCross = state.config?.emaCross;
        const hasLegacyEmaCrossDefault = isLegacyEmaCrossDefault(persistedEmaCross);
        const emaCross = hasLegacyEmaCrossDefault
          ? current.config.emaCross
          : persistedEmaCross ?? current.config.emaCross;
        const emaCrossFill =
          hasLegacyEmaCrossDefault &&
          isLegacyEmaCrossFillDefault(state.config?.emaCrossFill)
            ? current.config.emaCrossFill
            : {
                ...current.config.emaCrossFill,
                ...state.config?.emaCrossFill,
              };
        const persistedPmRangeBreakout = state.config?.pmRangeBreakout;
        const hasLegacyPmRangeBreakoutDefault =
          isLegacyPmRangeBreakoutDefault(persistedPmRangeBreakout);
        const persistedFolderVersion = state.watchlistFolderVersion ?? 1;
        const baseWatchlist = state.watchlist ?? current.watchlist;
        const watchlist =
          persistedFolderVersion < WATCHLIST_FOLDER_VERSION
            ? Array.from(new Set([...baseWatchlist, ...TOP_COMMODITY_SYMBOLS]))
            : baseWatchlist;
        const watchlistFolders = normalizeWatchlistFolders(
          state.watchlistFolders ?? current.watchlistFolders,
        );
        const migratedWatchlistFolders = [...watchlistFolders];
        const addDefaultFolder = (folderId: string, name: string) => {
          if (!migratedWatchlistFolders.some((folder) => folder.id === folderId)) {
            migratedWatchlistFolders.push(
              DEFAULT_WATCHLIST_FOLDERS.find((folder) => folder.id === folderId) ?? {
                id: folderId,
                name,
              },
            );
          }
        };

        if (persistedFolderVersion < WATCHLIST_FOLDER_VERSION) {
          addDefaultFolder(WATCHLIST_STOCKS_FOLDER_ID, "Acciones");
          addDefaultFolder(WATCHLIST_COMMODITIES_FOLDER_ID, "Commodities");
        }
        const watchlistAssignments = buildWatchlistAssignments(
          watchlist,
          migratedWatchlistFolders,
          state.watchlistAssignments ?? current.watchlistAssignments,
        );

        return {
          ...current,
          ...state,
          indicators: { ...current.indicators, ...state.indicators },
          hidden: { ...current.hidden, ...state.hidden },
          config: {
            ...current.config,
            ...state.config,
            emaCross,
            emaCrossFill,
            rsiSettings: {
              ...current.config.rsiSettings,
              ...state.config?.rsiSettings,
            },
            swingPatterns: {
              ...current.config.swingPatterns,
              ...state.config?.swingPatterns,
            },
            volumeProfile: {
              ...current.config.volumeProfile,
              ...state.config?.volumeProfile,
            },
            pmRangeBreakout: {
              ...current.config.pmRangeBreakout,
              ...(hasLegacyPmRangeBreakoutDefault
                ? {}
                : state.config?.pmRangeBreakout),
              nySession:
                (hasLegacyPmRangeBreakoutDefault
                  ? current.config.pmRangeBreakout.nySession
                  : (state.config?.pmRangeBreakout?.nySession ??
                    current.config.pmRangeBreakout.nySession)) ===
                  "1030-1700" &&
                (hasLegacyPmRangeBreakoutDefault
                  ? current.config.pmRangeBreakout.nyPreSession
                  : (state.config?.pmRangeBreakout?.nyPreSession ??
                    current.config.pmRangeBreakout.nyPreSession)) ===
                  "0930-1100"
                  ? current.config.pmRangeBreakout.nySession
                  : hasLegacyPmRangeBreakoutDefault
                    ? current.config.pmRangeBreakout.nySession
                    : state.config?.pmRangeBreakout?.nySession ??
                    current.config.pmRangeBreakout.nySession,
            },
            sqzAdxTtm: {
              ...current.config.sqzAdxTtm,
              ...state.config?.sqzAdxTtm,
            },
          },
          watchlist,
          watchlistFolders: migratedWatchlistFolders,
          watchlistAssignments,
          watchlistFolderVersion: WATCHLIST_FOLDER_VERSION,
          pageBackgroundColor:
            typeof state.pageBackgroundColor === "string"
              ? state.pageBackgroundColor
              : current.pageBackgroundColor,
          pagePanelColor:
            typeof state.pagePanelColor === "string"
              ? state.pagePanelColor
              : current.pagePanelColor,
          chartTimeZone:
            typeof state.chartTimeZone === "string"
              ? state.chartTimeZone
              : current.chartTimeZone,
        };
      },
    },
  ),
);
