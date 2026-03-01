import { NextResponse } from "next/server";
import { ragFetch } from "@/lib/rag-server";

export async function GET() {
  try {
    const res = await ragFetch("/papers");
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch papers";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
