import type { Metadata } from "next";
import { TopBar } from "../components/TopBar";
import Header from "../components/Header";
import { LocaleProvider } from "../components/LocaleProvider";
import WidthController from "../components/WidthController";
import AuthWarmup from "../components/AuthWarmup";
import { getActiveLanguage } from "../lib/lang";
import { getDictionary } from "../dictionaries";
import { SITE_URL } from "../lib/seo";
import { getAuthMode } from "../lib/oidc";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "vefa çağlar",
  description: "personal website of vefa çağlar",
  openGraph: {
    type: "website",
    siteName: "vefa çağlar",
  },
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
  const issuer = process.env.OIDC_ISSUER?.replace(/\/+$/, "");
  const warmupUrl =
    getAuthMode() === "oidc" && issuer ? `${issuer}/.well-known/openid-configuration` : null;

  return (
    <html lang={lang}>
      <body>
        <LocaleProvider locale={locale}>
          <WidthController />
          {warmupUrl && <AuthWarmup url={warmupUrl} />}
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
