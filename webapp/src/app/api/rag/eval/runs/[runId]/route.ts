import { ragFetch } from "@/lib/rag-server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const res = await ragFetch(`/eval/runs/${runId}`);
  return NextResponse.json(await res.json());
}
