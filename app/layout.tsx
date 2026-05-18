import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "./components/Nav";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AGENTE P.E.R.R.Y — Sistema de Señales de Alerta en Contrataciones Públicas",
  description:
    "Knowledge Graph para la detección automatizada de patrones inusuales en contrataciones públicas del Perú. Datos de fuentes públicas: SEACE y SUNAT.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-black text-white">
        <Nav />
        {children}
      </body>
    </html>
  );
}
