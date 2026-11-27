export function HpBar({ hp, max, label, side }: { hp: number; max: number; label: string; side: 'left' | 'right' }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  return (
    <div className={`hpbar hpbar-${side}`}>
      <div className="hpbar-label">{label}</div>
      <div
        className="hpbar-track"
        role="progressbar"
        aria-label={`${label} 血量`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.max(0, Math.round(hp))}
      >
        <div className="hpbar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Hearts({ n, max }: { n: number; max: number }) {
  return (
    <div className="hearts" aria-label={`生命 ${n} / ${max}`} role="img">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? 'heart on' : 'heart off'} aria-hidden="true">
          {i < n ? '♥' : '♡'}
        </span>
      ))}
    </div>
  );
}
