import { ragFetch } from "@/lib/rag-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const datasetId = request.nextUrl.searchParams.get("dataset_id");
  const path = datasetId ? `/eval/stats?dataset_id=${datasetId}` : "/eval/stats";
  const res = await ragFetch(path);
  return NextResponse.json(await res.json());
}
