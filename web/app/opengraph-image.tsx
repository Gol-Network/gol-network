import { ImageResponse } from 'next/og';

export const alt =
  'Gol: one account for bounded agents, with a record of allowed and refused actions';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: 'stretch',
        background: '#f7f9fc',
        color: '#101318',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'space-between',
        padding: '72px',
        width: '100%',
      }}
    >
      <div style={{ color: '#2463eb', fontSize: '32px', fontWeight: 700, letterSpacing: '-1px' }}>
        GOL
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <div
          style={{
            fontSize: '68px',
            fontWeight: 700,
            letterSpacing: '-3px',
            lineHeight: 1,
            maxWidth: '980px',
          }}
        >
          Limits an agent can ask to cross, but cannot override.
        </div>
        <div style={{ color: '#2463eb', fontSize: '30px', fontWeight: 600 }}>
          Not just what happened. What was stopped.
        </div>
      </div>
      <div
        style={{
          borderTop: '2px solid #dfe5ef',
          color: '#6d7583',
          display: 'flex',
          fontSize: '22px',
          justifyContent: 'space-between',
          paddingTop: '28px',
        }}
      >
        <span>Proposed product vision</span>
        <span>Arc testnet prototype available</span>
      </div>
    </div>,
    size,
  );
}
