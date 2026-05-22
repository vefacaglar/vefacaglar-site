import type { Metadata } from "next";
import { TopBar } from "../components/TopBar";
import Header from "../components/Header";
import { getActiveLanguage } from "../lib/lang";
import { getDictionary } from "../dictionaries";
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
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  return (
    <html lang="en">
      <body>
        <TopBar />
        <main className={styles.main}>
          <Header dict={dict} />
          {children}
        </main>
      </body>
    </html>
  );
}
