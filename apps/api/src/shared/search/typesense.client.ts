import Typesense, { Client as TypesenseClient } from "typesense";

export interface TypesenseConfig {
  enabled: boolean;
  host: string;
  port: number;
  protocol: "http" | "https";
  apiKey: string;
}

export function readTypesenseConfig(): TypesenseConfig {
  const explicitHost = process.env.TYPESENSE_HOST;
  const portRaw = process.env.TYPESENSE_PORT;
  const protocol = process.env.TYPESENSE_PROTOCOL as "http" | "https" | undefined;
  const apiKey = process.env.TYPESENSE_API_KEY;
  const publicUrl = process.env.TYPESENSE_PUBLIC_URL;

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
