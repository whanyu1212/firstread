import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

/** Figtree for text: clean like Geist, a little warmer. Geist Mono for numbers, timings and level names. */
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "FirstRead",
  description: "A per-turn safety layer for mental health companion agents, powered by Jev.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${geistMono.variable}`}>
      <body className="bg-page font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
