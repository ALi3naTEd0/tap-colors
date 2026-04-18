import { ImageResponse } from 'next/og'
import fs from 'fs'
import path from 'path'

export const alt = 'Tap Colors — ¡Toca los colores!'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const DOTS = ['#FF4B4B', '#FBBF24', '#22C55E', '#F97316', '#A855F7', '#EC4899', '#3B82F6']

function getIconBase64() {
  const buf = fs.readFileSync(path.join(process.cwd(), 'public/icon-192.png'))
  return `data:image/png;base64,${buf.toString('base64')}`
}

export default function Image() {
  const iconSrc = getIconBase64()

  return new ImageResponse(
    (
      <div style={{
        width: 1200,
        height: 630,
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        fontFamily: 'sans-serif',
      }}>
        {/* Logo + title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconSrc} width={140} height={140} alt="logo" style={{ borderRadius: 32 }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{
              fontSize: 104,
              fontWeight: 900,
              color: '#111827',
              letterSpacing: '-3px',
              lineHeight: 1,
            }}>
              Tap Colors
            </div>
            <div style={{
              fontSize: 36,
              fontWeight: 600,
              color: '#d1d5db',
            }}>
              ¡Toca los colores!
            </div>
          </div>
        </div>

        {/* Color dots */}
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          {DOTS.map((hex, i) => (
            <div key={hex} style={{
              width:  i === 3 ? 64 : 52,
              height: i === 3 ? 64 : 52,
              borderRadius: '50%',
              background: hex,
              opacity: 0.88,
            }} />
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
