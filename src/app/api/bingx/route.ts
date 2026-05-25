export const dynamic = "force-dynamic";

const BINGX_BASE = "https://open-api.bingx.com";
const ALLOWED_PATHS = new Set([
  "/openApi/swap/v2/quote/contracts",
  "/openApi/swap/v2/quote/ticker",
  "/openApi/swap/v3/quote/klines",
]);

export async function GET(request: Request) {
  const sourceUrl = new URL(request.url);
  const path = sourceUrl.searchParams.get("path") ?? "";

  if (!ALLOWED_PATHS.has(path)) {
    return Response.json({ error: "BingX path no soportado" }, { status: 400 });
  }

  const targetUrl = new URL(`${BINGX_BASE}${path}`);
  sourceUrl.searchParams.forEach((value, key) => {
    if (key !== "path") {
      targetUrl.searchParams.set(key, value);
    }
  });

  const res = await fetch(targetUrl, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  const body = await res.text();

  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}
