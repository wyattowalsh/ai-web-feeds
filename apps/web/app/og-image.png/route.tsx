import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
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
          backgroundColor: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 25px 25px, #18181b 2%, transparent 0%), radial-gradient(circle at 75px 75px, #18181b 2%, transparent 0%)",
          backgroundSize: "100px 100px",
          padding: "80px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Main Content Container */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "48px",
          }}
        >
          {/* Logo/Icon */}
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "24px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "72px",
              boxShadow: "0 20px 60px rgba(102, 126, 234, 0.4)",
            }}
          >
            🤖
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
                background: "linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%)",
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
                color: "#a1a1aa",
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
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "12px",
                fontSize: "24px",
                fontWeight: 600,
                color: "#a1a1aa",
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
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "12px",
                fontSize: "24px",
                fontWeight: 600,
                color: "#a1a1aa",
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
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "12px",
                fontSize: "24px",
                fontWeight: 600,
                color: "#a1a1aa",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span>📡</span>
              <span>RSS Feeds</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: "60px",
            fontSize: "24px",
            color: "#52525b",
            display: "flex",
          }}
        >
          ai-web-feeds.vercel.app
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
