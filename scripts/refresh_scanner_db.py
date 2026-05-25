import json
import os
import sqlite3
import ssl
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    import certifi
except ImportError:
    certifi = None


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "scanner.db"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
NASDAQ_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"
OTHER_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"

MAX_WORKERS = int(os.environ.get("SCANNER_MAX_WORKERS", "12"))
PROGRESS_EVERY = int(os.environ.get("SCANNER_PROGRESS_EVERY", "500"))
MAX_SYMBOLS_PER_MARKET = int(os.environ.get("SCANNER_MAX_SYMBOLS_PER_MARKET", "0"))
INCLUDE_US = os.environ.get("SCANNER_INCLUDE_US", "true").lower() != "false"
INCLUDE_TOKYO = os.environ.get("SCANNER_INCLUDE_TOKYO", "true").lower() != "false"
INCLUDE_HONG_KONG = os.environ.get("SCANNER_INCLUDE_HONG_KONG", "true").lower() != "false"
INCLUDE_SAUDI = os.environ.get("SCANNER_INCLUDE_SAUDI", "true").lower() != "false"


def make_ssl_context():
    if certifi:
        return ssl.create_default_context(cafile=certifi.where())

    context = ssl.create_default_context()
    try:
        context.load_default_certs()
    except ssl.SSLError:
        pass
    return context


SSL_CONTEXT = make_ssl_context()


def get_text(url):
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})

    with urlopen(req, timeout=25, context=SSL_CONTEXT) as res:
        return res.read().decode("utf-8", errors="replace")


def get_json(url):
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
    )

    try:
        with urlopen(req, timeout=20, context=SSL_CONTEXT) as res:
            return json.loads(res.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None


def to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def yahoo_symbol(symbol):
    if symbol.endswith((".T", ".HK", ".SR")):
        return symbol

    return symbol.replace(".", "-")


def add_symbol(symbols, symbol, name, exchange, market, etf=False):
    symbols[symbol] = {
        "symbol": symbol,
        "name": name,
        "exchange": exchange,
        "market": market,
        "etf": etf,
    }


def load_us_symbols(symbols):
    nasdaq_text = get_text(NASDAQ_LISTED_URL)
    for line in nasdaq_text.splitlines()[1:]:
        parts = line.split("|")
        if len(parts) < 7 or parts[0] == "File Creation Time":
            continue

        symbol = parts[0].strip()
        name = parts[1].strip()
        test_issue = parts[3].strip()
        etf = parts[6].strip()

        if test_issue == "Y":
            continue

        add_symbol(symbols, symbol, name, "NASDAQ", "USA", etf == "Y")

    other_text = get_text(OTHER_LISTED_URL)
    for line in other_text.splitlines()[1:]:
        parts = line.split("|")
        if len(parts) < 7 or parts[0] == "File Creation Time":
            continue

        symbol = parts[0].strip()
        name = parts[1].strip()
        exchange_code = parts[2].strip()
        test_issue = parts[6].strip()

        if test_issue == "Y":
            continue

        exchange = {
            "A": "NYSE American",
            "N": "NYSE",
            "P": "NYSE Arca",
            "Z": "BATS",
            "V": "IEX",
        }.get(exchange_code, exchange_code)

        add_symbol(symbols, symbol, name, exchange, "USA", False)


def load_tokyo_symbols(symbols):
    for code in range(1000, 10000):
        symbol = f"{code}.T"
        add_symbol(symbols, symbol, f"Tokyo {code}", "Tokyo", "Tokyo", False)


def load_hong_kong_symbols(symbols):
    for code in range(1, 10000):
        symbol = f"{code:04d}.HK"
        add_symbol(
            symbols,
            symbol,
            f"Hong Kong {code:04d}",
            "Hong Kong",
            "Hong Kong",
            False,
        )


def load_saudi_symbols(symbols):
    for code in range(1000, 10000):
        symbol = f"{code}.SR"
        add_symbol(
            symbols,
            symbol,
            f"Saudi {code}",
            "Saudi Arabia",
            "Saudi Arabia",
            False,
        )


def load_symbols():
    symbols = {}
    market_counts = {}

    def extend_with_limit(loader):
        before = set(symbols)
        loader(symbols)

        if MAX_SYMBOLS_PER_MARKET <= 0:
            return

        added = [symbol for symbol in symbols if symbol not in before]
        for symbol in added:
            market = symbols[symbol]["market"]
            market_counts[market] = market_counts.get(market, 0) + 1
            if market_counts[market] > MAX_SYMBOLS_PER_MARKET:
                del symbols[symbol]

    if INCLUDE_US:
        extend_with_limit(load_us_symbols)
    if INCLUDE_TOKYO:
        extend_with_limit(load_tokyo_symbols)
    if INCLUDE_HONG_KONG:
        extend_with_limit(load_hong_kong_symbols)
    if INCLUDE_SAUDI:
        extend_with_limit(load_saudi_symbols)

    return list(symbols.values())


def fetch_stock(item):
    symbol = item["symbol"]
    ys = yahoo_symbol(symbol)
    url = f"{YAHOO_CHART_URL}/{ys}?range=1d&interval=1m&includePrePost=false"
    payload = get_json(url)

    if not payload:
        return None

    result = payload.get("chart", {}).get("result", [])
    if not result:
        return None

    data = result[0]
    meta = data.get("meta", {})
    quote = data.get("indicators", {}).get("quote", [{}])[0]

    name = (
        meta.get("longName")
        or meta.get("shortName")
        or meta.get("instrumentInfo", {}).get("shortName")
        or item["name"]
    )
    price = to_float(meta.get("regularMarketPrice"))
    previous_close = to_float(meta.get("previousClose"))
    exchange = meta.get("exchangeName") or meta.get("fullExchangeName") or item["exchange"]

    if price <= 0 or previous_close <= 0:
        return None

    highs = [to_float(value) for value in quote.get("high", []) if to_float(value) > 0]
    lows = [to_float(value) for value in quote.get("low", []) if to_float(value) > 0]
    volumes = [
        to_float(value) for value in quote.get("volume", []) if to_float(value) > 0
    ]

    day_high = max(highs) if highs else price
    day_low = min(lows) if lows else price
    volume = sum(volumes) if volumes else 0.0
    change_pct = ((price - previous_close) / previous_close) * 100
    range_pct = ((day_high - day_low) / day_low) * 100 if day_low > 0 else 0.0

    return (
        symbol,
        name,
        exchange,
        price,
        day_high,
        day_low,
        change_pct,
        range_pct,
        volume,
        "ETF" if item["etf"] else "STK",
        item["market"],
    )


def scan_all():
    symbols = load_symbols()
    rows = []
    done = 0
    started_at = time.time()

    print(
        json.dumps(
            {
                "event": "scanner_start",
                "symbols": len(symbols),
                "workers": MAX_WORKERS,
            }
        ),
        flush=True,
    )

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(fetch_stock, item) for item in symbols]

        for future in as_completed(futures):
            done += 1
            try:
                row = future.result()
            except Exception:
                row = None

            if row:
                rows.append(row)

            if PROGRESS_EVERY > 0 and done % PROGRESS_EVERY == 0:
                print(
                    json.dumps(
                        {
                            "event": "scanner_progress",
                            "processed": done,
                            "symbols": len(symbols),
                            "available": len(rows),
                            "elapsedSeconds": round(time.time() - started_at, 1),
                        }
                    ),
                    flush=True,
                )

    return rows


def ensure_schema(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS scanner_results (
            symbol TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            exchange TEXT NOT NULL,
            last REAL NOT NULL,
            high REAL NOT NULL,
            low REAL NOT NULL,
            change_pct REAL NOT NULL,
            range_pct REAL NOT NULL,
            volume REAL NOT NULL,
            type TEXT NOT NULL,
            market TEXT NOT NULL,
            scanned_at INTEGER NOT NULL
        )
        """
    )


def refresh_db(rows):
    if not rows:
        raise RuntimeError("No rows fetched; keeping existing scanner DB intact.")

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    scanned_at = int(time.time())

    with sqlite3.connect(DB_PATH) as conn:
        ensure_schema(conn)
        conn.execute("DELETE FROM scanner_results")
        conn.executemany(
            """
            INSERT OR REPLACE INTO scanner_results (
                symbol, name, exchange, last, high, low, change_pct,
                range_pct, volume, type, market, scanned_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [row + (scanned_at,) for row in rows],
        )
        conn.commit()

    return scanned_at


def main():
    rows = scan_all()
    scanned_at = refresh_db(rows)
    markets = {}

    for row in rows:
        market = row[10]
        markets[market] = markets.get(market, 0) + 1

    print(
        json.dumps(
            {
                "inserted": len(rows),
                "scannedAt": scanned_at,
                "markets": markets,
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=os.sys.stderr)
        raise
