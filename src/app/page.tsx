"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { BottomPanel } from "@/components/layout/BottomPanel";
import { PriceChart } from "@/components/chart/PriceChart";
import { IndicatorSettingsDialog } from "@/components/chart/IndicatorSettingsDialog";
import { useChartStore } from "@/lib/store/chart-store";

function normalizeHexColor(color: string, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function isLightColor(color: string) {
  const r = Number.parseInt(color.slice(1, 3), 16) / 255;
  const g = Number.parseInt(color.slice(3, 5), 16) / 255;
  const b = Number.parseInt(color.slice(5, 7), 16) / 255;
  const luminance =
    0.2126 * r ** 2.2 + 0.7152 * g ** 2.2 + 0.0722 * b ** 2.2;

  return luminance > 0.55;
}

function getPagePanelTheme(panelColor: string) {
  const panel = normalizeHexColor(panelColor, "#1e222d");
  const light = isLightColor(panel);

  return {
    panel,
    bg: light ? "#f6f8fb" : panel === "#000000" ? "#000000" : "#131722",
    hover: light ? "#e9edf5" : panel === "#000000" ? "#1d1d1d" : "#303643",
    border: light ? "#cbd3df" : panel === "#000000" ? "#343434" : "#343a47",
    text: light ? "#111827" : "#eef2fb",
    textMuted: light ? "#48515f" : "#aab2c2",
    textDim: light ? "#687386" : "#7f8898",
  };
}

export default function HomePage() {
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const symbol = useChartStore((s) => s.symbol);
  const timeframe = useChartStore((s) => s.timeframe);
  const pageBackgroundColor = useChartStore((s) => s.pageBackgroundColor);
  const pagePanelColor = useChartStore((s) => s.pagePanelColor);
  const panelTheme = getPagePanelTheme(pagePanelColor);
  const appStyle = {
    backgroundColor: pageBackgroundColor,
    "--app-tv-bg": panelTheme.bg,
    "--app-tv-panel": panelTheme.panel,
    "--app-tv-panel-hover": panelTheme.hover,
    "--app-tv-border": panelTheme.border,
    "--app-tv-text": panelTheme.text,
    "--app-tv-text-muted": panelTheme.textMuted,
    "--app-tv-text-dim": panelTheme.textDim,
    "--color-tv-bg": panelTheme.bg,
    "--color-tv-panel": panelTheme.panel,
    "--color-tv-panel-hover": panelTheme.hover,
    "--color-tv-border": panelTheme.border,
    "--color-tv-text": panelTheme.text,
    "--color-tv-text-muted": panelTheme.textMuted,
    "--color-tv-text-dim": panelTheme.textDim,
  } as CSSProperties;

  useEffect(() => {
    const target = document.body;
    target.style.setProperty("--app-tv-bg", panelTheme.bg);
    target.style.setProperty("--app-tv-panel", panelTheme.panel);
    target.style.setProperty("--app-tv-panel-hover", panelTheme.hover);
    target.style.setProperty("--app-tv-border", panelTheme.border);
    target.style.setProperty("--app-tv-text", panelTheme.text);
    target.style.setProperty("--app-tv-text-muted", panelTheme.textMuted);
    target.style.setProperty("--app-tv-text-dim", panelTheme.textDim);
    target.style.backgroundColor = pageBackgroundColor;
  }, [pageBackgroundColor, panelTheme]);

  return (
    <div
      className="tv-theme flex fixed inset-0 flex-col overflow-hidden bg-tv-bg"
      style={appStyle}
    >
      <Header />
      <div className="flex min-h-0 flex-1">
        <div className="hidden md:flex">
          <LeftSidebar />
        </div>
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <PriceChart symbol={symbol} timeframe={timeframe} />
          </div>
        </main>
        <aside className="hidden md:flex w-8 shrink-0 flex-col items-center border-l border-tv-border bg-tv-panel py-1.5">
          <button
            type="button"
            aria-label={rightSidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
            title={rightSidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
            onClick={() => setRightSidebarOpen((open) => !open)}
            className="flex h-7 w-7 items-center justify-center rounded text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
          >
            {rightSidebarOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>
        </aside>
        <div className="hidden md:flex">
          <RightSidebar hidden={!rightSidebarOpen} />
        </div>
      </div>
      <BottomPanel />
      <IndicatorSettingsDialog />
    </div>
  );
}
