import { useEffect, type RefObject } from 'react';

const KB_MIN = 120; // px of viewport loss before we treat it as an on-screen keyboard
const GAP = 8; // breathing room between the card's bottom border and the keyboard

/**
 * Mobile on-screen keyboard handling.
 *
 * While an <input> inside `ref` has focus and the on-screen keyboard is open, scroll the page so the
 * bottom border of `ref` sits right above the keyboard (the whole card stays visible).
 *
 * Uses the VisualViewport API (iOS Safari, Android Chrome): the keyboard shrinks the visual viewport,
 * not the layout viewport. Also exposes the keyboard height as the CSS variable `--kb` and toggles the
 * `kb-open` class on <html>, so layouts can add scroll room / compact themselves.
 */
export function useKeyboardAlign(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!active || !vv) return;
    const root = document.documentElement;
    let raf = 0;

    const focusedInside = () => {
      const el = ref.current;
      const f = document.activeElement;
      return !!el && f instanceof HTMLInputElement && el.contains(f);
    };

    const align = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        const open = kb >= KB_MIN && focusedInside();
        root.classList.toggle('kb-open', open);
        root.style.setProperty('--kb', open ? `${kb}px` : '0px');
        if (!open) return;
        // second frame: let the kb-open layout (extra scroll room, compact arena) apply first
        raf = requestAnimationFrame(() => {
          const el = ref.current;
          if (!el) return;
          const visibleBottom = vv.offsetTop + vv.height; // in layout-viewport coordinates
          const delta = el.getBoundingClientRect().bottom - visibleBottom + GAP;
          if (Math.abs(delta) > 2) window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
        });
      });
    };

    // iOS animates the keyboard in and also auto-scrolls the focused input; re-align once it settles.
    let settle = 0;
    const alignSoon = () => {
      align();
      window.clearTimeout(settle);
      settle = window.setTimeout(align, 320);
    };

    // card height changes (feedback / hints appear) while the keyboard is open
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => root.classList.contains('kb-open') && align()) : null;
    if (ref.current && ro) ro.observe(ref.current);

    vv.addEventListener('resize', alignSoon);
    document.addEventListener('focusin', alignSoon);
    document.addEventListener('focusout', alignSoon);
    alignSoon();
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      ro?.disconnect();
      vv.removeEventListener('resize', alignSoon);
      document.removeEventListener('focusin', alignSoon);
      document.removeEventListener('focusout', alignSoon);
      root.classList.remove('kb-open');
      root.style.setProperty('--kb', '0px');
    };
  }, [ref, active]);
}
