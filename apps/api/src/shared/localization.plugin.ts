import { AsyncLocalStorage } from "async_hooks";
import type { FastifyInstance, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    lang: string;
  }
}

export const requestStorage = new AsyncLocalStorage<FastifyRequest>();

function detectLang(rawLang: unknown): string {
  if (typeof rawLang !== "string") return "en";
  const clean = rawLang.trim().toLowerCase();
  if (clean.startsWith("tr")) return "tr";
  if (clean.startsWith("en")) return "en";
  return "en";
}

export function registerLocalization(app: FastifyInstance): void {
  app.decorateRequest("lang", "en");

  app.addHook("onRequest", (request, _reply, done) => {
    request.lang = detectLang(request.headers["language"]);
    requestStorage.run(request, () => done());
  });
}
