'use client';

import { useState } from 'react';
import { explorerAddress, shorten } from './world';

/** Mock address chip: copy plus a Basescan link. Mirrors the Arc dashboard chip. */
export function AddressChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="address-chip">
      <code title={value}>{shorten(value)}</code>
      <button
        type="button"
        aria-label={`Copy address ${value}`}
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1_500);
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <a href={explorerAddress(value)} target="_blank" rel="noreferrer">
        Basescan ↗
      </a>
    </span>
  );
}
