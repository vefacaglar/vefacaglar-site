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
