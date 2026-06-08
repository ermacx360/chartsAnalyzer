export const dynamic = "force-dynamic";

type SerializedBucket = [number, number, number, number, number];

interface RemoteOrderflowResponse {
  buckets?: SerializedBucket[];
  rows?: unknown;
  bookPressure?: unknown;
}

function normalizeSymbol(value: string | null) {
  return value?.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "") ?? "";
}

function getRemoteOrderflowUrl(symbol: string) {
  const base = process.env.ORDERFLOW_API_URL?.trim();
  if (!base) return null;

  const url = new URL("/orderflow", base.endsWith("/") ? base : `${base}/`);
  url.searchParams.set("symbol", symbol);

  return url;
}

function isSerializedBucket(value: unknown): value is SerializedBucket {
  return (
    Array.isArray(value) &&
    value.length >= 5 &&
    value.slice(0, 5).every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

async function fetchRemoteBuckets(symbol: string) {
  const url = getRemoteOrderflowUrl(symbol);
  if (!url) return null;

  const apiKey = process.env.ORDERFLOW_API_KEY?.trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as RemoteOrderflowResponse;
    if (!Array.isArray(data.buckets)) return null;

    return {
      buckets: data.buckets.filter(isSerializedBucket),
      rows: data.rows,
      bookPressure: data.bookPressure,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = normalizeSymbol(url.searchParams.get("symbol"));

  if (!symbol) {
    return Response.json({ error: "symbol requerido" }, { status: 400 });
  }

  const remote = await fetchRemoteBuckets(symbol);

  if (!remote) {
    return Response.json(
      { error: "orderflow remoto no disponible", buckets: [], provider: "aws" },
      { status: 502 },
    );
  }

  return Response.json({ ...remote, provider: "aws" });
}
