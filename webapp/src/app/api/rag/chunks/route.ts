import { NextRequest, NextResponse } from "next/server";
import { ragFetch } from "@/lib/rag-server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();
    if (searchParams.get("paper_id")) params.set("paper_id", searchParams.get("paper_id")!);
    if (searchParams.get("chunk_type")) params.set("chunk_type", searchParams.get("chunk_type")!);
    if (searchParams.get("offset")) params.set("offset", searchParams.get("offset")!);
    if (searchParams.get("limit")) params.set("limit", searchParams.get("limit")!);

    const qs = params.toString();
    const res = await ragFetch(`/chunks${qs ? `?${qs}` : ""}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch chunks";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
