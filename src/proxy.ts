import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === "/login";
  const hasValidSession = request.cookies.has("auth_session");

  // Si intentan entrar a cualquier ruta (incluyendo APIs) sin sesión, bloquear.
  // Para la página web, redirigimos. Para la API, devolvemos 401.
  if (!hasValidSession && !isLoginPage) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return new NextResponse(JSON.stringify({ error: "No autorizado" }), { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Si ya tiene sesión y trata de entrar al login, mandarlo al inicio
  if (hasValidSession && isLoginPage) {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
