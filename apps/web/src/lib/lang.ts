import { cache } from "react";
import { cookies, headers } from "next/headers";

export const getActiveLanguage = cache((): string => {
  try {
    const localeHeader = headers().get("x-locale");
    if (localeHeader === "tr" || localeHeader === "en") {
      return localeHeader;
    }

    const cookieStore = cookies();
    const langCookie = cookieStore.get("lang")?.value;
    if (langCookie === "tr" || langCookie === "en") {
      return langCookie;
    }

    const acceptLang = headers().get("accept-language");
    if (acceptLang && acceptLang.toLowerCase().startsWith("tr")) {
      return "tr";
    }
  } catch (e) {
  }

  return "en";
});
