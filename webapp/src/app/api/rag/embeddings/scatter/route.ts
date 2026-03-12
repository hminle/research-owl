import { NextRequest, NextResponse } from "next/server";
import { ragUrl } from "@/lib/rag-server";

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get("limit") ?? "1000";

  // Longer timeout for UMAP computation
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch(ragUrl(`/embeddings/scatter?limit=${limit}`), {
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json({ error: body }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "UMAP computation timed out" }, { status: 504 });
    }
    const message = err instanceof Error ? err.message : "Failed to fetch embeddings";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
