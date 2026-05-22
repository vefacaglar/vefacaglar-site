import { cookies, headers } from "next/headers";

export function getActiveLanguage(): string {
  try {
    const cookieStore = cookies();
    const langCookie = cookieStore.get("lang")?.value;

    if (langCookie === "tr" || langCookie === "en") {
      return langCookie;
    }

    // Fallback to browser Accept-Language
    const acceptLang = headers().get("accept-language");
    if (acceptLang && acceptLang.toLowerCase().startsWith("tr")) {
      return "tr";
    }
  } catch (e) {
    // cookies() or headers() can sometimes throw in static context or build phases, fallback to en
  }

  return "en";
}
