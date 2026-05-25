const WebSocket = require("ws");

const WS_URL = "wss://web-quotes-core.simplefx.com/websocket/quotes";

// Cambia o agrega símbolos aquí
const SYMBOLS = [
  "BTCUSD",
  "ETHUSD",
  "US500",
  "US100",
  "XAUUSD",
];

const ws = new WebSocket(WS_URL);

function getMidPrice(bid, ask) {
  if (typeof bid !== "number" || typeof ask !== "number") return null;
  return (bid + ask) / 2;
}

function formatTime(unixTime) {
  if (!unixTime) return "N/A";
  return new Date(unixTime * 1000).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

ws.on("open", () => {
  console.log("✅ Conectado a SimpleFX WebSocket");

  const subscribeMessage = {
    p: "/subscribe/addList",
    i: 1,
    d: SYMBOLS,
  };

  console.log("📡 Suscribiendo a:", SYMBOLS.join(", "));
  ws.send(JSON.stringify(subscribeMessage));
});

ws.on("message", (data) => {
  try {
    const msg = JSON.parse(data.toString());

    if (msg.e) {
      console.log("❌ Error:", msg.e);
      return;
    }

    if (msg.p === "/subscribe/addList") {
      console.log("✅ Suscripción aceptada:", msg);
      return;
    }

    if (msg.p === "/quotes/subscribed" && Array.isArray(msg.d)) {
      for (const quote of msg.d) {
        const symbol = quote.s;
        const bid = quote.b;
        const ask = quote.a;
        const time = quote.t;
        const mid = getMidPrice(bid, ask);
        const spread = ask - bid;

        console.log("--------------------------------");
        console.log("Símbolo:", symbol);
        console.log("Bid:", bid);
        console.log("Ask:", ask);
        console.log("Mid:", mid);
        console.log("Spread:", spread);
        console.log("Hora:", formatTime(time));
      }

      return;
    }

    console.log("📩 Mensaje recibido:", msg);
  } catch (error) {
    console.error("❌ Error parseando mensaje:", error.message);
    console.log("Raw:", data.toString());
  }
});

ws.on("error", (error) => {
  console.error("❌ WebSocket error:", error.message);
});

ws.on("close", (code, reason) => {
  console.log("🔌 Conexión cerrada");
  console.log("Código:", code);
  console.log("Razón:", reason.toString());
});

// Cerrar limpio con CTRL + C
process.on("SIGINT", () => {
  console.log("\nCerrando conexión...");

  const unsubscribeMessage = {
    p: "/subscribe/removeList",
    i: 2,
    d: SYMBOLS,
  };

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(unsubscribeMessage));
    ws.close();
  } else {
    process.exit(0);
  }
});