import { ragFetch } from "@/lib/rag-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const datasetId = request.nextUrl.searchParams.get("dataset_id");
  const path = datasetId ? `/eval/runs?dataset_id=${datasetId}` : "/eval/runs";
  const res = await ragFetch(path);
  return NextResponse.json(await res.json());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await ragFetch("/eval/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json());
}
