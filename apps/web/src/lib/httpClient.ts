import { getActiveLanguage } from "./lang";

const API_URL = process.env.API_URL;

if (!API_URL) {
  throw new Error("API_URL environment variable is not set.");
}

type NextFetchRequestConfig = {
  revalidate?: number | false;
  tags?: string[];
};

type RequestInitWithNext = RequestInit & { next?: NextFetchRequestConfig };

class HttpClient {
  private getUrl(path: string): string {
    return path.startsWith("http://") || path.startsWith("https://")
      ? path
      : `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  private isAuthed(init?: RequestInitWithNext): boolean {
    if (!init?.headers) return false;
    if (init.headers instanceof Headers) return init.headers.has("Authorization");
    if (Array.isArray(init.headers)) {
      return init.headers.some(([k]) => k.toLowerCase() === "authorization");
    }
    return Object.keys(init.headers).some((k) => k.toLowerCase() === "authorization");
  }

  private async request(path: string, init?: RequestInitWithNext): Promise<Response> {
    const url = this.getUrl(path);
    const headers = new Headers(init?.headers);

    if (!headers.has("language")) {
      const lang = getActiveLanguage();
      headers.set("language", lang);
    }

    if (typeof window === "undefined") {
      try {
        const { headers: nextHeaders } = require("next/headers");
        const list = nextHeaders();
        const forwardedFor = list.get("x-forwarded-for");
        const realIp = list.get("x-real-ip");

        if (forwardedFor && !headers.has("x-forwarded-for")) {
          headers.set("x-forwarded-for", forwardedFor);
        } else if (realIp && !headers.has("x-forwarded-for")) {
          headers.set("x-forwarded-for", realIp);
        }
      } catch (e) {
      }
    }

    const maxRetries = 3;
    let delay = 500;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fetch(url, {
          ...init,
          headers,
        });
      } catch (error: any) {
        const isNetworkError =
          error instanceof TypeError ||
          error?.code === "ECONNREFUSED" ||
          error?.message?.includes("fetch failed");

        if (isNetworkError && attempt < maxRetries) {
          console.warn(
            `[HttpClient] Connection to ${url} failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        throw error;
      }
    }
    throw new Error("Fetch failed after max retries");
  }

  async get(path: string, init?: RequestInitWithNext): Promise<Response> {
    const authed = this.isAuthed(init);
    const cacheInit: RequestInitWithNext = authed
      ? { ...init, cache: "no-store", next: undefined }
      : {
          ...init,
          cache: init?.cache ?? "force-cache",
          next: init?.next ?? { revalidate: 60 },
        };

    return this.request(path, { ...cacheInit, method: "GET" });
  }

  async post(path: string, body?: any, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    const hasBody = body !== undefined;

    if (hasBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return this.request(path, {
      ...init,
      method: "POST",
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  }

  async put(path: string, body?: any, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    const hasBody = body !== undefined;

    if (hasBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return this.request(path, {
      ...init,
      method: "PUT",
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  }

  async delete(path: string, init?: RequestInit): Promise<Response> {
    return this.request(path, { ...init, method: "DELETE" });
  }
}

export const httpClient = new HttpClient();
