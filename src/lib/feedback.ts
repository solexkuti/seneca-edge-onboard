// Soft, premium interaction feedback — sound + optional haptics.
//
// Implementation notes:
// - Uses Web Audio API (no asset files, no network, instant playback).
// - Tones are short (50–120ms), low volume (10–20%), soft sine waves with a
//   gentle exponential fade so there's no harsh click.
// - Audio context is created lazily on the first user gesture (browsers
//   require this) and reused.
// - Calls are throttled to one sound per 150ms to prevent spam during
//   rapid taps.
// - Haptics use the Vibration API when available; safely no-ops otherwise.
//
// Usage:
//   import { playFeedback } from "@/lib/feedback";
//   onClick={() => { playFeedback("tap"); ...your handler }}
//
// Variants:
//   - "tap"     soft generic tap (option select, toggle on)
//   - "press"   slightly firmer CTA press
//   - "step"    forward progression (journal next step)
//   - "back"    reverse progression (journal back)

type FeedbackVariant = "tap" | "press" | "step" | "back";

type ToneSpec = {
  frequency: number; // Hz
  duration: number;  // seconds
  gain: number;      // 0..1 peak gain (kept ≤ 0.2 for soft volume)
  type?: OscillatorType;
  haptic?: number;   // ms vibration
};

const TONES: Record<FeedbackVariant, ToneSpec> = {
  tap:   { frequency: 880, duration: 0.06, gain: 0.10, type: "sine", haptic: 8 },
  press: { frequency: 660, duration: 0.09, gain: 0.14, type: "sine", haptic: 12 },
  step:  { frequency: 740, duration: 0.08, gain: 0.12, type: "sine", haptic: 10 },
  back:  { frequency: 520, duration: 0.07, gain: 0.10, type: "sine", haptic: 8 },
};

const THROTTLE_MS = 150;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let lastPlayedAt = 0;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);
    return ctx;
  } catch {
    return null;
  }
}

/** Mute / unmute all interaction feedback (e.g. for a settings toggle). */
export function setFeedbackEnabled(on: boolean) {
  enabled = on;
}

/** Play a soft interaction tone + light haptic. Throttled to 150ms. */
export function playFeedback(variant: FeedbackVariant = "tap") {
  if (!enabled) return;
  if (typeof window === "undefined") return;

  const now = performance.now();
  if (now - lastPlayedAt < THROTTLE_MS) return;
  lastPlayedAt = now;

  const audio = getCtx();
  if (!audio || !masterGain) {
    // Audio unavailable — still attempt haptic.
    tryHaptic(TONES[variant].haptic);
    return;
  }

  // Some browsers start the context in "suspended" state until a gesture.
  if (audio.state === "suspended") {
    audio.resume().catch(() => {});
  }

  const spec = TONES[variant];
  const t0 = audio.currentTime;
  const t1 = t0 + spec.duration;

  try {
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = spec.type ?? "sine";
    osc.frequency.setValueAtTime(spec.frequency, t0);

    // Gentle attack (avoid click), short body, soft exponential release.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(spec.gain, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(t0);
    osc.stop(t1 + 0.02);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* ignore audio errors */
  }

  tryHaptic(spec.haptic);
}

function tryHaptic(ms?: number) {
  if (!ms) return;
  try {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (nav && typeof nav.vibrate === "function") {
      nav.vibrate(ms);
    }
  } catch {
    /* ignore */
  }
}
