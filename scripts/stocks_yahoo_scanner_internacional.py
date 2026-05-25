# stocks_yahoo_scanner_all.py
import csv
import json
import os
import ssl
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    import certifi
except ImportError:
    certifi = None

try:
    from openpyxl import Workbook
except ImportError:
    Workbook = None


YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
NASDAQ_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"
OTHER_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"

MAX_WORKERS = 12
PAGE_SIZE = 50
CSV_FILE = "yahoo_stocks_scan_internacional.csv"
TXT_FILE = "yahoo_stocks_scan_internacional.txt"
XLSX_FILE = "yahoo_stocks_scan_internacional.xlsx"

INCLUDE_US = True
INCLUDE_TOKYO = True
INCLUDE_HONG_KONG = True
INCLUDE_SAUDI = True

BLUE = "\033[94m"
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"


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


def clear_screen():
    os.system("cls" if os.name == "nt" else "clear")


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


def add_symbol(symbols, symbol, name, exchange, etf=False):
    symbols[symbol] = {
        "symbol": symbol,
        "name": name,
        "exchange": exchange,
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

        add_symbol(symbols, symbol, name, "NASDAQ", etf == "Y")

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

        add_symbol(symbols, symbol, name, exchange, False)


def load_tokyo_symbols(symbols):
    for code in range(1000, 10000):
        symbol = f"{code}.T"
        add_symbol(symbols, symbol, f"Tokyo {code}", "Tokyo", False)


def load_hong_kong_symbols(symbols):
    for code in range(1, 10000):
        symbol = f"{code:04d}.HK"
        add_symbol(symbols, symbol, f"Hong Kong {code:04d}", "Hong Kong", False)


def load_saudi_symbols(symbols):
    for code in range(1000, 10000):
        symbol = f"{code}.SR"
        add_symbol(symbols, symbol, f"Saudi {code}", "Saudi Arabia", False)


def load_symbols():
    symbols = {}

    if INCLUDE_US:
        load_us_symbols(symbols)

    if INCLUDE_TOKYO:
        load_tokyo_symbols(symbols)

    if INCLUDE_HONG_KONG:
        load_hong_kong_symbols(symbols)

    if INCLUDE_SAUDI:
        load_saudi_symbols(symbols)

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

    highs = [to_float(v) for v in quote.get("high", []) if to_float(v) > 0]
    lows = [to_float(v) for v in quote.get("low", []) if to_float(v) > 0]
    volumes = [to_float(v) for v in quote.get("volume", []) if to_float(v) > 0]

    day_high = max(highs) if highs else price
    day_low = min(lows) if lows else price
    volume = sum(volumes) if volumes else 0.0
    change_pct = ((price - previous_close) / previous_close) * 100
    range_pct = ((day_high - day_low) / day_low) * 100 if day_low > 0 else 0.0

    return {
        "symbol": symbol,
        "name": name,
        "exchange": exchange,
        "last": price,
        "high": day_high,
        "low": day_low,
        "change_pct": change_pct,
        "range_pct": range_pct,
        "volume": volume,
        "etf": item["etf"],
    }


def scan_all():
    symbols = load_symbols()
    rows = []

    clear_screen()
    print(f"Simbolos cargados: {len(symbols)}")
    print("Escaneando Yahoo Chart API... puede tardar unos minutos.")
    print()

    done = 0

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

            if done % 100 == 0:
                print(f"Procesados: {done}/{len(symbols)} | Disponibles en Yahoo: {len(rows)}")

    rows.sort(key=lambda row: abs(row["change_pct"]), reverse=True)
    return rows


def fmt_symbol(symbol, width=7):
    symbol = str(symbol)
    if len(symbol) > width:
        return symbol[:width - 1] + "."
    return symbol


def fmt_name(name, width=13):
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
        .replace(YELLOW, "")
        .replace(RESET, "")
    )


def pad(text, width):
    diff = width - plain_len(text)
    if diff > 0:
        return text + (" " * diff)
    return text


def make_row(index, row):
    symbol = f"{BLUE}{fmt_symbol(row['symbol']):<7}{RESET}"
    change = f"{row['change_pct']:.2f}%"
    change_colored = f"{color_percent(row['change_pct'])}{change:>8}{RESET}"
    type_text = "ETF" if row["etf"] else "STK"

    return (
        f"{index:>4} "
        f"{symbol} "
        f"{fmt_name(row['name']):<13} "
        f"{row['exchange'][:4]:<4} "
        f"{fmt_price(row['last']):>9} "
        f"{fmt_price(row['high']):>9} "
        f"{fmt_price(row['low']):>9} "
        f"{change_colored} "
        f"{row['range_pct']:>6.2f}% "
        f"{fmt_volume(row['volume']):>8} "
        f"{type_text:<3}"
    )


def save_csv(rows):
    with open(CSV_FILE, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "symbol",
                "name",
                "exchange",
                "last",
                "high",
                "low",
                "change_pct",
                "range_pct",
                "volume",
                "etf",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)


def save_txt(rows):
    with open(TXT_FILE, "w", encoding="utf-8") as file:
        file.write("SCANNER INTERNACIONAL DE ACCIONES - Yahoo Chart API\n")
        file.write(f"Encontradas: {len(rows)} | Orden: mayor movimiento % absoluto\n\n")
        file.write(
            "Symbol\tNombre\tExchange\tUltimo\tMax\tMin\tChg %\tRng %\tVolumen\tTipo\n"
        )

        for row in rows:
            file.write(
                f"{row['symbol']}\t"
                f"{row['name']}\t"
                f"{row['exchange']}\t"
                f"{row['last']:.6f}\t"
                f"{row['high']:.6f}\t"
                f"{row['low']:.6f}\t"
                f"{row['change_pct']:.2f}\t"
                f"{row['range_pct']:.2f}\t"
                f"{row['volume']:.0f}\t"
                f"{'ETF' if row['etf'] else 'STK'}\n"
            )


def save_xlsx(rows):
    if Workbook is None:
        return False

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Yahoo Scan"

    headers = [
        "Symbol",
        "Nombre",
        "Exchange",
        "Ultimo",
        "Max",
        "Min",
        "Chg %",
        "Rng %",
        "Volumen",
        "Tipo",
    ]
    sheet.append(headers)

    for row in rows:
        sheet.append(
            [
                row["symbol"],
                row["name"],
                row["exchange"],
                row["last"],
                row["high"],
                row["low"],
                row["change_pct"],
                row["range_pct"],
                row["volume"],
                "ETF" if row["etf"] else "STK",
            ]
        )

    for column in sheet.columns:
        max_length = max(len(str(cell.value or "")) for cell in column)
        sheet.column_dimensions[column[0].column_letter].width = min(max_length + 2, 42)

    workbook.save(XLSX_FILE)
    return True


def save_outputs(rows):
    save_csv(rows)
    save_txt(rows)

    print(f"CSV guardado: {CSV_FILE}")
    print(f"TXT guardado: {TXT_FILE}")

    if save_xlsx(rows):
        print(f"Excel guardado: {XLSX_FILE}")
    else:
        print("Excel omitido: instala openpyxl con 'py -m pip install openpyxl'")


def split_movers(rows):
    gainers = [row for row in rows if row["change_pct"] > 0]
    losers = [row for row in rows if row["change_pct"] < 0]

    gainers.sort(key=lambda row: row["change_pct"], reverse=True)
    losers.sort(key=lambda row: row["change_pct"])

    return gainers, losers


def render_page(gainers, losers, page):
    clear_screen()

    side_size = PAGE_SIZE // 2
    total_pages = max(
        1,
        (max(len(gainers), len(losers)) + side_size - 1) // side_size,
    )
    page = max(0, min(page, total_pages - 1))

    start = page * side_size
    left_rows = gainers[start:start + side_size]
    right_rows = losers[start:start + side_size]

    left_width = 82
    right_width = 82
    line = "-" * left_width + "-+-" + "-" * right_width

    print("SCANNER INTERNACIONAL - Ganadoras vs Perdedoras")
    print(
        f"Ganadoras: {len(gainers)} | Perdedoras: {len(losers)} | "
        f"Pagina {page + 1}/{total_pages} | CSV: {CSV_FILE}"
    )
    print("=" * len(line))

    header = "   # Symbol  Nombre        Exch    Ultimo       Max       Min    Chg %    Rng      Vol Tipo"
    print(f"{'GANADORAS':^{left_width}} | {'PERDEDORAS':^{right_width}}")
    print(f"{header:<{left_width}} | {header:<{right_width}}")
    print(line)

    for i in range(side_size):
        left_index = start + i + 1
        right_index = start + i + 1

        left = make_row(left_index, left_rows[i]) if i < len(left_rows) else ""
        right = make_row(right_index, right_rows[i]) if i < len(right_rows) else ""

        print(f"{pad(left, left_width)} | {pad(right, right_width)}")
        print(line)

    print("Enter=siguiente | p=anterior | q=salir")
    print("Izquierda=mayores subidas | Derecha=mayores bajadas | Verde=sube hoy | Rojo=baja hoy")


def browse(rows):
    page = 0
    gainers, losers = split_movers(rows)
    side_size = PAGE_SIZE // 2
    total_pages = max(
        1,
        (max(len(gainers), len(losers)) + side_size - 1) // side_size,
    )

    while True:
        render_page(gainers, losers, page)
        command = input("> ").strip().lower()

        if command == "q":
            break
        if command == "p":
            page = max(0, page - 1)
            continue

        page = min(total_pages - 1, page + 1)


def main():
    rows = scan_all()

    if not rows:
        print("No se encontraron acciones disponibles en Yahoo.")
        return

    save_outputs(rows)
    browse(rows)


if __name__ == "__main__":
    main()
