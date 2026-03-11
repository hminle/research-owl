import { ragUrl } from "@/lib/rag-server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const upstream = ragUrl(`/static/parsed/${path.join("/")}`);

  const res = await fetch(upstream);
  if (!res.ok) {
    return new Response("Image not found", { status: 404 });
  }

  const contentType = res.headers.get("content-type") ?? "image/png";
  return new Response(res.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
