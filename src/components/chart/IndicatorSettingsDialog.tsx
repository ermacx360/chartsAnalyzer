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
  type RsiSettingsConfig,
  type RsiMaType,
  type VolumeProfileConfig,
} from "@/lib/store/chart-store";

const TITLES: Record<IndicatorKey, string> = {
  ema20: "EMA — Slot 1",
  ema50: "EMA — Slot 2",
  ema200: "EMA — Slot 3",
  emaCross: "EMA Cross",
  rsi: "RSI",
  macd: "MACD",
  volume: "Volumen",
  volumeProfile: "Volume Profile Visible Range",
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
    ema20: config.ema20,
    ema50: config.ema50,
    ema200: config.ema200,
    rsi: config.rsi,
    rsiSettings: { ...config.rsiSettings },
    macdFast: config.macdFast,
    macdSlow: config.macdSlow,
    macdSignal: config.macdSignal,
    volumeProfile: { ...config.volumeProfile },
    emaCross: cloneEmaCrossConfig(config.emaCross),
    emaCrossFill: cloneEmaCrossFillConfig(config.emaCrossFill),
    swingPatterns: { ...config.swingPatterns },
    pmRangeBreakout: { ...config.pmRangeBreakout },
    sqzAdxTtm: { ...config.sqzAdxTtm },
  }));

  function save() {
    if (target === "ema20") onSave({ ema20: clamp(draft.ema20, 2, 500) });
    else if (target === "ema50") onSave({ ema50: clamp(draft.ema50, 2, 500) });
    else if (target === "ema200") onSave({ ema200: clamp(draft.ema200, 2, 500) });
    else if (target === "rsi")
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
        emaCrossFill: normalizeEmaCrossFillConfig(draft.emaCrossFill),
      });
    else if (target === "volume") onSave({});
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

  return (
    <div className="flex flex-col gap-3">
      {(target === "ema20" || target === "ema50" || target === "ema200") && (
        <Field
          label="Período"
          value={draft[target]}
          onChange={(n) => setDraft((d) => ({ ...d, [target]: n }))}
        />
      )}
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
      {target === "volume" && (
        <p className="text-xs text-tv-text-muted">
          El indicador de volumen no tiene parámetros configurables en esta
          versión.
        </p>
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

function cloneEmaCrossConfig(config: EmaCrossLineConfig[]) {
  return DEFAULT_CONFIG.emaCross.map((fallback, index) => ({
    ...fallback,
    ...config[index],
    enabled: config[index]?.enabled ?? fallback.enabled,
  }));
}

function cloneEmaCrossFillConfig(config: EmaCrossFillConfig) {
  return {
    ...DEFAULT_CONFIG.emaCrossFill,
    ...config,
  };
}

function normalizeEmaCrossFillConfig(config: EmaCrossFillConfig) {
  const maxLineIndex = DEFAULT_CONFIG.emaCross.length - 1;
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
    color: normalizeColor(config.color, DEFAULT_CONFIG.emaCrossFill.color),
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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
