import { ImageResponse } from 'next/og';

export const alt = 'Hush — Where Connections Become Extraordinary';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Uses the built-in default font so the image never depends on a network fetch.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          backgroundColor: '#0A0A0F',
          backgroundImage:
            'radial-gradient(circle at 18% 22%, rgba(220,20,60,0.35) 0%, rgba(10,10,15,0) 45%), radial-gradient(circle at 85% 85%, rgba(212,175,55,0.18) 0%, rgba(10,10,15,0) 40%)',
          color: 'white',
          fontFamily: 'serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #DC143C, #8F0D25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            H
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: 14 }}>HUSH</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1.05, display: 'flex', flexWrap: 'wrap' }}>
            <span>Where Connections Become&nbsp;</span>
            <span style={{ color: '#FF4D6D' }}>Extraordinary</span>
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: 'rgba(255,255,255,0.75)', fontFamily: 'sans-serif' }}>
            Private dating for singles &amp; couples in South Africa
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, fontSize: 24, fontFamily: 'sans-serif' }}>
          {['Photo-verified', 'Discreet by design', '18+ only'].map((t) => (
            <div
              key={t}
              style={{
                display: 'flex',
                padding: '10px 22px',
                borderRadius: 999,
                border: '1px solid rgba(212,175,55,0.5)',
                color: '#D4AF37',
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
