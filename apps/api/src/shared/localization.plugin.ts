import { AsyncLocalStorage } from "async_hooks";
import { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    lang: string;
  }
}

export const languageStorage = new AsyncLocalStorage<string>();

export function registerLocalization(app: FastifyInstance): void {
  // Add a decorator to FastifyRequest to hold the active language
  app.decorateRequest("lang", "en");

  // Global preHandler hook to parse active language from headers, defaulting to 'en'
  app.addHook("preHandler", (request, reply, done) => {
    const rawLang = request.headers["language"];
    let detectedLang = "en";

    if (typeof rawLang === "string") {
      const cleanLang = rawLang.trim().toLowerCase();
      if (cleanLang.startsWith("tr")) {
        detectedLang = "tr";
      } else if (cleanLang.startsWith("en")) {
        detectedLang = "en";
      }
    }

    request.lang = detectedLang;

    // Run the rest of the request lifecycle within the AsyncLocalStorage context
    languageStorage.run(detectedLang, () => {
      done();
    });
  });
}
