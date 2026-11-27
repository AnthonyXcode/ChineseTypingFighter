import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';

export function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  const go = useApp((s) => s.go);
  return (
    <header className="screen-header">
      <button type="button" className="btn btn-ghost back-btn" onClick={onBack ?? (() => go('home'))} aria-label="返回">
        ← 返回
      </button>
      <h1 className="screen-title">{title}</h1>
      <div className="screen-header-right">{right}</div>
    </header>
  );
}

export function Overlay({ children, label, onEscape }: { children: ReactNode; label: string; onEscape?: () => void }) {
  // Element focused before the overlay opened (e.g. the answer input); focus returns there on close.
  const [opener] = useState(() => (typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null));
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = boxRef.current;
    return () => {
      // Defer so StrictMode's simulated unmount (node still attached) doesn't steal focus from the dialog.
      window.setTimeout(() => {
        if (box && !box.isConnected && opener && opener !== document.body && opener.isConnected) opener.focus();
      }, 0);
    };
  }, [opener]);
  useEffect(() => {
    if (!onEscape) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
      }
    };
    // NB: the Esc keydown that opens a pause overlay is still dispatching when React commits it;
    // AnswerInput stops its propagation so it can't reach this listener and close it again.
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onEscape]);
  return (
    <div ref={boxRef} className="overlay" role="dialog" aria-modal="true" aria-label={label}>
      <div className="overlay-card paper">{children}</div>
    </div>
  );
}

export function PauseOverlay({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  return (
    <Overlay label="暫停" onEscape={onResume}>
      <h2 className="seal-title">暫停</h2>
      <div className="stack">
        <button type="button" className="btn btn-primary btn-lg" onClick={onResume} autoFocus>
          繼續 <kbd>Esc</kbd>
        </button>
        <button type="button" className="btn btn-lg" onClick={onQuit}>
          離開
        </button>
      </div>
    </Overlay>
  );
}

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          className={`seg-btn ${o.value === value ? 'on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
      <span className="toggle-text">{checked ? '開' : '關'}</span>
    </button>
  );
}
