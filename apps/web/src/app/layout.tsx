import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Denker",
  description: "Local product discovery workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full font-sans antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
