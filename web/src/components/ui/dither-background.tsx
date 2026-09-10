'use client';

import Dither from '@/components/ui/dither';

export function DitherBackground({ theme }: { theme: 'dark' | 'light' }) {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-70" aria-hidden>
      <Dither
        waveColor={theme === 'dark' ? [0.08, 0.28, 0.7] : [0.32, 0.53, 0.95]}
        backgroundColor={theme === 'dark' ? [0, 0, 0] : [0.93, 0.95, 0.98]}
        waveAmplitude={0.18}
        waveFrequency={1.45}
        waveSpeed={0.14}
        colorNum={3}
        pixelSize={3}
        enableMouseInteraction={false}
        mouseRadius={0.25}
      />
    </div>
  );
}
