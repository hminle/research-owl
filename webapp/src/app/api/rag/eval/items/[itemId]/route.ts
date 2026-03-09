import { ragFetch } from "@/lib/rag-server";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const body = await request.json();
  const res = await ragFetch(`/eval/items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json());
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const res = await ragFetch(`/eval/items/${itemId}`, {
    method: "DELETE",
  });
  return NextResponse.json(await res.json());
}
