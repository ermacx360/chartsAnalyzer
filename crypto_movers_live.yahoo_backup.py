# stocks_top50_yahoo.py
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


YAHOO_SCREENER_URL = "https://query1.finance.yahoo.com/v1/finance/screener?formatted=false&lang=en-US&region=US"
YAHOO_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart"

BLUE = "\033[94m"
GREEN = "\033[92m"
RED = "\033[91m"
RESET = "\033[0m"

FALLBACK_SYMBOLS = [
    "MSFT", "AAPL", "NVDA", "GOOGL", "GOOG", "AMZN", "META", "BRK-B", "AVGO", "TSLA",
    "LLY", "JPM", "WMT", "V", "ORCL", "MA", "NFLX", "XOM", "COST", "JNJ",
    "HD", "PG", "ABBV", "BAC", "PLTR", "KO", "UNH", "GE", "TMUS", "CSCO",
    "AMD", "PM", "CRM", "WFC", "IBM", "MS", "ABT", "CVX", "AXP", "MCD",
    "LIN", "DIS", "NOW", "INTU", "T", "GS", "MRK", "UBER", "RTX", "VZ",
]


def get_json(url, body=None):
    data = None
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
    }

    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = Request(url, data=data, headers=headers)

    try:
        with urlopen(req, timeout=25) as res:
            return json.loads(res.read().decode("utf-8"))
    except HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        raise Exception(f"HTTP {e.code}: {body_text[:180]}")
    except URLError as e:
        raise Exception(f"No se pudo conectar: {e.reason}")


def to_float(value):
    if isinstance(value, dict):
        value = value.get("raw", value.get("fmt"))

    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def get_value(item, *keys):
    for key in keys:
        value = item.get(key)

        if isinstance(value, dict):
            if "raw" in value:
                return value.get("raw")
            if "fmt" in value:
                return value.get("fmt")

        if value not in (None, ""):
            return value

    return None


def fetch_top_stocks_from_screener(limit=50):
    query = {
        "offset": 0,
        "size": limit,
        "sortField": "intradaymarketcap",
        "sortType": "DESC",
        "quoteType": "EQUITY",
        "query": {
            "operator": "AND",
            "operands": [
                {"operator": "eq", "operands": ["region", "us"]},
                {"operator": "gt", "operands": ["intradaymarketcap", 0]},
            ],
        },
    }

    payload = get_json(YAHOO_SCREENER_URL, query)
    result = payload.get("finance", {}).get("result", [])

    if not result:
        raise Exception("Yahoo screener no devolvio resultados.")

    quotes = result[0].get("quotes", [])
    return normalize_rows(quotes)[:limit]


def fetch_top_stocks_from_quotes(limit=50):
    symbols = ",".join(FALLBACK_SYMBOLS[:limit])
    payload = get_json(f"{YAHOO_QUOTE_URL}?symbols={symbols}&formatted=false&region=US&lang=en-US")
    quotes = payload.get("quoteResponse", {}).get("result", [])
    rows = normalize_rows(quotes)
    rows.sort(key=lambda row: row["market_cap"], reverse=True)
    return rows[:limit]


def fetch_stock_from_chart(symbol, rank):
    url = f"{YAHOO_CHART_URL}/{quote(symbol)}?range=1d&interval=1m&includePrePost=false"
    payload = get_json(url)
    result = payload.get("chart", {}).get("result", [])

    if not result:
        return None

    data = result[0]
    meta = data.get("meta", {})
    quote_data = data.get("indicators", {}).get("quote", [{}])[0]

    price = to_float(meta.get("regularMarketPrice"))
    previous_close = to_float(meta.get("previousClose") or meta.get("chartPreviousClose"))
    volume = to_float(meta.get("regularMarketVolume"))

    if volume <= 0:
        volumes = [to_float(v) for v in quote_data.get("volume", []) if to_float(v) > 0]
        volume = sum(volumes) if volumes else 0.0

    if price <= 0:
        return None

    change_pct = 0.0
    if previous_close > 0:
        change_pct = ((price - previous_close) / previous_close) * 100

    return {
        "symbol": symbol,
        "name": str(meta.get("shortName") or meta.get("longName") or symbol),
        "exchange": str(meta.get("exchangeName") or meta.get("fullExchangeName") or "-"),
        "price": price,
        "change_pct": change_pct,
        "market_cap": 0.0,
        "volume": volume,
        "rank": rank,
    }


def fetch_top_stocks_from_chart(limit=50):
    rows = []

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [
            executor.submit(fetch_stock_from_chart, symbol, index)
            for index, symbol in enumerate(FALLBACK_SYMBOLS[:limit])
        ]

        for future in as_completed(futures):
            try:
                row = future.result()
            except Exception:
                row = None

            if row:
                rows.append(row)

    rows.sort(key=lambda row: row["rank"])
    return rows[:limit]


def normalize_rows(quotes):
    rows = []

    for item in quotes:
        symbol = get_value(item, "symbol")
        name = get_value(item, "shortName", "longName", "displayName") or "-"
        exchange = get_value(item, "exchange") or "-"
        price = to_float(get_value(item, "regularMarketPrice", "postMarketPrice", "preMarketPrice"))
        change_pct = to_float(get_value(item, "regularMarketChangePercent"))
        market_cap = to_float(get_value(item, "marketCap", "intradaymarketcap"))
        volume = to_float(get_value(item, "regularMarketVolume", "averageDailyVolume3Month"))

        if not symbol or market_cap <= 0:
            continue

        rows.append({
            "symbol": str(symbol),
            "name": str(name),
            "exchange": str(exchange),
            "price": price,
            "change_pct": change_pct,
            "market_cap": market_cap,
            "volume": volume,
        })

    rows.sort(key=lambda row: row["market_cap"], reverse=True)
    return rows


def fetch_top_stocks(limit=50):
    try:
        return fetch_top_stocks_from_screener(limit), "Yahoo Screener"
    except Exception:
        pass

    try:
        return fetch_top_stocks_from_quotes(limit), "Yahoo Quote fallback"
    except Exception:
        return fetch_top_stocks_from_chart(limit), "Yahoo Chart fallback"


def fmt_symbol(symbol, width=8):
    symbol = str(symbol)
    if len(symbol) > width:
        return symbol[:width - 1] + "."
    return symbol


def fmt_name(name, width=18):
    name = str(name or "-")
    if len(name) > width:
        return name[:width - 1] + "."
    return name


def fmt_price(value):
    if value <= 0:
        return "-"

    if value >= 1000:
        return f"{value:,.1f}"
    if value >= 100:
        return f"{value:,.2f}"
    if value >= 1:
        return f"{value:,.4f}"

    return f"{value:,.6f}".rstrip("0").rstrip(".")


def fmt_money(value):
    if value <= 0:
        return "-"

    if value >= 1_000_000_000_000:
        return f"${value / 1_000_000_000_000:.2f}T"
    if value >= 1_000_000_000:
        return f"${value / 1_000_000_000:.2f}B"
    if value >= 1_000_000:
        return f"${value / 1_000_000:.2f}M"

    return f"${value:,.0f}"


def fmt_volume(value):
    if value <= 0:
        return "-"

    if value >= 1_000_000_000:
        return f"{value / 1_000_000_000:.2f}B"
    if value >= 1_000_000:
        return f"{value / 1_000_000:.2f}M"
    if value >= 1_000:
        return f"{value / 1_000:.2f}K"

    return f"{value:.0f}"


def color_percent(value):
    if value > 0:
        return GREEN
    if value < 0:
        return RED
    return RESET


def plain_len(text):
    return len(
        text
        .replace(BLUE, "")
        .replace(GREEN, "")
        .replace(RED, "")
        .replace(RESET, "")
    )


def pad(text, width):
    diff = width - plain_len(text)
    if diff > 0:
        return text + (" " * diff)
    return text


def make_row(index, row):
    symbol = f"{BLUE}{fmt_symbol(row['symbol']):<8}{RESET}"
    change = f"{row['change_pct']:.2f}%"
    change_colored = f"{color_percent(row['change_pct'])}{change:>8}{RESET}"

    return (
        f"{index:>2} "
        f"{symbol} "
        f"{fmt_name(row['name']):<18} "
        f"{row['exchange']:<4} "
        f"{fmt_price(row['price']):>10} "
        f"{change_colored} "
        f"{fmt_money(row['market_cap']):>10} "
        f"{fmt_volume(row['volume']):>9}"
    )


def render(rows, source):
    left_width = 78
    right_width = 78
    line = "-" * left_width + "-+-" + "-" * right_width

    left_rows = rows[:25]
    right_rows = rows[25:50]

    print()
    print("TOP 50 ACCIONES POR MARKET CAP - Yahoo Finance")
    print(f"Actualizado: {time.strftime('%Y-%m-%d %H:%M:%S')} | Fuente: {source}")
    print("=" * len(line))

    header = " # Symbol   Nombre             Exch     Precio    Chg %       MCap       Vol"
    print(f"{header:<{left_width}} | {header:<{right_width}}")
    print(line)

    for i in range(25):
        left = make_row(i + 1, left_rows[i]) if i < len(left_rows) else ""
        right = make_row(i + 26, right_rows[i]) if i < len(right_rows) else ""

        print(f"{pad(left, left_width)} | {pad(right, right_width)}")
        print(line)

    print("Azul=simbolo | Verde=sube hoy | Rojo=baja hoy")


def main():
    try:
        rows, source = fetch_top_stocks(50)

        if not rows:
            print("No se encontraron acciones.")
            return

        render(rows, source)

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
