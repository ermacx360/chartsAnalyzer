interface SimpleFxQuote {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  time?: number;
}

type SimpleFxQuoteHandler = (quote: SimpleFxQuote) => void;

interface SimpleFxMessage {
  p?: string;
  d?: Array<{
    s?: string;
    b?: number;
    a?: number;
    t?: number;
  }>;
}

const SIMPLEFX_WS_URL = "wss://web-quotes-core.simplefx.com/websocket/quotes";

class SimpleFxWS {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<SimpleFxQuoteHandler>>();
  private messageId = 1;

  subscribeQuote(symbol: string, handler: SimpleFxQuoteHandler) {
    const normalizedSymbol = symbol.toUpperCase();
    const handlers = this.handlers.get(normalizedSymbol) ?? new Set();
    const isNewSymbol = handlers.size === 0;

    handlers.add(handler);
    this.handlers.set(normalizedSymbol, handlers);
    this.connect();

    if (isNewSymbol) {
      this.sendSubscription("/subscribe/addList", [normalizedSymbol]);
    }

    return () => {
      const currentHandlers = this.handlers.get(normalizedSymbol);
      if (!currentHandlers) return;

      currentHandlers.delete(handler);

      if (currentHandlers.size === 0) {
        this.handlers.delete(normalizedSymbol);
        this.sendSubscription("/subscribe/removeList", [normalizedSymbol]);
      }
    };
  }

  private connect() {
    if (
      typeof window === "undefined" ||
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    this.ws = new WebSocket(SIMPLEFX_WS_URL);

    this.ws.addEventListener("open", () => {
      const symbols = Array.from(this.handlers.keys());
      if (symbols.length > 0) {
        this.sendSubscription("/subscribe/addList", symbols);
      }
    });

    this.ws.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });

    this.ws.addEventListener("close", () => {
      this.ws = null;
    });

    this.ws.addEventListener("error", () => {
      this.ws?.close();
    });
  }

  private sendSubscription(path: string, symbols: string[]) {
    if (this.ws?.readyState !== WebSocket.OPEN || symbols.length === 0) {
      return;
    }

    this.ws.send(
      JSON.stringify({
        p: path,
        i: this.messageId,
        d: symbols,
      }),
    );
    this.messageId += 1;
  }

  private handleMessage(rawData: unknown) {
    const rawText =
      typeof rawData === "string"
        ? rawData
        : rawData instanceof Blob
          ? null
          : String(rawData);
    if (!rawText) return;

    try {
      const message = JSON.parse(rawText) as SimpleFxMessage;
      if (message.p !== "/quotes/subscribed" || !Array.isArray(message.d)) {
        return;
      }

      message.d.forEach((item) => {
        const symbol = item.s?.toUpperCase();
        const bid = item.b;
        const ask = item.a;

        if (
          !symbol ||
          typeof bid !== "number" ||
          typeof ask !== "number" ||
          !Number.isFinite(bid) ||
          !Number.isFinite(ask)
        ) {
          return;
        }

        const handlers = this.handlers.get(symbol);
        if (!handlers || handlers.size === 0) return;

        const quote = {
          symbol,
          bid,
          ask,
          mid: (bid + ask) / 2,
          time: item.t,
        };

        handlers.forEach((handler) => handler(quote));
      });
    } catch {
      return;
    }
  }
}

const simpleFxWS = new SimpleFxWS();

export function getSimpleFxWS() {
  return simpleFxWS;
}
