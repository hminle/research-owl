const RAG_API_URL = process.env.RAG_API_URL ?? "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 30_000;

export function ragUrl(path: string): string {
  return `${RAG_API_URL}${path}`;
}

export async function ragFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ragUrl(path), {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`rag-service request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`rag-service ${res.status}: ${body}`);
  }

  return res;
}
