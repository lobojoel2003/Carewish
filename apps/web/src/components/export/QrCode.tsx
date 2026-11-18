'use client';

import { useMemo } from 'react';
import { qrMatrix, qrPath } from '@/lib/card';

export function QrCode({
  value,
  label,
  className = 'h-36 w-36',
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const { size, d } = useMemo(() => {
    const m = qrMatrix(value);
    return { size: m.size, d: qrPath(m) };
  }, [value]);
  return (
    <svg
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      className={`${className} rounded-lg bg-white`}
      role="img"
      data-url={value}
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <path d={d} fill="#1d2730" />
    </svg>
  );
}
