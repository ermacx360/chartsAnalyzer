import json
import sqlite3
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "scanner.db"


def parse_limit(value):
    try:
        return max(1, min(int(value), 100))
    except (TypeError, ValueError):
        return 25


def parse_market(value):
    markets = {
        "usa": "USA",
        "tokyo": "Tokyo",
        "hong-kong": "Hong Kong",
        "saudi-arabia": "Saudi Arabia",
    }
    return markets.get((value or "").strip().lower())


def main():
    side = sys.argv[1] if len(sys.argv) > 1 else "gainers"
    limit = parse_limit(sys.argv[2] if len(sys.argv) > 2 else None)
    market = parse_market(sys.argv[3] if len(sys.argv) > 3 else None)

    if side == "losers":
        where = ["change_pct < 0"]
        order = "change_pct ASC"
    else:
        where = ["change_pct > 0"]
        order = "change_pct DESC"

    params = []
    if market:
        where.append("market = ?")
        params.append(market)

    params.append(limit)

    if not DB_PATH.exists():
        print(json.dumps({"rows": [], "updatedAt": None, "missingDb": True}))
        return

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            f"""
            SELECT
                symbol, name, exchange, last, high, low, change_pct,
                range_pct, volume, type, market, scanned_at
            FROM scanner_results
            WHERE {" AND ".join(where)}
            ORDER BY {order}
            LIMIT ?
            """,
            params,
        ).fetchall()
        updated_at = conn.execute(
            "SELECT MAX(scanned_at) FROM scanner_results"
        ).fetchone()[0]

    print(
        json.dumps(
            {
                "rows": [dict(row) for row in rows],
                "updatedAt": updated_at,
                "missingDb": False,
            }
        )
    )


if __name__ == "__main__":
    main()
