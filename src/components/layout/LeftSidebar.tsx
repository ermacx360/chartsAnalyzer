"use client";

import { useEffect } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChartBar,
  ChartSpline,
  Circle,
  Crosshair,
  Diamond,
  ListEnd,
  GitCompare,
  Highlighter,
  Lock,
  MousePointer2,
  MoveHorizontal,
  MoveVertical,
  Paintbrush,
  PenLine,
  Route,
  Ruler,
  Slash,
  Square,
  Trash2,
  Triangle,
  TrendingUp,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChartStore, type DrawingTool } from "@/lib/store/chart-store";
import { cn } from "@/lib/utils";

interface ToolDef {
  key: DrawingTool;
  icon: LucideIcon;
  label: string;
  hint?: string;
}

interface LineToolDef extends ToolDef {
  shortcut?: string;
}

const MAIN_TOOLS: ToolDef[] = [
  { key: "cursor", icon: MousePointer2, label: "Cursor", hint: "Modo navegacion" },
  {
    key: "measure",
    icon: Ruler,
    label: "Regla / Medir",
    hint: "Click en dos puntos para medir precio, %, barras y volumen",
  },
];

const LINE_TOOLS: LineToolDef[] = [
  { key: "trendLine", icon: Slash, label: "Linea de tendencia", shortcut: "Alt + T" },
  { key: "ray", icon: TrendingUp, label: "Rayo" },
  { key: "infoLine", icon: ChartSpline, label: "Linea de informacion" },
  { key: "extendedLine", icon: GitCompare, label: "Linea extendida" },
  { key: "trendAngle", icon: TrendingUp, label: "Angulo de tendencia" },
  { key: "hline", icon: MoveHorizontal, label: "Linea horizontal", shortcut: "Alt + H" },
  { key: "hray", icon: MoveHorizontal, label: "Rayo horizontal", shortcut: "Alt + J" },
  { key: "vline", icon: MoveVertical, label: "Linea vertical", shortcut: "Alt + V" },
  { key: "crossLine", icon: Crosshair, label: "Linea de cruce", shortcut: "Alt + C" },
];

const CHANNEL_TOOLS: LineToolDef[] = [
  { key: "parallelChannel", icon: GitCompare, label: "Canal paralelo" },
  { key: "regressionTrend", icon: ChartSpline, label: "Tendencia de regresion" },
  { key: "flatTopBottom", icon: MoveHorizontal, label: "Plano superior/inferior" },
  { key: "disjointChannel", icon: GitCompare, label: "Canal desconectado" },
];

const PAINT_TOOLS: LineToolDef[] = [
  { key: "brush", icon: Paintbrush, label: "Pincel" },
  { key: "highlighter", icon: Highlighter, label: "Resaltador" },
];

const ARROW_TOOLS: LineToolDef[] = [
  { key: "arrowMarker", icon: ArrowUpRight, label: "Marcador de flecha" },
  { key: "arrow", icon: ArrowUpRight, label: "Flecha" },
  { key: "arrowUp", icon: ArrowUp, label: "Marca de flecha hacia arriba" },
  { key: "arrowDown", icon: ArrowDown, label: "Marca de flecha hacia abajo" },
];

const SHAPE_TOOLS: LineToolDef[] = [
  { key: "rectangle", icon: Square, label: "Rectangulo", shortcut: "Alt + Shift + R" },
  { key: "rotatedRectangle", icon: Diamond, label: "Rectangulo rotado" },
  { key: "route", icon: Route, label: "Ruta" },
  { key: "circle", icon: Circle, label: "Circulo" },
  { key: "ellipse", icon: Circle, label: "Elipse" },
  { key: "polyline", icon: PenLine, label: "Polilinea" },
  { key: "triangle", icon: Triangle, label: "Triangulo" },
  { key: "arc", icon: ChartSpline, label: "Arco" },
  { key: "curve", icon: ChartSpline, label: "Curva" },
  { key: "doubleCurve", icon: ChartSpline, label: "Doble curva" },
];

const FIBONACCI_TOOLS: LineToolDef[] = [
  { key: "fibRetracement", icon: ListEnd, label: "Retroceso de Fibonacci" },
  {
    key: "fibExtension",
    icon: ListEnd,
    label: "Extension de Fibonacci en funcion de las tendencias",
  },
];

const PROJECTION_TOOLS: LineToolDef[] = [
  { key: "fixedVolumeProfile", icon: ChartBar, label: "Volume Profile fijo" },
  { key: "longPosition", icon: Waypoints, label: "Posicion larga" },
  { key: "shortPosition", icon: Waypoints, label: "Posicion corta" },
];

const LINE_TOOL_KEYS = new Set<DrawingTool>([
  ...LINE_TOOLS.map((tool) => tool.key),
  ...CHANNEL_TOOLS.map((tool) => tool.key),
  ...PAINT_TOOLS.map((tool) => tool.key),
]);

const ARROW_TOOL_KEYS = new Set<DrawingTool>([
  ...ARROW_TOOLS.map((tool) => tool.key),
]);

const SHAPE_TOOL_KEYS = new Set<DrawingTool>([
  ...SHAPE_TOOLS.map((tool) => tool.key),
]);

const FIBONACCI_TOOL_KEYS = new Set<DrawingTool>([
  ...FIBONACCI_TOOLS.map((tool) => tool.key),
]);

const PROJECTION_TOOL_KEYS = new Set<DrawingTool>([
  ...PROJECTION_TOOLS.map((tool) => tool.key),
]);

const SHORTCUT_TO_TOOL: Record<string, DrawingTool> = {
  t: "trendLine",
  h: "hline",
  j: "hray",
  v: "vline",
  c: "crossLine",
};

function SidebarButton({
  active,
  children,
  label,
  hint,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onClick}
        aria-label={label}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
          active
            ? "bg-tv-blue/15 text-tv-blue"
            : "text-tv-text-muted hover:text-tv-text",
        )}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        <div className="font-medium">{label}</div>
        {hint && (
          <div className="mt-0.5 text-[10px] text-tv-text-muted">{hint}</div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function LeftSidebar() {
  const tool = useChartStore((s) => s.tool);
  const setTool = useChartStore((s) => s.setTool);
  const clearPriceLines = useChartStore((s) => s.clearPriceLines);
  const clearDrawings = useChartStore((s) => s.clearDrawings);
  const symbol = useChartStore((s) => s.symbol);
  const allDrawTools = [
    ...LINE_TOOLS,
    ...CHANNEL_TOOLS,
    ...PAINT_TOOLS,
    ...ARROW_TOOLS,
    ...SHAPE_TOOLS,
    ...FIBONACCI_TOOLS,
    ...PROJECTION_TOOLS,
  ];
  const activeLineTool = allDrawTools.find((item) => item.key === tool);
  const ActiveLineIcon = activeLineTool?.icon ?? Slash;
  const linesActive = LINE_TOOL_KEYS.has(tool);
  const activeArrowTool = ARROW_TOOLS.find((item) => item.key === tool);
  const ActiveArrowIcon = activeArrowTool?.icon ?? ArrowUpRight;
  const arrowsActive = ARROW_TOOL_KEYS.has(tool);
  const activeShapeTool = SHAPE_TOOLS.find((item) => item.key === tool);
  const ActiveShapeIcon = activeShapeTool?.icon ?? Square;
  const shapesActive = SHAPE_TOOL_KEYS.has(tool);
  const activeFibonacciTool = FIBONACCI_TOOLS.find((item) => item.key === tool);
  const ActiveFibonacciIcon = activeFibonacciTool?.icon ?? ListEnd;
  const fibonacciActive = FIBONACCI_TOOL_KEYS.has(tool);
  const activeProjectionTool = PROJECTION_TOOLS.find((item) => item.key === tool);
  const ActiveProjectionIcon = activeProjectionTool?.icon ?? Waypoints;
  const projectionActive = PROJECTION_TOOL_KEYS.has(tool);

  const clearSymbolDrawings = () => {
    clearPriceLines(symbol);
    clearDrawings(symbol);
  };

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;

      const nextTool = SHORTCUT_TO_TOOL[event.key.toLowerCase()];
      if (!nextTool) return;

      event.preventDefault();
      setTool(nextTool);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setTool]);

  return (
    <aside className="flex w-11 flex-col items-center gap-0.5 border-r border-tv-border bg-tv-panel py-1.5">
      {MAIN_TOOLS.map((item) => {
        const Icon = item.icon;
        return (
          <SidebarButton
            key={item.key}
            active={tool === item.key}
            label={item.label}
            hint={item.hint}
            onClick={() => setTool(item.key)}
          >
            <Icon className="h-4 w-4" />
          </SidebarButton>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Herramientas de linea"
          title={activeLineTool?.label ?? "Herramientas de linea"}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
            linesActive
              ? "bg-tv-blue/15 text-tv-blue"
              : "text-tv-text-muted hover:text-tv-text",
          )}
        >
          <ActiveLineIcon className="h-4 w-4" />
        </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="right"
            sideOffset={8}
            className="w-72 rounded-sm border border-tv-border bg-[#1f1f1f] p-1.5 text-tv-text shadow-xl"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-muted">
                Lineas
              </DropdownMenuLabel>
              {LINE_TOOLS.map((item) => {
                const Icon = item.icon;
                const active = tool === item.key;
                return (
                  <DropdownMenuItem
                    key={item.key}
                    onClick={() => setTool(item.key)}
                    className={cn(
                      "min-h-9 cursor-pointer gap-3 rounded-sm px-2 text-[13px] text-tv-text focus:bg-tv-panel-hover",
                      active && "bg-tv-blue/15 text-tv-blue",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <DropdownMenuShortcut className="text-[11px] tracking-normal text-tv-text-muted">
                        {item.shortcut}
                      </DropdownMenuShortcut>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="-mx-1 my-1 bg-tv-border" />

            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-muted">
                Canales
              </DropdownMenuLabel>
              {CHANNEL_TOOLS.map((item) => {
                const Icon = item.icon;
                const active = tool === item.key;
                return (
                  <DropdownMenuItem
                    key={item.key}
                    onClick={() => setTool(item.key)}
                    className={cn(
                      "min-h-9 cursor-pointer gap-3 rounded-sm px-2 text-[13px] text-tv-text focus:bg-tv-panel-hover",
                      active && "bg-tv-blue/15 text-tv-blue",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="-mx-1 my-1 bg-tv-border" />

            <DropdownMenuGroup>
              {PAINT_TOOLS.map((item) => {
                const Icon = item.icon;
                const active = tool === item.key;
                return (
                  <DropdownMenuItem
                    key={item.key}
                    onClick={() => setTool(item.key)}
                    className={cn(
                      "min-h-9 cursor-pointer gap-3 rounded-sm px-2 text-[13px] text-tv-text focus:bg-tv-panel-hover",
                      active && "bg-tv-blue/15 text-tv-blue",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>

          </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Herramientas de flechas"
          title={activeArrowTool?.label ?? "Herramientas de flechas"}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
            arrowsActive
              ? "bg-tv-blue/15 text-tv-blue"
              : "text-tv-text-muted hover:text-tv-text",
          )}
        >
          <ActiveArrowIcon className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="right"
          sideOffset={8}
          className="w-72 rounded-sm border border-tv-border bg-[#1f1f1f] p-1.5 text-tv-text shadow-xl"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-muted">
              Flechas
            </DropdownMenuLabel>
            {ARROW_TOOLS.map((item) => {
              const Icon = item.icon;
              const active = tool === item.key;
              return (
                <DropdownMenuItem
                  key={item.key}
                  onClick={() => setTool(item.key)}
                  className={cn(
                    "min-h-9 cursor-pointer gap-3 rounded-sm px-2 text-[13px] text-tv-text focus:bg-tv-panel-hover",
                    active && "bg-tv-blue/15 text-tv-blue",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Herramientas de figuras"
          title={activeShapeTool?.label ?? "Herramientas de figuras"}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
            shapesActive
              ? "bg-tv-blue/15 text-tv-blue"
              : "text-tv-text-muted hover:text-tv-text",
          )}
        >
          <ActiveShapeIcon className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="right"
          sideOffset={8}
          className="w-72 rounded-sm border border-tv-border bg-[#1f1f1f] p-1.5 text-tv-text shadow-xl"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-muted">
              Figuras
            </DropdownMenuLabel>
            {SHAPE_TOOLS.map((item) => {
              const Icon = item.icon;
              const active = tool === item.key;
              return (
                <DropdownMenuItem
                  key={item.key}
                  onClick={() => setTool(item.key)}
                  className={cn(
                    "min-h-9 cursor-pointer gap-3 rounded-sm px-2 text-[13px] text-tv-text focus:bg-tv-panel-hover",
                    active && "bg-tv-blue/15 text-tv-blue",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <DropdownMenuShortcut className="text-[11px] tracking-normal text-tv-text-muted">
                      {item.shortcut}
                    </DropdownMenuShortcut>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Herramientas de Fibonacci"
          title={activeFibonacciTool?.label ?? "Herramientas de Fibonacci"}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
            fibonacciActive
              ? "bg-tv-blue/15 text-tv-blue"
              : "text-tv-text-muted hover:text-tv-text",
          )}
        >
          <ActiveFibonacciIcon className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="right"
          sideOffset={8}
          className="w-80 rounded-sm border border-tv-border bg-[#1f1f1f] p-1.5 text-tv-text shadow-xl"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-muted">
              Fibonacci
            </DropdownMenuLabel>
            {FIBONACCI_TOOLS.map((item) => {
              const Icon = item.icon;
              const active = tool === item.key;
              return (
                <DropdownMenuItem
                  key={item.key}
                  onClick={() => setTool(item.key)}
                  className={cn(
                    "min-h-9 cursor-pointer gap-3 rounded-sm px-2 text-[13px] text-tv-text focus:bg-tv-panel-hover",
                    active && "bg-tv-blue/15 text-tv-blue",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Herramientas de proyeccion"
          title={activeProjectionTool?.label ?? "Herramientas de proyeccion"}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
            projectionActive
              ? "bg-tv-blue/15 text-tv-blue"
              : "text-tv-text-muted hover:text-tv-text",
          )}
        >
          <ActiveProjectionIcon className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="right"
          sideOffset={8}
          className="w-64 rounded-sm border border-tv-border bg-[#1f1f1f] p-1.5 text-tv-text shadow-xl"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-muted">
              Proyeccion
            </DropdownMenuLabel>
            {PROJECTION_TOOLS.map((item) => {
              const Icon = item.icon;
              const active = tool === item.key;
              return (
                <DropdownMenuItem
                  key={item.key}
                  onClick={() => setTool(item.key)}
                  className={cn(
                    "min-h-9 cursor-pointer gap-3 rounded-sm px-2 text-[13px] text-tv-text focus:bg-tv-panel-hover",
                    active && "bg-tv-blue/15 text-tv-blue",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger
          onClick={clearSymbolDrawings}
          aria-label="Borrar dibujos"
          className="flex h-8 w-8 items-center justify-center rounded text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-red"
        >
          <Trash2 className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="font-medium">Borrar dibujos</div>
          <div className="mt-0.5 text-[10px] text-tv-text-muted">
            Limpia las lineas de este simbolo
          </div>
        </TooltipContent>
      </Tooltip>

      <div className="my-1 h-px w-6 bg-tv-border" />

      <Tooltip>
        <TooltipTrigger
          disabled
          aria-label="Herramientas bloqueadas"
          className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded text-tv-text-dim opacity-40"
        >
          <Lock className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="font-medium">Mas herramientas</div>
          <div className="mt-0.5 text-[10px] text-tv-yellow">Proximamente</div>
        </TooltipContent>
      </Tooltip>
    </aside>
  );
}
