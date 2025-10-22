import { ImageResponse } from 'next/og';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          padding: '80px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 800, color: '#fff' }}>
          AI Web Feeds Documentation
        </div>
        <div style={{ fontSize: 28, color: '#a1a1aa', marginTop: 16 }}>
          Guides, Features, and AI-friendly endpoints
        </div>
      </div>
    ),
    size,
  );
}
