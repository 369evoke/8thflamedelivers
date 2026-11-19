import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "8th Flame Delivery — Courier & Parcel Shipping", template: "%s · 8th Flame Delivery" },
  description: "Reliable courier and parcel delivery for individuals and businesses. Book, pay and track shipments online.",
  icons: { icon: "/brand/mark.svg" },
};

export const viewport: Viewport = { themeColor: "#252525", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
