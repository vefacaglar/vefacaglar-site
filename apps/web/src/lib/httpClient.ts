import { getActiveLanguage } from "./lang";

const API_URL = process.env.API_URL || "http://localhost:3001";

class HttpClient {
  private getUrl(path: string): string {
    return path.startsWith("http://") || path.startsWith("https://")
      ? path
      : `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const url = this.getUrl(path);
    const headers = new Headers(init?.headers);

    // Automatically inject active language if not explicitly provided
    if (!headers.has("language")) {
      const lang = getActiveLanguage();
      headers.set("language", lang);
    }

    // In a server-side context (e.g. Server Actions, Server Components),
    // forward the client's real IP address to the API.
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
        // Silence errors if called outside of a request context (e.g., static generation/build time)
      }
    }

    return fetch(url, {
      ...init,
      headers,
    });
  }

  async get(path: string, init?: RequestInit): Promise<Response> {
    return this.request(path, { ...init, method: "GET" });
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
