const DEFAULT_API_TIMEOUT_MS = 10_000;

export function apiProgressUrl(paperId: string): string {
  return `/api/rag/papers/${paperId}/progress`;
}

export async function apiFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs =
    init?.timeoutMs ?? (Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS) || DEFAULT_API_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(path, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`API request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res;
}
