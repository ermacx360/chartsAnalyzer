import { spawn } from "node:child_process";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScannerSide = "gainers" | "losers";
type ScannerMarket = "all" | "usa" | "tokyo" | "hong-kong" | "saudi-arabia";

function getSide(value: string | null): ScannerSide {
  return value === "losers" ? "losers" : "gainers";
}

function getLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(1, Math.min(parsed, 100));
}

function getMarket(value: string | null): ScannerMarket {
  const markets = new Set<ScannerMarket>([
    "all",
    "usa",
    "tokyo",
    "hong-kong",
    "saudi-arabia",
  ]);

  return markets.has(value as ScannerMarket) ? (value as ScannerMarket) : "all";
}

function runPythonQuery(
  side: ScannerSide,
  limit: number,
  market: ScannerMarket,
  command = "python",
) {
  const script = path.join(process.cwd(), "scripts", "query_scanner_db.py");

  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, [script, side, String(limit), market], {
      cwd: process.cwd(),
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr || `Python exited with code ${code}`));
    });
  });
}

function runPythonRefresh(command = "python") {
  const script = path.join(process.cwd(), "scripts", "refresh_scanner_db.py");

  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, [script], {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr || `Python exited with code ${code}`));
    });
  });
}

async function queryScanner(
  side: ScannerSide,
  limit: number,
  market: ScannerMarket,
) {
  try {
    return await runPythonQuery(side, limit, market, process.env.PYTHON ?? "python");
  } catch (error) {
    if (process.env.PYTHON) throw error;
    return runPythonQuery(side, limit, market, "py");
  }
}

async function refreshScanner() {
  try {
    return await runPythonRefresh(process.env.PYTHON ?? "python");
  } catch (error) {
    if (process.env.PYTHON) throw error;
    return runPythonRefresh("py");
  }
}

function parseLastJsonLine(output: string) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]) as unknown;
    } catch {
      // Progress lines are best-effort; keep looking for the final payload.
    }
  }

  throw new Error("El scanner no devolvio JSON valido");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const side = getSide(url.searchParams.get("side"));
  const limit = getLimit(url.searchParams.get("limit"));
  const market = getMarket(url.searchParams.get("market"));

  try {
    const output = await queryScanner(side, limit, market);
    return Response.json(JSON.parse(output));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message, rows: [] }, { status: 500 });
  }
}

export async function POST() {
  try {
    const output = await refreshScanner();
    return Response.json(parseLastJsonLine(output));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
