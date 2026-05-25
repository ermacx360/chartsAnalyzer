"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { getBinanceWS } from "@/lib/binance/ws";
import {
  fetchTickers24h,
  getMarketPollIntervalMs,
  getSymbolDisplay,
  isCryptoSymbol,
} from "@/lib/market/data";
import {
  useChartStore,
  type WatchlistAssignments,
  type WatchlistFolder,
} from "@/lib/store/chart-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatPrice, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Row {
  symbol: string;
  price: number;
  pct: number;
}

interface WatchlistGroup extends WatchlistFolder {
  symbols: string[];
}

type FolderDialogState =
  | { mode: "create" }
  | { mode: "rename"; folderId: string }
  | null;
type DeleteFolderState = WatchlistGroup | null;

const MARKET_POLL_INTERVAL_MS = 30_000;

function groupWatchlist(
  watchlist: string[],
  folders: WatchlistFolder[],
  assignments: WatchlistAssignments,
) {
  const groups = folders.map<WatchlistGroup>((folder) => ({
    ...folder,
    symbols: [],
  }));
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const fallbackGroup = groups[0];

  watchlist.forEach((symbol) => {
    const folderId = assignments[symbol];
    const group = groupsById.get(folderId) ?? fallbackGroup;
    group?.symbols.push(symbol);
  });

  return groups;
}

export function Watchlist() {
  const watchlist = useChartStore((s) => s.watchlist);
  const watchlistFolders = useChartStore((s) => s.watchlistFolders);
  const watchlistAssignments = useChartStore((s) => s.watchlistAssignments);
  const symbol = useChartStore((s) => s.symbol);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const removeFromWatchlist = useChartStore((s) => s.removeFromWatchlist);
  const createWatchlistFolder = useChartStore((s) => s.createWatchlistFolder);
  const renameWatchlistFolder = useChartStore((s) => s.renameWatchlistFolder);
  const removeWatchlistFolder = useChartStore((s) => s.removeWatchlistFolder);
  const moveWatchlistSymbol = useChartStore((s) => s.moveWatchlistSymbol);
  const openSymbolDialog = useChartStore((s) => s.setSymbolDialogOpen);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [flash, setFlash] = useState<Record<string, "up" | "down" | null>>({});
  const [closedFolders, setClosedFolders] = useState<Record<string, boolean>>(
    {},
  );
  const [folderDialog, setFolderDialog] = useState<FolderDialogState>(null);
  const [deleteFolder, setDeleteFolder] = useState<DeleteFolderState>(null);
  const [folderName, setFolderName] = useState("");

  const groups = useMemo(
    () => groupWatchlist(watchlist, watchlistFolders, watchlistAssignments),
    [watchlist, watchlistFolders, watchlistAssignments],
  );
  const folderDialogTitle =
    folderDialog?.mode === "rename" ? "Renombrar carpeta" : "Nueva carpeta";

  useEffect(() => {
    if (watchlist.length === 0) {
      return;
    }

    let cancelled = false;

    function loadTickers(symbols: string[], replace = false) {
      if (symbols.length === 0) return;

      fetchTickers24h(symbols)
        .then((tickers) => {
          if (cancelled) return;

          setRows((prev) => {
            const next: Record<string, Row> = replace ? {} : { ...prev };
            tickers.forEach((t) => {
              next[t.symbol] = {
                symbol: t.symbol,
                price: t.lastPrice,
                pct: t.priceChangePercent,
              };
            });
            return next;
          });
        })
        .catch(() => {
          return;
        });
    }

    const cryptoSymbols = watchlist.filter(isCryptoSymbol);
    const marketSymbols = watchlist.filter((symbol) => !isCryptoSymbol(symbol));
    const fastMarketSymbols = marketSymbols.filter(
      (symbol) => getMarketPollIntervalMs(symbol) === 1_000,
    );
    const slowMarketSymbols = marketSymbols.filter(
      (symbol) => getMarketPollIntervalMs(symbol) === 5_000,
    );
    const standardMarketSymbols = marketSymbols.filter(
      (symbol) => getMarketPollIntervalMs(symbol) === MARKET_POLL_INTERVAL_MS,
    );
    loadTickers(watchlist, true);

    const unsub =
      cryptoSymbols.length > 0
        ? getBinanceWS().subscribeMiniTickers(cryptoSymbols, (tick) => {
            setRows((prev) => {
              const prevRow = prev[tick.symbol];
              if (prevRow) {
                if (tick.close > prevRow.price) {
                  setFlash((f) => ({ ...f, [tick.symbol]: "up" }));
                  setTimeout(
                    () =>
                      setFlash((f) => ({ ...f, [tick.symbol]: null })),
                    300,
                  );
                } else if (tick.close < prevRow.price) {
                  setFlash((f) => ({ ...f, [tick.symbol]: "down" }));
                  setTimeout(
                    () =>
                      setFlash((f) => ({ ...f, [tick.symbol]: null })),
                    300,
                  );
                }
              }
              return {
                ...prev,
                [tick.symbol]: {
                  symbol: tick.symbol,
                  price: tick.close,
                  pct: tick.pct,
                },
              };
            });
          })
        : () => {
            return;
          };
    const pollId =
      standardMarketSymbols.length > 0
        ? window.setInterval(
            () => loadTickers(standardMarketSymbols),
            MARKET_POLL_INTERVAL_MS,
          )
        : null;
    const cryptoPollId =
      cryptoSymbols.length > 0
        ? window.setInterval(
            () => loadTickers(cryptoSymbols),
            MARKET_POLL_INTERVAL_MS,
          )
        : null;
    const fastCapitalPollId =
      fastMarketSymbols.length > 0
        ? window.setInterval(
            () => loadTickers(fastMarketSymbols),
            1_000,
          )
        : null;
    const slowCapitalPollId =
      slowMarketSymbols.length > 0
        ? window.setInterval(
            () => loadTickers(slowMarketSymbols),
            5_000,
          )
        : null;

    return () => {
      cancelled = true;
      if (pollId !== null) window.clearInterval(pollId);
      if (cryptoPollId !== null) window.clearInterval(cryptoPollId);
      if (fastCapitalPollId !== null) window.clearInterval(fastCapitalPollId);
      if (slowCapitalPollId !== null) window.clearInterval(slowCapitalPollId);
      unsub();
    };
  }, [watchlist]);

  function openCreateFolderDialog() {
    setFolderName("");
    setFolderDialog({ mode: "create" });
  }

  function openRenameFolderDialog(folder: WatchlistFolder) {
    setFolderName(folder.name);
    setFolderDialog({ mode: "rename", folderId: folder.id });
  }

  function closeFolderDialog() {
    setFolderDialog(null);
    setFolderName("");
  }

  function submitFolderName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = folderName.trim();

    if (!name || !folderDialog) {
      return;
    }

    if (folderDialog.mode === "create") {
      createWatchlistFolder(name);
    } else {
      renameWatchlistFolder(folderDialog.folderId, name);
    }

    closeFolderDialog();
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-tv-border px-3 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-tv-text-muted">
            Watchlist
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={openCreateFolderDialog}
              className="rounded p-1 text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
              title="Crear carpeta"
              aria-label="Crear carpeta"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => openSymbolDialog(true)}
              className="rounded p-1 text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
              title="Agregar símbolo"
              aria-label="Agregar al watchlist"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-[minmax(72px,1fr)_62px_56px] gap-1.5 border-b border-tv-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-dim">
          <span>Símbolo</span>
          <span className="text-right">Precio</span>
          <span className="text-right">24h</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {watchlist.length > 0 ? (
              groups.map((group) => {
                const isClosed = closedFolders[group.id] ?? true;
                const FolderIcon = isClosed ? Folder : FolderOpen;
                const canRemoveFolder = groups.length > 1;

                return (
                  <div
                    key={group.id}
                    className="group/folder border-b border-tv-border/70 last:border-b-0"
                  >
                    <div className="flex h-8 items-center gap-1 px-2">
                      <button
                        type="button"
                        onClick={() =>
                          setClosedFolders((prev) => ({
                            ...prev,
                            [group.id]: !isClosed,
                          }))
                        }
                        className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left text-[11px] font-medium uppercase tracking-wider text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
                        aria-label={`${isClosed ? "Abrir" : "Cerrar"} ${group.name}`}
                      >
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform",
                            !isClosed && "rotate-90",
                          )}
                        />
                        <FolderIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{group.name}</span>
                      </button>
                      <span className="w-4 text-right text-[10px] tabular-nums text-tv-text-dim">
                        {group.symbols.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => openRenameFolderDialog(group)}
                        className="rounded p-0.5 text-tv-text-muted hover:bg-tv-bg hover:text-tv-text"
                        title="Renombrar carpeta"
                        aria-label={`Renombrar ${group.name}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      {canRemoveFolder && (
                        <button
                          type="button"
                          onClick={() => setDeleteFolder(group)}
                          className="rounded p-0.5 text-tv-text-muted hover:bg-tv-bg hover:text-tv-red"
                          title="Eliminar carpeta"
                          aria-label={`Eliminar ${group.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {!isClosed &&
                      group.symbols.map((s) => {
                        const row = rows[s];
                        const isActive = s === symbol;
                        const f = flash[s];
                        const display = getSymbolDisplay(s);
                        const isCrypto = isCryptoSymbol(s);
                        const primaryLabel = isCrypto
                          ? display.primary
                          : display.compact;
                        const secondaryLabel = isCrypto
                          ? display.secondary
                          : display.primary;
                        const showSecondaryLabel =
                          secondaryLabel !== primaryLabel;
                        return (
                          <div
                            key={s}
                            onClick={() => setSymbol(s)}
                            className={cn(
                              "group/row grid cursor-pointer grid-cols-[minmax(72px,1fr)_62px_56px] items-center gap-1.5 py-1.5 pl-6 pr-2 text-[11px] transition-colors",
                              "hover:bg-tv-panel-hover",
                              isActive && "bg-tv-panel-hover",
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="shrink-0 font-semibold text-tv-text">
                                {primaryLabel}
                              </span>
                              {showSecondaryLabel && (
                                <span className="min-w-0 truncate text-[10px] text-tv-text-dim">
                                  {secondaryLabel}
                                </span>
                              )}
                            </div>
                            <span
                              className={cn(
                                "text-right tabular-nums transition-colors",
                                f === "up" && "text-tv-green",
                                f === "down" && "text-tv-red",
                                !f && "text-tv-text",
                              )}
                            >
                              {row ? formatPrice(row.price) : "—"}
                            </span>
                            <div className="flex min-w-0 items-center justify-end gap-0.5">
                              <span
                                className={cn(
                                  "min-w-0 tabular-nums",
                                  row
                                    ? row.pct >= 0
                                      ? "text-tv-green"
                                      : "text-tv-red"
                                    : "text-tv-text-muted",
                                )}
                              >
                                {row ? formatPct(row.pct) : "—"}
                              </span>
                              <select
                                value={group.id}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  moveWatchlistSymbol(s, event.target.value);
                                }}
                                className="h-5 w-4 rounded border border-transparent bg-transparent px-0 text-[0px] text-tv-text-muted outline-none transition-colors hover:border-tv-border hover:bg-tv-bg focus:border-tv-border focus:bg-tv-bg"
                                title="Mover a carpeta"
                                aria-label={`Mover ${s} a carpeta`}
                              >
                                {watchlistFolders.map((folder) => (
                                  <option key={folder.id} value={folder.id}>
                                    {folder.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromWatchlist(s);
                                }}
                                className="hidden rounded p-0.5 text-tv-text-muted hover:bg-tv-bg hover:text-tv-red group-hover/row:block"
                                aria-label={`Quitar ${s} del watchlist`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-tv-text-muted">
                Tu watchlist está vacío
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      <Dialog
        open={folderDialog !== null}
        onOpenChange={(open) => {
          if (!open) closeFolderDialog();
        }}
      >
        <DialogContent className="max-w-xs gap-0 bg-tv-panel p-0">
          <DialogHeader className="border-b border-tv-border px-4 py-3">
            <DialogTitle className="text-sm font-medium">
              {folderDialogTitle}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitFolderName}>
            <div className="p-3">
              <Input
                autoFocus
                placeholder="Nombre"
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                className="bg-tv-bg"
                maxLength={32}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-tv-border px-3 py-2">
              <button
                type="button"
                onClick={closeFolderDialog}
                className="rounded px-3 py-1.5 text-xs text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!folderName.trim()}
                className="rounded bg-tv-blue px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {folderDialog?.mode === "rename" ? "Guardar" : "Crear"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteFolder !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteFolder(null);
        }}
      >
        <DialogContent className="max-w-xs gap-0 bg-tv-panel p-0">
          <DialogHeader className="border-b border-tv-border px-4 py-3">
            <DialogTitle className="text-sm font-medium">
              Eliminar carpeta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 px-4 py-3 text-xs text-tv-text-muted">
            <p>
              Los símbolos de <span className="text-tv-text">{deleteFolder?.name}</span>{" "}
              se moverán a otra carpeta.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-tv-border px-3 py-2">
            <button
              type="button"
              onClick={() => setDeleteFolder(null)}
              className="rounded px-3 py-1.5 text-xs text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (deleteFolder) {
                  removeWatchlistFolder(deleteFolder.id);
                }
                setDeleteFolder(null);
              }}
              className="rounded bg-tv-red px-3 py-1.5 text-xs font-medium text-white"
            >
              Eliminar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
