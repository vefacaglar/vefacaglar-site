import Typesense, { Client as TypesenseClient } from "typesense";
import type { SearchLanguage } from "./search.types";

export interface TypesenseConfig {
  enabled: boolean;
  host: string;
  port: number;
  protocol: "http" | "https";
  apiKey: string;
  languages: SearchLanguage[];
}

const SUPPORTED_LANGUAGES: readonly SearchLanguage[] = ["en", "tr"];

export function readTypesenseLanguages(): SearchLanguage[] {
  const raw = process.env.TYPESENSE_LANGUAGES;
  if (!raw) return ["en"];

  const requested = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const valid = requested.filter((lang): lang is SearchLanguage =>
    (SUPPORTED_LANGUAGES as readonly string[]).includes(lang)
  );

  if (valid.length === 0) {
    console.warn(`[search] TYPESENSE_LANGUAGES contains no valid values, defaulting to "en"`);
    return ["en"];
  }

  return valid;
}

export function readTypesenseConfig(): TypesenseConfig {
  const explicitHost = process.env.TYPESENSE_HOST;
  const portRaw = process.env.TYPESENSE_PORT;
  const protocol = process.env.TYPESENSE_PROTOCOL as "http" | "https" | undefined;
  const apiKey = process.env.TYPESENSE_API_KEY;
  const publicUrl = process.env.TYPESENSE_PUBLIC_URL;
  const languages = readTypesenseLanguages();

  let host = explicitHost;
  let resolvedProtocol: "http" | "https" = protocol === "http" ? "http" : "https";
  let resolvedPort: number | undefined;

  if (!host && publicUrl) {
    try {
      const u = new URL(publicUrl);
      host = u.hostname;
      resolvedProtocol = u.protocol === "http:" ? "http" : "https";
      if (u.port) {
        resolvedPort = parseInt(u.port, 10);
      }
    } catch {
      // Invalid TYPESENSE_PUBLIC_URL; fall through to disabled.
    }
  }

  if (!host || !apiKey) {
    return {
      enabled: false,
      host: "",
      port: 0,
      protocol: resolvedProtocol,
      apiKey: "",
      languages,
    };
  }

  const port = portRaw
    ? parseInt(portRaw, 10)
    : resolvedPort !== undefined
      ? resolvedPort
      : resolvedProtocol === "https"
        ? 443
        : 80;

  return {
    enabled: true,
    host,
    port: Number.isFinite(port) ? port : 443,
    protocol: resolvedProtocol,
    apiKey,
    languages,
  };
}

export function createTypesenseClient(config: TypesenseConfig): TypesenseClient {
  return new Typesense.Client({
    nodes: [
      {
        host: config.host,
        port: config.port,
        protocol: config.protocol,
      },
    ],
    apiKey: config.apiKey,
    connectionTimeoutSeconds: 2,
  });
}

export function createDisabledTypesenseClient(): TypesenseClient {
  return new Proxy({} as TypesenseClient, {
    get(_target, prop) {
      return () => {
        throw new Error(`typesense is not configured (called: ${String(prop)})`);
      };
    },
  });
}
