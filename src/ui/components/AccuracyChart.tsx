import type { TestRecord } from '../../types/engine';

export function AccuracyChart({ tests }: { tests: TestRecord[] }) {
  const data = tests.slice(-50);
  if (data.length < 2) return <p className="muted small center">完成兩次或以上測試後會顯示進步曲線。</p>;
  const W = 320;
  const H = 120;
  const P = 22;
  const x = (i: number) => P + (i / (data.length - 1)) * (W - P - 8);
  const y = (acc: number) => 8 + (1 - acc) * (H - 8 - P);
  const pts = data.map((t, i) => `${x(i).toFixed(1)},${y(t.total ? t.correct / t.total : 0).toFixed(1)}`).join(' ');
  const last = data[data.length - 1];
  const lastAcc = last.total ? Math.round((last.correct / last.total) * 100) : 0;
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`最近 ${data.length} 次測試正確率曲線，最近一次 ${lastAcc}%`}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={P} x2={W - 8} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={P - 4} y={y(v) + 3} className="chart-axis" textAnchor="end">
              {v * 100}
            </text>
          </g>
        ))}
        <polyline points={pts} className="chart-line" fill="none" />
        {data.map((t, i) => (
          <circle key={i} cx={x(i)} cy={y(t.total ? t.correct / t.total : 0)} r={i === data.length - 1 ? 3.5 : 2} className="chart-dot" />
        ))}
      </svg>
      <figcaption className="muted small">最近 {data.length} 次正確率（%）</figcaption>
    </figure>
  );
}
