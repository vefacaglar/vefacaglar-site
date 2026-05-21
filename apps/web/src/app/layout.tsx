import type { Metadata } from "next";
import { TopBar } from "../components/TopBar";
import "./globals.css";
import styles from "./layout.module.css";

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
        <TopBar />
        <main className={styles.main}>
          {children}
        </main>
      </body>
    </html>
  );
}
