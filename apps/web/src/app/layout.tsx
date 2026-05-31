import type { Metadata } from "next";
import { TopBar } from "../components/TopBar";
import Header from "../components/Header";
import { LocaleProvider } from "../components/LocaleProvider";
import WidthController from "../components/WidthController";
import { getActiveLanguage } from "../lib/lang";
import { getDictionary } from "../dictionaries";
import { SITE_URL } from "../lib/seo";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "vefa çağlar",
  description: "personal website of vefa çağlar",
  verification: {
    google: "nVnbCv8TKlOREhb5XkkIegzW0AImFUIHrvNokeSlJYA",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  const locale = (lang === "tr" ? "tr" : "en") as "en" | "tr";

  return (
    <html lang={lang}>
      <body>
        <LocaleProvider locale={locale}>
          <WidthController />
          <TopBar />
          <main className={styles.main}>
            <Header dict={dict} />
            {children}
          </main>
        </LocaleProvider>
      </body>
    </html>
  );
}
