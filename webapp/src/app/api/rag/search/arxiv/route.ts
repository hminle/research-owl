import { NextRequest, NextResponse } from "next/server";
import { ragFetch } from "@/lib/rag-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await ragFetch("/search/arxiv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "ArXiv search failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
