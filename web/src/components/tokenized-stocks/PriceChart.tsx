'use client';

import { useId, useMemo } from 'react';
import { usd } from './world';

interface PriceChartProps {
  values: number[];
  variant?: 'full' | 'spark';
}

const WIDTH = 100;
const HEIGHT = 100;

/** Hand-rolled SVG line/area chart. No chart library, no network, pure geometry from the series. */
export function PriceChart({ values, variant = 'full' }: PriceChartProps) {
  const gradientId = useId();
  const geometry = useMemo(() => build(values), [values]);
  if (!geometry) return null;

  const rising = geometry.last >= geometry.first;
  const stroke = rising ? 'var(--green)' : 'var(--coral)';

  if (variant === 'spark') {
    return (
      <svg
        className="spark"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={geometry.line} fill="none" stroke={stroke} strokeWidth={3} vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  return (
    <figure className="price-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Price history">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={geometry.area} fill={`url(#${gradientId})`} stroke="none" />
        <path
          d={geometry.line}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={geometry.lastPoint.x} cy={geometry.lastPoint.y} r={2.4} fill={stroke} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption>
        <span>{usd(geometry.min)}</span>
        <span>{usd(geometry.max)}</span>
      </figcaption>
    </figure>
  );
}

interface Geometry {
  line: string;
  area: string;
  min: number;
  max: number;
  first: number;
  last: number;
  lastPoint: { x: number; y: number };
}

function build(values: number[]): Geometry | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || max || 1;
  const stepX = WIDTH / (values.length - 1);
  const points = values.map((value, index) => ({
    x: index * stepX,
    y: HEIGHT - ((value - min) / span) * (HEIGHT * 0.9) - HEIGHT * 0.05,
  }));
  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  const area = `${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`;
  return {
    line,
    area,
    min,
    max,
    first: values[0]!,
    last: values[values.length - 1]!,
    lastPoint: points[points.length - 1]!,
  };
}
