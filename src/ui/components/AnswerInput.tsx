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
  label?: string;
  status?: 'ok' | 'bad' | null;
  autoFocus?: boolean;
}

export function AnswerInput({ value, onChange, onSubmit, system, onHint, onEscape, disabled, label, status, autoFocus = true }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
  }, [autoFocus, disabled]);

  const placeholder = system === 'pinyin' ? '例：zhong1guo2' : '例：gwong2dung1';
  const lbl = label ?? (system === 'pinyin' ? '輸入拼音（數字標調）' : '輸入粵拼（聲調 1–6）');
  return (
    <div className={`answer-input ${status ?? ''}`}>
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
          placeholder={placeholder}
          aria-invalid={status === 'bad' ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (value.trim()) onSubmit(value);
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
        disabled={disabled || !value.trim()}
        onClick={() => {
          onSubmit(value);
          ref.current?.focus();
        }}
      >
        確定 <kbd>Enter</kbd>
      </button>
    </div>
  );
}
