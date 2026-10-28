import React from 'react';
import { PasswordStrengthFilter } from '../../patterns/chain-of-responsibility';

interface Props {
  password: string;
}

export const PasswordStrengthMeter: React.FC<Props> = ({ password }) => {
  const analysis = PasswordStrengthFilter.evaluate(password);

  const getSegmentClass = (segIndex: number) => {
    if (!password) return 'bg-border';
    if (analysis.strength === 'weak') {
      return segIndex === 0 ? 'bg-danger' : 'bg-border';
    }
    if (analysis.strength === 'medium') {
      return segIndex <= 1 ? 'bg-accent' : 'bg-border';
    }
    return 'bg-success';
  };

  const getLabel = () => {
    if (!password) return 'Min 8 chars, uppercase & numbers';
    if (analysis.strength === 'weak') return 'Weak Entropy (Add uppercase or numbers)';
    if (analysis.strength === 'medium') return 'Moderate Strength (Include special characters)';
    return 'Strong Scholarly Passphrase';
  };

  return (
    <div style={{ marginTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div style={{ display: 'flex', gap: '4px', height: '4px', width: '100%', borderRadius: '999px', overflow: 'hidden' }}>
        <div
          style={{
            flex: 1,
            transition: 'background-color 0.25s',
            background: getSegmentClass(0) === 'bg-danger' ? 'var(--color-accent-secondary)' :
                        getSegmentClass(0) === 'bg-accent' ? 'var(--color-accent)' :
                        getSegmentClass(0) === 'bg-success' ? 'var(--color-success)' : 'var(--color-border)'
          }}
        />
        <div
          style={{
            flex: 1,
            transition: 'background-color 0.25s',
            background: getSegmentClass(1) === 'bg-accent' ? 'var(--color-accent)' :
                        getSegmentClass(1) === 'bg-success' ? 'var(--color-success)' : 'var(--color-border)'
          }}
        />
        <div
          style={{
            flex: 1,
            transition: 'background-color 0.25s',
            background: getSegmentClass(2) === 'bg-success' ? 'var(--color-success)' : 'var(--color-border)'
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontFamily: 'var(--font-display)', color: 'var(--color-muted-foreground)' }}>
        <span>{getLabel()}</span>
        <span style={{ fontStyle: 'italic' }}>Chain of Resp. Gate 3</span>
      </div>
    </div>
  );
};
