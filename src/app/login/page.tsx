"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { loginUser } from "./actions";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await loginUser(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#131722] p-4">
      <div className="w-full max-w-sm rounded-xl border border-tv-border bg-tv-panel p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
            <Lock size={24} />
          </div>
          <h1 className="text-xl font-bold text-tv-text">Plataforma Privada</h1>
          <p className="mt-1 text-sm text-tv-text-muted">Inicia sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-tv-text-muted">
              Usuario
            </label>
            <input
              name="username"
              type="text"
              required
              className="w-full rounded border border-tv-border bg-[#131722] px-3 py-2 text-sm text-tv-text placeholder-tv-text-muted outline-none focus:border-blue-500"
              placeholder="Ej: juan"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-tv-text-muted">
              Contraseña
            </label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded border border-tv-border bg-[#131722] px-3 py-2 text-sm text-tv-text placeholder-tv-text-muted outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-center text-xs font-medium text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "mt-2 w-full rounded bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700",
              isLoading && "cursor-not-allowed opacity-70"
            )}
          >
            {isLoading ? "Verificando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
