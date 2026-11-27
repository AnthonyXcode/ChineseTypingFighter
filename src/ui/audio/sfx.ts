import { useApp } from '../store';

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!useApp.getState().settings.soundOn) return null;
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slideTo?: number } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.2, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain = 0.25, delay = 0, lowpass = 1800) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}

export const sfx = {
  correct() {
    tone(660, 0.12, { type: 'triangle' });
    tone(990, 0.16, { type: 'triangle', delay: 0.08 });
  },
  wrong() {
    tone(220, 0.25, { type: 'sawtooth', gain: 0.08, slideTo: 140 });
  },
  hit() {
    noise(0.12, 0.35, 0, 2600);
    tone(180, 0.12, { type: 'square', gain: 0.08, slideTo: 80 });
  },
  hurt() {
    noise(0.22, 0.3, 0, 700);
    tone(140, 0.3, { type: 'sawtooth', gain: 0.1, slideTo: 60 });
  },
  combo() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', delay: i * 0.07, gain: 0.15 }));
    noise(0.4, 0.15, 0.25, 5000);
  },
  click() {
    tone(880, 0.05, { type: 'sine', gain: 0.06 });
  },
  victory() {
    [392, 523, 659, 784].forEach((f, i) => tone(f, 0.3, { type: 'triangle', delay: i * 0.12, gain: 0.15 }));
  },
  defeat() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, { type: 'sine', delay: i * 0.15, gain: 0.12 }));
  },
};
