"use client";

import { formatPrice } from "@/lib/format";

interface Props {
  aX: number;
  aY: number;
  bX: number;
  bY: number;
  priceDiff: number;
  pctChange: number;
  bars: number;
  durationText: string;
  isUp: boolean;
  isPreview: boolean;
}

const UP_STROKE = "#26a69a";
const UP_FILL = "rgba(38, 166, 154, 0.16)";
const DOWN_STROKE = "#ff5a6b";
const DOWN_FILL = "rgba(255, 90, 107, 0.16)";

export function MeasureOverlay({
  aX,
  aY,
  bX,
  bY,
  priceDiff,
  pctChange,
  bars,
  durationText,
  isUp,
  isPreview,
}: Props) {
  const stroke = isUp ? UP_STROKE : DOWN_STROKE;
  const fill = isUp ? UP_FILL : DOWN_FILL;
  const left = Math.min(aX, bX);
  const right = Math.max(aX, bX);
  const top = Math.min(aY, bY);
  const bottom = Math.max(aY, bY);
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const centerX = (aX + bX) / 2;
  const centerY = (aY + bY) / 2;
  const markerId = `measure-arrow-${isUp ? "up" : "down"}`;
  const labelWidth = 146;
  const sign = priceDiff >= 0 ? "+" : "";
  const pctSign = pctChange >= 0 ? "+" : "";

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 z-20 h-full w-full"
        style={{ overflow: "visible" }}
      >
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
            <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
          </marker>
        </defs>
        <rect
          x={left}
          y={top}
          width={width}
          height={height}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          strokeDasharray={isPreview ? "4 3" : undefined}
        />
        <line
          x1={left}
          x2={right}
          y1={centerY}
          y2={centerY}
          stroke={stroke}
          strokeWidth={1}
          markerEnd={`url(#${markerId})`}
        />
        <line
          x1={centerX}
          x2={centerX}
          y1={top}
          y2={bottom}
          stroke={stroke}
          strokeWidth={1}
          markerEnd={`url(#${markerId})`}
        />
      </svg>
      <div
        className="pointer-events-none absolute z-20 rounded px-2 py-1.5 text-center text-[11px] font-semibold leading-tight tabular-nums text-white shadow-md"
        style={{
          left: Math.max(8, centerX - labelWidth / 2),
          top: bottom + 10,
          width: labelWidth,
          backgroundColor: stroke,
        }}
      >
        <div>
          {sign}
          {formatPrice(priceDiff)} ({pctSign}
          {pctChange.toFixed(2)}%)
        </div>
        <div className="mt-1 opacity-95">
          {bars} barras, {durationText}
        </div>
      </div>
    </>
  );
}
