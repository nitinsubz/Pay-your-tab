import { ImageResponse } from 'next/og';

export const alt = 'TabWrapped';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Social preview image — matches app icon gradient + receipt motif (not the Vercel default). */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #4F46E5 0%, #9333EA 50%, #EC4899 100%)',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: 168,
            height: 168,
            borderRadius: 36,
            background: 'rgba(255,255,255,0.12)',
            border: '3px solid rgba(255,255,255,0.35)',
            marginBottom: 36,
            padding: 28,
          }}
        >
          <div
            style={{
              width: '100%',
              height: 72,
              border: '3px solid white',
              borderRadius: 10,
              marginBottom: 12,
            }}
          />
          <div
            style={{
              width: '70%',
              height: 6,
              background: 'white',
              borderRadius: 3,
              marginBottom: 10,
            }}
          />
          <div style={{ width: '55%', height: 6, background: 'white', borderRadius: 3 }} />
        </div>
        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            color: 'white',
            letterSpacing: '-0.03em',
          }}
        >
          TabWrapped
        </div>
      </div>
    ),
    { ...size }
  );
}
