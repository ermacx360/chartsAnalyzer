# crypto_movers_live.py
import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BINANCE_24H_URL = "https://api.binance.com/api/v3/ticker/24hr"
BINGX_TICKER_URL = "https://open-api.bingx.com/openApi/swap/v2/quote/ticker"

REFRESH_SECONDS = 10
SIDE_ROWS = 25
MIN_QUOTE_VOLUME = 100_000

BLUE = "\033[94m"
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"


def clear_screen():
    os.system("cls" if os.name == "nt" else "clear")


def get_json(url):
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
    )

    with urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode("utf-8"))


def to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def normalize_binance_symbol(symbol):
    if not symbol.endswith("USDT"):
        return None

    base = symbol[:-4]
    if base.endswith(("UP", "DOWN", "BULL", "BEAR")):
        return None

    return f"{base}/USDT"


def normalize_bingx_symbol(symbol):
    if not symbol.endswith("-USDT"):
        return None

    base = symbol[:-5]
    return f"{base}/USDT"


def fetch_binance_rows():
    payload = get_json(BINANCE_24H_URL)
    rows = []

    for item in payload:
        symbol = normalize_binance_symbol(str(item.get("symbol", "")))
        if not symbol:
            continue

        price = to_float(item.get("lastPrice"))
        change_pct = to_float(item.get("priceChangePercent"))
        high = to_float(item.get("highPrice"))
        low = to_float(item.get("lowPrice"))
        volume = to_float(item.get("volume"))
        quote_volume = to_float(item.get("quoteVolume"))

        if price <= 0 or quote_volume < MIN_QUOTE_VOLUME:
            continue

        rows.append(
            {
                "symbol": symbol,
                "provider": "Binance",
                "market": "Spot",
                "price": price,
                "change_pct": change_pct,
                "high": high,
                "low": low,
                "volume": volume,
                "quote_volume": quote_volume,
            }
        )

    return rows


def fetch_bingx_rows():
    payload = get_json(BINGX_TICKER_URL)
    items = payload.get("data", []) if isinstance(payload, dict) else []
    rows = []

    for item in items:
        symbol = normalize_bingx_symbol(str(item.get("symbol", "")))
        if not symbol:
            continue

        price = to_float(item.get("lastPrice"))
        change_pct = to_float(item.get("priceChangePercent"))
        high = to_float(item.get("highPrice"))
        low = to_float(item.get("lowPrice"))
        volume = to_float(item.get("volume"))
        quote_volume = to_float(item.get("quoteVolume"))

        if price <= 0 or quote_volume < MIN_QUOTE_VOLUME:
            continue

        rows.append(
            {
                "symbol": symbol,
                "provider": "BingX",
                "market": "Perp",
                "price": price,
                "change_pct": change_pct,
                "high": high,
                "low": low,
                "volume": volume,
                "quote_volume": quote_volume,
            }
        )

    return rows


def fetch_all_rows():
    rows = []
    errors = []

    for name, fetcher in (
        ("Binance", fetch_binance_rows),
        ("BingX", fetch_bingx_rows),
    ):
        try:
            rows.extend(fetcher())
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            errors.append(f"{name}: {exc}")

    return rows, errors


def fmt_symbol(symbol, width=13):
    text = str(symbol)
    if len(text) > width:
        return text[: width - 1] + "."
    return text


def fmt_price(value):
    if value <= 0:
        return "-"
    if value >= 1000:
        return f"{value:,.1f}"
    if value >= 100:
        return f"{value:,.2f}"
    if value >= 1:
        return f"{value:,.4f}"
    return f"{value:,.8f}".rstrip("0").rstrip(".")


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
        text.replace(BLUE, "")
        .replace(GREEN, "")
        .replace(RED, "")
        .replace(YELLOW, "")
        .replace(RESET, "")
    )


def pad(text, width):
    diff = width - plain_len(text)
    if diff > 0:
        return text + (" " * diff)
    return text


def make_row(index, row):
    symbol = f"{BLUE}{fmt_symbol(row['symbol']):<13}{RESET}"
    change = f"{row['change_pct']:.2f}%"
    change_colored = f"{color_percent(row['change_pct'])}{change:>8}{RESET}"

    return (
        f"{index:>2} "
        f"{symbol} "
        f"{row['provider']:<7} "
        f"{row['market']:<4} "
        f"{fmt_price(row['price']):>12} "
        f"{change_colored} "
        f"{fmt_price(row['high']):>12} "
        f"{fmt_price(row['low']):>12} "
        f"{fmt_volume(row['quote_volume']):>10}"
    )


def render(rows, errors):
    gainers = sorted(
        [row for row in rows if row["change_pct"] > 0],
        key=lambda row: row["change_pct"],
        reverse=True,
    )[:SIDE_ROWS]
    losers = sorted(
        [row for row in rows if row["change_pct"] < 0],
        key=lambda row: row["change_pct"],
    )[:SIDE_ROWS]

    left_width = 92
    right_width = 92
    line = "-" * left_width + "-+-" + "-" * right_width

    clear_screen()
    print("CRYPTO MOVERS LIVE - Binance Spot + BingX Perpetual")
    print(
        f"Actualizado: {time.strftime('%Y-%m-%d %H:%M:%S')} | "
        f"Instrumentos: {len(rows)} | Refresco: {REFRESH_SECONDS}s | q=salir"
    )
    if errors:
        print(f"{YELLOW}Errores: {' | '.join(errors)}{RESET}")
    print("=" * len(line))
    print(f"{'GANADORAS':^{left_width}} | {'PERDEDORAS':^{right_width}}")

    header = " # Symbol        Fuente  Mkt        Precio    Chg %         Max          Min       Vol$"
    print(f"{header:<{left_width}} | {header:<{right_width}}")
    print(line)

    for i in range(SIDE_ROWS):
        left = make_row(i + 1, gainers[i]) if i < len(gainers) else ""
        right = make_row(i + 1, losers[i]) if i < len(losers) else ""
        print(f"{pad(left, left_width)} | {pad(right, right_width)}")
        print(line)


def should_quit():
    if os.name != "nt":
        return False

    try:
        import msvcrt

        if msvcrt.kbhit():
            key = msvcrt.getwch().lower()
            return key == "q"
    except Exception:
        return False

    return False


def main():
    while True:
        rows, errors = fetch_all_rows()
        render(rows, errors)

        for _ in range(REFRESH_SECONDS * 10):
            if should_quit():
                return
            time.sleep(0.1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nSaliendo...")
