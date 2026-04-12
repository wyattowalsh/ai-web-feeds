import { ImageResponse } from "next/og";

import { DESIGN_ASSETS } from "@/lib/design-assets";
import { getEmbeddedDesignAssetDataUrl } from "@/lib/design-assets.server";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  const plateUrl = await getEmbeddedDesignAssetDataUrl(DESIGN_ASSETS.social.docsPlate);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "#f8f5ed",
          padding: "80px",
          fontFamily: "Inter, system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <img
          src={plateUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "1200px",
            height: "630px",
            objectFit: "cover",
            opacity: 0.96,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(248, 245, 237, 0.92) 0%, rgba(248, 245, 237, 0.68) 48%, rgba(248, 245, 237, 0.34) 100%)",
          }}
        />
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "#0f172a",
            position: "relative",
          }}
        >
          AI Web Feeds Documentation
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#334155",
            marginTop: 16,
            position: "relative",
            maxWidth: "720px",
          }}
        >
          Guides, Features, and AI-friendly endpoints
        </div>
      </div>
    ),
    size,
  );
}
