import sqlite3
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "scanner.db"


ROWS = [
    ("NVDA", "NVIDIA Corporation", "NMS", 124.35, 126.1, 119.8, 5.82, 5.26, 84200000, "STK", "USA"),
    ("AAPL", "Apple Inc.", "NMS", 308.82, 310.4, 302.7, 2.41, 2.54, 51100000, "STK", "USA"),
    ("TSLA", "Tesla, Inc.", "NMS", 416.2, 423.0, 394.5, 4.9, 7.22, 92300000, "STK", "USA"),
    ("SPY", "SPDR S&P 500 ETF Trust", "PCX", 675.12, 676.3, 668.9, 0.77, 1.11, 62200000, "ETF", "USA"),
    ("7974.T", "Nintendo Co., Ltd.", "JPX", 7240.0, 7315.0, 7168.0, 1.36, 2.05, 3150000, "STK", "Tokyo"),
    ("9984.T", "SoftBank Group Corp.", "JPX", 15420.0, 15750.0, 15100.0, 3.08, 4.3, 12800000, "STK", "Tokyo"),
    ("0700.HK", "Tencent Holdings Limited", "HKG", 441.4, 448.0, 432.6, -2.14, 3.56, 24100000, "STK", "Hong Kong"),
    ("9988.HK", "Alibaba Group Holding Limited", "HKG", 121.8, 124.2, 119.4, -3.18, 4.02, 68200000, "STK", "Hong Kong"),
    ("2222.SR", "Saudi Arabian Oil Company", "SAU", 27.9, 27.96, 27.64, 0.14, 1.16, 29611546, "STK", "Saudi Arabia"),
    ("7203.T", "Toyota Motor Corporation", "JPX", 2928.5, 2960.0, 2898.0, -1.22, 2.14, 21800000, "STK", "Tokyo"),
]


def main():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    scanned_at = int(time.time())

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
            [row + (scanned_at,) for row in ROWS],
        )
        conn.commit()

    print(f"Seeded {len(ROWS)} rows into {DB_PATH}")


if __name__ == "__main__":
    main()
