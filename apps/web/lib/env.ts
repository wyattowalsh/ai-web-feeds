type BrowserLocationLike = {
  hostname: string;
  origin: string;
};

export const DEFAULT_SITE_BASE_URL = "https://ai-web-feeds.vercel.app";
export const DEFAULT_LOCAL_WEBSOCKET_URL = "http://localhost:8000";

const DEV_ANON_BINDING_SECRET = "aiwf-dev-anon-binding-secret";

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function normalizeAbsoluteUrl(name: string, value: string): string {
  try {
    return trimTrailingSlash(new URL(value).toString());
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }
}

export function getSiteBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  return normalizeAbsoluteUrl("NEXT_PUBLIC_BASE_URL", configured || DEFAULT_SITE_BASE_URL);
}

export function getRequiredBackendUrl(): string {
  const configured = process.env.BACKEND_URL?.trim();
  if (!configured) {
    throw new Error(
      "BACKEND_URL is required for proxied backend routes. Set BACKEND_URL to the Python service origin.",
    );
  }

  return normalizeAbsoluteUrl("BACKEND_URL", configured);
}

export function getWebSocketServerUrl(
  browserLocation: BrowserLocationLike | null = typeof window === "undefined"
    ? null
    : window.location,
): string {
  const configured = process.env.NEXT_PUBLIC_WEBSOCKET_URL?.trim();
  if (configured) {
    return normalizeAbsoluteUrl("NEXT_PUBLIC_WEBSOCKET_URL", configured);
  }

  if (browserLocation === null) {
    return DEFAULT_LOCAL_WEBSOCKET_URL;
  }

  const isLocalHost =
    browserLocation.hostname === "localhost" || browserLocation.hostname === "127.0.0.1";
  return isLocalHost ? DEFAULT_LOCAL_WEBSOCKET_URL : trimTrailingSlash(browserLocation.origin);
}

export function isPdfExportEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PDF_EXPORT?.trim() === "true";
}

export function getAnonymousBindingSecret(): string {
  const configured =
    process.env.AIWF_ANON_BINDING_SECRET?.trim() || process.env.AIWF_ADMIN_SESSION_SECRET?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AIWF_ANON_BINDING_SECRET must be configured in production to sign anonymous browser bindings.",
    );
  }

  return DEV_ANON_BINDING_SECRET;
}
