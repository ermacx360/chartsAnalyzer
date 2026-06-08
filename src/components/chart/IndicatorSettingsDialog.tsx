"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useChartStore,
  DEFAULT_CONFIG,
  type EmaCrossFillConfig,
  type EmaCrossLineConfig,
  type EmaCrossLineStyle,
  type IndicatorConfig,
  type IndicatorKey,
  type MonthlyGannConfig,
  type RsiSettingsConfig,
  type RsiMaType,
  type VolumeConfig,
  type VolumeProfileConfig,
} from "@/lib/store/chart-store";

const TITLES: Record<IndicatorKey, string> = {
  emaCross: "EMA Cross",
  emaCross2: "EMA Cross 7/25",
  rsi: "RSI",
  macd: "MACD",
  volume: "Volumen",
  volumeProfile: "Volume Profile Visible Range",
  vwapBands: "VWAP + Bandas",
  liquidityBlocks: "Bloques de Liquidez",
  monthlyGann: "Gann mensual",
  swingPatterns: "Swing Highs/Lows & Candle Patterns",
  pmRangeBreakout: "PM Range Breakout PRO",
  sqzAdxTtm: "SQZ + ADX + TTM",
};

const LINE_STYLE_OPTIONS: { value: EmaCrossLineStyle; label: string }[] = [
  { value: "solid", label: "Solida" },
  { value: "dotted", label: "Punteada" },
  { value: "dashed", label: "Guiones" },
  { value: "largeDashed", label: "Guiones largos" },
  { value: "sparseDotted", label: "Puntos espaciados" },
  { value: "stepped", label: "Escalera" },
];

const RSI_MA_OPTIONS: RsiMaType[] = [
  "None",
  "SMA",
  "SMA + Bollinger Bands",
  "EMA",
  "SMMA (RMA)",
  "WMA",
  "VWMA",
];

export function IndicatorSettingsDialog() {
  const target = useChartStore((s) => s.settingsTarget);
  const setTarget = useChartStore((s) => s.setSettingsTarget);
  const config = useChartStore((s) => s.config);
  const setConfig = useChartStore((s) => s.setConfig);

  const open = target !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setTarget(null);
      }}
    >
      <DialogContent
        className={
          target === "emaCross" ||
          target === "emaCross2" ||
          target === "pmRangeBreakout" ||
          target === "sqzAdxTtm"
            ? "max-h-[85vh] max-w-xl overflow-y-auto bg-tv-panel"
            : "max-w-sm bg-tv-panel"
        }
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {target ? TITLES[target] : ""} — Configuración
          </DialogTitle>
        </DialogHeader>
        {target && (
          <SettingsForm
            key={target}
            target={target}
            config={config}
            onSave={(patch) => {
              setConfig(patch);
              setTarget(null);
            }}
            onReset={() => {
              setConfig(DEFAULT_CONFIG);
              setTarget(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FormProps {
  target: IndicatorKey;
  config: IndicatorConfig;
  onSave: (patch: Partial<IndicatorConfig>) => void;
  onReset: () => void;
}

function SettingsForm({ target, config, onSave, onReset }: FormProps) {
  // Local draft state to avoid recalculating chart on every keystroke
  const [draft, setDraft] = useState(() => ({
    rsi: config.rsi,
    rsiSettings: { ...config.rsiSettings },
    macdFast: config.macdFast,
    macdSlow: config.macdSlow,
    macdSignal: config.macdSignal,
    volume: { ...config.volume },
    volumeProfile: { ...config.volumeProfile },
    monthlyGann: { ...config.monthlyGann },
    emaCross: cloneEmaCrossConfig(config.emaCross),
    emaCrossFill: cloneEmaCrossFillConfig(config.emaCrossFill),
    emaCross2: cloneEmaCrossConfig(config.emaCross2, DEFAULT_CONFIG.emaCross2),
    emaCross2Fill: cloneEmaCrossFillConfig(
      config.emaCross2Fill,
      DEFAULT_CONFIG.emaCross2Fill,
    ),
    swingPatterns: { ...config.swingPatterns },
    pmRangeBreakout: { ...config.pmRangeBreakout },
    sqzAdxTtm: { ...DEFAULT_CONFIG.sqzAdxTtm, ...config.sqzAdxTtm },
    vwapBands: { ...DEFAULT_CONFIG.vwapBands, ...(config.vwapBands || {}) },
    liquidityBlocks: { ...DEFAULT_CONFIG.liquidityBlocks, ...(config.liquidityBlocks || {}) },
  }));

  function save() {
    if (target === "rsi")
      onSave({
        rsi: clamp(draft.rsi, 1, 100),
        rsiSettings: {
          ...draft.rsiSettings,
          maLength: clamp(draft.rsiSettings.maLength, 1, 500),
          bbMult: Math.max(0.001, Math.min(50, draft.rsiSettings.bbMult)),
          rsiColor: normalizeColor(
            draft.rsiSettings.rsiColor,
            DEFAULT_CONFIG.rsiSettings.rsiColor,
          ),
          maColor: normalizeColor(
            draft.rsiSettings.maColor,
            DEFAULT_CONFIG.rsiSettings.maColor,
          ),
          rangeFillColor: normalizeColor(
            draft.rsiSettings.rangeFillColor,
            DEFAULT_CONFIG.rsiSettings.rangeFillColor,
          ),
          rangeLineColor: normalizeColor(
            draft.rsiSettings.rangeLineColor,
            DEFAULT_CONFIG.rsiSettings.rangeLineColor,
          ),
          rsiLineWidth: clamp(draft.rsiSettings.rsiLineWidth, 1, 5),
          maLineWidth: clamp(draft.rsiSettings.maLineWidth, 1, 5),
        },
      });
    else if (target === "macd")
      onSave({
        macdFast: clamp(draft.macdFast, 2, 100),
        macdSlow: clamp(draft.macdSlow, 2, 200),
        macdSignal: clamp(draft.macdSignal, 2, 100),
      });
    else if (target === "emaCross")
      onSave({
        emaCross: draft.emaCross.map((line, index) => ({
          enabled: line.enabled,
          period: clamp(line.period, 2, 2000),
          color: normalizeColor(line.color, DEFAULT_CONFIG.emaCross[index].color),
          lineStyle: line.lineStyle,
        })),
        emaCrossFill: normalizeEmaCrossFillConfig(
          draft.emaCrossFill,
          DEFAULT_CONFIG.emaCross,
          DEFAULT_CONFIG.emaCrossFill,
        ),
      });
    else if (target === "emaCross2")
      onSave({
        emaCross2: draft.emaCross2.map((line, index) => ({
          enabled: line.enabled,
          period: clamp(line.period, 2, 2000),
          color: normalizeColor(line.color, DEFAULT_CONFIG.emaCross2[index].color),
          lineStyle: line.lineStyle,
        })),
        emaCross2Fill: normalizeEmaCrossFillConfig(
          draft.emaCross2Fill,
          DEFAULT_CONFIG.emaCross2,
          DEFAULT_CONFIG.emaCross2Fill,
        ),
      });
    else if (target === "volume")
      onSave({
        volume: {
          heightPct: clamp(draft.volume.heightPct, 12, 45),
          ema20Enabled: draft.volume.ema20Enabled,
          ema20Color: normalizeColor(
            draft.volume.ema20Color,
            DEFAULT_CONFIG.volume.ema20Color,
          ),
        },
      });
    else if (target === "volumeProfile")
      onSave({
        volumeProfile: {
          rows: clamp(draft.volumeProfile.rows, 12, 1000),
          widthPct: clamp(draft.volumeProfile.widthPct, 12, 60),
          opacity: clamp(draft.volumeProfile.opacity, 10, 100),
          buyColor: normalizeColor(
            draft.volumeProfile.buyColor,
            DEFAULT_CONFIG.volumeProfile.buyColor,
          ),
          sellColor: normalizeColor(
            draft.volumeProfile.sellColor,
            DEFAULT_CONFIG.volumeProfile.sellColor,
          ),
          pocColor: normalizeColor(
            draft.volumeProfile.pocColor,
            DEFAULT_CONFIG.volumeProfile.pocColor,
          ),
        },
      });
    else if (target === "monthlyGann")
      onSave({
        monthlyGann: {
          startDate: normalizeDateInput(draft.monthlyGann.startDate),
          endDate: normalizeDateInput(draft.monthlyGann.endDate),
          topPriceOverride: normalizeOptionalNumber(
            draft.monthlyGann.topPriceOverride,
          ),
          bottomPriceOverride: normalizeOptionalNumber(
            draft.monthlyGann.bottomPriceOverride,
          ),
          color: normalizeColor(
            draft.monthlyGann.color,
            DEFAULT_CONFIG.monthlyGann.color,
          ),
          fillColor: normalizeColor(
            draft.monthlyGann.fillColor,
            DEFAULT_CONFIG.monthlyGann.fillColor,
          ),
          opacity: clamp(draft.monthlyGann.opacity, 0, 40),
          lineOpacity: clamp(draft.monthlyGann.lineOpacity, 0, 100),
          showLabels: draft.monthlyGann.showLabels,
        },
      });
    else if (target === "swingPatterns")
      onSave({
        swingPatterns: {
          length: clamp(draft.swingPatterns.length, 2, 100),
          swingHighColor: normalizeColor(
            draft.swingPatterns.swingHighColor,
            DEFAULT_CONFIG.swingPatterns.swingHighColor,
          ),
          swingLowColor: normalizeColor(
            draft.swingPatterns.swingLowColor,
            DEFAULT_CONFIG.swingPatterns.swingLowColor,
          ),
        },
      });
    else if (target === "pmRangeBreakout")
      onSave({
        pmRangeBreakout: {
          ...draft.pmRangeBreakout,
          nySession: normalizeSessionInput(
            draft.pmRangeBreakout.nySession,
            DEFAULT_CONFIG.pmRangeBreakout.nySession,
          ),
          nyPreSession: normalizeSessionInput(
            draft.pmRangeBreakout.nyPreSession,
            DEFAULT_CONFIG.pmRangeBreakout.nyPreSession,
          ),
          ldnSession: normalizeSessionInput(
            draft.pmRangeBreakout.ldnSession,
            DEFAULT_CONFIG.pmRangeBreakout.ldnSession,
          ),
          ldnPreSession: normalizeSessionInput(
            draft.pmRangeBreakout.ldnPreSession,
            DEFAULT_CONFIG.pmRangeBreakout.ldnPreSession,
          ),
          tkSession: normalizeSessionInput(
            draft.pmRangeBreakout.tkSession,
            DEFAULT_CONFIG.pmRangeBreakout.tkSession,
          ),
          tkPreSession: normalizeSessionInput(
            draft.pmRangeBreakout.tkPreSession,
            DEFAULT_CONFIG.pmRangeBreakout.tkPreSession,
          ),
          rr: Math.max(0.25, Math.min(10, draft.pmRangeBreakout.rr)),
          rsiLen: clamp(draft.pmRangeBreakout.rsiLen, 2, 100),
          pivotLen: clamp(draft.pmRangeBreakout.pivotLen, 2, 20),
          divValidBars: clamp(draft.pmRangeBreakout.divValidBars, 1, 200),
          hhllLen: clamp(draft.pmRangeBreakout.hhllLen, 1, 50),
          bosLen: clamp(draft.pmRangeBreakout.bosLen, 1, 50),
        },
      });
    else if (target === "sqzAdxTtm")
      onSave({
        sqzAdxTtm: {
          ...draft.sqzAdxTtm,
          bbLength: clamp(draft.sqzAdxTtm.bbLength, 2, 500),
          bbMult: Math.max(0.1, Math.min(10, draft.sqzAdxTtm.bbMult)),
          kcLength: clamp(draft.sqzAdxTtm.kcLength, 2, 500),
          kcMult: Math.max(0.1, Math.min(10, draft.sqzAdxTtm.kcMult)),
          linearMomentum: clamp(draft.sqzAdxTtm.linearMomentum, 2, 500),
          adxLength: clamp(draft.sqzAdxTtm.adxLength, 1, 200),
          keyLevel: clamp(draft.sqzAdxTtm.keyLevel, 1, 100),
          waveALength: clamp(draft.sqzAdxTtm.waveALength, 1, 500),
          waveBLength: clamp(draft.sqzAdxTtm.waveBLength, 1, 500),
          waveCLength: clamp(draft.sqzAdxTtm.waveCLength, 1, 500),
        },
      });
    else if (target === "vwapBands")
      onSave({
        vwapBands: {
          anchor: draft.vwapBands.anchor,
          calcMode: draft.vwapBands.calcMode,
          showBand1: draft.vwapBands.showBand1,
          bandMult1: draft.vwapBands.bandMult1,
          showBand2: draft.vwapBands.showBand2,
          bandMult2: draft.vwapBands.bandMult2,
          showBand3: draft.vwapBands.showBand3,
          bandMult3: draft.vwapBands.bandMult3,
          color: normalizeColor(draft.vwapBands.color, DEFAULT_CONFIG.vwapBands.color),
          band1Color: normalizeColor(draft.vwapBands.band1Color, DEFAULT_CONFIG.vwapBands.band1Color),
          band2Color: normalizeColor(draft.vwapBands.band2Color, DEFAULT_CONFIG.vwapBands.band2Color),
          band3Color: normalizeColor(draft.vwapBands.band3Color, DEFAULT_CONFIG.vwapBands.band3Color),
          opacity: clamp(draft.vwapBands.opacity ?? 1, 0.1, 1),
          lineWidth: clamp(draft.vwapBands.lineWidth ?? 1, 1, 5),
        },
      });
    else if (target === "liquidityBlocks")
      onSave({
        liquidityBlocks: {
          bucketPct: clamp(draft.liquidityBlocks.bucketPct, 0.01, 5),
          topBlocks: clamp(draft.liquidityBlocks.topBlocks, 1, 50),
          minVolumeUsdt: clamp(draft.liquidityBlocks.minVolumeUsdt, 1000, 1000000000),
          opacity: clamp(draft.liquidityBlocks.opacity, 0.1, 1),
          buyColor: normalizeColor(draft.liquidityBlocks.buyColor, DEFAULT_CONFIG.liquidityBlocks.buyColor),
          sellColor: normalizeColor(draft.liquidityBlocks.sellColor, DEFAULT_CONFIG.liquidityBlocks.sellColor),
        },
      });
  }

  function updateEmaCrossLine(
    index: number,
    patch: Partial<EmaCrossLineConfig>,
  ) {
    setDraft((current) => ({
      ...current,
      emaCross: current.emaCross.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  }

  function updateEmaCrossFill(patch: Partial<EmaCrossFillConfig>) {
    setDraft((current) => ({
      ...current,
      emaCrossFill: { ...current.emaCrossFill, ...patch },
    }));
  }

  function updateEmaCross2Line(
    index: number,
    patch: Partial<EmaCrossLineConfig>,
  ) {
    setDraft((current) => ({
      ...current,
      emaCross2: current.emaCross2.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  }

  function updateEmaCross2Fill(patch: Partial<EmaCrossFillConfig>) {
    setDraft((current) => ({
      ...current,
      emaCross2Fill: { ...current.emaCross2Fill, ...patch },
    }));
  }

  return (
    <div className="flex flex-col gap-3">
      {false && target === "rsi" && (
        <Field
          label="Período"
          value={draft.rsi}
          onChange={(n) => setDraft((d) => ({ ...d, rsi: n }))}
        />
      )}
      {target === "rsi" && (
        <RsiSettingsFields
          length={draft.rsi}
          settings={draft.rsiSettings}
          onLengthChange={(rsi) => setDraft((d) => ({ ...d, rsi }))}
          onSettingsChange={(patch) =>
            setDraft((d) => ({
              ...d,
              rsiSettings: { ...d.rsiSettings, ...patch },
            }))
          }
        />
      )}
      {target === "macd" && (
        <div className="grid grid-cols-3 gap-2">
          <Field
            label="Rápida"
            value={draft.macdFast}
            onChange={(n) => setDraft((d) => ({ ...d, macdFast: n }))}
          />
          <Field
            label="Lenta"
            value={draft.macdSlow}
            onChange={(n) => setDraft((d) => ({ ...d, macdSlow: n }))}
          />
          <Field
            label="Señal"
            value={draft.macdSignal}
            onChange={(n) => setDraft((d) => ({ ...d, macdSignal: n }))}
          />
        </div>
      )}
      {target === "emaCross" && (
        <div className="flex flex-col gap-2">
          {draft.emaCross.map((line, index) => (
            <div
              key={index}
              className="grid grid-cols-[24px_56px_1fr_150px] items-end gap-2"
            >
              <label className="flex h-8 items-center justify-center rounded-lg border border-input bg-tv-bg">
                <input
                  aria-label={`Activar EMA ${index + 1}`}
                  type="checkbox"
                  checked={line.enabled}
                  onChange={(event) =>
                    updateEmaCrossLine(index, { enabled: event.target.checked })
                  }
                  className="h-3.5 w-3.5 accent-tv-blue"
                />
              </label>
              <Field
                label={`EMA ${index + 1}`}
                value={line.period}
                onChange={(n) => updateEmaCrossLine(index, { period: n })}
                max={2000}
              />
              <ColorField
                value={line.color}
                fallback={DEFAULT_CONFIG.emaCross[index].color}
                onChange={(color) => updateEmaCrossLine(index, { color })}
              />
              <LineStyleField
                value={line.lineStyle}
                onChange={(lineStyle) => updateEmaCrossLine(index, { lineStyle })}
              />
            </div>
          ))}
          <div className="mt-2 border-t border-tv-border pt-3">
            <label className="flex items-center gap-2 text-xs text-tv-text">
              <input
                type="checkbox"
                checked={draft.emaCrossFill.enabled}
                onChange={(e) => updateEmaCrossFill({ enabled: e.target.checked })}
                className="h-3.5 w-3.5 accent-tv-blue"
              />
              <span>Colorear zona entre EMAs</span>
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <FillLineField
                label="Desde"
                value={draft.emaCrossFill.from}
                lines={draft.emaCross}
                onChange={(from) => updateEmaCrossFill({ from })}
              />
              <FillLineField
                label="Hasta"
                value={draft.emaCrossFill.to}
                lines={draft.emaCross}
                onChange={(to) => updateEmaCrossFill({ to })}
              />
              <ColorField
                value={draft.emaCrossFill.color}
                fallback={DEFAULT_CONFIG.emaCrossFill.color}
                onChange={(color) => updateEmaCrossFill({ color })}
              />
              <OpacityField
                value={draft.emaCrossFill.opacity}
                onChange={(opacity) => updateEmaCrossFill({ opacity })}
              />
            </div>
          </div>
        </div>
      )}
      {target === "emaCross2" && (
        <div className="flex flex-col gap-2">
          {draft.emaCross2.map((line, index) => (
            <div
              key={index}
              className="grid grid-cols-[24px_56px_1fr_150px] items-end gap-2"
            >
              <label className="flex h-8 items-center justify-center rounded-lg border border-input bg-tv-bg">
                <input
                  aria-label={`Activar EMA ${index + 1}`}
                  type="checkbox"
                  checked={line.enabled}
                  onChange={(event) =>
                    updateEmaCross2Line(index, { enabled: event.target.checked })
                  }
                  className="h-3.5 w-3.5 accent-tv-blue"
                />
              </label>
              <Field
                label={`EMA ${index + 1}`}
                value={line.period}
                onChange={(n) => updateEmaCross2Line(index, { period: n })}
                max={2000}
              />
              <ColorField
                value={line.color}
                fallback={DEFAULT_CONFIG.emaCross2[index].color}
                onChange={(color) => updateEmaCross2Line(index, { color })}
              />
              <LineStyleField
                value={line.lineStyle}
                onChange={(lineStyle) =>
                  updateEmaCross2Line(index, { lineStyle })
                }
              />
            </div>
          ))}
          <div className="mt-2 border-t border-tv-border pt-3">
            <label className="flex items-center gap-2 text-xs text-tv-text">
              <input
                type="checkbox"
                checked={draft.emaCross2Fill.enabled}
                onChange={(e) => updateEmaCross2Fill({ enabled: e.target.checked })}
                className="h-3.5 w-3.5 accent-tv-blue"
              />
              <span>Colorear zona entre EMAs</span>
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <FillLineField
                label="Desde"
                value={draft.emaCross2Fill.from}
                lines={draft.emaCross2}
                onChange={(from) => updateEmaCross2Fill({ from })}
              />
              <FillLineField
                label="Hasta"
                value={draft.emaCross2Fill.to}
                lines={draft.emaCross2}
                onChange={(to) => updateEmaCross2Fill({ to })}
              />
              <ColorField
                value={draft.emaCross2Fill.color}
                fallback={DEFAULT_CONFIG.emaCross2Fill.color}
                onChange={(color) => updateEmaCross2Fill({ color })}
              />
              <OpacityField
                value={draft.emaCross2Fill.opacity}
                onChange={(opacity) => updateEmaCross2Fill({ opacity })}
              />
            </div>
          </div>
        </div>
      )}
      {target === "volume" && (
        <VolumeFields
          settings={draft.volume}
          onSettingsChange={(patch) =>
            setDraft((d) => ({
              ...d,
              volume: { ...d.volume, ...patch },
            }))
          }
        />
      )}
      {target === "volumeProfile" && (
        <VolumeProfileFields
          settings={draft.volumeProfile}
          onSettingsChange={(patch) =>
            setDraft((d) => ({
              ...d,
              volumeProfile: { ...d.volumeProfile, ...patch },
            }))
          }
        />
      )}
      {target === "monthlyGann" && (
        <MonthlyGannFields
          settings={draft.monthlyGann}
          onSettingsChange={(patch) =>
            setDraft((d) => ({
              ...d,
              monthlyGann: { ...d.monthlyGann, ...patch },
            }))
          }
        />
      )}
      {target === "swingPatterns" && (
        <div className="flex flex-col gap-3">
          <Field
            label="Periodo"
            value={draft.swingPatterns.length}
            min={2}
            max={100}
            onChange={(length) =>
              setDraft((d) => ({
                ...d,
                swingPatterns: { ...d.swingPatterns, length },
              }))
            }
          />
          <ColorField
            value={draft.swingPatterns.swingHighColor}
            fallback={DEFAULT_CONFIG.swingPatterns.swingHighColor}
            onChange={(swingHighColor) =>
              setDraft((d) => ({
                ...d,
                swingPatterns: { ...d.swingPatterns, swingHighColor },
              }))
            }
          />
          <ColorField
            value={draft.swingPatterns.swingLowColor}
            fallback={DEFAULT_CONFIG.swingPatterns.swingLowColor}
            onChange={(swingLowColor) =>
              setDraft((d) => ({
                ...d,
                swingPatterns: { ...d.swingPatterns, swingLowColor },
              }))
            }
          />
        </div>
      )}
      {target === "pmRangeBreakout" && (
        <div className="grid grid-cols-2 gap-2">
          <ToggleField label="Caja PM" checked={draft.pmRangeBreakout.showPMBox} onChange={(showPMBox) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, showPMBox } }))} />
          <ToggleField label="Amplitud PM %" checked={draft.pmRangeBreakout.showPMPct} onChange={(showPMPct) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, showPMPct } }))} />
          <ToggleField label="Historico trades" checked={draft.pmRangeBreakout.showTradeHistory} onChange={(showTradeHistory) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, showTradeHistory } }))} />
          <ToggleField label="Trade nulo" checked={draft.pmRangeBreakout.showNull} onChange={(showNull) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, showNull } }))} />
          <ToggleField label="Filtro horario" checked={draft.pmRangeBreakout.useTimeFilter} onChange={(useTimeFilter) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, useTimeFilter } }))} />
          <ToggleField label="Permitir LONG" checked={draft.pmRangeBreakout.allowLong} onChange={(allowLong) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, allowLong } }))} />
          <ToggleField label="Permitir SHORT" checked={draft.pmRangeBreakout.allowShort} onChange={(allowShort) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, allowShort } }))} />
          <ToggleField label="EMAs 20/200" checked={draft.pmRangeBreakout.showEMA} onChange={(showEMA) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, showEMA } }))} />
          <ToggleField label="Caja diaria" checked={draft.pmRangeBreakout.showDailyBox} onChange={(showDailyBox) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, showDailyBox } }))} />
          <ToggleField label="Sweeps NY/LDN" checked={draft.pmRangeBreakout.showSweeps} onChange={(showSweeps) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, showSweeps } }))} />
          <ToggleField label="FVG" checked={draft.pmRangeBreakout.showFvg} onChange={(showFvg) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, showFvg } }))} />
          <ToggleField label="Ocultar FVG mitigado" checked={draft.pmRangeBreakout.hideMitigatedFvg} onChange={(hideMitigatedFvg) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, hideMitigatedFvg } }))} />
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
              Cierre FVG
            </span>
            <select
              value={draft.pmRangeBreakout.fvgCloseMode}
              onChange={(event) =>
                setDraft((d) => ({
                  ...d,
                  pmRangeBreakout: {
                    ...d.pmRangeBreakout,
                    fvgCloseMode: event.target.value as "close" | "avg",
                  },
                }))
              }
              className="h-9 rounded-md border border-tv-border bg-tv-bg px-2 text-sm text-tv-text outline-none"
            >
              <option value="avg">AVG 50%</option>
              <option value="close">Cierre</option>
            </select>
          </label>
          <Field label="FVG activos" value={draft.pmRangeBreakout.maxActiveFvg} min={1} max={20} onChange={(maxActiveFvg) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, maxActiveFvg } }))} />
          <ToggleField label="Aviso RSI trade" checked={draft.pmRangeBreakout.showRsiDivInTrade} onChange={(showRsiDivInTrade) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, showRsiDivInTrade } }))} />
          <ToggleField label="Anular por RSI" checked={draft.pmRangeBreakout.useRsiDivFilter} onChange={(useRsiDivFilter) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, useRsiDivFilter } }))} />
          <ToggleField label="HH/HL/LH/LL" checked={draft.pmRangeBreakout.hhllEnabled} onChange={(hhllEnabled) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, hhllEnabled } }))} />
          <ToggleField label="BOS / CHoCH" checked={draft.pmRangeBreakout.bosEnabled} onChange={(bosEnabled) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, bosEnabled } }))} />
          <ToggleField label="NY" checked={draft.pmRangeBreakout.nyActive} onChange={(nyActive) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, nyActive } }))} />
          <ToggleField label="Trades NY" checked={draft.pmRangeBreakout.nyTradeActive} onChange={(nyTradeActive) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, nyTradeActive } }))} />
          <ToggleField label="Premarket NY" checked={draft.pmRangeBreakout.nyPreActive} onChange={(nyPreActive) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, nyPreActive } }))} />
          <ToggleField label="Londres" checked={draft.pmRangeBreakout.ldnActive} onChange={(ldnActive) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, ldnActive } }))} />
          <ToggleField label="Trades Londres" checked={draft.pmRangeBreakout.ldnTradeActive} onChange={(ldnTradeActive) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, ldnTradeActive } }))} />
          <ToggleField label="Premarket Londres" checked={draft.pmRangeBreakout.ldnPreActive} onChange={(ldnPreActive) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, ldnPreActive } }))} />
          <ToggleField label="Tokio" checked={draft.pmRangeBreakout.tkActive} onChange={(tkActive) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, tkActive } }))} />
          <ToggleField label="Trades Tokio" checked={draft.pmRangeBreakout.tkTradeActive} onChange={(tkTradeActive) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, tkTradeActive } }))} />
          <ToggleField label="Premarket Tokio" checked={draft.pmRangeBreakout.tkPreActive} onChange={(tkPreActive) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, tkPreActive } }))} />
          <Field label="RR" value={draft.pmRangeBreakout.rr} min={0.25} max={10} onChange={(rr) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, rr } }))} />
          <Field label="RSI periodo" value={draft.pmRangeBreakout.rsiLen} min={2} max={100} onChange={(rsiLen) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, rsiLen } }))} />
          <SessionField label="Horario NY" value={draft.pmRangeBreakout.nySession} onChange={(nySession) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, nySession } }))} />
          <SessionField label="Premarket NY" value={draft.pmRangeBreakout.nyPreSession} onChange={(nyPreSession) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, nyPreSession } }))} />
          <SessionField label="Horario Londres" value={draft.pmRangeBreakout.ldnSession} onChange={(ldnSession) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, ldnSession } }))} />
          <SessionField label="Premarket Londres" value={draft.pmRangeBreakout.ldnPreSession} onChange={(ldnPreSession) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, ldnPreSession } }))} />
          <SessionField label="Horario Tokio" value={draft.pmRangeBreakout.tkSession} onChange={(tkSession) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, tkSession } }))} />
          <SessionField label="Premarket Tokio" value={draft.pmRangeBreakout.tkPreSession} onChange={(tkPreSession) => setDraft((d) => ({ ...d, pmRangeBreakout: { ...d.pmRangeBreakout, tkPreSession } }))} />
        </div>
      )}
      {target === "sqzAdxTtm" && (
        <div className="grid grid-cols-2 gap-2">
          <ToggleField
            label="Squeeze Oscillator"
            checked={draft.sqzAdxTtm.showSqueeze}
            onChange={(showSqueeze) =>
              setDraft((d) => ({
                ...d,
                sqzAdxTtm: { ...d.sqzAdxTtm, showSqueeze },
              }))
            }
          />
          <ToggleField
            label="ADX"
            checked={draft.sqzAdxTtm.showAdx}
            onChange={(showAdx) =>
              setDraft((d) => ({
                ...d,
                sqzAdxTtm: { ...d.sqzAdxTtm, showAdx },
              }))
            }
          />
          <ToggleField
            label="TTM Waves"
            checked={draft.sqzAdxTtm.showWaves}
            onChange={(showWaves) =>
              setDraft((d) => ({
                ...d,
                sqzAdxTtm: { ...d.sqzAdxTtm, showWaves },
              }))
            }
          />
          <ToggleField
            label="Squeeze Momentum"
            checked={draft.sqzAdxTtm.showTtmSqueeze}
            onChange={(showTtmSqueeze) =>
              setDraft((d) => ({
                ...d,
                sqzAdxTtm: { ...d.sqzAdxTtm, showTtmSqueeze },
              }))
            }
          />
          <Field label="BB Length" value={draft.sqzAdxTtm.bbLength} min={2} max={500} onChange={(bbLength) => setDraft((d) => ({ ...d, sqzAdxTtm: { ...d.sqzAdxTtm, bbLength } }))} />
          <Field label="BB Mult" value={draft.sqzAdxTtm.bbMult} min={0.1} max={10} onChange={(bbMult) => setDraft((d) => ({ ...d, sqzAdxTtm: { ...d.sqzAdxTtm, bbMult } }))} />
          <Field label="KC Length" value={draft.sqzAdxTtm.kcLength} min={2} max={500} onChange={(kcLength) => setDraft((d) => ({ ...d, sqzAdxTtm: { ...d.sqzAdxTtm, kcLength } }))} />
          <Field label="KC Mult" value={draft.sqzAdxTtm.kcMult} min={0.1} max={10} onChange={(kcMult) => setDraft((d) => ({ ...d, sqzAdxTtm: { ...d.sqzAdxTtm, kcMult } }))} />
          <Field label="Linear Momentum" value={draft.sqzAdxTtm.linearMomentum} min={2} max={500} onChange={(linearMomentum) => setDraft((d) => ({ ...d, sqzAdxTtm: { ...d.sqzAdxTtm, linearMomentum } }))} />
          <Field label="ADX Longitud" value={draft.sqzAdxTtm.adxLength} min={1} max={200} onChange={(adxLength) => setDraft((d) => ({ ...d, sqzAdxTtm: { ...d.sqzAdxTtm, adxLength } }))} />
          <Field label="Key Level" value={draft.sqzAdxTtm.keyLevel} min={1} max={100} onChange={(keyLevel) => setDraft((d) => ({ ...d, sqzAdxTtm: { ...d.sqzAdxTtm, keyLevel } }))} />
          <Field label="Wave A Length" value={draft.sqzAdxTtm.waveALength} min={1} max={500} onChange={(waveALength) => setDraft((d) => ({ ...d, sqzAdxTtm: { ...d.sqzAdxTtm, waveALength } }))} />
          <Field label="Wave B Length" value={draft.sqzAdxTtm.waveBLength} min={1} max={500} onChange={(waveBLength) => setDraft((d) => ({ ...d, sqzAdxTtm: { ...d.sqzAdxTtm, waveBLength } }))} />
          <Field label="Wave C Length" value={draft.sqzAdxTtm.waveCLength} min={1} max={500} onChange={(waveCLength) => setDraft((d) => ({ ...d, sqzAdxTtm: { ...d.sqzAdxTtm, waveCLength } }))} />
        </div>
      )}
      {target === "vwapBands" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-tv-text-muted">Anclaje</label>
              <select
                className="w-full rounded border border-tv-border bg-tv-bg px-2 py-1 text-sm outline-none focus:border-tv-primary"
                value={draft.vwapBands.anchor}
                onChange={(e) => setDraft((d) => ({ ...d, vwapBands: { ...d.vwapBands, anchor: e.target.value as any } }))}
              >
                <option value="Session">Sesión (Día)</option>
                <option value="Week">Semana</option>
                <option value="Month">Mes</option>
                <option value="Year">Año</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-tv-text-muted">Modo de cálculo</label>
              <select
                className="w-full rounded border border-tv-border bg-tv-bg px-2 py-1 text-sm outline-none focus:border-tv-primary"
                value={draft.vwapBands.calcMode}
                onChange={(e) => setDraft((d) => ({ ...d, vwapBands: { ...d.vwapBands, calcMode: e.target.value as any } }))}
              >
                <option value="Standard Deviation">Desviación Estándar</option>
                <option value="Percentage">Porcentaje</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2">
            <span className="w-16 text-sm text-tv-text">VWAP</span>
            <ColorField
              value={draft.vwapBands.color}
              fallback={DEFAULT_CONFIG.vwapBands.color}
              onChange={(color) => setDraft((d) => ({ ...d, vwapBands: { ...d.vwapBands, color } }))}
            />
          </div>

          {[1, 2, 3].map((i) => {
            const num = i as 1 | 2 | 3;
            const showKey = `showBand${num}` as const;
            const multKey = `bandMult${num}` as const;
            const colorKey = `band${num}Color` as const;
            
            return (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.vwapBands[showKey]}
                  onChange={(e) => setDraft((d) => ({ ...d, vwapBands: { ...d.vwapBands, [showKey]: e.target.checked } }))}
                />
                <span className="w-20 text-sm text-tv-text">Banda {num}</span>
                <ColorField
                  value={draft.vwapBands[colorKey]}
                  fallback={DEFAULT_CONFIG.vwapBands[colorKey]}
                  onChange={(c) => setDraft((d) => ({ ...d, vwapBands: { ...d.vwapBands, [colorKey]: c } }))}
                />
                <Field
                  label=""
                  value={draft.vwapBands[multKey]}
                  min={0.1}
                  max={100}
                  onChange={(v) => setDraft((d) => ({ ...d, vwapBands: { ...d.vwapBands, [multKey]: v } }))}
                />
              </div>
            );
          })}
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex justify-between items-center text-xs">
              <label className="text-tv-text-muted">Opacidad (Líneas)</label>
              <span className="text-tv-text font-mono">
                {Math.round((draft.vwapBands.opacity ?? 1) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              className="w-full cursor-pointer accent-tv-primary"
              value={draft.vwapBands.opacity ?? 1}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  vwapBands: { ...d.vwapBands, opacity: parseFloat(e.target.value) },
                }))
              }
            />
          </div>
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex justify-between items-center text-xs">
              <label className="text-tv-text-muted">Grosor (Líneas)</label>
              <span className="text-tv-text font-mono">
                {Math.round(draft.vwapBands.lineWidth ?? 1)}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              className="w-full cursor-pointer accent-tv-primary"
              value={draft.vwapBands.lineWidth ?? 1}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  vwapBands: { ...d.vwapBands, lineWidth: parseInt(e.target.value) },
                }))
              }
            />
          </div>
        </div>
      )}
      {target === "liquidityBlocks" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="w-24 text-sm text-tv-text">Color de Compra</span>
            <ColorField
              value={draft.liquidityBlocks.buyColor}
              fallback={DEFAULT_CONFIG.liquidityBlocks.buyColor}
              onChange={(c) => setDraft((d) => ({ ...d, liquidityBlocks: { ...d.liquidityBlocks, buyColor: c } }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24 text-sm text-tv-text">Color de Venta</span>
            <ColorField
              value={draft.liquidityBlocks.sellColor}
              fallback={DEFAULT_CONFIG.liquidityBlocks.sellColor}
              onChange={(c) => setDraft((d) => ({ ...d, liquidityBlocks: { ...d.liquidityBlocks, sellColor: c } }))}
            />
          </div>
          <Field
            label="Opacidad base"
            value={draft.liquidityBlocks.opacity}
            min={0.1}
            max={1}
            onChange={(opacity) => setDraft((d) => ({ ...d, liquidityBlocks: { ...d.liquidityBlocks, opacity } }))}
          />
          <Field
            label="Volumen Mínimo (Millones USDT)"
            value={draft.liquidityBlocks.minVolumeUsdt / 1_000_000}
            min={0.01}
            max={1000}
            onChange={(val) => setDraft((d) => ({ ...d, liquidityBlocks: { ...d.liquidityBlocks, minVolumeUsdt: val * 1_000_000 } }))}
          />
          <Field
            label="Máximos bloques (Top N)"
            value={draft.liquidityBlocks.topBlocks}
            min={1}
            max={50}
            onChange={(topBlocks) => setDraft((d) => ({ ...d, liquidityBlocks: { ...d.liquidityBlocks, topBlocks } }))}
          />
          <Field
            label="Agrupación de precio (%)"
            value={draft.liquidityBlocks.bucketPct}
            min={0.01}
            max={5}
            onChange={(bucketPct) => setDraft((d) => ({ ...d, liquidityBlocks: { ...d.liquidityBlocks, bucketPct } }))}
          />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-tv-text-muted hover:text-tv-text"
        >
          Reset defaults
        </Button>
        <Button size="sm" onClick={save} className="bg-tv-blue hover:bg-tv-blue/90">
          Aplicar
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  min = 2,
  max = 500,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        className="bg-tv-bg tabular-nums"
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex h-8 items-center gap-2 rounded-lg border border-input bg-tv-bg px-2 text-xs text-tv-text">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 accent-tv-blue"
      />
      <span>{label}</span>
    </label>
  );
}

function SessionField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <Input
        value={value}
        placeholder="0930-1100"
        onChange={(event) => onChange(event.target.value)}
        className="bg-tv-bg font-mono text-xs"
      />
    </label>
  );
}

function RsiSettingsFields({
  length,
  settings,
  onLengthChange,
  onSettingsChange,
}: {
  length: number;
  settings: RsiSettingsConfig;
  onLengthChange: (value: number) => void;
  onSettingsChange: (patch: Partial<RsiSettingsConfig>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field
        label="RSI Length"
        value={length}
        min={1}
        max={100}
        onChange={onLengthChange}
      />
      <ToggleField
        label="Divergencias"
        checked={settings.calculateDivergence}
        onChange={(calculateDivergence) =>
          onSettingsChange({ calculateDivergence })
        }
      />
      <ColorField
        label="Color RSI"
        value={settings.rsiColor}
        fallback={DEFAULT_CONFIG.rsiSettings.rsiColor}
        onChange={(rsiColor) => onSettingsChange({ rsiColor })}
      />
      <ColorField
        label="Color MA"
        value={settings.maColor}
        fallback={DEFAULT_CONFIG.rsiSettings.maColor}
        onChange={(maColor) => onSettingsChange({ maColor })}
      />
      <ColorField
        label="Fondo rango"
        value={settings.rangeFillColor}
        fallback={DEFAULT_CONFIG.rsiSettings.rangeFillColor}
        onChange={(rangeFillColor) => onSettingsChange({ rangeFillColor })}
      />
      <ColorField
        label="Lineas topes"
        value={settings.rangeLineColor}
        fallback={DEFAULT_CONFIG.rsiSettings.rangeLineColor}
        onChange={(rangeLineColor) => onSettingsChange({ rangeLineColor })}
      />
      <LineStyleField
        value={settings.rsiLineStyle}
        onChange={(rsiLineStyle) => onSettingsChange({ rsiLineStyle })}
      />
      <LineStyleField
        value={settings.maLineStyle}
        onChange={(maLineStyle) => onSettingsChange({ maLineStyle })}
      />
      <Field
        label="RSI Grosor"
        value={settings.rsiLineWidth}
        min={1}
        max={5}
        onChange={(rsiLineWidth) => onSettingsChange({ rsiLineWidth })}
      />
      <Field
        label="MA Grosor"
        value={settings.maLineWidth}
        min={1}
        max={5}
        onChange={(maLineWidth) => onSettingsChange({ maLineWidth })}
      />
      <label className="col-span-2 flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
          Smoothing Type
        </span>
        <select
          value={settings.maType}
          onChange={(event) =>
            onSettingsChange({ maType: event.target.value as RsiMaType })
          }
          className="h-9 rounded-md border border-tv-border bg-tv-bg px-2 text-sm text-tv-text outline-none"
        >
          {RSI_MA_OPTIONS.map((option) => (
            <option key={option} value={option} className="bg-tv-panel">
              {option}
            </option>
          ))}
        </select>
      </label>
      <Field
        label="MA Length"
        value={settings.maLength}
        min={1}
        max={500}
        onChange={(maLength) => onSettingsChange({ maLength })}
      />
      <Field
        label="BB StdDev"
        value={settings.bbMult}
        min={0.001}
        max={50}
        onChange={(bbMult) => onSettingsChange({ bbMult })}
      />
    </div>
  );
}

function VolumeFields({
  settings,
  onSettingsChange,
}: {
  settings: VolumeConfig;
  onSettingsChange: (patch: Partial<VolumeConfig>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field
        label="Altura %"
        value={settings.heightPct}
        min={12}
        max={45}
        onChange={(heightPct) => onSettingsChange({ heightPct })}
      />
      <label className="flex h-8 items-center gap-2 rounded-lg border border-input bg-tv-bg px-2 text-xs text-tv-text">
        <input
          type="checkbox"
          checked={settings.ema20Enabled}
          onChange={(event) =>
            onSettingsChange({ ema20Enabled: event.target.checked })
          }
          className="h-3.5 w-3.5 accent-tv-blue"
        />
        <span>EMA 20 del volumen</span>
      </label>
      <ColorField
        label="Color EMA 20"
        value={settings.ema20Color}
        fallback={DEFAULT_CONFIG.volume.ema20Color}
        onChange={(ema20Color) => onSettingsChange({ ema20Color })}
      />
    </div>
  );
}

function VolumeProfileFields({
  settings,
  onSettingsChange,
}: {
  settings: VolumeProfileConfig;
  onSettingsChange: (patch: Partial<VolumeProfileConfig>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field
        label="Filas"
        value={settings.rows}
        min={12}
        max={1000}
        onChange={(rows) => onSettingsChange({ rows })}
      />
      <Field
        label="Ancho %"
        value={settings.widthPct}
        min={12}
        max={60}
        onChange={(widthPct) => onSettingsChange({ widthPct })}
      />
      <Field
        label="Opacidad"
        value={settings.opacity}
        min={10}
        max={100}
        onChange={(opacity) => onSettingsChange({ opacity })}
      />
      <ColorField
        label="Compras"
        value={settings.buyColor}
        fallback={DEFAULT_CONFIG.volumeProfile.buyColor}
        onChange={(buyColor) => onSettingsChange({ buyColor })}
      />
      <ColorField
        label="Ventas"
        value={settings.sellColor}
        fallback={DEFAULT_CONFIG.volumeProfile.sellColor}
        onChange={(sellColor) => onSettingsChange({ sellColor })}
      />
      <ColorField
        label="POC"
        value={settings.pocColor}
        fallback={DEFAULT_CONFIG.volumeProfile.pocColor}
        onChange={(pocColor) => onSettingsChange({ pocColor })}
      />
    </div>
  );
}

function MonthlyGannFields({
  settings,
  onSettingsChange,
}: {
  settings: MonthlyGannConfig;
  onSettingsChange: (patch: Partial<MonthlyGannConfig>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <DateField
        label="Inicio"
        value={settings.startDate}
        onChange={(startDate) => onSettingsChange({ startDate })}
      />
      <DateField
        label="Fin"
        value={settings.endDate}
        onChange={(endDate) => onSettingsChange({ endDate })}
      />
      <Field
        label="Relleno"
        value={settings.opacity}
        min={0}
        max={40}
        onChange={(opacity) => onSettingsChange({ opacity })}
      />
      <Field
        label="Lineas"
        value={settings.lineOpacity}
        min={0}
        max={100}
        onChange={(lineOpacity) => onSettingsChange({ lineOpacity })}
      />
      <label className="flex h-8 items-center gap-2 rounded-lg border border-input bg-tv-bg px-2 text-xs text-tv-text">
        <input
          type="checkbox"
          checked={settings.showLabels}
          onChange={(event) =>
            onSettingsChange({ showLabels: event.target.checked })
          }
          className="h-3.5 w-3.5 accent-tv-blue"
        />
        <span>Etiquetas</span>
      </label>
      <ColorField
        label="Lineas"
        value={settings.color}
        fallback={DEFAULT_CONFIG.monthlyGann.color}
        onChange={(color) => onSettingsChange({ color })}
      />
      <ColorField
        label="Fondo"
        value={settings.fillColor}
        fallback={DEFAULT_CONFIG.monthlyGann.fillColor}
        onChange={(fillColor) => onSettingsChange({ fillColor })}
      />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <Input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 bg-tv-bg text-xs text-tv-text"
      />
    </label>
  );
}

function FillLineField({
  label,
  value,
  lines,
  onChange,
}: {
  label: string;
  value: number;
  lines: EmaCrossLineConfig[];
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="h-8 rounded-lg border border-input bg-tv-bg px-2 text-xs text-tv-text outline-none"
      >
        {lines.map((line, index) => (
          <option key={index} value={index} className="bg-tv-panel">
            EMA {index + 1} ({line.period})
          </option>
        ))}
      </select>
    </label>
  );
}

function ColorField({
  label = "Color",
  value,
  fallback,
  onChange,
}: {
  label?: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  const color = normalizeColor(value, fallback);

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 shrink-0 cursor-pointer rounded border border-tv-border bg-tv-bg p-0.5"
          aria-label="Color de EMA"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-tv-bg font-mono text-xs"
          aria-label="Color hex"
        />
      </div>
    </label>
  );
}

function OpacityField({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        Opacidad
      </span>
      <div className="flex h-8 items-center gap-2 rounded-lg border border-input bg-tv-bg px-2">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="min-w-0 flex-1 accent-tv-blue"
          aria-label="Opacidad del relleno"
        />
        <span className="w-9 text-right text-xs tabular-nums text-tv-text-muted">
          {value}%
        </span>
      </div>
    </label>
  );
}

function LineStyleField({
  value,
  onChange,
}: {
  value: EmaCrossLineStyle;
  onChange: (value: EmaCrossLineStyle) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        Estilo
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as EmaCrossLineStyle)}
        className="h-8 rounded-lg border border-input bg-tv-bg px-2 text-xs text-tv-text outline-none"
      >
        {LINE_STYLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="bg-tv-panel">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function cloneEmaCrossConfig(
  config: EmaCrossLineConfig[],
  defaults = DEFAULT_CONFIG.emaCross,
) {
  return defaults.map((fallback, index) => ({
    ...fallback,
    ...config?.[index],
    enabled: config[index]?.enabled ?? fallback.enabled,
  }));
}

function cloneEmaCrossFillConfig(
  config: EmaCrossFillConfig,
  defaults = DEFAULT_CONFIG.emaCrossFill,
) {
  return {
    ...defaults,
    ...config,
  };
}

function normalizeEmaCrossFillConfig(
  config: EmaCrossFillConfig,
  lines = DEFAULT_CONFIG.emaCross,
  defaults = DEFAULT_CONFIG.emaCrossFill,
) {
  const maxLineIndex = lines.length - 1;
  const from = clamp(config.from, 0, maxLineIndex);
  const rawTo = clamp(config.to, 0, maxLineIndex);
  const to =
    rawTo === from
      ? from === maxLineIndex
        ? from - 1
        : from + 1
      : rawTo;

  return {
    enabled: config.enabled,
    from,
    to,
    color: normalizeColor(config.color, defaults.color),
    opacity: clamp(config.opacity, 0, 100),
  };
}

function normalizeColor(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function normalizeSessionInput(value: string, fallback: string): string {
  const normalized = value.trim();
  return /^([01]\d|2[0-3])[0-5]\d-([01]\d|2[0-3])[0-5]\d$/.test(normalized)
    ? normalized
    : fallback;
}

function normalizeDateInput(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function normalizeOptionalNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
