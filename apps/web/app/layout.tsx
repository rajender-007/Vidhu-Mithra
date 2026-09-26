import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NyayaPath | Legal information for the next step",
  description: "A calm, source-aware legal information navigator for people in India.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
