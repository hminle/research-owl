import { ragFetch } from "@/lib/rag-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const res = await ragFetch("/eval/datasets");
  return NextResponse.json(await res.json());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await ragFetch("/eval/datasets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json());
}
