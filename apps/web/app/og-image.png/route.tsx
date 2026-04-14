import { ImageResponse } from "next/og";

import { DESIGN_ASSETS } from "@/lib/design-assets";
import { getEmbeddedDesignAssetDataUrl } from "@/lib/design-assets.server";

export const runtime = "nodejs";

export async function GET() {
  const plateUrl = await getEmbeddedDesignAssetDataUrl(DESIGN_ASSETS.social.sitewidePlate);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8f5ed",
          padding: "80px",
          fontFamily: "Inter, system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* next/og ImageResponse renders plain HTML, so next/image is not available here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={plateUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "1200px",
            height: "630px",
            objectFit: "cover",
            opacity: 0.92,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(248, 245, 237, 0.22) 0%, rgba(248, 245, 237, 0.7) 100%)",
          }}
        />
        {/* Main Content Container */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "48px",
            position: "relative",
          }}
        >
          {/* Logo/Icon */}
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "24px",
              background: "linear-gradient(135deg, #147fe6 0%, #1d4ed8 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "72px",
              boxShadow: "0 20px 60px rgba(20, 127, 230, 0.22)",
            }}
          >
            📡
          </div>

          {/* Title */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "24px",
            }}
          >
            <div
              style={{
                fontSize: "82px",
                fontWeight: 900,
                background: "linear-gradient(135deg, #0f172a 0%, #2563eb 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                letterSpacing: "-0.04em",
                textAlign: "center",
                display: "flex",
              }}
            >
              AI Web Feeds
            </div>

            {/* Subtitle */}
            <div
              style={{
                fontSize: "36px",
                fontWeight: 500,
                color: "#334155",
                textAlign: "center",
                maxWidth: "900px",
                lineHeight: 1.4,
                display: "flex",
              }}
            >
              RSS/Atom Feeds Optimized for AI Agents & LLMs
            </div>
          </div>

          {/* Features Grid */}
          <div
            style={{
              display: "flex",
              gap: "24px",
              marginTop: "24px",
            }}
          >
            <div
              style={{
                padding: "16px 32px",
                backgroundColor: "rgba(255, 255, 255, 0.82)",
                border: "1px solid rgba(148, 163, 184, 0.35)",
                borderRadius: "12px",
                fontSize: "24px",
                fontWeight: 600,
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span>📄</span>
              <span>PDF Export</span>
            </div>
            <div
              style={{
                padding: "16px 32px",
                backgroundColor: "rgba(255, 255, 255, 0.82)",
                border: "1px solid rgba(148, 163, 184, 0.35)",
                borderRadius: "12px",
                fontSize: "24px",
                fontWeight: 600,
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span>🤖</span>
              <span>LLM Ready</span>
            </div>
            <div
              style={{
                padding: "16px 32px",
                backgroundColor: "rgba(255, 255, 255, 0.82)",
                border: "1px solid rgba(148, 163, 184, 0.35)",
                borderRadius: "12px",
                fontSize: "24px",
                fontWeight: 600,
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span>📡</span>
              <span>RSS Feeds</span>
            </div>
          </div>
          <div
            style={{
              fontSize: "22px",
              color: "#475569",
              display: "flex",
              marginTop: "12px",
            }}
          >
            aiwebfeeds.vercel.app
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
