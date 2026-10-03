import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "GeoMineral — Follow the evidence",
  description: "Explore Earth. Understand the geology. Follow the evidence.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
