import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vefa Çağlar",
  description: "Personal website of Vefa Çağlar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main style={{ width: "min(var(--max), calc(100% - 48px))", margin: "0 auto", padding: "96px 0" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
