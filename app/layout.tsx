import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aven | Team memory",
  description: "A quiet operational memory for fast moving teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
