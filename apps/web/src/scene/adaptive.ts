/**
 * Adaptive resolution (iteration 48). If the frame rate stays low (a weak or software-rendered GPU, a laptop
 * on battery), render fewer pixels; when it recovers, step back up. Measured over windows of about two
 * seconds, with hysteresis: one slow window steps down, three good windows in a row step up, so a single
 * hitch (loading a model) can't make the picture pump. It never locks at the bottom.
 */
export const ADAPT = {
  /** Seconds of frames per decision. */
  window: 2,
  /** Below this average, step down. */
  slowFps: 45,
  /** At or above this average for `goodWindows` windows in a row, step up. */
  goodFps: 55,
  goodWindows: 3,
  step: 0.05,
  min: 0.35,
};

export interface AdaptState {
  scale: number;
  goodStreak: number;
}

/** The next resolution scale after one measuring window with this average frame rate. */
export function adapt(state: AdaptState, fps: number, max: number): AdaptState {
  // Above 1 (a high-density screen on High), bigger steps: from 2 down to 1 takes a few windows, not twenty.
  const step = state.scale > 1 ? Math.max(ADAPT.step, round(state.scale * 0.12)) : ADAPT.step;
  if (fps < ADAPT.slowFps) return { scale: Math.max(ADAPT.min, round(state.scale - step)), goodStreak: 0 };
  if (fps < ADAPT.goodFps) return { scale: state.scale, goodStreak: 0 };
  const goodStreak = state.goodStreak + 1;
  if (goodStreak >= ADAPT.goodWindows && state.scale < max) return { scale: Math.min(max, round(state.scale + ADAPT.step)), goodStreak: 0 };
  return { scale: state.scale, goodStreak };
}

const round = (x: number) => Math.round(x * 100) / 100;

/**
 * Automatic quality (iteration 54): two measuring windows in a row under this frame rate step the graphics
 * quality down one level (High → Medium → Low), unless the player chose a quality themselves. Fewer pixels
 * alone can't rescue a GPU that struggles with the shadows and the ambient occlusion.
 */
export const QUALITY_DOWN_FPS = 30;

export function qualityStep(slowStreak: number, fps: number): { slowStreak: number; down: boolean } {
  if (fps >= QUALITY_DOWN_FPS) return { slowStreak: 0, down: false };
  const n = slowStreak + 1;
  return n >= 2 ? { slowStreak: 0, down: true } : { slowStreak: n, down: false };
}
