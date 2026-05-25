import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChartsAnalyzer",
  description:
    "Plataforma de charts en vivo con indices, commodities y criptomonedas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark h-full antialiased">
      <body className="h-full overflow-hidden bg-tv-bg text-tv-text">
        <TooltipProvider delay={150}>{children}</TooltipProvider>
      </body>
    </html>
  );
}

