import { useId } from 'react';

export type FighterKind = 'hero' | 'bandit' | 'saber' | 'sword' | 'shadow' | 'boss';
export type FighterAnim = 'idle' | 'attack' | 'hurt' | 'dead' | 'special' | 'win';

interface Props {
  kind: FighterKind;
  anim: FighterAnim;
  /** changes to restart the same animation */
  animKey?: number;
  side: 'left' | 'right';
  label: string;
}

const INK = 'var(--ink)';
const PAPER = 'var(--paper)';

function Weapon({ kind }: { kind: FighterKind }) {
  switch (kind) {
    case 'hero':
    case 'sword':
      return (
        <g>
          <line x1="86" y1="66" x2="117" y2="30" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="84" y1="60" x2="93" y2="69" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          {kind === 'hero' && <path d="M85 68 q-4 8 -1 14" stroke="var(--seal)" strokeWidth="1.6" fill="none" />}
        </g>
      );
    case 'bandit':
      return <line x1="88" y1="66" x2="112" y2="26" stroke={INK} strokeWidth="7" strokeLinecap="round" />;
    case 'saber':
      return (
        <g>
          <path d="M88 64 Q104 42 118 28 Q112 50 94 68 Z" fill={INK} />
          <line x1="84" y1="62" x2="92" y2="70" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        </g>
      );
    case 'shadow':
      return <path d="M88 64 L106 54 L90 68 Z" fill={INK} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />;
    case 'boss':
      return (
        <g>
          <line x1="96" y1="12" x2="88" y2="152" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <path d="M95 18 Q114 22 116 40 Q106 34 94 36 Z" fill={INK} />
          <path d="M95 18 Q80 22 80 34 Q88 30 94 32 Z" fill={INK} opacity="0.8" />
        </g>
      );
  }
}

function Headwear({ kind }: { kind: FighterKind }) {
  switch (kind) {
    case 'hero':
      return (
        <g>
          <path d="M52 34 Q40 42 26 38 Q38 36 46 30" stroke="var(--seal)" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M37 33 L60 17 L83 33 Q60 30 37 33 Z" fill="var(--wash)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        </g>
      );
    case 'bandit':
      return (
        <g>
          <path d="M50 33 L70 32" stroke="var(--rust)" strokeWidth="5" strokeLinecap="round" />
          <path d="M50 33 q-8 2 -12 8 M50 33 q-6 -2 -11 0" stroke="var(--rust)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M53 44 Q60 56 68 44" fill={INK} />
        </g>
      );
    case 'saber':
      return <circle cx="58" cy="25" r="4.5" fill={INK} />;
    case 'sword':
      return (
        <g>
          <path d="M56 28 L62 22 L66 28" fill={INK} />
          <path d="M54 30 Q42 34 34 46" stroke={INK} strokeWidth="1.6" fill="none" />
        </g>
      );
    case 'shadow':
      return (
        <g>
          <circle cx="60" cy="38" r="11" fill={INK} />
          <rect x="58" y="35" width="10" height="2.6" rx="1.3" fill={PAPER} />
          <path d="M50 40 Q40 46 36 58" stroke={INK} strokeWidth="2.4" fill="none" />
        </g>
      );
    case 'boss':
      return (
        <g>
          <path d="M50 30 L54 20 L60 27 L66 19 L70 30 Z" fill="var(--seal)" stroke={INK} strokeWidth="1.5" />
          <path d="M52 44 Q60 62 69 44 Q60 50 52 44 Z" fill={INK} />
        </g>
      );
  }
}

const ROBE: Record<FighterKind, string> = {
  hero: 'var(--robe-hero)',
  bandit: 'var(--robe-bandit)',
  saber: 'var(--robe-saber)',
  sword: 'var(--robe-sword)',
  shadow: 'var(--ink)',
  boss: 'var(--robe-boss)',
};

export function Fighter({ kind, anim, animKey = 0, side, label }: Props) {
  const fid = useId().replace(/:/g, '');
  const scale = kind === 'boss' ? 1.22 : 1;
  const sash = kind === 'hero' || kind === 'boss' ? 'var(--seal)' : kind === 'shadow' ? '#333' : 'var(--ink-soft)';
  return (
    <div className={`fighter fighter-${side} fighter-${kind}`} role="img" aria-label={label}>
      <div key={`${anim}-${animKey}`} className={`fighter-body anim-${anim}`}>
        <svg viewBox="0 0 120 160" width="100%" height="100%" aria-hidden="true">
          <defs>
            <filter id={`ink-${fid}`} x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed={kind.length} result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
          <ellipse cx="60" cy="153" rx="34" ry="5" fill={INK} opacity="0.18" />
          <g
            filter={`url(#ink-${fid})`}
            transform={`${side === 'right' ? 'translate(120 0) scale(-1 1)' : ''} translate(60 152) scale(${scale}) translate(-60 -152)`}
          >
            {/* legs */}
            <path d="M56 112 L44 150 L36 151" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M64 112 L80 150 L88 151" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {/* back arm */}
            <path d="M52 58 Q38 74 42 92" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round" />
            {/* robe */}
            <path d="M50 50 Q45 86 38 120 Q60 124 82 120 Q75 86 70 50 Q60 46 50 50 Z" fill={ROBE[kind]} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M60 50 L56 86" stroke={INK} strokeWidth="1.2" opacity="0.6" />
            {kind === 'boss' && <path d="M46 52 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l2 6" stroke={INK} strokeWidth="2.5" fill="none" />}
            {/* sash */}
            <path d="M46 82 L74 81 L73 88 L47 89 Z" fill={sash} />
            <path d="M48 88 q-4 10 -8 14" stroke={sash} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            {/* weapon + front arm */}
            <Weapon kind={kind} />
            <path d="M67 57 Q80 64 88 64" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round" />
            <circle cx="88" cy="64" r="3.2" fill={INK} />
            {/* head */}
            {kind !== 'shadow' && <circle cx="60" cy="38" r="10.5" fill="var(--face)" stroke={INK} strokeWidth="2.4" />}
            {kind !== 'shadow' && <path d="M64 36 l3 0" stroke={INK} strokeWidth="2" strokeLinecap="round" />}
            <Headwear kind={kind} />
          </g>
        </svg>
      </div>
    </div>
  );
}
