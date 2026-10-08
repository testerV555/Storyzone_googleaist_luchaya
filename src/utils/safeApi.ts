/**
 * Safe API client utilities to ensure zero unhandled JSON parse crashes
 * (e.g. "Unexpected token '<', "<!doctype "... is not valid JSON")
 * and resilient client-side fallbacks when network or server issues occur.
 */

export interface SafeFetchResult<T> {
  ok: boolean;
  data: T;
  error?: string;
}

export async function safeFetchJson<T>(
  url: string,
  options?: RequestInit,
  fallbackData?: T
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();

    if (!res.ok) {
      console.warn(`[SafeFetch] ${url} returned status ${res.status}:`, text.slice(0, 120));
      return {
        ok: false,
        data: fallbackData as T,
        error: `HTTP ${res.status}`,
      };
    }

    const trimmed = text.trim();
    if (!contentType.includes("application/json") && trimmed.startsWith("<")) {
      console.warn(`[SafeFetch] ${url} returned HTML document instead of JSON:`, trimmed.slice(0, 120));
      return {
        ok: false,
        data: fallbackData as T,
        error: "Server returned HTML instead of JSON",
      };
    }

    try {
      const parsed = JSON.parse(text) as T;
      return {
        ok: true,
        data: parsed,
      };
    } catch (parseErr: any) {
      console.warn(`[SafeFetch] Failed to parse JSON from ${url}:`, parseErr?.message, trimmed.slice(0, 80));
      return {
        ok: false,
        data: fallbackData as T,
        error: parseErr?.message,
      };
    }
  } catch (netErr: any) {
    console.warn(`[SafeFetch] Network or fetch error for ${url}:`, netErr?.message);
    return {
      ok: false,
      data: fallbackData as T,
      error: netErr?.message,
    };
  }
}
