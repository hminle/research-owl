import { ragFetch } from "@/lib/rag-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ datasetId: string }> },
) {
  const { datasetId } = await params;
  const res = await ragFetch(`/eval/datasets/${datasetId}`);
  return NextResponse.json(await res.json());
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ datasetId: string }> },
) {
  const { datasetId } = await params;
  const body = await request.json();
  const res = await ragFetch(`/eval/datasets/${datasetId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json());
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ datasetId: string }> },
) {
  const { datasetId } = await params;
  const res = await ragFetch(`/eval/datasets/${datasetId}`, {
    method: "DELETE",
  });
  return NextResponse.json(await res.json());
}
