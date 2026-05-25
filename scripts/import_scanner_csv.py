import csv
import sqlite3
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "scanner.db"


def get_market(symbol, exchange):
    upper_exchange = (exchange or "").upper()

    if symbol.endswith(".T") or upper_exchange == "JPX":
        return "Tokyo"
    if symbol.endswith(".HK") or upper_exchange == "HKG":
        return "Hong Kong"
    if symbol.endswith(".SR") or upper_exchange == "SAU":
        return "Saudi Arabia"

    return "USA"


def to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def to_type(value):
    return "ETF" if str(value).strip().lower() in {"true", "1", "yes", "y", "etf"} else "STK"


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/import_scanner_csv.py <csv-file>")

    csv_path = Path(sys.argv[1]).expanduser().resolve()
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    scanned_at = int(time.time())
    rows = []

    with csv_path.open("r", newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        for item in reader:
            symbol = (item.get("symbol") or "").strip()
            if not symbol:
                continue

            exchange = (item.get("exchange") or "").strip()
            rows.append(
                (
                    symbol,
                    (item.get("name") or symbol).strip(),
                    exchange,
                    to_float(item.get("last")),
                    to_float(item.get("high")),
                    to_float(item.get("low")),
                    to_float(item.get("change_pct")),
                    to_float(item.get("range_pct")),
                    to_float(item.get("volume")),
                    to_type(item.get("etf")),
                    get_market(symbol, exchange),
                    scanned_at,
                )
            )

    with sqlite3.connect(DB_PATH) as conn:
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
        conn.execute("DELETE FROM scanner_results")
        conn.executemany(
            """
            INSERT INTO scanner_results (
                symbol, name, exchange, last, high, low, change_pct,
                range_pct, volume, type, market, scanned_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        conn.commit()

    print(f"Imported {len(rows)} rows into {DB_PATH}")


if __name__ == "__main__":
    main()
