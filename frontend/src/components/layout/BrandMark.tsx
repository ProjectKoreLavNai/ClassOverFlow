import React from 'react';

// A class register whose last line runs out of the box: ClassOverflow.
export const BrandMark: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2.75" y="3.75" width="14.5" height="16.5" rx="2.5" stroke="var(--text)" strokeWidth="1.6" />
    <path d="M6.5 8.75h7M6.5 12.25h7" stroke="var(--text)" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M6.5 15.75h15" stroke="var(--data)" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
