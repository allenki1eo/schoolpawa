import { ImageResponse } from "next/og";

/** PWA icons rendered once at build/first request and cached. */
export const dynamic = "force-static";
export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable" }];
}

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: raw } = await ctx.params;
  const maskable = raw === "maskable";
  const size = raw === "192" ? 192 : 512;
  const pad = maskable ? size * 0.2 : size * 0.08;
  const inner = size - pad * 2;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: maskable ? "#0e182f" : "transparent" }}>
        <div
          style={{
            width: inner,
            height: inner,
            borderRadius: maskable ? 0 : inner * 0.28,
            background: "linear-gradient(145deg, #13203d, #050a16)",
            border: maskable ? "none" : `${Math.max(2, inner * 0.03)}px solid #f7c948`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg viewBox="0 0 48 48" width={inner * 0.7} height={inner * 0.7}>
            <path d="M27.5 8 13 27h9.5L19 40l16-20.5h-9.8z" fill="#f7c948" />
          </svg>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
