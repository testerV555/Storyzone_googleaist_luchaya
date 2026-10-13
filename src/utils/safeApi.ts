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
  fallbackData?: T,
  timeoutMs: number = 32000
): Promise<SafeFetchResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Timeout after ${timeoutMs}ms`));
  }, timeoutMs);

  // If caller already provided a signal, link it
  if (options?.signal) {
    options.signal.addEventListener("abort", () => {
      controller.abort(options.signal?.reason);
    });
  }

  const fetchOptions: RequestInit = {
    ...options,
    signal: controller.signal,
  };

  try {
    const res = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
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
    clearTimeout(timeoutId);
    const isAbort = netErr?.name === "AbortError" || netErr?.message?.includes("Timeout");
    console.warn(`[SafeFetch] Network or timeout error for ${url}:`, isAbort ? "Request timed out" : netErr?.message);
    return {
      ok: false,
      data: fallbackData as T,
      error: isAbort ? "Превышено время ожидания ответа ИИ" : (netErr?.message || "Ошибка сети"),
    };
  }
}
