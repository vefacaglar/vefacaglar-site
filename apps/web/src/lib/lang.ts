import { cache } from "react";
import { cookies, headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";

export const getActiveLanguage = cache(async (): Promise<string> => {
  try {
    const headerStore = await headers();
    const localeHeader = headerStore.get("x-locale");
    if (localeHeader === "tr" || localeHeader === "en") {
      return localeHeader;
    }

    const cookieStore = await cookies();
    const langCookie = cookieStore.get("lang")?.value;
    if (langCookie === "tr" || langCookie === "en") {
      return langCookie;
    }

    const acceptLang = headerStore.get("accept-language");
    if (acceptLang && acceptLang.toLowerCase().startsWith("tr")) {
      return "tr";
    }
  } catch (e) {
    // Let Next.js see the dynamic-rendering bailout instead of swallowing it.
    unstable_rethrow(e);
  }

  return "en";
});
