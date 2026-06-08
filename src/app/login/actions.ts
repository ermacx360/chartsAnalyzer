"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginUser(formData: FormData) {
  const username = formData.get("username")?.toString().trim() || "";
  const password = formData.get("password")?.toString() || "";

  if (!username || !password) {
    return { error: "Por favor, ingresa usuario y contraseña" };
  }

  // Parsear APP_USERS de las variables de entorno (formato: "user1:pass1,user2:pass2")
  const rawUsers = process.env.APP_USERS || "";
  const validUsers = rawUsers.split(",").map((u) => u.trim());

  const credentialsMatch = validUsers.some(
    (u) => u === `${username}:${password}`
  );

  if (!credentialsMatch) {
    return { error: "Usuario o contraseña incorrectos" };
  }

  // Generar cookie de sesión segura (dura 30 días)
  const cookieStore = await cookies();
  cookieStore.set("auth_session", "true", {
    secure: process.env.VERCEL === "1",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 días
    path: "/",
    sameSite: "lax",
  });

  redirect("/");
}
