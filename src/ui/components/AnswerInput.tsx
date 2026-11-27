import { useEffect, useRef } from 'react';
import type { RomanSystem } from '../../types/engine';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  system: RomanSystem;
  onHint?: () => void;
  onEscape?: () => void;
  disabled?: boolean;
  /** temporarily not accepting answers (e.g. during an attack animation); keeps focus, shows a notice */
  locked?: boolean;
  label?: string;
  status?: 'ok' | 'bad' | null;
  autoFocus?: boolean;
}

export function AnswerInput({ value, onChange, onSubmit, system, onHint, onEscape, disabled, locked = false, label, status, autoFocus = true }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
  }, [autoFocus, disabled]);

  // Esc pauses even when focus is elsewhere on the screen (the input's own handler covers the focused case).
  useEffect(() => {
    if (!onEscape || disabled) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.target === ref.current) return;
      if (document.querySelector('.overlay')) return; // an open dialog owns Esc
      e.preventDefault();
      onEscape();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onEscape, disabled]);

  const placeholder = system === 'pinyin' ? '例：zhong1guo2' : '例：gwong2dung1';
  const lbl = label ?? (system === 'pinyin' ? '輸入拼音（數字標調）' : '輸入粵拼（聲調 1–6）');
  return (
    <div className={`answer-input ${status ?? ''} ${locked ? 'locked' : ''}`}>
      <label className="answer-label">
        <span>{lbl}</span>
        <input
          ref={ref}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          disabled={disabled}
          readOnly={locked}
          aria-busy={locked || undefined}
          placeholder={locked ? '出招中，請稍候…' : placeholder}
          aria-invalid={status === 'bad' ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (value.trim() && !locked) onSubmit(value);
            } else if (e.key === 'Tab' && onHint && !e.shiftKey) {
              e.preventDefault();
              onHint();
            } else if (e.key === 'Escape' && onEscape) {
              e.preventDefault();
              // keep this keydown from reaching the pause overlay's window listener once it mounts
              e.stopPropagation();
              onEscape();
            }
          }}
        />
      </label>
      <button
        type="button"
        className="btn btn-primary answer-submit"
        disabled={disabled || locked || !value.trim()}
        onClick={() => {
          onSubmit(value);
          ref.current?.focus();
        }}
      >
        {locked ? '出招中…' : <>確定 <kbd>Enter</kbd></>}
      </button>
    </div>
  );
}
