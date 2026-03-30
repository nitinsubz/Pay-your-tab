import { ImageResponse } from 'next/og';
import { getTabShareMetadata } from '@/lib/firebaseAdmin';

export const alt = 'TabWrapped tab preview';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tab = await getTabShareMetadata(id);

  const title = tab?.title ?? 'TabWrapped';
  const subtitle = tab?.description || tab?.eyebrow || 'Split checks and settle up fast.';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #4F46E5 0%, #9333EA 50%, #EC4899 100%)',
          color: 'white',
          padding: '56px 64px',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: 0.95 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: '2px solid rgba(255,255,255,0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 18,
                height: 12,
                border: '2px solid rgba(255,255,255,0.9)',
                borderRadius: 3,
              }}
            />
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>TabWrapped</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              fontSize: 74,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              maxWidth: '100%',
              textWrap: 'balance',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 38,
              lineHeight: 1.2,
              opacity: 0.9,
              maxWidth: '92%',
              textWrap: 'balance',
            }}
          >
            {subtitle}
          </div>
        </div>

        <div style={{ fontSize: 24, opacity: 0.82, letterSpacing: '0.01em' }}>tabwrapped.com</div>
      </div>
    ),
    { ...size }
  );
}
