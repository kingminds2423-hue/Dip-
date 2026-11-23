import React from 'react';

interface OfficialRoundSealProps {
  topText: string;
  centerTop: string;
  centerBottom: string;
  bottomText: string;
  colorScheme?: 'emerald' | 'indigo' | 'amber' | 'purple' | 'slate';
  size?: 'sm' | 'md';
}

const COLOR_MAP = {
  emerald: {
    ring: '#047857',
    bg: 'rgba(16, 185, 129, 0.06)',
    text: '#065f46'
  },
  indigo: {
    ring: '#4338ca',
    bg: 'rgba(99, 102, 241, 0.07)',
    text: '#312e81'
  },
  amber: {
    ring: '#b45309',
    bg: 'rgba(245, 158, 11, 0.07)',
    text: '#78350f'
  },
  purple: {
    ring: '#6d28d9',
    bg: 'rgba(139, 92, 246, 0.07)',
    text: '#4c1d95'
  },
  slate: {
    ring: '#1e293b',
    bg: 'rgba(30, 41, 59, 0.06)',
    text: '#0f172a'
  }
};

export const OfficialRoundSeal: React.FC<OfficialRoundSealProps> = ({
  topText,
  centerTop,
  centerBottom,
  bottomText,
  colorScheme = 'emerald',
  size = 'md'
}) => {
  const palette = COLOR_MAP[colorScheme];
  const dim = size === 'sm' ? 62 : 76;

  return (
    <div
      className="inline-flex flex-col items-center justify-center rounded-full select-none shrink-0"
      style={{
        width: `${dim}px`,
        height: `${dim}px`,
        border: `2px solid ${palette.ring}`,
        backgroundColor: palette.bg,
        boxShadow: `inset 0 0 0 2px #ffffff, inset 0 0 0 3px ${palette.ring}`,
        color: palette.text,
        transform: 'rotate(-7deg)'
      }}
    >
      <span
        className="font-black uppercase text-center leading-none px-1 truncate max-w-full"
        style={{ fontSize: size === 'sm' ? '5.5px' : '6.5px' }}
      >
        {topText}
      </span>
      <div
        className="w-4/5 my-0.5 border-t border-b py-0.5 text-center font-black leading-tight"
        style={{
          borderColor: palette.ring,
          fontSize: size === 'sm' ? '6.5px' : '7.5px'
        }}
      >
        <div>{centerTop}</div>
        {centerBottom && (
          <div style={{ fontSize: size === 'sm' ? '5.5px' : '6.5px', opacity: 0.9 }}>
            {centerBottom}
          </div>
        )}
      </div>
      <span
        className="font-bold text-center leading-none px-1 truncate max-w-full"
        style={{ fontSize: size === 'sm' ? '5.5px' : '6.5px' }}
      >
        {bottomText}
      </span>
    </div>
  );
};
