/**
 * Sound effects and haptic feedback for scoring events.
 * Uses Web Audio API for programmatic sound synthesis.
 * No external audio files needed.
 */

export enum SoundType {
  RAID_POINT = 'RAID_POINT',
  BONUS_POINT = 'BONUS_POINT',
  TACKLE = 'TACKLE',
  SUPER_TACKLE = 'SUPER_TACKLE',
  SUPER_RAID = 'SUPER_RAID',
  ALL_OUT = 'ALL_OUT',
  EMPTY_RAID = 'EMPTY_RAID',
  DO_OR_DIE = 'DO_OR_DIE',
  MATCH_END = 'MATCH_END',
  WHISTLE = 'WHISTLE',
  RAID_TIME_EXPIRED = 'RAID_TIME_EXPIRED',
  RAID_GAP_WARNING = 'RAID_GAP_WARNING',
  FIVE_MINUTE_WARNING = 'FIVE_MINUTE_WARNING',
  HALF_END = 'HALF_END',
}

// Check if sound is enabled
function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('kabaddi-sound-enabled') !== 'false';
}

// Check if vibration is enabled
function isVibrationEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('kabaddi-vibration-enabled') !== 'false';
}

// Get or create AudioContext (lazy singleton)
let audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** Play a synthesized tone */
function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.3,
  startTime?: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime ?? ctx.currentTime);
  gain.gain.setValueAtTime(volume, startTime ?? ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, (startTime ?? ctx.currentTime) + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime ?? ctx.currentTime);
  osc.stop((startTime ?? ctx.currentTime) + duration);
}

/** Play a frequency sweep */
function playSweep(
  ctx: AudioContext,
  startFreq: number,
  endFreq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume: number = 0.3,
  startTime?: number,
) {
  const t = startTime ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, t);
  osc.frequency.linearRampToValueAtTime(endFreq, t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration);
}

/** Play sound for a given event type */
export function playSound(type: SoundType): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const t = ctx.currentTime;

  switch (type) {
    case SoundType.RAID_POINT:
      // Short ascending tone (440Hz → 660Hz, 150ms)
      playSweep(ctx, 440, 660, 0.15, 'sine', 0.25);
      break;

    case SoundType.BONUS_POINT:
      // Quick high ping (880Hz, 100ms)
      playTone(ctx, 880, 0.1, 'sine', 0.2);
      break;

    case SoundType.TACKLE:
      // Descending tone (440Hz → 220Hz, 200ms)
      playSweep(ctx, 440, 220, 0.2, 'sawtooth', 0.2);
      break;

    case SoundType.SUPER_TACKLE:
      // Descending + ascending sweep (200ms)
      playSweep(ctx, 440, 220, 0.1, 'sawtooth', 0.2);
      playSweep(ctx, 220, 660, 0.1, 'sine', 0.25);
      break;

    case SoundType.SUPER_RAID:
      // Triumphant ascending scale (3 notes, 300ms total)
      playTone(ctx, 440, 0.1, 'sine', 0.25, t);
      playTone(ctx, 550, 0.1, 'sine', 0.25, t + 0.1);
      playTone(ctx, 660, 0.1, 'sine', 0.3, t + 0.2);
      break;

    case SoundType.ALL_OUT:
      // Low boom + high ring (200ms)
      playTone(ctx, 110, 0.15, 'sawtooth', 0.3, t);
      playTone(ctx, 880, 0.15, 'sine', 0.2, t + 0.05);
      break;

    case SoundType.EMPTY_RAID:
      // Short low blip (330Hz, 80ms)
      playTone(ctx, 330, 0.08, 'sine', 0.15);
      break;

    case SoundType.DO_OR_DIE:
      // Urgent triple beep — high intensity (3x 660Hz, 400ms total)
      playTone(ctx, 660, 0.1, 'square', 0.25, t);
      playTone(ctx, 660, 0.1, 'square', 0.25, t + 0.13);
      playTone(ctx, 880, 0.15, 'square', 0.3, t + 0.26);
      break;

    case SoundType.MATCH_END:
      // Long descending whistle (500ms)
      playSweep(ctx, 880, 220, 0.5, 'sine', 0.25);
      break;

    case SoundType.WHISTLE:
      // Quick referee whistle sound (600Hz trill, 300ms)
      for (let i = 0; i < 6; i++) {
        playTone(ctx, 600 + (i % 2) * 100, 0.05, 'sine', 0.2, t + i * 0.05);
      }
      break;

    case SoundType.RAID_TIME_EXPIRED:
      // Buzzing alarm — raider ran out of 30s (2 low buzzer tones)
      playTone(ctx, 220, 0.15, 'sawtooth', 0.3, t);
      playTone(ctx, 220, 0.15, 'sawtooth', 0.3, t + 0.2);
      break;

    case SoundType.RAID_GAP_WARNING:
      // Attention alert — auto-pause triggered (double beep)
      playTone(ctx, 600, 0.15, 'sine', 0.3, t);
      playTone(ctx, 700, 0.2, 'sine', 0.35, t + 0.2);
      break;

    case SoundType.FIVE_MINUTE_WARNING:
      // Urgent chime pattern — 5 minutes left! (3 ascending notes)
      playTone(ctx, 523, 0.15, 'sine', 0.3, t);
      playTone(ctx, 659, 0.15, 'sine', 0.3, t + 0.18);
      playTone(ctx, 784, 0.25, 'sine', 0.35, t + 0.36);
      break;

    case SoundType.HALF_END:
      // Full whistle blast — half/match time complete (long trill + descending)
      for (let i = 0; i < 10; i++) {
        playTone(ctx, 700 + (i % 2) * 150, 0.06, 'sine', 0.25, t + i * 0.06);
      }
      playSweep(ctx, 880, 330, 0.4, 'sine', 0.2, t + 0.6);
      break;
  }
}

/** Trigger vibration pattern on supported devices */
export function vibrate(pattern: number | number[]): void {
  if (!isVibrationEnabled()) return;
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Vibration not supported or failed
  }
}

/** Get vibration pattern for event type */
function getVibrationPattern(type: SoundType): number | number[] {
  switch (type) {
    case SoundType.RAID_POINT:
      return [50];
    case SoundType.BONUS_POINT:
      return [30];
    case SoundType.TACKLE:
      return [100];
    case SoundType.SUPER_TACKLE:
      return [100, 50, 100];
    case SoundType.SUPER_RAID:
      return [50, 50, 50, 50, 100];
    case SoundType.ALL_OUT:
      return [200, 100, 200];
    case SoundType.EMPTY_RAID:
      return [20];
    case SoundType.DO_OR_DIE:
      return [100, 50, 100, 50, 150];
    case SoundType.MATCH_END:
      return [300, 100, 300];
    case SoundType.WHISTLE:
      return [50, 50, 50];
    case SoundType.RAID_TIME_EXPIRED:
      return [150, 50, 150];
    case SoundType.RAID_GAP_WARNING:
      return [100, 50, 200];
    case SoundType.FIVE_MINUTE_WARNING:
      return [100, 50, 100, 50, 200];
    case SoundType.HALF_END:
      return [200, 100, 200, 100, 300];
    default:
      return [50];
  }
}

/** Trigger both sound and vibration feedback */
export function triggerFeedback(type: SoundType): void {
  playSound(type);
  vibrate(getVibrationPattern(type));
}

/** Check if sound is currently enabled */
export function getSoundEnabled(): boolean {
  return isSoundEnabled();
}

/** Set sound enabled state */
export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('kabaddi-sound-enabled', String(enabled));
}

/** Check if vibration is currently enabled */
export function getVibrationEnabled(): boolean {
  return isVibrationEnabled();
}

/** Set vibration enabled state */
export function setVibrationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('kabaddi-vibration-enabled', String(enabled));
}
